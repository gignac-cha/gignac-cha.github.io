import { corsHeaders, parseAllowlist } from './cors.ts';
import {
  findQuery,
  listQueries,
  ParameterError,
  parseOwnerUUIDs,
  validateParameters,
} from './queries.ts';
import { queryR2SQL } from './r2-sql.ts';

// footprint-tracker: the read side of the footprint family — a read-only, parameterized JSON
// query API over the collected footprints (Iceberg table `footprint.trail`, queried through
// R2 SQL, https://developers.cloudflare.com/r2-sql/). This module is deliberately a THIN layer:
// routing, CORS application, the upstream call, and error mapping live here, while everything
// with logic in it is delegated to pure modules that unit-test without workerd — parameter
// validation and SQL building (queries.ts), allowlist/CORS computation (cors.ts), and the
// upstream client (r2-sql.ts). The error contract at this boundary: invalid parameters
// (ParameterError) → 400, unknown or undecodable query name → 404, upstream/configuration
// failure (R2SQLError, ConfigurationError) → 502. Pinned end to end by worker.test.ts.

const QUERIES_PREFIX = '/queries/';

// Every method this worker answers on some path. Served as the Allow header on OPTIONS
// responses and on every 405, where RFC 9110 §15.5.6 REQUIRES an Allow header:
// https://www.rfc-editor.org/rfc/rfc9110.html#name-405-method-not-allowed
// Pinned by 'carries Allow on OPTIONS and on 405 responses' in worker.test.ts.
const ALLOWED_METHODS = 'GET, HEAD, OPTIONS';

// Machine-readable self-description, served verbatim at both GET / and GET /help.
const HELP = {
  name: 'footprint-tracker',
  description: 'Read-only JSON query API over collected footprints (backed by R2 SQL).',
  endpoints: [
    { method: 'GET', path: '/', description: 'This document.' },
    { method: 'GET', path: '/help', description: 'This document.' },
    { method: 'GET', path: '/health', description: 'Health check ("ok").' },
    { method: 'GET', path: '/queries', description: 'Catalog of available queries and their parameters.' },
    { method: 'GET', path: '/queries/{name}', description: 'Run a query; parameters via the query string.' },
  ],
};

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
    const response = await route(request, environment);
    // HEAD is GET with the content stripped (RFC 9110 §9.3.2 — "identical to GET except that
    // the server MUST NOT send content"), so fetch() is a thin wrapper: route() handles HEAD as
    // GET, and only the body is withheld here while status and headers (including CORS and
    // Content-Type) pass through untouched. Stripping in ONE place gives every present and
    // future route HEAD support for free — do not "simplify" this into per-route handling.
    // Pinned by 'answers HEAD like GET with the body stripped and headers (incl. CORS)
    // preserved' in worker.test.ts.
    // See https://www.rfc-editor.org/rfc/rfc9110.html#name-head
    if (request.method === 'HEAD') {
      return new Response(null, { status: response.status, headers: response.headers });
    }
    return response;
  },
} satisfies ExportedHandler<Env>;

