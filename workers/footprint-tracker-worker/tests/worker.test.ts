import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../sources/index.ts';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const ORIGIN = 'http://localhost:5173';
const WORKER_URL = 'https://footprint-tracker.test';

// R2 SQL 업스트림은 전역 fetch 로 나갑니다. 테스트는 이 전역을 가로채(스텁)
// 워커가 보낸 요청(Bearer 토큰 · 정확한 SQL)을 결정적으로 검증하고, 원하는 응답을 돌려줍니다.
type OutboundCall = { url: string; method: string; headers: Record<string, string>; body: unknown };
let outboundCalls: OutboundCall[];
let respondWith: () => Response;

const rowsEnvelope = (rows: unknown[]): Response =>
  new Response(JSON.stringify({ success: true, result: { schema: [], rows, metrics: {} } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  outboundCalls = [];
  respondWith = () => rowsEnvelope([]);
  vi.stubGlobal('fetch', ((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    outboundCalls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(headers.entries()),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    });
    return Promise.resolve(respondWith());
  }) as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const dispatch = async (request: Request) => {
  const executionContext = createExecutionContext();
  const response = await worker.fetch(
    request as Request<unknown, IncomingRequestCfProperties>,
    env,
    executionContext,
  );
  await waitOnExecutionContext(executionContext);
  return response;
};

const get = (path: string, headers: Record<string, string> = {}) =>
  dispatch(new IncomingRequest(`${WORKER_URL}${path}`, { method: 'GET', headers }));

describe('GET /healthz', () => {
  it('answers 200 ok with no upstream call and no CORS', async () => {
    const response = await get('/healthz', { Origin: ORIGIN });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(outboundCalls).toHaveLength(0);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('GET /queries', () => {
  it('lists the five queries and reflects an allowlisted origin', async () => {
    const response = await get('/queries', { Origin: ORIGIN });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { queries: Array<{ name: string }> };
    expect(body.queries.map((query) => query.name)).toEqual([
      'recent-footprints',
      'footprints-by-day',
      'unique-visitors-by-day',
      'top-pages',
      'top-origins',
      'bots-by-day',
    ]);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Vary')).toBe('Origin');
  });
});

describe('GET /queries/{name}', () => {
  it('sends the Bearer token and exact SQL upstream, and shapes { name, rows }', async () => {
    const rows = [{ received_at: '2026-07-16T00:00:00.000Z', uuid: 'u-1', href: 'https://x/' }];
    respondWith = () => rowsEnvelope(rows);

    const response = await get('/queries/recent-footprints?limit=5', { Origin: ORIGIN });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'recent-footprints', rows });

    expect(outboundCalls).toHaveLength(1);
    const [call] = outboundCalls;
    expect(call.url).toBe(env.R2_SQL_URL);
    expect(call.method).toBe('POST');
    expect(call.headers.authorization).toBe('Bearer test-token');
    expect(call.headers['content-type']).toBe('application/json');
    expect(call.body).toEqual({
      query:
        'SELECT received_at, uuid, origin, href, user_agent, arguments FROM footprint.trail ORDER BY received_at DESC LIMIT 5',
    });
  });

  it('sends the exact by-day SQL with inclusive from / exclusive to', async () => {
    await get('/queries/footprints-by-day?from=2026-07-01&to=2026-07-17', { Origin: ORIGIN });
    expect((outboundCalls[0].body as { query: string }).query).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY day ORDER BY day",
    );
  });

  it('passes through bots-by-day rows with total and bot counts', async () => {
    const rows = [
      { day: '2026-07-15', footprints: 120, bot_footprints: 37 },
      { day: '2026-07-16', footprints: 98, bot_footprints: 12 },
    ];
    respondWith = () => rowsEnvelope(rows);
    const response = await get('/queries/bots-by-day?from=2026-07-01&to=2026-07-17', { Origin: ORIGIN });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'bots-by-day', rows });
    expect((outboundCalls[0].body as { query: string }).query).toContain(
      "SUM(CASE WHEN user_agent ILIKE '%bot%'",
    );
  });

  it('normalizes upstream rows found at result.rows, rows or data', async () => {
    const rows = [{ day: '2026-07-16', footprints: 3 }];
    for (const envelope of [{ result: { rows } }, { rows }, { data: rows }]) {
      respondWith = () =>
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      const response = await get('/queries/footprints-by-day?from=2026-07-01&to=2026-07-17');
      expect(await response.json()).toEqual({ name: 'footprints-by-day', rows });
    }
  });
});

describe('CORS posture on /queries', () => {
  it('omits CORS headers for a non-allowlisted origin (still serves the request)', async () => {
    const response = await get('/queries', { Origin: 'https://evil.example' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Vary')).toBeNull();
  });

  it('omits CORS headers when there is no Origin', async () => {
    const response = await get('/queries');
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers an OPTIONS preflight with 204, CORS and Allow-Methods for an allowed origin', async () => {
    const response = await dispatch(
      new IncomingRequest(`${WORKER_URL}/queries/recent-footprints`, {
        method: 'OPTIONS',
        headers: { Origin: ORIGIN },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET');
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('answers OPTIONS with 204 and Allow-Methods but no CORS for a disallowed origin', async () => {
    const response = await dispatch(
      new IncomingRequest(`${WORKER_URL}/queries`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET');
  });
});

describe('error responses', () => {
  it('answers 400 with CORS for a missing required parameter', async () => {
    const response = await get('/queries/footprints-by-day', { Origin: ORIGIN });
    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toMatch(/from/);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(outboundCalls).toHaveLength(0);
  });

  it('answers 400 for injection attempts and never calls upstream', async () => {
    for (const path of [
      '/queries/recent-footprints?limit=20;DROP TABLE x',
      "/queries/footprints-by-day?from=2026-01-01' OR '1'='1&to=2026-07-17",
    ]) {
      const response = await get(path);
      expect(response.status).toBe(400);
    }
    expect(outboundCalls).toHaveLength(0);
  });

  it('answers 404 for an unknown query name', async () => {
    const response = await get('/queries/made-up', { Origin: ORIGIN });
    expect(response.status).toBe(404);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('answers 404 for an unknown path', async () => {
    expect((await get('/nope')).status).toBe(404);
  });

  it('answers 405 for non-GET, non-OPTIONS methods', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await dispatch(new IncomingRequest(`${WORKER_URL}/queries`, { method }));
      expect(response.status).toBe(405);
    }
  });

  it('answers 502 when R2 SQL returns a non-200', async () => {
    respondWith = () =>
      new Response(JSON.stringify({ success: false, errors: [{ code: 40003, message: 'bad sql' }] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    const response = await get('/queries/recent-footprints', { Origin: ORIGIN });
    expect(response.status).toBe(502);
    expect((await response.json() as { error: string }).error).toMatch(/40003|bad sql/);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('answers 502 when R2 SQL returns success:false at HTTP 200', async () => {
    respondWith = () =>
      new Response(JSON.stringify({ success: false, errors: [{ code: 40004, message: 'unknown column' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const response = await get('/queries/top-pages?from=2026-07-01&to=2026-07-17');
    expect(response.status).toBe(502);
  });

  it('answers 502 when R2 SQL is unreachable', async () => {
    respondWith = () => {
      throw new Error('connection refused');
    };
    const response = await get('/queries/recent-footprints');
    expect(response.status).toBe(502);
  });
});
