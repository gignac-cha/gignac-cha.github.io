import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // R2_SQL_TOKEN is a secret, so it is not in wrangler.jsonc and the pool cannot read it
      // from there; tests inject a known value as a plain miniflare binding instead, and
      // worker.test.ts asserts the exact `Bearer test-token` header reaches the upstream.
      // See https://developers.cloudflare.com/workers/testing/vitest-integration/
      miniflare: {
        bindings: { R2_SQL_TOKEN: 'test-token' },
      },
    }),
  ],
  test: {
    include: ['*.test.ts'],
  },
});