const route = async (request: Request, environment: Env): Promise<Response> => {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method === 'HEAD' ? 'GET' : request.method;
  const origin = request.headers.get('Origin');
  const allowlist = parseAllowlist(environment.VIEWER_ORIGINS);

  // CORS is applied ONLY to /queries and /queries/* responses — success AND error alike — and
  // only reflects an origin that matches the VIEWER_ORIGINS allowlist exactly (see cors.ts).
  // The /queries* endpoints are the one surface the browser-based viewer reads cross-origin;
  // the introspection paths (/, /help, /health) are for humans and same-origin tools and
  // deliberately carry no CORS headers at all. Errors must carry CORS too: without the headers
  // a browser surfaces an opaque network error and the viewer could never tell a 400 from a
  // 502. Pinned by the 'CORS posture on /queries' suite, 'answers 400 with CORS for a missing
  // required parameter', and the no-CORS assertions in the /health and /help tests in
  // worker.test.ts. See https://fetch.spec.whatwg.org/#http-cors-protocol
  const isQueriesPath = pathname === '/queries' || pathname.startsWith(QUERIES_PREFIX);
  const cors = isQueriesPath ? corsHeaders(origin, allowlist) : {};

  // OPTIONS serves two different jobs depending on the path. On /queries* it is a real CORS
  // preflight answer — unlike the trail collector (whose posts are CORS-simple and never
  // preflight), this API IS read cross-origin by the viewer, so a browser may probe first:
  // 204 with Access-Control-Allow-Methods: GET, plus the reflected origin when allowlisted.
  // Everywhere else it is plain HTTP method discovery and gets Allow only, no CORS at all.
  // Pinned by 'answers an OPTIONS preflight with 204, CORS and Allow-Methods for an allowed
  // origin', 'answers OPTIONS with 204 and Allow-Methods but no CORS for a disallowed origin'
  // and 'answers OPTIONS on a non-/queries path with 204 and no CORS at all' in
  // worker.test.ts. See https://fetch.spec.whatwg.org/#cors-preflight-fetch
  if (method === 'OPTIONS') {
    if (isQueriesPath) {
      return new Response(null, {
        status: 204,
        headers: { ...cors, Allow: ALLOWED_METHODS, 'Access-Control-Allow-Methods': 'GET' },
      });
    }
    return new Response(null, { status: 204, headers: { Allow: ALLOWED_METHODS } });
  }

  if (method !== 'GET') {
    // RFC 9110 §15.5.6 REQUIRES an Allow header on every 405. On /queries* the CORS headers
    // ride along too (when the origin is allowlisted) so a browser can actually READ the
    // failure instead of surfacing an opaque network error. Pinned by 'carries Allow on
    // OPTIONS and on 405 responses' and 'answers 405 with CORS on /queries for an allowed
    // origin (browser can read the failure)' in worker.test.ts.
    // See https://www.rfc-editor.org/rfc/rfc9110.html#name-405-method-not-allowed
    return new Response(null, { status: 405, headers: { ...cors, Allow: ALLOWED_METHODS } });
  }

  if (pathname === '/health') {
    return new Response('ok');
  }

  // The help document is SERVED at both / and /help — the same body from each path directly,
  // not a redirect from one to the other, so either address answers in a single round trip.
  // Pinned by 'serves the same help document at both paths (no redirect), without CORS or
  // upstream calls' in worker.test.ts.
  if (pathname === '/' || pathname === '/help') {
    return json(HELP, 200);
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
      // decodeURIComponent() throws a URIError on malformed percent-encoding (e.g.
      // /queries/%zz); uncaught, that would turn a garbage URL into a worker exception and a
      // 500. A name that cannot even be decoded can never match a catalog entry, so it is
      // answered exactly like any other unknown query: 404. Pinned by 'answers 404 for a
      // malformed percent-encoded query name instead of crashing' in worker.test.ts.
      // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent
      return json({ error: `unknown query: ${rawName}` }, 404, cors);
    }
    const definition = findQuery(name);
    if (!definition) {
      return json({ error: `unknown query: ${name}` }, 404, cors);
    }

    try {
      const values = validateParameters(definition, url.searchParams);
      // Parsed per request, not memoized at module scope. Two reasons: `environment` simply does
      // not exist at module scope in a Worker (bindings arrive as a fetch() argument), and doing
      // it inside the try keeps a malformed OWNER_UUIDS on the REQUEST path — it surfaces as a
      // 502 carrying `invalid owner uuid: ...` instead of as an isolate that fails to start with
      // no message at all. The cost is a split plus one regex test per entry, nothing next to the
      // upstream round trip on the very next line.
      // See https://developers.cloudflare.com/workers/configuration/environment-variables/
      const ownerUUIDs = parseOwnerUUIDs(environment.OWNER_UUIDS);
      const sql = definition.buildSQL(environment.TABLE_NAME, values, ownerUUIDs);
      const rows = await queryR2SQL(environment, sql);
      return json({ name, rows }, 200, cors);
    } catch (error) {
      // One try wraps validation, SQL building and the upstream call so `values` stays a const
      // and every error maps in one place. The split by fault: a bad parameter value is the
      // caller's mistake (ParameterError → 400), while everything past validation is on our
      // side — R2SQLError (upstream unreachable, non-2xx, or a success:false envelope — see
      // r2-sql.ts) and ConfigurationError (poisoned TABLE_NAME or OWNER_UUIDS — see queries.ts)
      // both map to 502 Bad Gateway (RFC 9110 §15.6.3), passing the upstream message through for
      // the viewer and the logs. Pinned by 'answers 400 with CORS for a missing required
      // parameter', 'answers 502 (not 400, not 200) for a poisoned OWNER_UUIDS var and never
      // calls upstream', and the three 502 tests in worker.test.ts.
      // See https://www.rfc-editor.org/rfc/rfc9110.html#name-502-bad-gateway
      if (error instanceof ParameterError) {
        return json({ error: error.message }, 400, cors);
      }
      const message = error instanceof Error ? error.message : 'upstream error';
      return json({ error: message }, 502, cors);
    }
  }

  return json({ error: 'not found' }, 404, cors);
};
