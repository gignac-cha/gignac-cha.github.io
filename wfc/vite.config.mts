import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@packages\/canvas/, replacement: resolve(__dirname, '../packages/canvas/') },
      { find: /^@packages\/fps/, replacement: resolve(__dirname, '../packages/fps/') },
      { find: /^@packages\/tools/, replacement: resolve(__dirname, '../packages/tools/') },
    ],
  },
});
