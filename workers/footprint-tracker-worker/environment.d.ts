// R2_SQL_TOKEN is a secret: it is deliberately absent from wrangler.jsonc, so `wrangler types`
// cannot include it in the generated types. TypeScript interface merging adds it to both
// places the worker's environment is typed — the generated global `Env`
// (worker-configuration.d.ts) and `Cloudflare.Env`, which is what `env` from cloudflare:test
// is typed as. See https://www.typescriptlang.org/docs/handbook/declaration-merging.html
interface Env {
  R2_SQL_TOKEN: string;
}

declare namespace Cloudflare {
  interface Env {
    R2_SQL_TOKEN: string;
  }
}
