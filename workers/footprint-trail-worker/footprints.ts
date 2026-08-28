// The three sources one collected footprint is built from, each kept exactly as it arrived. No
// promotion, filtering or reshaping happens here: toRecord() below is the SINGLE place where the
// wide row is produced, so the column list cannot drift from the schema (see its comment).
export type Footprint = {
  receivedAt: string;
  headers: Record<string, string>;
  cf: Record<string, unknown> | undefined;
  payload: Record<string, unknown>;
};

// What the worker hands buildFootprint() alongside the parsed body — the parts of a request the
// BODY cannot be trusted for, or cannot carry at all: receivedAt is stamped SERVER-side (the
// client clock is neither trusted nor required), headers are the request's own (always present,
// and costlier to fake than a JSON field), and cf is Cloudflare's request metadata (country,
// colo, …) which the client could not provide. The whole header MAP travels here — the previous
// 8-column row promoted only origin/user-agent, while the wide row splits four header columns out
// of it and stores the rest as `headers` / `headers_remains`.
// See https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties
export type FootprintContext = {
  receivedAt: string;
  headers: Record<string, string>;
  cf: Record<string, unknown> | undefined;
};

// One row in the Pipelines stream — and therefore one row of the Iceberg table, because the
// stream's schema (stream-schema.json, kept in lockstep with this type AND with toRecord()) is
// what the R2 Data Catalog sink turns into table columns. Every column is a STRING: container
// columns hold JSON text, promoted scalar columns hold the raw value.
//
// The row is WIDE (24 columns) for one hard reason. R2 SQL's json_get_*() fails the ENTIRE query
// — error 40004, "argument 1 exceeds the maximum byte length of 2000" — as soon as the column
// value it reads is longer than 2000 bytes, an undocumented limit that no setting relaxes. The
// browser payload alone averages ~1.9 KB, so 80% of live rows were already over it and every
// metric that reached inside `payload` (referrer, language, screen, colorScheme, …) evaluated to
// NULL. Splitting the three big sources into per-path columns puts every queried value far under
// the limit (largest split column measured: 947 B), while `headers`, `cf` and `payload` stay
// VERBATIM as the lossless archive that nothing queries — replay and backfill read those.
//
// Naming: `__` is a JSON path descent that keeps the source key's own casing
// (`payload__navigator__userAgentHints`); header names are lowercased with `-` → `_`
// (`sec-ch-ua` → `headers__sec_ch_ua`). The `_remains` suffix means "the source minus whatever
// was lifted out of it into its own column" and exists only on the three top-level sources — the
// only names that would otherwise collide with their verbatim copy. Deeper containers
// (`payload__location`) need no suffix, because no verbatim copy of them exists.
//
// Absent sources become explicit `null` (never an omitted key) so every row carries the full
// column set: Pipelines silently DISCARDS events that do not match the stream schema, which is
// also why stream-schema.json marks only received_at and payload required. Pinned by 'produces
// the full 24-column row from one source object' and 'maps every absent source to null so the
// record schema stays stable' in footprints.test.ts.
// See https://developers.cloudflare.com/r2/sql/ and
// https://developers.cloudflare.com/pipelines/ and, on why an Iceberg schema change is worth
// designing around, https://iceberg.apache.org/spec/#schema-evolution
export type FootprintRecord = {
  received_at: string;
  headers: string;
  headers_remains: string;
  headers__origin: string | null;
  headers__referer: string | null;
  headers__user_agent: string | null;
  headers__sec_ch_ua: string | null;
  cf: string | null;
  cf_remains: string | null;
  cf__tlsClientAuth: string | null;
  cf__tlsExportedAuthenticator: string | null;
  cf__edgeL4: string | null;
  cf__requestHeaderNames: string | null;
  payload: string;
  payload_remains: string;
  payload__uuid: string | null;
  payload__arguments: string | null;
  payload__location: string | null;
  payload__location__href: string | null;
  payload__document: string | null;
  payload__document__referrer: string | null;
  payload__navigator: string | null;
  payload__navigator__userAgent: string | null;
  payload__navigator__userAgentHints: string | null;
};

