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
  types: './footprint.d.ts',
  exports: {
    '.': {
      types: './footprint.d.ts',
      import: './footprint.js',
    },
  },
  // Must stay `true`: importing this package IS the feature. footprint.ts fires its one
  // automatic pageview from a top-level `if (typeof window !== 'undefined')` block, and a
  // consumer may `import` the package for that side effect alone, using no exports at all.
  // `sideEffects: false` is the reflexive "optimization" for libraries, but it declares every
  // module pure and safe to prune when its exports are unused — exactly the situation here — so
  // webpack/Rollup-class bundlers would tree-shake the entire tracker out of production builds
  // and tracking would die with no error anywhere. This flag is the manifest half of the
  // contract documented above the auto-fire block in footprint.ts.
  // See webpack's tree-shaking guide on the `sideEffects` field:
  // https://webpack.js.org/guides/tree-shaking/
  sideEffects: true,
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
