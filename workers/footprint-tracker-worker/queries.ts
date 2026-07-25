// Parameterized query catalog for footprint-tracker. Everything in this module is a PURE
// function, so the whole SQL-building surface unit-tests without workerd (queries.test.ts runs
// it directly).
//
// THE security invariant of this worker: user input NEVER reaches SQL as a free string. The
// R2 SQL HTTP API accepts one opaque query string ({ query: "..." }) and offers no
// bind-parameter mechanism, so "parameterized" here means validate-then-embed-as-literal —
// every value is forced through a strict character allowlist before it may appear in SQL (the
// input-validation defense of
// https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html):
//   - integer: must match /^-?\d+$/, then Number.isInteger, then clamp to [minimum, maximum] —
//     embedded only as a bare numeric literal.
//   - date: must match /^\d{4}-\d{2}-\d{2}$/ — a matching value contains only digits and
//     hyphens, so once single-quoted it cannot break out of its quotes.
//   - boolean: must be exactly 'true' or 'false' — it never reaches SQL as text at all, only as
//     a branch that selects between two code-constant SQL fragments.
//   - table name: comes from trusted wrangler config, but is re-validated with
//     /^[A-Za-z0-9_.]+$/ at build time anyway (defense in depth).
//   - owner uuids: come from trusted wrangler config (OWNER_UUIDS), but are re-validated with
//     /^[A-Za-z0-9_-]{1,128}$/ at build time anyway (defense in depth).
// Do not "simplify" any of this into direct string interpolation — there is no second line of
// defense downstream. Pinned by the 'SQL injection attempts are rejected' suite in
// queries.test.ts and by 'answers 400 for injection attempts and never calls upstream' in
// worker.test.ts.

export type ParameterDescriptor =
  | {
      name: string;
      type: 'integer';
      required: boolean;
      default: number;
      minimum: number;
      maximum: number;
    }
  | {
      name: string;
      type: 'date';
      required: boolean;
    }
  | {
      name: string;
      type: 'boolean';
      required: boolean;
      default: boolean;
    };

export type ParameterValues = Record<string, number | string | boolean>;

export interface QueryDefinition {
  name: string;
  description: string;
  parameters: ParameterDescriptor[];
  // `ownerUUIDs` is the validated OWNER_UUIDS list (see parseOwnerUUIDs below), threaded through
  // as an explicit third argument rather than read from a module-level global: buildSQL must
  // stay pure so queries.test.ts can build every SQL string with no environment at all — tests
  // that do not exercise the feature simply pass [].
  buildSQL: (table: string, values: ParameterValues, ownerUUIDs: string[]) => string;
}

// A caller mistake (missing or ill-typed parameter). The route maps this — and only this — to
// HTTP 400; everything else that throws while running a query is treated as server-side.
export class ParameterError extends Error {}

// An operator mistake (e.g. a TABLE_NAME or OWNER_UUIDS var that fails re-validation). The
// caller did nothing wrong, so the route maps this to 502 alongside upstream failures — never
// to 400.
export class ConfigurationError extends Error {}

// These character allowlists ARE the injection boundary: a string that matches one of them
// cannot contain a quote, semicolon, comment token, or LIKE wildcard, so embedding it in SQL
// (as a quoted literal or an identifier) is safe by construction. They are deliberately
// lexical, not semantic — DATE_PATTERN accepts 2026-13-45, because calendar validity is not a
// security property and R2 SQL simply returns no rows for it. Pinned by 'treats an
// out-of-calendar but well-formed date as a lexical value (no throw, no rows guarantee)' in
// queries.test.ts.
const TABLE_NAME_PATTERN = /^[A-Za-z0-9_.]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Owner uuids are compared against the `uuid` column, whose values the footprint library mints
// itself (crypto.randomUUID(), or a short fallback id). The allowlist is a little wider than
// canonical UUID syntax on purpose — it also admits the fallback ids — while still excluding
// every character that could end the surrounding single-quoted literal or start a comment. The
// 128-character cap keeps a pathological config from inflating the query string without bound.
// Pinned by 'rejects an OWNER_UUIDS entry that tries to break out of its quotes' in
// queries.test.ts.
const OWNER_UUID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// Decimal integer notation only. Number() alone would also admit '1e2' (scientific, → 100) and
// '0x1f' (hexadecimal, → 31) — both of which satisfy Number.isInteger — so this pattern gate
// keeps the API surface to the one predictable notation. Pinned by 'rejects non-decimal
// integer notations (scientific, hexadecimal, sign, space)' in queries.test.ts.
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion
const INTEGER_PATTERN = /^-?\d+$/;

