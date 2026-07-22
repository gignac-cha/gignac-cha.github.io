// 트래커(쿼리 워커) HTTP 클라이언트입니다.
// URL 조립·에러 매핑은 순수 함수로 분리해 vitest(fetch 스텁)로 검증하고, fetchQuery/fetchQueries 만 실제 네트워크를 만집니다.
//
// API 규약(요약):
//   GET {base}/queries                         -> { queries: QueryDescriptor[] }
//   GET {base}/queries/{name}?from&to&limit     -> 200 { name, rows } | 4xx/5xx { error }

import { normalizeTrackerEndpoint } from './tracker-endpoint.ts';

// GET /queries/{name} 에 붙일 수 있는 파라미터입니다(모두 선택적으로 조립).
export interface QueryParameters {
  from?: string;
  to?: string;
  limit?: number;
}

// GET /queries 로 받는 쿼리 메타데이터입니다.
export interface QueryParameterDescriptor {
  name: string;
  type: 'integer' | 'date';
  required: boolean;
  default?: number | string;
  minimum?: number;
  maximum?: number;
}

export interface QueryDescriptor {
  name: string;
  description: string;
  parameters: QueryParameterDescriptor[];
}

// GET /queries/{name} 성공 응답입니다.
export interface QueryResult<Row = Record<string, unknown>> {
  name: string;
  rows: Row[];
}

// 각 쿼리의 row 타입(API 규약과 1:1).
export interface RecentFootprintRow {
  received_at: string;
  uuid: string;
  origin: string;
  href: string;
  user_agent: string;
  arguments: string; // JSON 배열 문자열
}
export interface FootprintsByDayRow {
  day: string;
  footprints: number;
}
export interface UniqueVisitorsByDayRow {
  day: string;
  visitors: number;
}
export interface BotsByDayRow {
  day: string;
  footprints: number;
  bot_footprints: number; // bot_footprints <= footprints 보장
}
export interface TopPageRow {
  href: string;
  footprints: number;
}
export interface TopOriginRow {
  origin: string;
  footprints: number;
}

// 쿼리 이름 상수(오타 방지).
export const QUERY_NAMES = {
  recentFootprints: 'recent-footprints',
  footprintsByDay: 'footprints-by-day',
  uniqueVisitorsByDay: 'unique-visitors-by-day',
  botsByDay: 'bots-by-day',
  topPages: 'top-pages',
  topOrigins: 'top-origins',
} as const;

// 트래커가 에러를 돌려줬을 때 상태 코드와 함께 원문 메시지를 전달하는 오류 타입입니다.
export class TrackerError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TrackerError';
    this.status = status;
  }
}

// GET /queries 의 URL 을 조립합니다.
export function buildQueriesUrl(baseUrl: string): string {
  return `${normalizeTrackerEndpoint(baseUrl)}/queries`;
}

// GET /queries/{name} 의 URL 을 파라미터와 함께 조립합니다.
// - undefined 파라미터는 붙이지 않습니다.
// - 쿼리 이름은 인코딩합니다.
export function buildQueryUrl(baseUrl: string, queryName: string, parameters: QueryParameters = {}): string {
  const base = normalizeTrackerEndpoint(baseUrl);
  const path = `${base}/queries/${encodeURIComponent(queryName)}`;
  const search = new URLSearchParams();

  if (parameters.from !== undefined) {
    search.set('from', parameters.from);
  }
  if (parameters.to !== undefined) {
    search.set('to', parameters.to);
  }
  if (parameters.limit !== undefined) {
    search.set('limit', String(parameters.limit));
  }

  const query = search.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

// 응답 상태와 파싱된 본문에서 사용자에게 보여줄 에러 메시지를 뽑습니다.
// 트래커가 { error } 를 주면 그 원문을 우선하고, 없으면 상태 코드 기반 한국어 기본 문구를 씁니다.
export function mapErrorMessage(status: number, body: unknown): string {
  if (body !== null && typeof body === 'object' && 'error' in body) {
    const errorText = (body as { error: unknown }).error;
    if (typeof errorText === 'string' && errorText.trim().length > 0) {
      return errorText;
    }
  }

  switch (status) {
    case 400:
      return '요청 파라미터가 올바르지 않습니다 (400).';
    case 404:
      return '해당 쿼리를 찾을 수 없습니다 (404).';
    case 502:
      return '트래커 upstream 에 연결하지 못했습니다 (502).';
    default:
      return `트래커 요청이 실패했습니다 (${status}).`;
  }
}

// 응답 본문을 안전하게 JSON 으로 파싱합니다(비 JSON 이면 null).
async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// GET /queries/{name} 을 호출해 rows 를 돌려줍니다. 실패 시 TrackerError(상태코드+원문)를 던집니다.
export async function fetchQuery<Row = Record<string, unknown>>(
  baseUrl: string,
  queryName: string,
  parameters: QueryParameters = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<QueryResult<Row>> {
  const url = buildQueryUrl(baseUrl, queryName, parameters);

  let response: Response;
  try {
    response = await fetchImplementation(url);
  } catch (networkError) {
    // 네트워크 자체 실패(CORS·오프라인 등)는 상태 코드가 없으므로 0 으로 표기합니다.
    const reason = networkError instanceof Error ? networkError.message : String(networkError);
    throw new TrackerError(`트래커에 연결하지 못했습니다: ${reason}`, 0);
  }

  const body = await parseJsonSafely(response);

  if (!response.ok) {
    throw new TrackerError(mapErrorMessage(response.status, body), response.status);
  }

  const result = body as QueryResult<Row> | null;
  return {
    name: result?.name ?? queryName,
    rows: Array.isArray(result?.rows) ? result.rows : [],
  };
}

// GET /queries 로 쿼리 목록을 가져옵니다.
export async function fetchQueries(
  baseUrl: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<QueryDescriptor[]> {
  const url = buildQueriesUrl(baseUrl);

  let response: Response;
  try {
    response = await fetchImplementation(url);
  } catch (networkError) {
    const reason = networkError instanceof Error ? networkError.message : String(networkError);
    throw new TrackerError(`트래커에 연결하지 못했습니다: ${reason}`, 0);
  }

  const body = await parseJsonSafely(response);

  if (!response.ok) {
    throw new TrackerError(mapErrorMessage(response.status, body), response.status);
  }

  const queries = (body as { queries?: unknown } | null)?.queries;
  return Array.isArray(queries) ? (queries as QueryDescriptor[]) : [];
}
