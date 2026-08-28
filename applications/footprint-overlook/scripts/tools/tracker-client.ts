// HTTP client for footprint-tracker, the read side of the footprint family. URL assembly and error
// mapping are pure functions verified with a stubbed fetch (tracker-client.test.ts); only
// fetchQuery/fetchQueries touch the network.
//
// The worker's contract, as implemented in workers/footprint-tracker-worker/worker.ts:
//   GET {base}/queries              -> 200 { queries: QueryDescriptor[] }
//   GET {base}/queries/{name}?...   -> 200 { name, rows } | 400/404/502 { error } | 405 (no body)
//   GET {base}/ and {base}/help     -> 200, a self-describing help document
//   GET {base}/health               -> 200 'ok'
// Three properties of that worker shape this module:
//   1) CORS headers are served ONLY on /queries and /queries/*, and only for an origin listed
//      exactly in the worker's VIEWER_ORIGINS var. /health, /help and / carry no CORS at all, so a
//      browser can never read them cross-origin — which is why the reachability probe below is
//      fetchQueries() and not a /health ping.
//   2) Out-of-range integer parameters are CLAMPED server-side, not rejected (limit 1..100 for
//      recent-footprints, 1..50 for every ranked query — top-pages, top-referrers,
//      views-by-country, top-platforms, top-languages, top-events), so a too-large limit still
//      answers 200 with fewer rows than asked for.
//   3) Errors carry the CORS headers too, which is what lets the messages below reach the user
//      instead of surfacing as an opaque network failure.

import { normalizeTrackerEndpoint } from './tracker-endpoint.ts';

// Parameters that may be appended to GET /queries/{name}; each is optional and omitted when unset.
//
// The worker also accepts `include_owner`, which switches OFF its owner-visit exclusion. It is
// deliberately absent here: the viewer exists to read other people's traffic, so the operator's own
// visits must never be counted, and leaving the parameter unsendable makes that a property of the
// client rather than a habit at each of the ~15 call sites. Omitting it is what the worker reads as
// include_owner=false.
export interface QueryParameters {
  from?: string;
  to?: string;
  limit?: number;
  uuid?: string;
  minutes?: number;
}

// Query metadata as served by GET /queries. `boolean` is the type the worker reports for
// `include_owner`; it appears in the catalog even though this client never sends it, and typing it
// here keeps a descriptor round-trip from widening to `string`.
export interface QueryParameterDescriptor {
  name: string;
  type: 'integer' | 'date' | 'boolean' | 'string';
  required: boolean;
  default?: number | string | boolean;
  minimum?: number;
  maximum?: number;
}

export interface QueryDescriptor {
  name: string;
  description: string;
  parameters: QueryParameterDescriptor[];
}

// Successful GET /queries/{name} response.
export interface QueryResult<Row = Record<string, unknown>> {
  name: string;
  rows: Row[];
}

// Row types, one per query, mirroring the SELECT lists in
// workers/footprint-tracker-worker/queries.ts.
//
// The nullable fields are not defensive typing: the collector stores an explicit null for uuid,
// origin, href and user_agent whenever the request or the payload did not carry one (toRecord in
// footprint-trail-worker/footprints.ts), so recent-footprints returns nulls and the two top-*
// queries — which GROUP BY those same columns — return one bucket keyed null. The aggregate
// columns (day, footprints, visitors, bot_footprints) cannot be null: day is substr() over the
// server-stamped received_at, and COUNT/SUM always produce a number.
//
// The dimension queries added for the v2 layout (referrer, country, platform, colour scheme,
// language, screen width) widen that rule rather than break it: each of those columns is read out
// of the stored JSON with json_get_str/json_get_int, which yields null whenever the path is absent
// — an older payload shape, a non-browser client, a header Cloudflare could not resolve. A GROUP BY
// over such a column therefore always CAN return one bucket keyed null, and that bucket is real
// data ("we do not know"), not a hole to drop: the viewer labels it 미상 / 미보고 instead. Two
// queries are the exceptions, and only because the worker filters server-side:
// verified-bot-categories excludes the null/empty category, and top-events keeps only
// arguments != '[]' — so their key columns are non-null strings.
export interface RecentFootprintRow {
  received_at: string;
  uuid: string | null;
  origin: string | null;
  href: string | null;
  user_agent: string | null;
  arguments: string; // JSON array, serialized
  // cf.verifiedBotCategory as Cloudflare resolved it at collection time ('Search Engine Crawler',
  // 'Monitoring & Analytics', …). On real Cloudflare traffic the ordinary-human value is the
  // EMPTY STRING — Cloudflare always sets the key and leaves it blank for non-verified requests
  // (measured on the live table; see the predicate comment in
  // workers/footprint-tracker-worker/queries.ts). Null appears only when the whole cf column is
  // null (non-Cloudflare replays) or on rows collected before this column was selected. Both
  // blank and null therefore mean "no verdict", which is why detectBotEvidence() treats them
  // identically and falls back to the User-Agent heuristic rather than reading either as
  // "certainly human".
  verified_bot_category: string | null;
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
  bot_footprints: number; // guaranteed bot_footprints <= footprints
}
export interface TopPageRow {
  href: string | null;
  footprints: number;
}
// Kept although the v2 layout no longer draws an origins panel (the single tracked site made it a
// one-bar chart): this module is the typed mirror of the worker's API surface, and top-origins is
// still served. Dropping the type here would only mean re-deriving it the next time anything reads
// that query.
export interface TopOriginRow {
  origin: string | null;
  footprints: number;
}

