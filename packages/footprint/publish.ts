import { execFile, spawn } from 'node:child_process';
import { access, copyFile, cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const runCommand = promisify(execFile);

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const outputsDirectory = join(packageDirectory, 'outputs');
const publishDirectory = join(packageDirectory, 'publish');

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const scope = process.env.FOOTPRINT_NPM_SCOPE?.trim();
if (!scope) {
  throw new Error(
    'FOOTPRINT_NPM_SCOPE 가 필요합니다. 저장소에 커밋하지 않는 .env 에 FOOTPRINT_NPM_SCOPE=<scope> 를 두세요.',
  );
}
if (!/^[a-z0-9][a-z0-9._-]*$/.test(scope)) {
  throw new Error(`유효하지 않은 스코프입니다: ${JSON.stringify(scope)}`);
}

await runCommand('pnpm', ['build'], { cwd: packageDirectory });

await rm(publishDirectory, { recursive: true, force: true });
await cp(outputsDirectory, publishDirectory, { recursive: true });

// Generate CommonJS type declarations (.d.cts) beside the ESM ones. tsc emits only .d.ts, but the
// `require` conditions below point at .cjs files; with `"type": "module"` a bare .d.ts sibling is
// interpreted as ESM, so `require`-mode type resolution fails — @arethetypeswrong reports it as
// "Masquerading as ESM (FalseESM)" and a CommonJS consumer sees no types. Each .d.cts is the .d.ts
// with its relative import specifiers rewritten from .ts/.js to .cjs, so a declaration's siblings
// resolve to their .d.cts counterparts instead of leaking back into the ESM declaration graph.
const declarations = (await readdir(publishDirectory)).filter((name) => name.endsWith('.d.ts'));
for (const name of declarations) {
  const declaration = await readFile(join(publishDirectory, name), 'utf8');
  const rewritten = declaration.replace(/(from\s+['"]\.\/[^'"]+?)\.(?:ts|js)(['"])/g, '$1.cjs$2');
  await writeFile(join(publishDirectory, name.replace(/\.d\.ts$/, '.d.cts')), rewritten);
}

const source = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
const manifest = {
  name: `@${scope}/footprint`,
  version: source.version,
  description: source.description,
  type: 'module',
  types: './index.d.ts',
  exports: {
    // Default entry (`.`): the side-effectful auto-fire tracker. `import '@scope/footprint'` (or
    // `import { step } from '@scope/footprint'`) both send the automatic pageview and expose step.
    // Dual-published — `import` resolves to the ESM build, `require` to the CJS build, each paired
    // with its own type declarations (.d.ts / .d.cts). `types` MUST be the first key in each
    // condition (resolvers match in order), and the trailing `default` is the fallback for
    // resolvers matching neither `import` nor `require` — it also lets Node's require(ESM) succeed
    // against the ESM file on runtimes that support it.
    '.': {
      import: { types: './index.d.ts', default: './index.js' },
      require: { types: './index.d.cts', default: './index.cjs' },
      default: './index.js',
    },
    // Opt-out entry (`./step`): the pure core with NO import-time side effect. Consumers who want
    // step() without the automatic pageview use `import { step } from '@scope/footprint/step'` (or
    // its CJS `require`). Dual-published for a concrete reason: the CJS consumers who most need an
    // opt-out — SSR and test toolchains — are exactly the ones resolving through `require`, so
    // shipping only the ESM here would strand them on the side-effectful default entry.
    './step': {
      import: { types: './footprint.d.ts', default: './footprint.js' },
      require: { types: './footprint.d.cts', default: './footprint.cjs' },
      default: './footprint.js',
    },
    // Let tooling request the manifest itself; some resolvers ask for it explicitly.
    './package.json': './package.json',
  },
  // Must stay `["./index.js", "./index.cjs"]` — neither `false` nor `true`. Importing this package
  // IS the feature: the index entries call footprint's fireAutoPageview() at load time, and a
  // consumer may `import '@scope/footprint'` for that side effect alone, using no exports at all.
  // BOTH index builds are listed because either the ESM or the CJS entry may be the module a
  // bundler resolves. `sideEffects: false` — the reflexive "optimization" for libraries — declares
  // every module pure and safe to prune when its exports are unused — exactly the situation here —
  // so webpack/Rollup-class bundlers would tree-shake the entire tracker out of production builds
  // and tracking would die with no error anywhere. A blanket `true` errs the other way: it brands
  // every module side-effectful, forbidding bundlers from pruning any of them, including the
  // deliberately pure './step' core (footprint.js / footprint.cjs). The array scopes the
  // declaration to the truth of the code after the index.ts/footprint.ts split: only the index
  // entries have an import-time effect, so they alone are unprunable and everything else stays
  // tree-shakeable. This is the manifest half of the contract documented in index.ts and above
  // fireAutoPageview in footprint.ts. See webpack's tree-shaking guide on the `sideEffects` field:
  // https://webpack.js.org/guides/tree-shaking/
  sideEffects: ['./index.js', './index.cjs'],
  author: source.author,
  license: source.license,
  publishConfig: { access: 'public' },
};
await writeFile(join(publishDirectory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// The committed README documents the package under its unscoped source name (`footprint`) — the
// scope must never appear in a committed file. The published copy is what a consumer reads on the
// registry page after installing the scoped package, so its import examples must name what they
// actually install: rewrite `from 'footprint'` / `from 'footprint/step'` specifiers (and the
// backticked `footprint/step` prose mention) to the scoped name at staging time, exactly like the
// manifest name above. Nothing else is touched — storage keys such as 'footprint:endpoint' and
// plain prose stay verbatim.
const readme = await readFile(join(packageDirectory, 'README.md'), 'utf8');
const scopedReadme = readme
  .replace(/from 'footprint(\/step)?'/g, (_match, subpath: string | undefined) => `from '@${scope}/footprint${subpath ?? ''}'`)
  .replace(/`footprint\/step`/g, `\`@${scope}/footprint/step\``)
  // Strip the repo-development section: it documents building this source tree (pnpm scripts, the
  // outputs/ folder), none of which exists in the installed package — the tarball ships the built
  // files at its root. Leaving it in would point registry readers at paths they don't have.
  .replace(/\n## Development\n[\s\S]*?(?=\n## )/, '\n');
await writeFile(join(publishDirectory, 'README.md'), scopedReadme);

if (await exists(join(packageDirectory, 'LICENSE'))) {
  await copyFile(join(packageDirectory, 'LICENSE'), join(publishDirectory, 'LICENSE'));
}

const willPublish = process.env.FOOTPRINT_PUBLISH === '1';
// npm refuses to publish a prerelease version without an explicit dist-tag, so that a prerelease
// cannot accidentally become `latest`. Our date-based `0.0.0-YYYYMMDD.N` versions ARE the primary
// release line, so `latest` is exactly what we mean — passed explicitly to satisfy that guard
// (and a no-op for non-prerelease versions, where `latest` is the default anyway).
const publishArguments = ['publish', publishDirectory, '--tag', 'latest', ...(willPublish ? [] : ['--dry-run'])];
console.log(`\n[publish] ${manifest.name}@${manifest.version} — ${willPublish ? '실제 게시' : 'dry-run'}\n`);
// The publish step must run with THIS terminal's stdio, not execFile's pipes. npm's account
// security flow (OTP / web authentication) is interactive: on a TTY it prints the authentication
// URL, opens the browser, and waits for approval before uploading. Behind piped stdio npm detects
// no TTY, aborts immediately with EOTP, and even masks the URL in its error output — so the
// publish can never succeed through execFile, no matter where it is launched from. `stdio:
// 'inherit'` hands the terminal through, letting npm drive its auth prompt directly (dry-run is
// unaffected — it needs no auth and simply prints to the same terminal).
await new Promise<void>((resolve, reject) => {
  const child = spawn('npm', publishArguments, { cwd: packageDirectory, stdio: 'inherit' });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`npm publish 가 실패했습니다 (exit ${code})`));
    }
  });
});
