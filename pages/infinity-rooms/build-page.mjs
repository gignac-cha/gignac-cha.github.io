// build-page.mjs
//
// Builds infinity-rooms into a non-bundled, non-minified, structure-preserving
// native ESM module tree at the worktree root's `page/infinity-rooms/`.
//
// What it does (per the deploy convention `../../page/infinity-rooms/`):
//  1. Transpile each source .ts -> .js 1:1 (esbuild transform, no bundling,
//     no minify), preserving the source folder structure.
//  2. Rewrite explicit relative `.ts` import specifiers -> `.js` (static +
//     dynamic import()). Bare imports (`three`, `three/webgpu`, `d3`) are left
//     untouched so the importmap (jsdelivr CDN) resolves them in the browser.
//  3. Drop `*.tests.ts` and `*.d.ts` from the output.
//  4. Compile style.scss (+ styles/ partials) -> style.css (no minify, dart-sass).
//  5. Copy index.html with `script.ts` -> `script.js`, `style.scss` -> `style.css`;
//     copy favicon.png. importmap and other CDN links are left as-is.
//
// Tools: esbuild (transform API, file-by-file), sass (dart-sass). No new deps.

import { transform } from 'esbuild';
import * as sass from 'sass';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(SRC_DIR, '../../page/infinity-rooms');

const EXTERNAL_BARE = new Set(['three', 'three/webgpu', 'd3']);

/** Recursively collect files under `dir`, returning paths relative to SRC_DIR. */
async function collectFiles(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip non-source dirs.
      if (['node_modules', 'outputs', 'dist', 'page'].includes(entry.name)) continue;
      await collectFiles(abs, acc);
    } else {
      acc.push(path.relative(SRC_DIR, abs));
    }
  }
  return acc;
}

/** Should this .ts file be transpiled into the output tree? */
function isCompilableTs(rel) {
  if (!rel.endsWith('.ts')) return false;
  if (rel.endsWith('.tests.ts')) return false;
  if (rel.endsWith('.d.ts')) return false;
  return true;
}

/**
 * Rewrite explicit relative `.ts` import specifiers to `.js`.
 * Only touches relative specifiers (starting with `.`); bare specifiers
 * (three / three/webgpu / d3 / etc.) are left untouched.
 *
 * Covers: `from '...'`, `import '...'`, `export ... from '...'`,
 * and dynamic `import('...')`.
 */
function rewriteRelativeTsImports(code) {
  // from '...'  |  from "..."
  const specifierRe = /(\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(['"])([^'"]+)\2/gm;
  return code.replace(specifierRe, (match, prefix, quote, spec) => {
    const isRelative = spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..';
    if (!isRelative) return match; // bare import -> leave for importmap
    if (EXTERNAL_BARE.has(spec)) return match; // defensive
    if (spec.endsWith('.ts')) {
      const rewritten = spec.slice(0, -'.ts'.length) + '.js';
      return `${prefix}${quote}${rewritten}${quote}`;
    }
    return match;
  });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function buildTs(rel) {
  const srcAbs = path.join(SRC_DIR, rel);
  const source = await fs.readFile(srcAbs, 'utf8');
  const result = await transform(source, {
    loader: 'ts',
    format: 'esm',
    // Transpile-only: strip types, keep readable output.
    minify: false,
    sourcemap: false,
    // Keep modern output close to the source.
    target: 'esnext',
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
  });
  const rewritten = rewriteRelativeTsImports(result.code);
  const outRel = rel.slice(0, -'.ts'.length) + '.js';
  const outAbs = path.join(OUT_DIR, outRel);
  await ensureDir(path.dirname(outAbs));
  await fs.writeFile(outAbs, rewritten, 'utf8');
  return outRel;
}

async function buildScss() {
  const entry = path.join(SRC_DIR, 'style.scss');
  const result = sass.compile(entry, { style: 'expanded', sourceMap: false });
  const outAbs = path.join(OUT_DIR, 'style.css');
  await ensureDir(path.dirname(outAbs));
  await fs.writeFile(outAbs, result.css, 'utf8');
  return 'style.css';
}

async function buildHtml() {
  const html = await fs.readFile(path.join(SRC_DIR, 'index.html'), 'utf8');
  const patched = html
    .replace(/src="\.\/script\.ts"/g, 'src="./script.js"')
    .replace(/href="\.\/style\.scss"/g, 'href="./style.css"');
  await ensureDir(OUT_DIR);
  await fs.writeFile(path.join(OUT_DIR, 'index.html'), patched, 'utf8');
  return 'index.html';
}

async function copyFavicon() {
  const src = path.join(SRC_DIR, 'favicon.png');
  try {
    await fs.access(src);
  } catch {
    return null;
  }
  await ensureDir(OUT_DIR);
  await fs.copyFile(src, path.join(OUT_DIR, 'favicon.png'));
  return 'favicon.png';
}

async function main() {
  // Clean output to avoid stale files from renamed/removed sources.
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await ensureDir(OUT_DIR);

  const all = await collectFiles(SRC_DIR);
  const tsFiles = all.filter(isCompilableTs).filter((rel) => {
    // Only transpile actual page sources: root script.ts and scripts/**.
    return rel === 'script.ts' || rel.startsWith('scripts' + path.sep) || rel.startsWith('scripts/');
  });

  const emittedJs = [];
  for (const rel of tsFiles.sort()) {
    emittedJs.push(await buildTs(rel));
  }

  const css = await buildScss();
  const html = await buildHtml();
  const favicon = await copyFavicon();

  console.log(`[build-page] output: ${OUT_DIR}`);
  console.log(`[build-page] emitted ${emittedJs.length} .js modules`);
  console.log(`[build-page] css: ${css}`);
  console.log(`[build-page] html: ${html}`);
  console.log(`[build-page] favicon: ${favicon ?? '(missing, skipped)'}`);
}

main().catch((err) => {
  console.error('[build-page] failed:', err);
  process.exit(1);
});