// User-Agent substrings that mark a footprint as a bot, matched case-insensitively with ILIKE.
// These are CODE CONSTANTS, never user input — the one place this worker intentionally embeds
// strings into SQL — and that is only safe while every hint stays free of single quotes and of
// the LIKE wildcards % and _ (each hint is interpolated into an ILIKE '%hint%' literal).
// Growing the list is a code change plus redeploy on purpose: the heuristic is versioned with
// the code. Pinned by 'keeps the bot User-Agent hints free of single quotes and LIKE
// wildcards' in queries.test.ts.
const BOT_USER_AGENT_HINTS = [
  'bot',
  'crawler',
  'spider',
  'headless',
  'scraper',
  'python-requests',
  'curl',
  'wget',
] as const;

// A footprint counts as a bot when user_agent matches ANY hint (OR-chain). SQL three-valued
// logic makes a NULL user_agent yield NULL from every ILIKE, so the surrounding CASE WHEN
// falls through to ELSE 0 — an absent User-Agent is "not a bot" rather than an error or a match.
const BOT_USER_AGENT_CONDITION = BOT_USER_AGENT_HINTS.map(
  (hint) => `user_agent ILIKE '%${hint}%'`,
).join(' OR ');

// Cloudflare's own bot verdict, carried in the request metadata the trail worker stores as the
// `cf` JSON column: cf.verifiedBotCategory names the category ('Search Engine Crawler',
// 'Monitoring & Analytics', ...) for a bot Cloudflare has VERIFIED, and is the EMPTY STRING for
// everyone else (the key is always present — see the predicate comment below, which pins the
// live-table measurement). It is a far stronger signal than the User-Agent heuristic — it is Cloudflare's own
// verification, not a substring guess — so the two are OR-ed rather than swapped: the verified
// category catches well-behaved bots that omit a give-away User-Agent, and the heuristic still
// catches unverified scrapers Cloudflare has no verdict for.
// See https://developers.cloudflare.com/bots/concepts/bot/#verified-bots and
// https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties
const VERIFIED_BOT_CATEGORY = "CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END";
// TWO predicates, and BOTH are load-bearing — this was measured against the live table, not
// guessed:
//   - `!= ''` carries the ordinary case. Cloudflare always SETS cf.verifiedBotCategory; for a
//     request that is not a verified bot it sets it to the EMPTY STRING rather than omitting the
//     key. A probe of the live table confirmed it (strpos(cf, 'verifiedBotCategory') found the
//     key at a real offset while json_get_str returned ''), so without this predicate every
//     human visit would be classified as a bot.
//   - `IS NOT NULL` carries the other case. `cf` is a nullable column — the trail worker writes
//     NULL when request.cf is absent (local development, non-Cloudflare replays; see toRecord()
//     in workers/footprint-trail-worker/footprints.ts) — and json_get_str on a NULL input is
//     NULL, which `!= ''` would evaluate to NULL, i.e. NOT true, but only by relying on SQL
//     three-valued logic inside a CASE that also ORs other terms. Saying it outright is cheaper
//     to read than to re-derive.
// Written out longhand instead of leaning on COALESCE, whose support in the R2 SQL dialect is
// not documented and was not verified. Pinned by 'builds verified-bot-categories excluding null
// and empty categories' in queries.test.ts.
const VERIFIED_BOT_CONDITION = `${VERIFIED_BOT_CATEGORY} IS NOT NULL AND ${VERIFIED_BOT_CATEGORY} != ''`;

// Defense in depth: TABLE_NAME is trusted wrangler config, but it is still concatenated into
// SQL, so it is re-validated at every build. A poisoned value throws ConfigurationError (→ 502
// at the route) instead of silently widening the injection surface. Pinned by 'makes buildSQL
// throw a ConfigurationError for a poisoned table name' in queries.test.ts.
export const assertTableName = (table: string): string => {
  if (!TABLE_NAME_PATTERN.test(table)) {
    throw new ConfigurationError(`invalid table name: ${JSON.stringify(table)}`);
  }
  return table;
};

