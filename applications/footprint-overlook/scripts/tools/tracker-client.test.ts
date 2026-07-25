import { describe, expect, it, vi } from 'vitest';

import {
  buildQueriesUrl,
  buildQueryUrl,
  fetchQueries,
  fetchQuery,
  mapErrorMessage,
  type RecentFootprintRow,
  TrackerError,
} from './tracker-client.ts';

// Minimal stand-in for a fetch Response.
function makeResponse(status: number, jsonBody: unknown, options: { throwOnJson?: boolean } = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (options.throwOnJson) {
        throw new Error('invalid json');
      }
      return jsonBody;
    },
  } as unknown as Response;
}

describe('buildQueriesUrl', () => {
  it('appends /queries to the base', () => {
    expect(buildQueriesUrl('http://127.0.0.1:8788')).toBe('http://127.0.0.1:8788/queries');
  });

  it('normalizes a trailing slash on the base', () => {
    expect(buildQueriesUrl('http://127.0.0.1:8788/')).toBe('http://127.0.0.1:8788/queries');
  });
});

describe('buildQueryUrl', () => {
  it('builds the bare path when no parameters are given', () => {
    expect(buildQueryUrl('http://127.0.0.1:8788', 'recent-footprints')).toBe(
      'http://127.0.0.1:8788/queries/recent-footprints',
    );
  });

  it('appends from / to / limit as a query string', () => {
    expect(
      buildQueryUrl('http://127.0.0.1:8788', 'footprints-by-day', {
        from: '2026-07-10',
        to: '2026-07-17',
        limit: 50,
      }),
    ).toBe('http://127.0.0.1:8788/queries/footprints-by-day?from=2026-07-10&to=2026-07-17&limit=50');
  });

  it('omits undefined parameters', () => {
    expect(buildQueryUrl('http://127.0.0.1:8788', 'top-pages', { from: '2026-07-10' })).toBe(
      'http://127.0.0.1:8788/queries/top-pages?from=2026-07-10',
    );
  });

  it('percent-encodes the query name', () => {
    expect(buildQueryUrl('http://x', 'a b/c')).toBe('http://x/queries/a%20b%2Fc');
  });
});

describe('mapErrorMessage', () => {
  it('prefers the upstream error text', () => {
    expect(mapErrorMessage(400, { error: 'from is required' })).toBe('from is required');
  });

  it('falls back to a status-based sentence when the body carries no error', () => {
    expect(mapErrorMessage(400, null)).toContain('400');
    expect(mapErrorMessage(404, {})).toContain('404');
    expect(mapErrorMessage(502, null)).toContain('502');
    expect(mapErrorMessage(500, null)).toContain('500');
  });

  it('describes a 405, which the worker answers with no body at all', () => {
    // worker.ts returns `new Response(null, { status: 405, headers: { Allow } })`, so there is
    // never an { error } to quote and only the fallback can say anything useful.
    expect(mapErrorMessage(405, null)).toContain('405');
  });

  it('falls back when the error text is blank', () => {
    expect(mapErrorMessage(404, { error: '   ' })).toContain('404');
  });
});

describe('fetchQuery', () => {
  it('returns { name, rows } on 200', async () => {
    const fakeFetch = vi.fn(async () =>
      makeResponse(200, { name: 'footprints-by-day', rows: [{ day: '2026-07-10', footprints: 5 }] }),
    );
    const result = await fetchQuery('http://127.0.0.1:8788', 'footprints-by-day', { from: '2026-07-10', to: '2026-07-11' }, fakeFetch as unknown as typeof fetch);

    expect(result.rows).toHaveLength(1);
    expect(fakeFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/queries/footprints-by-day?from=2026-07-10&to=2026-07-11',
    );
  });

  it('passes null column values through untouched', async () => {
    // The collector writes null for uuid / origin / href / user_agent when they are absent, so
    // the client must not coerce or drop them — the display layer decides how to render missing.
    const fakeFetch = vi.fn(async () =>
      makeResponse(200, {
        name: 'recent-footprints',
        rows: [
          {
            received_at: '2026-07-16T00:00:00Z',
            uuid: null,
            origin: null,
            href: null,
            user_agent: null,
            arguments: '[]',
          },
        ],
      }),
    );
    const result = await fetchQuery<RecentFootprintRow>(
      'http://x',
      'recent-footprints',
      {},
      fakeFetch as unknown as typeof fetch,
    );
    expect(result.rows[0].uuid).toBeNull();
    expect(result.rows[0].href).toBeNull();
  });

  it('defends against a body whose rows is not an array', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(200, { name: 'top-pages' }));
    const result = await fetchQuery('http://x', 'top-pages', {}, fakeFetch as unknown as typeof fetch);
    expect(result.rows).toEqual([]);
  });

  it('throws a TrackerError carrying the upstream text on 4xx', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(400, { error: 'to is required' }));
    await expect(fetchQuery('http://x', 'footprints-by-day', {}, fakeFetch as unknown as typeof fetch)).rejects.toThrowError(
      new TrackerError('to is required', 400),
    );
  });

  it('preserves the status on 502', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(502, { error: 'bad gateway' }));
    await expect(
      fetchQuery('http://x', 'top-origins', {}, fakeFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 502, message: 'bad gateway' });
  });

  it('handles a non-JSON error body via the status sentence', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(404, null, { throwOnJson: true }));
    await expect(
      fetchQuery('http://x', 'nope', {}, fakeFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('wraps a network failure as a TrackerError with status 0', async () => {
    const fakeFetch = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(
      fetchQuery('http://x', 'recent-footprints', {}, fakeFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 0 });
  });

  it('works with the default argument when the global fetch is stubbed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse(200, { name: 'top-pages', rows: [{ href: '/', footprints: 3 }] })),
    );
    const result = await fetchQuery('http://x', 'top-pages', { from: '2026-07-10', to: '2026-07-17' });
    expect(result.rows).toEqual([{ href: '/', footprints: 3 }]);
    vi.unstubAllGlobals();
  });
});

describe('fetchQueries', () => {
  it('returns the queries array', async () => {
    const fakeFetch = vi.fn(async () =>
      makeResponse(200, { queries: [{ name: 'recent-footprints', description: '', parameters: [] }] }),
    );
    const queries = await fetchQueries('http://x', fakeFetch as unknown as typeof fetch);
    expect(queries).toHaveLength(1);
    expect(queries[0].name).toBe('recent-footprints');
  });

  it('probes /queries — the only endpoint that carries CORS headers', async () => {
    // /health and /help would be cheaper but are unreadable cross-origin, so a probe against
    // them could never confirm the allowlist.
    const fakeFetch = vi.fn(async () => makeResponse(200, { queries: [] }));
    await fetchQueries('https://footprint-tracker.example.workers.dev/', fakeFetch as unknown as typeof fetch);
    expect(fakeFetch).toHaveBeenCalledWith('https://footprint-tracker.example.workers.dev/queries');
  });

  it('throws a TrackerError on failure', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(502, { error: 'db down' }));
    await expect(fetchQueries('http://x', fakeFetch as unknown as typeof fetch)).rejects.toMatchObject({
      status: 502,
      message: 'db down',
    });
  });

  it('reports a blocked or unreachable endpoint as status 0', async () => {
    // What a CORS rejection looks like to script: an opaque network error, no status.
    const fakeFetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(fetchQueries('https://wrong.example.com', fakeFetch as unknown as typeof fetch)).rejects.toMatchObject({
      status: 0,
    });
  });
});
