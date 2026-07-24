import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { FootprintRecord } from './footprints.ts';
import worker from './worker.ts';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const ORIGIN = 'https://gignac-cha.github.io';
const WORKER_URL = 'https://footprint-trail.test';

const pageview = {
  arguments: [],
  uuid: 'e2e-uuid-0001',
  location: { href: `${ORIGIN}/cardioid`, pathname: '/cardioid', search: '', hash: '' },
  navigator: { userAgent: 'payload-agent', language: 'ko' },
  colorScheme: 'dark',
};

// The real STREAM binding is replaced with a stub that captures every send() batch: the Workers
// Vitest pool runs this worker in a real workerd isolate, but there is no local Pipelines
// simulator to receive events — and even if there were, asserting through an async batching
// service would be nondeterministic. Capturing the batches keeps the assertions exact (what was
// sent, in what order, in which batch) while everything else stays the real runtime.
// See https://developers.cloudflare.com/workers/testing/vitest-integration/
const makeEnvironment = (overrides: Record<string, unknown> = {}) => {
  const batches: FootprintRecord[][] = [];
  const environment = {
    ...env,
    ...overrides,
    STREAM: {
      send: async (records: FootprintRecord[]) => {
        batches.push(records);
      },
    },
  } as unknown as Env;
  return { environment, batches };
};

const dispatch = async (request: Request, environment: Env) => {
  const executionContext = createExecutionContext();
  const response = await worker.fetch(
    request as Request<unknown, IncomingRequestCfProperties>,
    environment,
    executionContext,
  );
  // waitOnExecutionContext() drains the worker's context.waitUntil() work — the STREAM.send()
  // call — before returning; without it, assertions on the captured batches would race the
  // delivery that intentionally happens after the response.
  await waitOnExecutionContext(executionContext);
  return response;
};

const post = (
  environment: Env,
  body: string,
  { path = '/', headers = {} as Record<string, string>, cf = undefined as Record<string, unknown> | undefined } = {},
) =>
  dispatch(
    new IncomingRequest(`${WORKER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Origin: ORIGIN,
        'User-Agent': 'header-agent',
        ...headers,
      },
      body,
      ...(cf ? { cf: cf as unknown as IncomingRequestCfProperties } : {}),
    }),
    environment,
  );

describe('collecting footprints', () => {
  it('streams a pageview and answers 204 with an empty body', async () => {
    const { environment, batches } = makeEnvironment();
    const response = await post(environment, JSON.stringify(pageview));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    const [record] = batches[0];
    expect(record).toMatchObject({
      uuid: 'e2e-uuid-0001',
      origin: ORIGIN,
      href: `${ORIGIN}/cardioid`,
      user_agent: 'header-agent',
      arguments: '[]',
    });
    expect(JSON.parse(record.payload)).toEqual(pageview);
  });

  it('sends no CORS headers at all (delivery relies on CORS-simple requests)', async () => {
    const { environment } = makeEnvironment();
    const response = await post(environment, JSON.stringify(pageview));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Headers')).toBeNull();
  });

  it('streams step() arguments verbatim', async () => {
    const { environment, batches } = makeEnvironment();
    const stepArguments = ['cta-click', { plan: 'pro', tags: ['a', 'b'] }, 42, null];
    await post(environment, JSON.stringify({ ...pageview, arguments: stepArguments }));
    expect(JSON.parse(batches[0][0].arguments)).toEqual(stepArguments);
  });

  it('accepts a POST on any path (the endpoint may include one)', async () => {
    const { environment, batches } = makeEnvironment();
    const response = await post(environment, JSON.stringify(pageview), { path: '/collect/abc' });
    expect(response.status).toBe(204);
    expect(batches).toHaveLength(1);
  });

  it('tolerates a minimal payload, keeping nullable fields as null', async () => {
    const { environment, batches } = makeEnvironment();
    const response = await post(environment, '{}', { headers: { Origin: '', 'User-Agent': '' } });
    expect(response.status).toBe(204);
    expect(batches[0][0]).toMatchObject({ uuid: null, href: null, cf: null, arguments: '[]' });
  });

  it('records received_at as an ISO 8601 timestamp', async () => {
    const { environment, batches } = makeEnvironment();
    await post(environment, JSON.stringify(pageview));
    expect(batches[0][0].received_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('streams multiple footprints in arrival order, one batch each', async () => {
    const { environment, batches } = makeEnvironment();
    await post(environment, JSON.stringify({ ...pageview, arguments: ['first'] }));
    await post(environment, JSON.stringify({ ...pageview, arguments: ['second'] }));
    expect(batches).toHaveLength(2);
    expect(batches.map((batch) => JSON.parse(batch[0].arguments)[0])).toEqual(['first', 'second']);
  });

  it('streams Cloudflare request metadata when present', async () => {
    const { environment, batches } = makeEnvironment();
    await post(environment, JSON.stringify(pageview), { cf: { country: 'KR', colo: 'ICN' } });
    expect(JSON.parse(batches[0][0].cf as string)).toMatchObject({ country: 'KR', colo: 'ICN' });
  });
});

describe('origin allowlist (COLLECTOR_ORIGINS)', () => {
  it('accepts a POST from an allowlisted origin', async () => {
    const { environment, batches } = makeEnvironment({ COLLECTOR_ORIGINS: ORIGIN });
    expect((await post(environment, JSON.stringify(pageview))).status).toBe(204);
    expect(batches).toHaveLength(1);
  });

  it('rejects a POST from a non-allowlisted origin with 403 and streams nothing', async () => {
    const { environment, batches } = makeEnvironment({ COLLECTOR_ORIGINS: ORIGIN });
    const response = await post(environment, JSON.stringify(pageview), {
      headers: { Origin: 'https://evil.example' },
    });
    expect(response.status).toBe(403);
    expect(batches).toHaveLength(0);
  });

  it('lets a request WITHOUT an Origin header through (bots are recorded by design)', async () => {
    const { environment, batches } = makeEnvironment({ COLLECTOR_ORIGINS: ORIGIN });
    // Built manually instead of via post(): that helper always sets an Origin header, and this
    // test's whole point is a request where the header is genuinely absent, not merely empty.
    const response = await dispatch(
      new IncomingRequest(`${WORKER_URL}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'User-Agent': 'curl/8.0' },
        body: JSON.stringify(pageview),
      }),
      environment,
    );
    expect(response.status).toBe(204);
    expect(batches).toHaveLength(1);
  });

  it('stays fully open when the allowlist is empty', async () => {
    const { environment, batches } = makeEnvironment({ COLLECTOR_ORIGINS: '' });
    const response = await post(environment, JSON.stringify(pageview), {
      headers: { Origin: 'https://anyone.example' },
    });
    expect(response.status).toBe(204);
    expect(batches).toHaveLength(1);
  });
});

