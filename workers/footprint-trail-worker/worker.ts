import { buildFootprint, parsePayload, toRecord } from './footprints.ts';

// 64 KiB is the ceiling a well-behaved client can ever send: the W3C Beacon spec lets user agents
// cap the total in-flight sendBeacon payload, and Chromium enforces exactly 64 KiB — so the
// footprint library's beacon (or its same-body fetch fallback) can never legitimately exceed it.
// Anything larger is by definition not our client — hand-crafted or abusive — and is cut off with
// 413 before JSON.parse ever sees it, which also bounds the memory one request can cost.
// See https://www.w3.org/TR/beacon/ (transmission restrictions) and
// https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
const MAXIMUM_BODY_BYTES = 64 * 1024;

// Every method this worker answers on some path. Served on OPTIONS responses and on every 405,
// where RFC 9110 §15.5.6 REQUIRES an Allow header:
// https://www.rfc-editor.org/rfc/rfc9110.html#name-405-method-not-allowed
const ALLOWED_METHODS = 'GET, HEAD, POST, OPTIONS';

// COLLECTOR_ORIGINS (comma-separated) parsed into a set; whitespace-tolerant, empty entries
// dropped. An empty result means "no allowlist" and the collector stays fully open.
const parseAllowedOrigins = (raw: string | undefined): Set<string> =>
  new Set(
    (raw ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );

// Machine-readable self-description, served verbatim at both GET / and GET /help.
const HELP = {
  name: 'footprint-trail',
  description:
    'Footprint collector: POST one JSON object as text/plain (at most 64 KiB) on any path and it is streamed to storage. Collection responses are status-only.',
  endpoints: [
    { method: 'POST', path: '/*', description: 'Collect one footprint. 204 on success, 400 for a non-object body, 413 over 64 KiB.' },
    { method: 'GET', path: '/health', description: 'Health check ("ok").' },
    { method: 'GET', path: '/', description: 'This document.' },
    { method: 'GET', path: '/help', description: 'This document.' },
  ],
};

// Collector contract, the server half of the footprint library's send() transport:
// - Footprints arrive as CORS-simple POSTs (text/plain body), which per the Fetch Standard need
//   no preflight — so this worker serves NO CORS headers at all, and any origin can deliver to it
//   with zero per-site configuration. "Adding CORS" here would be pure noise: the OPTIONS
//   preflight it implies never happens, and neither sendBeacon nor a keepalive fetch ever reads
//   the response. Pinned by 'sends no CORS headers at all' and 'answers OPTIONS with 204 + Allow
//   and still no CORS headers' in worker.test.ts.
//   See https://fetch.spec.whatwg.org/#cors-safelisted-request-header
// - Collection responses are therefore status-only (204 on success): there is no reader on the
//   other side. Only the introspection paths (/, /help, /health) return content.
// - This worker's only job is validate + enqueue: accepted footprints go into the Pipelines
//   stream (STREAM binding), and the pipeline delivers them to the R2 Data Catalog sink as
//   Parquet. See https://developers.cloudflare.com/pipelines/
export default {
  async fetch(request, environment, context): Promise<Response> {
    const url = new URL(request.url);

    // HEAD is GET with the content stripped (RFC 9110 §9.3.2 — "identical to GET except that the
    // server MUST NOT send content"), so it is routed as GET and only the body is withheld.
    // Pinned by 'answers HEAD like GET with the body stripped' in worker.test.ts.
    // See https://www.rfc-editor.org/rfc/rfc9110.html#name-head
    const isHead = request.method === 'HEAD';
    const method = isHead ? 'GET' : request.method;
    const respond = (body: string, headers?: Record<string, string>): Response =>
      new Response(isHead ? null : body, { headers });

    if (method === 'GET') {
      if (url.pathname === '/health') {
        return respond('ok');
      }
      // The help document is SERVED at both / and /help — the same body from each path directly,
      // not a redirect from one to the other, so either address answers in a single round trip.
      // Pinned by 'serves the same help document at GET / and GET /help (no redirect)'.
      if (url.pathname === '/' || url.pathname === '/help') {
        return respond(`${JSON.stringify(HELP, null, 2)}\n`, { 'Content-Type': 'application/json' });
      }
      return new Response(null, { status: 404 });
    }
    if (method === 'OPTIONS') {
      // Plain HTTP method discovery, NOT a CORS preflight answer: footprints are CORS-simple and
      // never preflight (see the contract above), so only Allow is served — no CORS headers.
      // Pinned by 'answers OPTIONS with 204 + Allow and still no CORS headers (never a preflight)'.
      return new Response(null, { status: 204, headers: { Allow: ALLOWED_METHODS } });
    }
    // Collection accepts only POST — but on ANY path: the endpoint URL that host pages seed into
    // browser storage may carry an arbitrary path (e.g. /collect/<id>), and rejecting on path
    // would silently drop those deliveries. Pinned by 'accepts a POST on any path (the endpoint
    // may include one)' in worker.test.ts.
    if (method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: ALLOWED_METHODS } });
    }

    // Origin allowlist — the one hardening knob this collector has (the COLLECTOR_ORIGINS var).
    // A public collector URL can be POSTed to by anyone, including other sites pointing their
    // pages at our endpoint; when the allowlist is configured, a request that CARRIES an Origin
    // header must match one entry exactly or it is dropped with 403 before the body is even read.
    // Requests WITHOUT an Origin (bots, curl, server-side clients) deliberately pass: this
    // project records all page access including bots, and non-browser clients simply do not send
    // the header. This is a tripwire for honest misuse, not an authentication boundary — the
    // header is trivially forged outside a browser. An empty/unset var keeps the collector open.
    // Pinned by the 'origin allowlist (COLLECTOR_ORIGINS)' suite in worker.test.ts.
    // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin
    const allowedOrigins = parseAllowedOrigins(environment.COLLECTOR_ORIGINS);
    const requestOrigin = request.headers.get('Origin');
    if (allowedOrigins.size > 0 && requestOrigin !== null && requestOrigin !== '' && !allowedOrigins.has(requestOrigin)) {
      return new Response(null, { status: 403 });
    }

    // The limit is enforced on real BYTES because the cheaper signals both lie: the
    // Content-Length header is optional (chunked transfer has none) and is not guaranteed to
    // match the decoded body size (RFC 9110 §8.6), and JavaScript's string .length counts UTF-16
    // code units, not bytes — '가'.repeat(30000) is 30,000 code units but ~90 KiB of UTF-8.
    // Reading the raw ArrayBuffer first yields the one number the 64 KiB contract is actually
    // about; the text is decoded only after the size check has passed. Pinned by the two 413
    // tests in worker.test.ts (including the multibyte one).
    // See https://www.rfc-editor.org/rfc/rfc9110.html#name-content-length and
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length
    const bodyBytes = await request.arrayBuffer();
    if (bodyBytes.byteLength > MAXIMUM_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }
    const bodyText = new TextDecoder().decode(bodyBytes);
    const payload = parsePayload(bodyText);
    if (!payload) {
      return new Response(null, { status: 400 });
    }

    const footprint = buildFootprint(payload, {
      receivedAt: new Date().toISOString(),
      origin: request.headers.get('Origin') ?? undefined,
      userAgent: request.headers.get('User-Agent') ?? undefined,
      cf: request.cf as Record<string, unknown> | undefined,
    });
    // The 204 must not wait for stream delivery: sendBeacon/keepalive-fetch clients never read
    // the response, and a page mid-unload benefits from the fastest possible ack.
    // context.waitUntil() keeps this worker alive until STREAM.send() settles AFTER the response
    // has already been returned. If the send rejects, the footprint is lost by design —
    // collection is fire-and-forget analytics, the observability logs are the audit trail, and
    // no retry queue is worth the complexity here.
    // See https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil
    context.waitUntil(environment.STREAM.send([toRecord(footprint)]));

    return new Response(null, { status: 204 });
  },
} satisfies ExportedHandler<Env>;