// Same defense in depth for owner uuids, and for the same reason: they end up inside quoted SQL
// literals. This runs at every SQL build (not only at parse time) so that a caller who hands
// buildSQL an unvalidated array — a future refactor, a test — still cannot inject. Pinned by
// 'makes buildSQL throw a ConfigurationError for a poisoned owner uuid' in queries.test.ts.
export const assertOwnerUUID = (uuid: string): string => {
  if (!OWNER_UUID_PATTERN.test(uuid)) {
    throw new ConfigurationError(`invalid owner uuid: ${JSON.stringify(uuid)}`);
  }
  return uuid;
};

// Parses the OWNER_UUIDS var: a comma-separated list of visitor uuids whose footprints are
// excluded from every query by default, so the site owner's own browsing does not inflate their
// own analytics. Empty (or absent) means the feature is off. Whitespace around entries is
// tolerated because a hand-edited wrangler var will have it; blank entries are dropped so a
// trailing comma is harmless. A malformed entry is an OPERATOR mistake, not a caller mistake, so
// it throws ConfigurationError (→ 502) rather than being silently skipped — silently skipping
// would leak exactly the footprints the operator asked to hide. Pinned by the 'parseOwnerUUIDs'
// suite in queries.test.ts.
export const parseOwnerUUIDs = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(assertOwnerUUID);

// The ONE owner-exclusion mechanism — every query in the catalog composes its WHERE clause with
// this call and nothing else, so the filter can never drift query by query. It returns either
// '' (feature off, or the caller opted in with include_owner=true) or a leading-space fragment
// ready to concatenate. `keyword` exists because the catalog has two shapes: ranged queries
// already have a WHERE and need ' AND ...', while recent-footprints has none and needs
// ' WHERE ...' — the predicate itself is identical in both. Pinned by the 'owner exclusion
// (OWNER_UUIDS)' suite in queries.test.ts.
const ownerExclusion = (
  values: ParameterValues,
  ownerUUIDs: string[],
  keyword: 'WHERE' | 'AND',
): string => {
  if (values.include_owner === true || ownerUUIDs.length === 0) {
    return '';
  }
  const literals = ownerUUIDs.map((uuid) => `'${assertOwnerUUID(uuid)}'`).join(', ');
  return ` ${keyword} uuid NOT IN (${literals})`;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

// The single gate every user-supplied value passes before buildSQL may see it. Values are
// checked per descriptor and failures throw ParameterError (→ 400 at the route). Two deliberate
// softness choices: an empty string counts as missing (URLSearchParams yields '' for `?limit=`,
// which no caller means as a value), and out-of-range integers are CLAMPED rather than
// rejected — a too-large limit is a UX matter, not an attack, and clamping keeps dashboards
// working instead of erroring. Pinned by the 'parameter validation failures' suite and 'clamps
// limit to [1, 100]' in queries.test.ts.
export const validateParameters = (
  definition: QueryDefinition,
  searchParameters: URLSearchParams,
): ParameterValues => {
  const values: ParameterValues = {};

  for (const parameter of definition.parameters) {
    const raw = searchParameters.get(parameter.name);
    const isMissing = raw === null || raw === '';

    if (parameter.type === 'integer') {
      if (isMissing) {
        if (parameter.required) {
          throw new ParameterError(`missing required parameter: ${parameter.name}`);
        }
        values[parameter.name] = parameter.default;
        continue;
      }
      if (!INTEGER_PATTERN.test(raw)) {
        throw new ParameterError(`parameter ${parameter.name} must be an integer`);
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed)) {
        throw new ParameterError(`parameter ${parameter.name} must be an integer`);
      }
      values[parameter.name] = clamp(parsed, parameter.minimum, parameter.maximum);
      continue;
    }

    if (parameter.type === 'boolean') {
      if (isMissing) {
        if (parameter.required) {
          throw new ParameterError(`missing required parameter: ${parameter.name}`);
        }
        values[parameter.name] = parameter.default;
        continue;
      }
      // Exactly the two lowercase spellings, nothing else. Deliberately NOT the permissive
      // '1'/'yes'/'on' family, and deliberately not "any non-empty string is true": a typo like
      // `include_owner=ture` must be a loud 400, because guessing it as `false` would silently
      // give the caller the opposite of what they asked for on a privacy-shaped switch.
      // Pinned by 'rejects an include_owner value that is not true or false' in queries.test.ts.
      if (raw !== 'true' && raw !== 'false') {
        throw new ParameterError(`parameter ${parameter.name} must be true or false`);
      }
      values[parameter.name] = raw === 'true';
      continue;
    }

    if (isMissing) {
      if (parameter.required) {
        throw new ParameterError(`missing required parameter: ${parameter.name}`);
      }
      continue;
    }
    if (!DATE_PATTERN.test(raw)) {
      throw new ParameterError(`parameter ${parameter.name} must be a date (YYYY-MM-DD)`);
    }
    values[parameter.name] = raw;
  }

  return values;
};