// period-summary answers with exactly one row. Its `visitors` is a period-wide COUNT(DISTINCT
// uuid), which is NOT the sum of the daily distinct counts: a visitor returning on three days
// counts once here and three times there. That is the whole reason the query exists — the summary
// card previously showed the daily sum and had to be labelled defensively.
export interface PeriodSummaryRow {
  views: number;
  visitors: number;
}
export interface TopReferrerRow {
  referrer: string | null;
  views: number;
}
export interface ViewsByCountryRow {
  country: string | null; // ISO 3166-1 alpha-2, as Cloudflare's cf.country reports it
  views: number;
  visitors: number;
}
export interface UserAgentRow {
  // The raw request header, verbatim — grouping happens on the exact string server-side, and the
  // compact display name is derived client-side (toUserAgentLabel). null when the client sent no
  // User-Agent header at all.
  user_agent: string | null;
  views: number;
  visitors: number;
}
// Sparse: only the hours that actually saw traffic come back, so the viewer zero-fills all 24 bins
// (fillMissingHours in tools/zero-filling.ts) before drawing.
export interface ViewsByHourRow {
  hour: string; // '00'..'23', UTC — substr(received_at, 12, 2)
  views: number;
}
export interface TopPlatformRow {
  platform: string | null;
  mobile: boolean | null;
  views: number;
}
export interface ViewsByColorSchemeRow {
  color_scheme: string | null; // 'dark' | 'light' as the browser reported it, or null
  views: number;
}
export interface TopLanguageRow {
  language: string | null; // BCP 47 tag, e.g. 'ko-KR'
  views: number;
}
export interface ViewsByScreenWidthRow {
  // Bucket key assigned by the worker's CASE WHEN, not a raw pixel value: 'under-600',
  // '600-to-1023', '1024-to-1439', '1440-to-1919', '1920-and-above', or null when the payload
  // carried no screen width at all.
  width_bucket: string | null;
  views: number;
}
export interface TopEventRow {
  arguments: string; // JSON array, serialized; never '[]' (the worker filters those out)
  views: number;
}
export interface VerifiedBotCategoryRow {
  category: string; // non-null by construction: the worker excludes the null/empty bucket
  views: number;
}

// New Query Row Interfaces for Part B
export interface UtmBreakdownRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  views: number;
}
export interface NewVsReturningByDayRow {
  day: string;
  new_visitors: number;
  returning_visitors: number;
}
export interface VisitDepthRow {
  depth_bucket: '1' | '2' | '3-5' | '6-10' | '11-plus';
  visitors: number;
}
export interface WeeklyRetentionRow {
  cohort_week: string; // 'YYYY-Www'
  week_offset: number; // 0..7
  visitors: number;
}
export interface TopLandingRow {
  href: string | null;
  landings: number;
}
export interface PageTransitionRow {
  from_href: string | null;
  to_href: string | null;
  transitions: number;
}
export interface ConnectionTypeRow {
  effective_type: 'slow-2g' | '2g' | '3g' | '4g' | null;
  views: number;
}
export interface DeviceCapabilityRow {
  memory_bucket: 'under-4' | '4-to-7' | '8-and-above' | null;
  views: number;
}
export interface AccessibilitySignalRow {
  reduced_motion: boolean | null;
  views: number;
}
export interface BotsByHourRow {
  hour: string; // '00'..'23' UTC
  views: number;
  bot_views: number;
}
export interface ViewsByMinuteRow {
  minute: string; // 'YYYY-MM-DDTHH:MM' UTC
  views: number;
}