// Headers that must never reach storage, in ANY column. `cookie` duplicates the visitor uuid the
// payload already carries and, on a third-party site, can carry that site's SESSION TOKENS —
// collecting analytics must not turn this worker into a credential store; `authorization` is the
// same hazard in its most literal form. They are dropped where the header map is BUILT, so no
// later code path can leak them: `headers` and `headers_remains` are both derived from the
// already-filtered map, and nothing else ever reads request.headers into a record. Pinned by
// 'never stores the cookie or authorization header in any column' in footprints.test.ts and by
// its end-to-end twin in worker.test.ts.
// See https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cookie
const REDACTED_HEADER_NAMES = new Set(['cookie', 'authorization']);

// Every request header as a plain object with LOWERCASE names — the source of the `headers`
// column and of the four `headers__*` columns split out of it. Field names are case-insensitive
// (RFC 9110 §5.1) and the Fetch Standard already yields them lowercased when a Headers object is
// iterated, but the lowercasing is repeated here because COLUMN names are derived from these
// keys: a runtime that ever handed back `User-Agent` would silently move the value out of
// `headers__user_agent` and into `headers_remains`, breaking every query reading that column.
// Pinned by 'lowercases header names' in footprints.test.ts.
// See https://www.rfc-editor.org/rfc/rfc9110.html#name-field-names and
// https://fetch.spec.whatwg.org/#concept-header-list-sort-and-combine
export const buildHeaders = (headers: Headers): Record<string, string> => {
  const collected: Record<string, string> = {};
  headers.forEach((value, name) => {
    const lowercasedName = name.toLowerCase();
    if (REDACTED_HEADER_NAMES.has(lowercasedName)) {
      return;
    }
    collected[lowercasedName] = value;
  });
  return collected;
};