// Opt back IN to the site owner's own footprints. Absent means excluded — the safe default is
// the one the dashboard wants, so the viewer never has to send anything. It is appended to
// EVERY definition programmatically (see QUERY_DEFINITIONS below) rather than copied into each
// parameter list, so a new query cannot forget it. Pinned by 'offers include_owner on every
// query' in queries.test.ts.
const INCLUDE_OWNER_PARAMETER: ParameterDescriptor = {
  name: 'include_owner',
  type: 'boolean',
  required: false,
  default: false,
};

// The whole query catalog. Time filtering is a plain string comparison against the ISO 8601
// received_at column — sound because RFC 3339 timestamps in UTC sort lexicographically in
// chronological order (https://www.rfc-editor.org/rfc/rfc3339#section-5.1). `from` is
// inclusive and `to` is exclusive, so the viewer passes "the day after the range end" as `to`
// and adjacent ranges chain without overlap. Day bucketing uses substr(received_at, 1, 10) —
// the first ten characters of an ISO timestamp ARE its date — and hour bucketing uses
// substr(received_at, 12, 2), the two characters after the 'T', instead of leaning on upstream
// date functions. Both are therefore UTC by construction, because received_at is stamped in UTC
// by the trail worker; there is no local-time path anywhere in this API.
//
// The dimensional queries read the two JSON string columns the trail worker stores — `cf`
// (Cloudflare request metadata) and `payload` (the browser snapshot) — with R2 SQL's json_get_*
// scalar functions. Nested paths are extra arguments, NOT a dotted string:
// json_get_str(payload, 'document', 'referrer'). The JSON paths mirror collect() in
// packages/footprint/footprint.ts and mergeUserAgentHints() in packages/footprint/payload.ts —
// changing a key there silently turns these columns to NULL, so the two must be edited
// together. json_get_* on an absent path returns NULL, which is a legitimate bucket here
// ("unreported"), not an error: older rows and non-browser clients simply group under null.
//
// EVERY json_get_* call below is wrapped in `CASE WHEN octet_length(column) <= 2000 THEN ... END`,
// and the guard is load-bearing, not defensive: R2 SQL rejects json_get_*() on any input value
// over 2000 bytes by FAILING THE WHOLE QUERY (code 40004 "argument 1 exceeds the maximum byte
// length of 2000"), measured live the moment the first real browser payload reached 2013 bytes —
// five dashboard panels 502'd at once. CASE short-circuits per row (verified against the live
// table with that same oversized row present), so an oversized payload/cf degrades to the NULL
// "unreported" bucket instead of taking the query down. Real payloads routinely straddle 2KB, so
// removing a guard reintroduces a failure that only appears once real traffic arrives.
// Pinned by 'guards every json_get_* read against the 2000-byte limit' in queries.test.ts.
//
// The exact SQL of every query is pinned character-for-character in queries.test.ts and, as sent
// over the wire, by 'sends the exact by-day SQL with inclusive from / exclusive to' in
// worker.test.ts. Every string below was additionally executed once against the live
// footprint.trail table (HTTP 200) before being pinned.
// See https://developers.cloudflare.com/r2-sql/sql-reference/scalar-functions/
const CATALOG: QueryDefinition[] = [
  {
    name: 'recent-footprints',
    description: 'Most recent footprints, newest first.',
    parameters: [
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 100 },
    ],
    // verified_bot_category rides along so the recent-views table can tag a row as a bot on
    // Cloudflare's own verdict instead of only on the User-Agent heuristic. It is NOT filtered
    // here, unlike verified-bot-categories below: the value reaches the viewer raw, and the empty
    // string that non-bot requests carry (see VERIFIED_BOT_CONDITION above) means "not a verified
    // bot" — a consumer must treat '' exactly like null.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT received_at, uuid, origin, href, user_agent, arguments, ${VERIFIED_BOT_CATEGORY} AS verified_bot_category FROM ${assertTableName(table)}${ownerExclusion(values, ownerUUIDs, 'WHERE')} ORDER BY received_at DESC LIMIT ${values.limit}`,
  },
  {
    name: 'footprints-by-day',
    description: 'Footprint count per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY day ORDER BY day`,
  },
  {
    name: 'unique-visitors-by-day',
    description: 'Distinct visitor (uuid) count per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT substr(received_at, 1, 10) AS day, COUNT(DISTINCT uuid) AS visitors FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY day ORDER BY day`,
  },
  {
    name: 'top-pages',
    description: 'Most visited pages (by href) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT href, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY href ORDER BY footprints DESC LIMIT ${values.limit}`,
  },
  {
    name: 'top-origins',
    description: 'Most active origins within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT origin, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY origin ORDER BY footprints DESC LIMIT ${values.limit}`,
  },
  {
    name: 'bots-by-day',
    description:
      'Total vs. bot footprint count per day (Cloudflare verified-bot category OR User-Agent heuristic).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // Both bot signals run at QUERY time over stored columns, so they are retroactive: growing
    // BOT_USER_AGENT_HINTS — or Cloudflare verifying a new bot operator — reclassifies all
    // history on the next query, with no backfill or reingestion. The output columns stay
    // `footprints` / `bot_footprints` even though the viewer now labels them "페이지 뷰" / "봇":
    // the row shape is the API contract and the relabelling is UI copy only.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints, SUM(CASE WHEN (${VERIFIED_BOT_CONDITION}) OR ${BOT_USER_AGENT_CONDITION} THEN 1 ELSE 0 END) AS bot_footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY day ORDER BY day`,
  },
  {
    name: 'period-summary',
    description: 'Total views and distinct visitors for the whole date range (single row).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // One row, deliberately: summing unique-visitors-by-day would double-count a visitor who
    // came back on another day, so the period-wide distinct count has to be asked for as a
    // period-wide query. The viewer divides views by visitors for its "views per visitor" card.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT COUNT(*) AS views, COUNT(DISTINCT uuid) AS visitors FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')}`,
  },
  {
    name: 'top-referrers',
    description: 'Most common referrers (payload.document.referrer) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // document.referrer is '' for a direct visit and NULL for a row that predates the payload
    // field; both are returned as their own buckets rather than filtered away, because "how much
    // traffic is direct" is exactly what the viewer's 유입 경로 panel is asking. Bucketing the
    // two together is the VIEWER's presentation decision, not this query's.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'document', 'referrer') END AS referrer, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY referrer ORDER BY views DESC LIMIT ${values.limit}`,
  },
  {
    name: 'views-by-country',
    description: 'Views and distinct visitors per country (cf.country) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // cf.country is Cloudflare's own edge geolocation, not a client-reported field, so it cannot
    // be spoofed by the browser. It is NULL when the request carried no cf metadata at all
    // (local development, replayed rows) — a real bucket the viewer labels 미상.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'country') END AS country, COUNT(*) AS views, COUNT(DISTINCT uuid) AS visitors FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY country ORDER BY views DESC LIMIT ${values.limit}`,
  },
  {
    name: 'views-by-hour',
    description: 'Views per hour of day (UTC) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // substr(received_at, 12, 2) is the two characters right after the 'T' of an ISO 8601
    // timestamp — the hour, as a zero-padded string ('00'..'23'), which is why ORDER BY hour
    // sorts correctly without a cast. Hours with no traffic are simply ABSENT from the result;
    // zero-filling to 24 bins is the viewer's job, so the wire stays sparse.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT substr(received_at, 12, 2) AS hour, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY hour ORDER BY hour`,
  },
  {
    name: 'top-platforms',
    description: 'Views per platform and mobile flag (User-Agent Client Hints) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // Path confirmed against mergeUserAgentHints() in packages/footprint/payload.ts, which is
    // what lands at payload.navigator.userAgentHints — `platform` ('macOS', 'Windows', ...) and
    // `mobile` (boolean) are its low-entropy fields, present without the async
    // getHighEntropyValues() call. Both are NULL on browsers with no navigator.userAgentData
    // (Safari, Firefox), so the null bucket here means "did not report", not "unknown device".
    // See https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'navigator', 'userAgentHints', 'platform') END AS platform, CASE WHEN octet_length(payload) <= 2000 THEN json_get_bool(payload, 'navigator', 'userAgentHints', 'mobile') END AS mobile, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY platform, mobile ORDER BY views DESC LIMIT ${values.limit}`,
  },
  {
    name: 'views-by-color-scheme',
    description: 'Views per preferred color scheme (payload.colorScheme) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'colorScheme') END AS color_scheme, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY color_scheme ORDER BY views DESC`,
  },
  {
    name: 'top-languages',
    description: 'Most common browser languages (payload.navigator.language) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // navigator.language (the single preferred tag, e.g. 'ko-KR'), not navigator.languages —
    // the payload carries both, but the array cannot be grouped on and the preferred tag is what
    // a language breakdown means.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'navigator', 'language') END AS language, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY language ORDER BY views DESC LIMIT ${values.limit}`,
  },
  {
    name: 'views-by-screen-width',
    description: 'Views per screen-width bucket (payload.screen.width) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // Bucketing happens HERE rather than in the viewer so the wire carries five rows instead of
    // one row per distinct pixel width. The CASE has no ELSE on purpose: a row whose
    // payload.screen.width is absent yields NULL from json_get_int, every comparison against it
    // is NULL (never true), and a CASE with no matching branch evaluates to NULL — so unreported
    // widths land in their own null bucket instead of being mislabelled as the smallest one.
    // Verified against the live table before pinning (a bucket probe returned HTTP 200 with a
    // null width_bucket row). The boundaries are the common CSS breakpoints, and the labels are
    // stable identifiers — the Korean display strings live in the viewer.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload) <= 2000 THEN CASE WHEN json_get_int(payload, 'screen', 'width') < 600 THEN 'under-600' WHEN json_get_int(payload, 'screen', 'width') < 1024 THEN '600-to-1023' WHEN json_get_int(payload, 'screen', 'width') < 1440 THEN '1024-to-1439' WHEN json_get_int(payload, 'screen', 'width') < 1920 THEN '1440-to-1919' WHEN json_get_int(payload, 'screen', 'width') >= 1920 THEN '1920-and-above' END END AS width_bucket, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY width_bucket ORDER BY views DESC`,
  },
  {
    name: 'top-events',
    description: 'Most common custom event argument lists within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // `arguments` is the JSON array string the library sends for footprint(...arguments_); a
    // plain page view sends none, which the trail worker stores as the literal two-character
    // string '[]' (never NULL — see toRecord() in workers/footprint-trail-worker/footprints.ts).
    // Comparing against that exact literal is therefore the whole "was this an event?" test, and
    // it needs no JSON parsing. Grouping on the raw string means two calls with the same
    // arguments in the same order collapse into one row; decoding the JSON for display is the
    // viewer's job.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT arguments, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' AND arguments != '[]'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY arguments ORDER BY views DESC LIMIT ${values.limit}`,
  },
  {
    name: 'verified-bot-categories',
    description: 'Views per Cloudflare verified-bot category (cf.verifiedBotCategory) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // The one dimensional query that DOES filter its null bucket away: every human visit has no
    // verified-bot category, so keeping nulls would drown the actual categories under a single
    // giant "not a bot" row and make the panel useless. The predicate is the same
    // VERIFIED_BOT_CONDITION that bots-by-day ORs into its bot CASE, so the two panels can never
    // disagree about what "verified bot" means.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT ${VERIFIED_BOT_CATEGORY} AS category, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' AND ${VERIFIED_BOT_CONDITION}${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY category ORDER BY views DESC`,
  },
];

// include_owner is bolted onto every definition here instead of being repeated sixteen times in
// CATALOG above: the owner filter is a cross-cutting rule, and a per-query parameter list is
// exactly the kind of thing a new query would forget to copy. Pinned by 'offers include_owner on
// every query' in queries.test.ts.
export const QUERY_DEFINITIONS: QueryDefinition[] = CATALOG.map((definition) => ({
  ...definition,
  parameters: [...definition.parameters, INCLUDE_OWNER_PARAMETER],
}));

export const findQuery = (name: string): QueryDefinition | undefined =>
  QUERY_DEFINITIONS.find((definition) => definition.name === name);

// The catalog as served by GET /queries: descriptors only, with the internal buildSQL function
// stripped so implementation details never leak into the API. Pinned by 'does not leak the
// internal buildSQL function' in queries.test.ts.
export const listQueries = (): Array<Omit<QueryDefinition, 'buildSQL'>> =>
  QUERY_DEFINITIONS.map(({ name, description, parameters }) => ({ name, description, parameters }));
