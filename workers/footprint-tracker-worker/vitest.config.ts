import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // R2_SQL_TOKEN 은 비밀값이라 wrangler.jsonc 에 없습니다. 테스트에서는 miniflare 바인딩으로 주입합니다.
      miniflare: {
        bindings: { R2_SQL_TOKEN: 'test-token' },
      },
    }),
  ],
  test: {
    include: ['sources/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