// Query-name constants, to keep typos out of the request path.
export const QUERY_NAMES = {
  recentFootprints: 'recent-footprints',
  footprintsByDay: 'footprints-by-day',
  uniqueVisitorsByDay: 'unique-visitors-by-day',
  botsByDay: 'bots-by-day',
  periodSummary: 'period-summary',
  topPages: 'top-pages',
  topOrigins: 'top-origins',
  topReferrers: 'top-referrers',
  viewsByCountry: 'views-by-country',
  viewsByHour: 'views-by-hour',
  topPlatforms: 'top-platforms',
  viewsByColorScheme: 'views-by-color-scheme',
  topLanguages: 'top-languages',
  viewsByScreenWidth: 'views-by-screen-width',
  topEvents: 'top-events',
  verifiedBotCategories: 'verified-bot-categories',
  utmBreakdown: 'utm-breakdown',
  newVsReturningByDay: 'new-vs-returning-by-day',
  visitDepth: 'visit-depth',
  weeklyRetention: 'weekly-retention',
  topLandings: 'top-landings',
  pageTransitions: 'page-transitions',
  connectionTypes: 'connection-types',
  deviceCapabilities: 'device-capabilities',
  accessibilitySignals: 'accessibility-signals',
  botsByHour: 'bots-by-hour',
  viewsByMinute: 'views-by-minute',
  userAgents: 'user-agents',
} as const;

// Carries the upstream status alongside the message so a caller can distinguish a rejected request
// from an unreachable tracker. Status 0 is reserved for "the fetch itself failed" (offline, DNS,
// or a CORS block, which the Fetch Standard deliberately reports to script as an opaque network
// error with no status). See https://fetch.spec.whatwg.org/#concept-network-error
export class TrackerError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TrackerError';
    this.status = status;
  }
}

// Builds the GET /queries URL.
export function buildQueriesUrl(baseUrl: string): string {
  return `${normalizeTrackerEndpoint(baseUrl)}/queries`;
}

// Builds the GET /queries/{name} URL with its parameters.
// - undefined parameters are not appended.
// - the query name is percent-encoded (the worker decodes it and answers 404 for anything that
//   does not decode, so an encoded name can never become a routing surprise).
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
  if (parameters.uuid !== undefined) {
    search.set('uuid', parameters.uuid);
  }
  if (parameters.minutes !== undefined) {
    search.set('minutes', String(parameters.minutes));
  }

  const query = search.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

// Extracts the message to show from a failed response. The worker's own { error } text is
// preferred verbatim — it names the offending parameter, or passes the R2 SQL failure through on a
// 502 — and the status-based Korean sentences are only the fallback for a body that carries none
// (405, which the worker answers with no body at all, or a non-JSON error page from an
// intermediary). Pinned by the 'mapErrorMessage' suite in tracker-client.test.ts.
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
    case 405:
      return '트래커가 이 요청 방식을 허용하지 않습니다 (405).';
    case 502:
      return '트래커 upstream 에 연결하지 못했습니다 (502).';
    default:
      return `트래커 요청이 실패했습니다 (${status}).`;
  }
}

// Parses a response body as JSON, yielding null for anything that is not JSON.
async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Wraps a thrown fetch rejection as a TrackerError with status 0. The reason is included because
// it is the only clue distinguishing "wrong host" from "the origin is missing from the worker's
// VIEWER_ORIGINS allowlist" — a browser reports both as a bare network error.
function toNetworkError(networkError: unknown): TrackerError {
  const reason = networkError instanceof Error ? networkError.message : String(networkError);
  return new TrackerError(`트래커에 연결하지 못했습니다: ${reason}`, 0);
}

// Calls GET /queries/{name} and returns its rows, throwing TrackerError (status + upstream text)
// on failure. A 200 whose body lacks a rows array degrades to [] rather than throwing, so one
// malformed response empties a section instead of breaking the dashboard.
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
    throw toNetworkError(networkError);
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

// Calls GET /queries for the query catalog.
//
// This doubles as the endpoint reachability probe used by the setup card, and it has to be this
// endpoint: /health and /help are cheaper but carry no CORS headers, so a browser cannot read them
// cross-origin and every probe against them would fail identically whether or not the tracker is
// healthy. /queries is the only surface with CORS, which makes a successful call here proof of
// exactly what the dashboard needs — the URL resolves, the worker is up, and this origin is
// allowlisted in its VIEWER_ORIGINS.
export async function fetchQueries(
  baseUrl: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<QueryDescriptor[]> {
  const url = buildQueriesUrl(baseUrl);

  let response: Response;
  try {
    response = await fetchImplementation(url);
  } catch (networkError) {
    throw toNetworkError(networkError);
  }

  const body = await parseJsonSafely(response);

  if (!response.ok) {
    throw new TrackerError(mapErrorMessage(response.status, body), response.status);
  }

  const queries = (body as { queries?: unknown } | null)?.queries;
  return Array.isArray(queries) ? (queries as QueryDescriptor[]) : [];
}
