import { describe, expect, it, vi } from 'vitest';

import {
  buildQueriesUrl,
  buildQueryUrl,
  fetchQueries,
  fetchQuery,
  mapErrorMessage,
  TrackerError,
} from './tracker-client.ts';

// fetch 응답을 흉내 내는 최소 헬퍼입니다.
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
  it('base 뒤에 /queries 를 붙인다', () => {
    expect(buildQueriesUrl('http://127.0.0.1:8788')).toBe('http://127.0.0.1:8788/queries');
  });

  it('base 의 끝 슬래시를 정규화한다', () => {
    expect(buildQueriesUrl('http://127.0.0.1:8788/')).toBe('http://127.0.0.1:8788/queries');
  });
});

describe('buildQueryUrl', () => {
  it('파라미터 없이 경로만 만든다', () => {
    expect(buildQueryUrl('http://127.0.0.1:8788', 'recent-footprints')).toBe(
      'http://127.0.0.1:8788/queries/recent-footprints',
    );
  });

  it('from/to/limit 을 쿼리스트링으로 붙인다', () => {
    expect(
      buildQueryUrl('http://127.0.0.1:8788', 'footprints-by-day', {
        from: '2026-07-10',
        to: '2026-07-17',
        limit: 50,
      }),
    ).toBe('http://127.0.0.1:8788/queries/footprints-by-day?from=2026-07-10&to=2026-07-17&limit=50');
  });

  it('undefined 파라미터는 붙이지 않는다', () => {
    expect(buildQueryUrl('http://127.0.0.1:8788', 'top-pages', { from: '2026-07-10' })).toBe(
      'http://127.0.0.1:8788/queries/top-pages?from=2026-07-10',
    );
  });

  it('쿼리 이름을 인코딩한다', () => {
    expect(buildQueryUrl('http://x', 'a b/c')).toBe('http://x/queries/a%20b%2Fc');
  });
});

describe('mapErrorMessage', () => {
  it('본문의 error 원문을 우선한다', () => {
    expect(mapErrorMessage(400, { error: 'from is required' })).toBe('from is required');
  });

  it('error 가 없으면 상태 코드 기반 한국어 문구를 쓴다', () => {
    expect(mapErrorMessage(400, null)).toContain('400');
    expect(mapErrorMessage(404, {})).toContain('404');
    expect(mapErrorMessage(502, null)).toContain('502');
    expect(mapErrorMessage(500, null)).toContain('500');
  });

  it('error 가 빈 문자열이면 기본 문구로 폴백한다', () => {
    expect(mapErrorMessage(404, { error: '   ' })).toContain('404');
  });
});

describe('fetchQuery', () => {
  it('200 이면 { name, rows } 를 돌려준다', async () => {
    const fakeFetch = vi.fn(async () =>
      makeResponse(200, { name: 'footprints-by-day', rows: [{ day: '2026-07-10', footprints: 5 }] }),
    );
    const result = await fetchQuery('http://127.0.0.1:8788', 'footprints-by-day', { from: '2026-07-10', to: '2026-07-11' }, fakeFetch as unknown as typeof fetch);

    expect(result.rows).toHaveLength(1);
    expect(fakeFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/queries/footprints-by-day?from=2026-07-10&to=2026-07-11',
    );
  });

  it('rows 가 배열이 아니면 빈 배열로 방어한다', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(200, { name: 'top-pages' }));
    const result = await fetchQuery('http://x', 'top-pages', {}, fakeFetch as unknown as typeof fetch);
    expect(result.rows).toEqual([]);
  });

  it('4xx 이면 원문 메시지를 담은 TrackerError 를 던진다', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(400, { error: 'to is required' }));
    await expect(fetchQuery('http://x', 'footprints-by-day', {}, fakeFetch as unknown as typeof fetch)).rejects.toThrowError(
      new TrackerError('to is required', 400),
    );
  });

  it('502 도 상태 코드를 보존한다', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(502, { error: 'bad gateway' }));
    await expect(
      fetchQuery('http://x', 'top-origins', {}, fakeFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 502, message: 'bad gateway' });
  });

  it('비 JSON 에러 본문도 상태 코드 문구로 처리한다', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(404, null, { throwOnJson: true }));
    await expect(
      fetchQuery('http://x', 'nope', {}, fakeFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('네트워크 실패는 status 0 의 TrackerError 로 감싼다', async () => {
    const fakeFetch = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(
      fetchQuery('http://x', 'recent-footprints', {}, fakeFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 0 });
  });

  it('vi.stubGlobal 로 전역 fetch 를 스텁하면 기본 인자로도 동작한다', async () => {
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
  it('queries 배열을 돌려준다', async () => {
    const fakeFetch = vi.fn(async () =>
      makeResponse(200, { queries: [{ name: 'recent-footprints', description: '', parameters: [] }] }),
    );
    const queries = await fetchQueries('http://x', fakeFetch as unknown as typeof fetch);
    expect(queries).toHaveLength(1);
    expect(queries[0].name).toBe('recent-footprints');
  });

  it('실패하면 TrackerError 를 던진다', async () => {
    const fakeFetch = vi.fn(async () => makeResponse(502, { error: 'db down' }));
    await expect(fetchQueries('http://x', fakeFetch as unknown as typeof fetch)).rejects.toMatchObject({
      status: 502,
      message: 'db down',
    });
  });
});
