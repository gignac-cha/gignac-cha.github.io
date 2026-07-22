import { execFile } from 'node:child_process';
import { access, copyFile, cp, readFile, rm, writeFile } from 'node:fs/promises';
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

const source = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
const manifest = {
  name: `@${scope}/footprint`,
  version: source.version,
  description: source.description,
  type: 'module',
  types: './index.d.ts',
  exports: {
    // Default entry: the side-effectful auto-fire tracker. `import '@scope/footprint'` (or
    // `import { step } from '@scope/footprint'`) both send the automatic pageview and expose step.
    '.': {
      types: './index.d.ts',
      import: './index.js',
    },
    // Opt-out entry: the pure core with NO import-time side effect. Consumers who want step()
    // without the automatic pageview use `import { step } from '@scope/footprint/step'`.
    './step': {
      types: './footprint.d.ts',
      import: './footprint.js',
    },
  },
  // Must stay exactly `["./index.js"]` — neither `false` nor `true`. Importing this package IS
  // the feature: index.js calls footprint.js's fireAutoPageview() at import time, and a consumer
  // may `import '@scope/footprint'` for that side effect alone, using no exports at all.
  // `sideEffects: false` — the reflexive "optimization" for libraries — declares every module
  // pure and safe to prune when its exports are unused — exactly the situation here — so
  // webpack/Rollup-class bundlers would tree-shake the entire tracker out of production builds
  // and tracking would die with no error anywhere. A blanket `true` errs the other way: it brands
  // every module side-effectful, forbidding bundlers from pruning any of them, including the
  // deliberately pure './step' core. The array scopes the declaration to the truth of the code
  // after the index.ts/footprint.ts split: index.js is the ONLY module with an import-time
  // effect, so it alone is unprunable, and everything else — the './step' core included — stays
  // tree-shakeable. This is the manifest half of the contract documented in index.ts and above
  // fireAutoPageview in footprint.ts.
  // See webpack's tree-shaking guide on the `sideEffects` field:
  // https://webpack.js.org/guides/tree-shaking/
  sideEffects: ['./index.js'],
  author: source.author,
  license: source.license,
  publishConfig: { access: 'public' },
};
await writeFile(join(publishDirectory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

for (const file of ['README.md', 'LICENSE']) {
  if (await exists(join(packageDirectory, file))) {
    await copyFile(join(packageDirectory, file), join(publishDirectory, file));
  }
}

const willPublish = process.env.FOOTPRINT_PUBLISH === '1';
const publishArguments = ['publish', publishDirectory, ...(willPublish ? [] : ['--dry-run'])];
console.log(`\n[publish] ${manifest.name}@${manifest.version} — ${willPublish ? '실제 게시' : 'dry-run'}\n`);
const published = await runCommand('npm', publishArguments, { cwd: packageDirectory });
process.stdout.write(published.stdout);
process.stderr.write(published.stderr);