// Only a JSON OBJECT is a footprint. Arrays and primitives are valid JSON but cannot carry the
// uuid/arguments/location shape toRecord() decomposes, so they are rejected here (the caller
// answers 400) instead of turning garbage into empty-but-stored records.
export const parsePayload = (bodyText: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

// A container the decomposition can descend into. Arrays are excluded on purpose: destructuring
// one into `{ ...remainder }` would turn it into an index-keyed object, so an array-valued source
// counts as un-splittable and is kept whole by remainderOrNull() below.
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const objectOrEmpty = (value: unknown): Record<string, unknown> =>
  isPlainObject(value) ? value : {};

// A source is ABSENT when its key was missing (request.cf on a local replay, a page with no
// document.referrer) or explicitly null. Both mean "nothing to store", and mapping the JSON null
// onto a SQL NULL keeps `<column> IS NULL` the single test a query has to write. Pinned by 'maps
// every absent source to null so the record schema stays stable' in footprints.test.ts.
const isAbsent = (value: unknown): boolean => value === undefined || value === null;

// A container column whose whole value was lifted into it (nothing was split out from inside).
const jsonOrNull = (value: unknown): string | null => (isAbsent(value) ? null : JSON.stringify(value));

// A container column holding what is LEFT of a source after the keys with their own columns were
// lifted out of it. A source that is present but not a plain object is stored WHOLE, because
// nothing could be lifted out of it: dropping it would blind the split columns to a value the
// verbatim archive still has, for no gain. Pinned by 'reassembles the original payload from
// payload_remains and the lifted columns' and 'keeps a malformed container whole instead of
// dropping it' in footprints.test.ts.
const remainderOrNull = (source: unknown, remainder: Record<string, unknown>): string | null =>
  isAbsent(source) ? null : JSON.stringify(isPlainObject(source) ? remainder : source);

// Pairs the parsed body with the request-side context. Deliberately dumb — it copies, it does not
// interpret: every promotion decision lives in toRecord(), so there is exactly one place where a
// column can be added, renamed or lost.
export const buildFootprint = (
  payload: Record<string, unknown>,
  context: FootprintContext,
): Footprint => ({
  receivedAt: context.receivedAt,
  headers: context.headers,
  cf: context.cf,
  payload,
});

// The whole column split, in one expression. Each source is destructured ONCE — the lifted keys
// become their own columns and the rest object becomes the matching `_remains`/container column —
// so a column and the key its neighbour excludes can never disagree, and adding a column is a
// single edit here plus its twin in stream-schema.json. The verbatim `headers`/`cf`/`payload`
// columns are serialized from the untouched sources, never from the leftovers, so the archive
// stays lossless no matter what gets promoted (invariant 1 of the design).
//
// Scalar columns store the RAW string, not JSON text, so `WHERE payload__uuid = '…'` and `ILIKE`
// on `headers__user_agent` work directly — no json_get_*() call and therefore no 2000-byte
// hazard. A non-string value in a scalar position is dropped to null rather than stored quoted;
// the verbatim column still carries it. Pinned by 'stores promoted scalars as raw unquoted
// strings' in footprints.test.ts.
export const toRecord = (footprint: Footprint): FootprintRecord => {
  const { receivedAt, headers, cf, payload } = footprint;

  const {
    origin: headerOrigin,
    referer: headerReferer,
    'user-agent': headerUserAgent,
    'sec-ch-ua': headerSecChUa,
    ...headersRemains
  } = headers;
  const {
    tlsClientAuth,
    tlsExportedAuthenticator,
    edgeL4,
    requestHeaderNames,
    ...cfRemains
  } = objectOrEmpty(cf);
  const {
    uuid,
    arguments: arguments_,
    location: payloadLocation,
    document: payloadDocument,
    navigator: payloadNavigator,
    ...payloadRemains
  } = payload;
  const { href, ...locationRemains } = objectOrEmpty(payloadLocation);
  const { referrer, ...documentRemains } = objectOrEmpty(payloadDocument);
  const {
    userAgent: navigatorUserAgent,
    userAgentHints,
    ...navigatorRemains
  } = objectOrEmpty(payloadNavigator);

  return {
    received_at: receivedAt,
    headers: JSON.stringify(headers),
    headers_remains: JSON.stringify(headersRemains),
    headers__origin: stringOrUndefined(headerOrigin) ?? null,
    // Referer and the two URL columns below are unbounded by nature, which is precisely why each
    // one is isolated in its own scalar column instead of sharing a container with values that
    // queries depend on.
    headers__referer: stringOrUndefined(headerReferer) ?? null,
    headers__user_agent: stringOrUndefined(headerUserAgent) ?? null,
    headers__sec_ch_ua: stringOrUndefined(headerSecChUa) ?? null,
    cf: jsonOrNull(cf),
    cf_remains: remainderOrNull(cf, cfRemains),
    cf__tlsClientAuth: jsonOrNull(tlsClientAuth),
    // Present only on some handshakes (152 of 280 live rows carried it), so null here is the
    // NORMAL case, not a failure. Pinned by 'leaves cf__tlsExportedAuthenticator null when the
    // handshake did not carry one' in footprints.test.ts.
    cf__tlsExportedAuthenticator: jsonOrNull(tlsExportedAuthenticator),
    cf__edgeL4: jsonOrNull(edgeL4),
    cf__requestHeaderNames: jsonOrNull(requestHeaderNames),
    payload: JSON.stringify(payload),
    payload_remains: JSON.stringify(payloadRemains),
    payload__uuid: stringOrUndefined(uuid) ?? null,
    // step() arguments are developer-supplied values of any shape and any size — exactly why they
    // get their own column instead of riding inside payload_remains next to the fields dashboards
    // depend on.
    payload__arguments: jsonOrNull(arguments_),
    payload__location: remainderOrNull(payloadLocation, locationRemains),
    payload__location__href: stringOrUndefined(href) ?? null,
    payload__document: remainderOrNull(payloadDocument, documentRemains),
    payload__document__referrer: stringOrUndefined(referrer) ?? null,
    payload__navigator: remainderOrNull(payloadNavigator, navigatorRemains),
    payload__navigator__userAgent: stringOrUndefined(navigatorUserAgent) ?? null,
    payload__navigator__userAgentHints: jsonOrNull(userAgentHints),
  };
};
