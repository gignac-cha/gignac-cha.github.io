import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker.ts';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const ORIGIN = 'http://localhost:5173';
const WORKER_URL = 'https://footprint-tracker.test';

// The R2 SQL upstream leaves the worker via global fetch. The Workers Vitest pool runs the
// worker in a real workerd isolate, but the upstream must be deterministic, so the global is
// stubbed (vi.stubGlobal): every outbound call is captured — URL, method, headers, parsed
// body — letting assertions check the Bearer token and the EXACT SQL sent, while respondWith
// scripts whatever envelope each test wants back.
// See https://developers.cloudflare.com/workers/testing/vitest-integration/ and
// https://vitest.dev/api/vi.html#vi-stubglobal
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

const dispatch = async (request: Request, environment: Env = env) => {
  const executionContext = createExecutionContext();
  const response = await worker.fetch(
    request as Request<unknown, IncomingRequestCfProperties>,
    environment,
    executionContext,
  );
  await waitOnExecutionContext(executionContext);
  return response;
};

// OWNER_UUIDS ships as "" in wrangler.jsonc (feature off), and `wrangler types` therefore narrows
// it to the literal type "" — so exercising the owner filter means handing the worker a MODIFIED
// COPY of the environment rather than mutating the shared one, which would leak across tests.
// worker.ts only ever reads plain string properties off `environment`, so a spread copy is a
// faithful stand-in; the cast exists solely to widen that literal type.
const withOwnerUUIDs = (ownerUUIDs: string): Env =>
  ({ ...env, OWNER_UUIDS: ownerUUIDs }) as unknown as Env;

const get = (path: string, headers: Record<string, string> = {}, environment: Env = env) =>
  dispatch(new IncomingRequest(`${WORKER_URL}${path}`, { method: 'GET', headers }), environment);

