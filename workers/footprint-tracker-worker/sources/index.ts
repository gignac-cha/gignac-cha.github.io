import { corsHeaders, parseAllowlist } from './cors.ts';
import { findQuery, listQueries, ParameterError, validateParameters } from './queries.ts';
import { queryR2Sql } from './r2-sql.ts';

// footprint 발자국 위에 올린 파라미터화된 분석 질의 API(R2 SQL 위의 읽기 전용 JSON API).
// 라우팅 · CORS 적용 · 업스트림 호출 · 에러 매핑만 담당하고, 검증/SQL 생성/업스트림은 순수 모듈에 위임합니다.

const QUERIES_PREFIX = '/queries/';

const json = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export default {
  async fetch(request, environment, context): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const origin = request.headers.get('Origin');
    const allowlist = parseAllowlist(environment.VIEWER_ORIGINS);

    // CORS 헤더는 모든 /queries 응답(성공·에러)에만 붙입니다. 오리진이 허용 목록과 정확히 일치할 때만.
    const isQueriesPath = pathname === '/queries' || pathname.startsWith(QUERIES_PREFIX);
    const cors = isQueriesPath ? corsHeaders(origin, allowlist) : {};

    // 프리플라이트: /queries 경로의 OPTIONS 는 204 + (허용 오리진이면) CORS + 허용 메서드.
    if (request.method === 'OPTIONS') {
      if (isQueriesPath) {
        return new Response(null, {
          status: 204,
          headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' },
        });
      }
      return new Response(null, { status: 204 });
    }

    if (request.method !== 'GET') {
      // /queries 경로라면 405 에도 CORS 헤더를 실어(허용 오리진일 때) 브라우저가 실패를 읽을 수 있게 합니다.
      return new Response(null, { status: 405, headers: cors });
    }

    if (pathname === '/health') {
      return new Response('ok');
    }

    if (pathname === '/queries') {
      return json({ queries: listQueries() }, 200, cors);
    }

    if (pathname.startsWith(QUERIES_PREFIX)) {
      const rawName = pathname.slice(QUERIES_PREFIX.length);
      let name: string;
      try {
        name = decodeURIComponent(rawName);
      } catch {
        // 퍼센트 인코딩이 깨진 이름(예: %zz)은 디코딩 불가 → 알 수 없는 쿼리로 취급합니다(500 방지).
        return json({ error: `unknown query: ${rawName}` }, 404, cors);
      }
      const definition = findQuery(name);
      if (!definition) {
        return json({ error: `unknown query: ${name}` }, 404, cors);
      }

      let values;
      try {
        values = validateParameters(definition, url.searchParams);
      } catch (error) {
        if (error instanceof ParameterError) {
          return json({ error: error.message }, 400, cors);
        }
        throw error;
      }

      try {
        const sql = definition.buildSql(environment.TABLE_NAME, values);
        const rows = await queryR2Sql(environment, sql);
        return json({ name, rows }, 200, cors);
      } catch (error) {
        // 업스트림(R2 SQL) 실패 또는 잘못된 테이블 설정 → 502.
        const message = error instanceof Error ? error.message : 'upstream error';
        return json({ error: message }, 502, cors);
      }
    }

    return json({ error: 'not found' }, 404, cors);
  },
} satisfies ExportedHandler<Env>;
