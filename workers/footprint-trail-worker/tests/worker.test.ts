import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { FootprintRecord } from '../sources/footprints.ts';
import worker from '../sources/index.ts';

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

// 실제 스트림 대신 send 호출을 그대로 붙잡는 스텁을 env 에 얹어, 워커가 흘려보낸 배치를 결정적으로 검증합니다.
const makeEnvironment = () => {
  const batches: FootprintRecord[][] = [];
  const environment = {
    ...env,
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
});

describe('routing', () => {
  it('answers ok on GET /healthz', async () => {
    const { environment } = makeEnvironment();
    const response = await dispatch(new IncomingRequest(`${WORKER_URL}/healthz`), environment);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  it('answers 405 for GET, PUT and DELETE', async () => {
    const { environment } = makeEnvironment();
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await dispatch(new IncomingRequest(`${WORKER_URL}/`, { method }), environment);
      expect(response.status).toBe(405);
    }
  });

  it('answers 405 for OPTIONS — no preflight is ever expected', async () => {
    const { environment } = makeEnvironment();
    const response = await dispatch(new IncomingRequest(`${WORKER_URL}/`, { method: 'OPTIONS' }), environment);
    expect(response.status).toBe(405);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
