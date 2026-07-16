import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
