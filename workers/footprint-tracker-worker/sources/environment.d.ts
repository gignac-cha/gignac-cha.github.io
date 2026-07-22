// R2_SQL_TOKEN 은 비밀값이라 wrangler.jsonc 에 없으므로 `wrangler types` 가 만들어 주지 않습니다.
// 생성된 전역 `Env` 와 `Cloudflare.Env`(cloudflare:test 의 `env` 타입) 양쪽에 인터페이스 병합으로 더해 줍니다.
interface Env {
  R2_SQL_TOKEN: string;
}

declare namespace Cloudflare {
  interface Env {
    R2_SQL_TOKEN: string;
  }
}
