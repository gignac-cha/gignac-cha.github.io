const path = require('node:path');
const esbuild = require('esbuild');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'vendor-entry.js')],
  outfile: path.join(__dirname, 'vendor/three-kit.js'),
  nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'inline',
  target: ['es2022'],
});