describe('rejecting garbage', () => {
  it('answers 400 for invalid JSON and streams nothing', async () => {
    const { environment, batches } = makeEnvironment();
    const response = await post(environment, '{broken');
    expect(response.status).toBe(400);
    expect(batches).toHaveLength(0);
  });

  it('answers 400 for non-object JSON', async () => {
    const { environment, batches } = makeEnvironment();
    expect((await post(environment, '[1,2,3]')).status).toBe(400);
    expect((await post(environment, '42')).status).toBe(400);
    expect(batches).toHaveLength(0);
  });

  it('answers 413 for a body above the sendBeacon limit (64KiB)', async () => {
    const { environment, batches } = makeEnvironment();
    const oversized = JSON.stringify({ padding: 'x'.repeat(64 * 1024) });
    const response = await post(environment, oversized);
    expect(response.status).toBe(413);
    expect(batches).toHaveLength(0);
  });

  it('answers 413 for a multibyte body over 64KiB in bytes but not in code units', async () => {
    const { environment, batches } = makeEnvironment();
    // '가' is ONE UTF-16 code unit but THREE UTF-8 bytes: 30,000 of them keep .length (~30k)
    // comfortably under 64 Ki while the encoded body is ~90 KiB — so this passes any
    // code-unit-based check and only a byte-accurate limit rejects it.
    const multibyte = JSON.stringify({ padding: '가'.repeat(30000) });
    expect(multibyte.length).toBeLessThan(64 * 1024);
    const response = await post(environment, multibyte);
    expect(response.status).toBe(413);
    expect(batches).toHaveLength(0);
  });
});

describe('routing', () => {
  it('answers ok on GET /health', async () => {
    const { environment } = makeEnvironment();
    const response = await dispatch(new IncomingRequest(`${WORKER_URL}/health`), environment);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  it('answers 405 with an Allow header for PUT, DELETE and PATCH', async () => {
    const { environment } = makeEnvironment();
    for (const method of ['PUT', 'DELETE', 'PATCH']) {
      const response = await dispatch(new IncomingRequest(`${WORKER_URL}/`, { method }), environment);
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toBe('GET, HEAD, POST, OPTIONS');
    }
  });

  it('answers OPTIONS with 204 + Allow and still no CORS headers (never a preflight)', async () => {
    const { environment } = makeEnvironment();
    const response = await dispatch(new IncomingRequest(`${WORKER_URL}/`, { method: 'OPTIONS' }), environment);
    expect(response.status).toBe(204);
    expect(response.headers.get('Allow')).toBe('GET, HEAD, POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('serves the same help document at GET / and GET /help (no redirect)', async () => {
    const { environment } = makeEnvironment();
    const root = await dispatch(new IncomingRequest(`${WORKER_URL}/`), environment);
    const help = await dispatch(new IncomingRequest(`${WORKER_URL}/help`), environment);
    expect(root.status).toBe(200);
    expect(help.status).toBe(200);
    expect(root.headers.get('Content-Type')).toBe('application/json');
    const rootBody = await root.text();
    expect(rootBody).toBe(await help.text());
    expect((JSON.parse(rootBody) as { name: string }).name).toBe('footprint-trail');
  });

  it('answers 404 for an unknown GET path', async () => {
    const { environment } = makeEnvironment();
    expect((await dispatch(new IncomingRequest(`${WORKER_URL}/unknown`), environment)).status).toBe(404);
  });

  it('answers HEAD like GET with the body stripped', async () => {
    const { environment } = makeEnvironment();
    const help = await dispatch(new IncomingRequest(`${WORKER_URL}/help`, { method: 'HEAD' }), environment);
    expect(help.status).toBe(200);
    expect(help.headers.get('Content-Type')).toBe('application/json');
    expect(await help.text()).toBe('');
    const health = await dispatch(new IncomingRequest(`${WORKER_URL}/health`, { method: 'HEAD' }), environment);
    expect(health.status).toBe(200);
    expect(await health.text()).toBe('');
  });
});
