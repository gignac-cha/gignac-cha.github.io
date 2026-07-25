// defineConfig comes from vitest/config, not vite: the plain vite export does not know the `test`
// key and reports it as a type error. Same style as the infinity-rooms page.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Build output goes to outputs/ per the repository convention (no abbreviated directory names).
  build: {
    outDir: 'outputs',
  },
  test: {
    // Tests are colocated next to the modules they cover.
    include: ['**/*.test.ts'],
    // The node environment, deliberately: this project keeps DOM-touching code thin and untested
    // and verifies the pure layer instead, so no DOM implementation is needed to run the suite.
    environment: 'node',
  },
});