describe('GET /health', () => {
  it('answers 200 ok with no upstream call and no CORS', async () => {
    const response = await get('/health', { Origin: ORIGIN });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(outboundCalls).toHaveLength(0);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('GET / and GET /help', () => {
  it('serves the same help document at both paths (no redirect), without CORS or upstream calls', async () => {
    const root = await get('/', { Origin: ORIGIN });
    const help = await get('/help', { Origin: ORIGIN });
    expect(root.status).toBe(200);
    expect(help.status).toBe(200);
    const rootBody = await root.text();
    expect(rootBody).toBe(await help.text());
    expect((JSON.parse(rootBody) as { name: string }).name).toBe('footprint-tracker');
    expect(root.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(outboundCalls).toHaveLength(0);
  });
});

describe('HEAD and Allow', () => {
  it('answers HEAD like GET with the body stripped and headers (incl. CORS) preserved', async () => {
    const response = await dispatch(
      new IncomingRequest(`${WORKER_URL}/queries`, { method: 'HEAD', headers: { Origin: ORIGIN } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(await response.text()).toBe('');
  });

  it('carries Allow on OPTIONS and on 405 responses', async () => {
    const options = await dispatch(new IncomingRequest(`${WORKER_URL}/help`, { method: 'OPTIONS' }));
    expect(options.status).toBe(204);
    expect(options.headers.get('Allow')).toBe('GET, HEAD, OPTIONS');
    const notAllowed = await dispatch(new IncomingRequest(`${WORKER_URL}/queries`, { method: 'POST' }));
    expect(notAllowed.status).toBe(405);
    expect(notAllowed.headers.get('Allow')).toBe('GET, HEAD, OPTIONS');
  });
});

describe('GET /queries', () => {
  it('lists the sixteen queries and reflects an allowlisted origin', async () => {
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
      'period-summary',
      'top-referrers',
      'views-by-country',
      'views-by-hour',
      'top-platforms',
      'views-by-color-scheme',
      'top-languages',
      'views-by-screen-width',
      'top-events',
      'verified-bot-categories',
    ]);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('advertises the boolean include_owner descriptor on every query', async () => {
    // The catalog is what the viewer and the mock tracker both read to know the API surface, so
    // the boolean descriptor variant has to survive the trip over the wire, not just exist in
    // TypeScript. Pinned alongside 'offers include_owner on every query' in queries.test.ts.
    const response = await get('/queries');
    const body = (await response.json()) as {
      queries: Array<{ parameters: Array<Record<string, unknown>> }>;
    };
    for (const query of body.queries) {
      expect(query.parameters).toContainEqual({
        name: 'include_owner',
        type: 'boolean',
        required: false,
        default: false,
      });
    }
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
        "SELECT received_at, uuid, origin, href, user_agent, arguments, json_get_str(cf, 'verifiedBotCategory') AS verified_bot_category FROM footprint.trail ORDER BY received_at DESC LIMIT 5",
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
    // The output columns stay `footprints` / `bot_footprints` even though the viewer relabels
    // them: the row shape is the API contract, the labels are UI copy.
    expect(await response.json()).toEqual({ name: 'bots-by-day', rows });
    expect((outboundCalls[0].body as { query: string }).query).toContain(
      "SUM(CASE WHEN (json_get_str(cf, 'verifiedBotCategory') IS NOT NULL AND json_get_str(cf, 'verifiedBotCategory') != '') OR user_agent ILIKE '%bot%'",
    );
  });

  it('sends the exact SQL of every new v2 query over the wire', async () => {
    // Each of these strings was also executed once, verbatim, against the live footprint.trail
    // table (read-only, HTTP 200) before being pinned — see the note above the dimensional suite
    // in queries.test.ts. This test pins the wire side: what the worker actually POSTs.
    const range = 'from=2026-07-01&to=2026-07-17';
    const expected: Array<[string, string]> = [
      [
        'period-summary',
        "SELECT COUNT(*) AS views, COUNT(DISTINCT uuid) AS visitors FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17'",
      ],
      [
        'top-referrers',
        "SELECT json_get_str(payload, 'document', 'referrer') AS referrer, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY referrer ORDER BY views DESC LIMIT 10",
      ],
      [
        'views-by-country',
        "SELECT json_get_str(cf, 'country') AS country, COUNT(*) AS views, COUNT(DISTINCT uuid) AS visitors FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY country ORDER BY views DESC LIMIT 10",
      ],
      [
        'views-by-hour',
        "SELECT substr(received_at, 12, 2) AS hour, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY hour ORDER BY hour",
      ],
      [
        'top-platforms',
        "SELECT json_get_str(payload, 'navigator', 'userAgentHints', 'platform') AS platform, json_get_bool(payload, 'navigator', 'userAgentHints', 'mobile') AS mobile, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY platform, mobile ORDER BY views DESC LIMIT 10",
      ],
      [
        'views-by-color-scheme',
        "SELECT json_get_str(payload, 'colorScheme') AS color_scheme, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY color_scheme ORDER BY views DESC",
      ],
      [
        'top-languages',
        "SELECT json_get_str(payload, 'navigator', 'language') AS language, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY language ORDER BY views DESC LIMIT 10",
      ],
      [
        'views-by-screen-width',
        "SELECT CASE WHEN json_get_int(payload, 'screen', 'width') < 600 THEN 'under-600' WHEN json_get_int(payload, 'screen', 'width') < 1024 THEN '600-to-1023' WHEN json_get_int(payload, 'screen', 'width') < 1440 THEN '1024-to-1439' WHEN json_get_int(payload, 'screen', 'width') < 1920 THEN '1440-to-1919' WHEN json_get_int(payload, 'screen', 'width') >= 1920 THEN '1920-and-above' END AS width_bucket, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY width_bucket ORDER BY views DESC",
      ],
      [
        'top-events',
        "SELECT arguments, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND arguments != '[]' GROUP BY arguments ORDER BY views DESC LIMIT 10",
      ],
      [
        'verified-bot-categories',
        "SELECT json_get_str(cf, 'verifiedBotCategory') AS category, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND json_get_str(cf, 'verifiedBotCategory') IS NOT NULL AND json_get_str(cf, 'verifiedBotCategory') != '' GROUP BY category ORDER BY views DESC",
      ],
    ];

    for (const [name, sql] of expected) {
      outboundCalls = [];
      const response = await get(`/queries/${name}?${range}`, { Origin: ORIGIN });
      expect(response.status).toBe(200);
      expect((outboundCalls[0].body as { query: string }).query).toBe(sql);
    }
  });

  it('passes through the row shapes of the new queries verbatim, nulls included', async () => {
    // The null buckets are load-bearing: 'did not report' is a real answer the viewer renders as
    // 미보고 / 미상, so the worker must never coerce or drop them on the way out.
    const rows = [
      { platform: null, mobile: null, views: 12 },
      { platform: 'macOS', mobile: false, views: 4 },
    ];
    respondWith = () => rowsEnvelope(rows);
    const response = await get('/queries/top-platforms?from=2026-07-01&to=2026-07-17');
    expect(await response.json()).toEqual({ name: 'top-platforms', rows });
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

describe('OWNER_UUIDS owner exclusion', () => {
  const OWNERS = 'owner-1,owner-2';

  it('excludes the owner uuids from a ranged query by default', async () => {
    await get(
      '/queries/footprints-by-day?from=2026-07-01&to=2026-07-17',
      { Origin: ORIGIN },
      withOwnerUUIDs(OWNERS),
    );
    expect((outboundCalls[0].body as { query: string }).query).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND uuid NOT IN ('owner-1', 'owner-2') GROUP BY day ORDER BY day",
    );
  });

  it('opens a WHERE clause on recent-footprints, which has none of its own', async () => {
    await get('/queries/recent-footprints', { Origin: ORIGIN }, withOwnerUUIDs(OWNERS));
    expect((outboundCalls[0].body as { query: string }).query).toBe(
      "SELECT received_at, uuid, origin, href, user_agent, arguments, json_get_str(cf, 'verifiedBotCategory') AS verified_bot_category FROM footprint.trail WHERE uuid NOT IN ('owner-1', 'owner-2') ORDER BY received_at DESC LIMIT 20",
    );
  });

  it('adds nothing when OWNER_UUIDS is the committed empty default', async () => {
    // env carries the wrangler.jsonc value, which is "" — the feature ships OFF.
    await get('/queries/footprints-by-day?from=2026-07-01&to=2026-07-17');
    expect((outboundCalls[0].body as { query: string }).query).not.toContain('uuid NOT IN');
  });

  it('is bypassed by include_owner=true', async () => {
    await get(
      '/queries/footprints-by-day?from=2026-07-01&to=2026-07-17&include_owner=true',
      { Origin: ORIGIN },
      withOwnerUUIDs(OWNERS),
    );
    expect((outboundCalls[0].body as { query: string }).query).not.toContain('uuid NOT IN');
  });

  it('answers 400 for an include_owner value that is neither true nor false', async () => {
    const response = await get(
      '/queries/footprints-by-day?from=2026-07-01&to=2026-07-17&include_owner=1',
      { Origin: ORIGIN },
      withOwnerUUIDs(OWNERS),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe(
      'parameter include_owner must be true or false',
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(outboundCalls).toHaveLength(0);
  });

  it('answers 502 (not 400, not 200) for a poisoned OWNER_UUIDS var and never calls upstream', async () => {
    // A malformed OWNER_UUIDS is the OPERATOR's mistake, so it maps to 502 like any other
    // configuration failure — mapping it to 400 would blame the caller for a var they cannot see,
    // and silently ignoring it would serve the owner's own footprints as if the filter worked.
    const response = await get(
      '/queries/footprints-by-day?from=2026-07-01&to=2026-07-17',
      { Origin: ORIGIN },
      withOwnerUUIDs("owner-1,evil') OR 1=1--"),
    );
    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: string }).error).toMatch(/invalid owner uuid/);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(outboundCalls).toHaveLength(0);
  });

  it('applies the exclusion to every query in the catalog', async () => {
    const listing = await get('/queries');
    const { queries } = (await listing.json()) as {
      queries: Array<{ name: string; parameters: Array<{ name: string }> }>;
    };
    for (const query of queries) {
      outboundCalls = [];
      const ranged = query.parameters.some((parameter) => parameter.name === 'from');
      await get(
        `/queries/${query.name}${ranged ? '?from=2026-07-01&to=2026-07-17' : ''}`,
        {},
        withOwnerUUIDs(OWNERS),
      );
      expect((outboundCalls[0].body as { query: string }).query).toContain(
        "uuid NOT IN ('owner-1', 'owner-2')",
      );
    }
  });
});

describe('CORS posture on /queries', () => {
  it('omits CORS headers for a non-allowlisted origin (still serves the request)', async () => {
    const response = await get('/queries', { Origin: 'https://evil.example' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    // Vary: Origin must survive even the no-match variant — a shared cache that stored this
    // response without it could later replay it to an allowlisted origin (see corsHeaders in
    // cors.ts).
    expect(response.headers.get('Vary')).toBe('Origin');
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

  it('answers OPTIONS on a non-/queries path with 204 and no CORS at all', async () => {
    const response = await dispatch(
      new IncomingRequest(`${WORKER_URL}/health`, { method: 'OPTIONS', headers: { Origin: ORIGIN } }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull();
    expect(response.headers.get('Vary')).toBeNull();
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

  it('answers 404 for a malformed percent-encoded query name instead of crashing', async () => {
    const response = await get('/queries/%zz', { Origin: ORIGIN });
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: string }).error).toMatch(/unknown query/);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(outboundCalls).toHaveLength(0);
  });

  it('answers 405 with CORS on /queries for an allowed origin (browser can read the failure)', async () => {
    const response = await dispatch(
      new IncomingRequest(`${WORKER_URL}/queries`, { method: 'POST', headers: { Origin: ORIGIN } }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Vary')).toBe('Origin');
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

  it('surfaces the real error detail even when the errors envelope has a null entry', async () => {
    respondWith = () =>
      new Response(
        JSON.stringify({ success: false, errors: [null, { code: 40010, message: 'table not found' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const response = await get('/queries/recent-footprints');
    expect(response.status).toBe(502);
    // Without the null guard in describeErrors, the first (null) entry throws before the real
    // 40010 detail is reached, and the 502 body carries a TypeError instead.
    expect(((await response.json()) as { error: string }).error).toMatch(/40010|table not found/);
  });

  it('answers 502 when R2 SQL is unreachable', async () => {
    respondWith = () => {
      throw new Error('connection refused');
    };
    const response = await get('/queries/recent-footprints');
    expect(response.status).toBe(502);
  });
});
