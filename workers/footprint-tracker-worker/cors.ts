// CORS for the tracker is kept to two pure functions — allowlist parsing and the header
// computation for one origin — so the policy unit-tests without workerd (cors.test.ts) while
// the route stays in charge of WHERE the headers apply (only /queries*, see worker.ts).

// VIEWER_ORIGINS parsed into a list; whitespace-tolerant, empty entries dropped. NOTE the
// polarity difference from the trail collector: an empty allowlist here means NO cross-origin
// reader is ever reflected (deny by default — the data is still served, but browsers cannot read
// it cross-origin), whereas the trail worker's empty COLLECTOR_ORIGINS leaves its collector open.
// Do not copy semantics between the two workers.
//
// A LIST and a comma-separated STRING are both accepted, matching parseAllowedOrigins in the
// trail worker — the Wrangler config declares the variable as a JSON array (delivered to the
// Worker as a real array), while the Cloudflare dashboard and .dev.vars can only hold text. The
// full reasoning lives on that function; the two workers deliberately parse their origin lists
// the same way even though they gate on the result differently.
// See https://developers.cloudflare.com/workers/configuration/environment-variables/
// Pinned by 'returns only Vary: Origin when the allowlist is empty' and the array-shape cases in
// cors.test.ts.
export const parseAllowlist = (raw: string | string[] | undefined): string[] =>
  (Array.isArray(raw) ? raw : (raw ?? '').split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

// Reflected CORS with two hard rules.
// 1) Access-Control-Allow-Origin is reflected ONLY on an EXACT allowlist match — never by
//    prefix, suffix or substring, which is the classic allowlist bypass (an attacker registers
//    an origin that merely CONTAINS the allowed one, e.g.
//    footprint-overlook.pages.dev.evil.example). A non-matching origin still gets the
//    response — CORS gates reading in browsers, not serving — just without the header. Pinned
//    by 'matches only exactly — not by prefix, suffix or trailing slash' in cors.test.ts.
// 2) Vary: Origin is ALWAYS emitted, match or no match: the headers of a /queries response
//    differ by request Origin, and a shared cache that stored one variant without Vary could
//    replay a CORS-bearing response to the wrong origin (or a bare one to the viewer,
//    breaking it). Pinned by 'omits CORS headers for a non-allowlisted origin (still serves
//    the request)' in worker.test.ts, which asserts Vary survives the no-match path.
// See https://fetch.spec.whatwg.org/#http-cors-protocol and
// https://www.rfc-editor.org/rfc/rfc9110.html#name-vary
export const corsHeaders = (
  origin: string | null,
  allowlist: string[],
): Record<string, string> => {
  if (origin !== null && allowlist.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    };
  }
  return { Vary: 'Origin' };
};
