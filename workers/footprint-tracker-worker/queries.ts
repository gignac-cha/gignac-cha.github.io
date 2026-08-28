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
    }
  | {
      // Free-text is deliberately NOT what this admits: the only string parameter today is a
      // visitor uuid, validated against the same allowlist as OWNER_UUIDS entries (the footprint
      // library mints both shapes), so a value that reaches SQL can never close its quotes.
      name: string;
      type: 'string';
      required: boolean;
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
  // Optional post-processing of upstream rows before they are served — the escape hatch for the
  // two contracts SQL alone cannot honor: views-by-minute promises ZERO-FILLED minutes (GROUP BY
  // cannot produce rows for minutes with no data) and weekly-retention promises ISO week labels
  // ('2026-W30') plus small integer offsets, which are string formatting, not analytics.
  // `nowMilliseconds` is a parameter instead of Date.now() so tests pin exact outputs.
  mapRows?: (
    rows: Array<Record<string, unknown>>,
    values: ParameterValues,
    nowMilliseconds?: number,
  ) => Array<Record<string, unknown>>;
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
// Owner uuids are compared against the `payload__uuid` column (the split-out scalar copy of
// payload.uuid — see the column-map comment above CATALOG), whose values the footprint library
// mints itself (crypto.randomUUID(), or a short fallback id). The allowlist is a little wider than
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

// A footprint counts as a bot when headers__user_agent matches ANY hint (OR-chain). That column
// is the raw `User-Agent` request header the trail worker splits out of `headers` (measured
// 112B average, 140B max), so it is matched DIRECTLY: ILIKE is not json_get_*, so the 2000-byte
// limit that forces the guards below does not apply to it at all. SQL three-valued logic makes a
// NULL headers__user_agent yield NULL from every ILIKE, so the surrounding CASE WHEN falls
// through to ELSE 0 — an absent User-Agent is "not a bot" rather than an error or a match.
const BOT_USER_AGENT_CONDITION = BOT_USER_AGENT_HINTS.map(
  (hint) => `headers__user_agent ILIKE '%${hint}%'`,
).join(' OR ');

// Cloudflare's own bot verdict, read from `cf_remains` — the request metadata the trail worker
// stores after splitting the four bulky sub-objects (tlsClientAuth, tlsExportedAuthenticator,
// edgeL4, requestHeaderNames) out of `cf`, which leaves the ~24 scalars including
// verifiedBotCategory in 780B average / 837B max instead of the original column's 1849B max.
// verifiedBotCategory names the category ('Search Engine Crawler',
// 'Monitoring & Analytics', ...) for a bot Cloudflare has VERIFIED, and is the EMPTY STRING for
// everyone else (the key is always present — see the predicate comment below, which pins the
// live-table measurement). It is a far stronger signal than the User-Agent heuristic — it is Cloudflare's own
// verification, not a substring guess — so the two are OR-ed rather than swapped: the verified
// category catches well-behaved bots that omit a give-away User-Agent, and the heuristic still
// catches unverified scrapers Cloudflare has no verdict for.
// See https://developers.cloudflare.com/bots/concepts/bot/#verified-bots and
// https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties
const VERIFIED_BOT_CATEGORY = "CASE WHEN octet_length(cf_remains) <= 2000 THEN json_get_str(cf_remains, 'verifiedBotCategory') END";
// TWO predicates, and BOTH are load-bearing — this was measured against the live table, not
// guessed:
//   - `!= ''` carries the ordinary case. Cloudflare always SETS cf.verifiedBotCategory; for a
//     request that is not a verified bot it sets it to the EMPTY STRING rather than omitting the
//     key. A probe of the live pre-split table confirmed it (strpos(cf, 'verifiedBotCategory')
//     found the key at a real offset while json_get_str returned ''), so without this predicate
//     every human visit would be classified as a bot. The split moved the key from `cf` to
//     `cf_remains` verbatim — the trail worker copies the value, it does not normalize it — so
//     the measurement carries over unchanged.
//   - `IS NOT NULL` carries the other case. `cf_remains` is a nullable column — the trail worker
//     writes NULL when request.cf is absent (local development, non-Cloudflare replays; see
//     toRecord() in workers/footprint-trail-worker/footprints.ts) — and json_get_str on a NULL input is
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
  return ` ${keyword} payload__uuid NOT IN (${literals})`;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const WEEK_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

// ISO-8601 week label ('2026-W31') for a UTC instant. The ISO rule: a week belongs to the year
// that contains its Thursday, weeks start on Monday. Implemented with the standard
// shift-to-Thursday trick so the year boundary cases (Dec 29 – Jan 3) land in the right year.
// Exported for direct testing — weekly-retention's cohort labels are exactly this function.
// See https://en.wikipedia.org/wiki/ISO_week_date#Algorithms
export const isoWeekLabel = (instant: Date): string => {
  const thursday = new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
  const weekday = thursday.getUTCDay() === 0 ? 7 : thursday.getUTCDay();
  thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

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

    if (parameter.type === 'string') {
      if (isMissing) {
        if (parameter.required) {
          throw new ParameterError(`missing required parameter: ${parameter.name}`);
        }
        continue;
      }
      // The visitor-uuid allowlist is the ONLY admitted string shape (see the descriptor type's
      // comment): same alphabet as OWNER_UUIDS, so the buildSQL below can re-assert it with
      // assertOwnerUUID as defense in depth before quoting it into the WHERE clause.
      if (!OWNER_UUID_PATTERN.test(raw)) {
        throw new ParameterError(`parameter ${parameter.name} must be a visitor uuid`);
      }
      values[parameter.name] = raw;
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
// COLUMN MAP — every query below reads the WIDE table (`footprint.trail_wide`), whose columns
// the trail worker splits out of the three originals at write time. The originals (`headers`,
// `cf`, `payload`) are still stored verbatim for archival and backfill, but NOTHING here reads
// them: `payload` alone averaged 1933B with a 2153B maximum, and 225 of 280 live rows were over
// the 2000-byte json_get_* ceiling described below, which turned referrer/language/screen/color
// panels into all-NULL "unreported". The split is what makes them readable again.
//   scalar columns, referenced DIRECTLY (raw strings, no JSON quoting, so no json_get_* and
//   therefore no guard — and being URLs or a User-Agent, no byte ceiling applies to them):
//     payload__uuid                 visitor id            → aliased back to `uuid`
//     payload__location__href       visited URL           → aliased back to `href`
//     payload__document__referrer   document.referrer     → aliased back to `referrer`
//     headers__origin               Origin header         → aliased back to `origin`
//     headers__user_agent           User-Agent header     → aliased back to `user_agent`
//   payload__arguments (→ aliased back to `arguments`) is referenced directly too, but it is a
//   JSON ARRAY string, not a raw scalar: top-events compares and groups it as an opaque string,
//   so no json_get_* ever parses it — which matters, because it is the one column whose length
//   is developer-controlled and unbounded (see the top-events comment).
//   JSON container columns, read with json_get_* one level shallower than before:
//     payload_remains  screen / connection / colorScheme / reducedMotion … (857B avg, 947B max)
//     payload__location            location minus href (45B avg)
//     payload__navigator           navigator minus userAgent/userAgentHints (234B avg)
//     payload__navigator__userAgentHints  the UA-CH subtree (395B avg)
//     cf_remains                   cf minus its four bulky sub-objects (780B avg)
// The wide table also carries payload__navigator__userAgent — the BROWSER-reported User-Agent —
// which nothing here reads: the old `user_agent` column was always the request HEADER, so bot
// detection keeps reading headers__user_agent and the two must not be confused.
//
// RESPONSE FIELD NAMES DO NOT MOVE WITH THE COLUMNS. The /queries catalog — query names,
// parameter descriptors — and every row field name served to the viewer stay byte-identical to
// the pre-split API, which is why the split columns are aliased straight back in the outermost
// select list (`payload__uuid AS uuid`, `headers__origin AS origin`, …) and the overlook viewer
// needs no change at all. GROUP BY follows whatever the pre-split SQL grouped by: a plain column
// becomes the new column name (GROUP BY payload__location__href), while an expression alias
// stays the alias (GROUP BY referrer, GROUP BY day) — the alias resolution the engine already
// proved it does for the substr() buckets. Pinned by 'aliases every split column back to its
// contract response field name' in queries.test.ts.
//
// Nested paths are extra arguments, NOT a dotted string: json_get_str(payload__location,
// 'search'). The JSON paths mirror collect() in packages/footprint/footprint.ts and
// mergeUserAgentHints() in packages/footprint/payload.ts, one level shallower because the
// container is now the column — changing a key THERE, or a split rule in the trail worker's
// toRecord(), silently turns these columns to NULL, so the three must be edited together.
// json_get_* on an absent path returns NULL, which is a legitimate bucket here ("unreported"),
// not an error: rows that predate a field and non-browser clients simply group under null.
//
// EVERY json_get_* call below is STILL wrapped in `CASE WHEN octet_length(column) <= 2000 THEN
// ... END`, the split columns included. R2 SQL rejects json_get_*() on any input value over 2000
// bytes by FAILING THE WHOLE QUERY (code 40004 "argument 1 exceeds the maximum byte length of
// 2000" — an undocumented hard limit, re-measured 2026-08-27 and not configurable), which is how
// five dashboard panels 502'd at once the moment the first real browser payload reached 2013
// bytes. Today no split column comes close (947B is the largest measured), so the guard never
// fires — it is kept as INSURANCE, because these columns hold variable-length data (a longer
// language list, a new UA-CH brand, a bigger cf scalar set) and the day one of them crosses 2KB
// the guard degrades that row to the NULL "unreported" bucket instead of taking the whole panel
// down. CASE short-circuits per row (verified against the live pre-split table with an oversized
// row present) and costs nothing when it never trips. Pinned by 'guards every json_get_* read
// against the 2000-byte limit' and, for the column split's own failure mode — a guard that names
// a DIFFERENT column than the read it wraps — by 'guards every json_get_* on the very column it
// reads', both in queries.test.ts.
//
// The exact SQL of every query is pinned character-for-character in queries.test.ts and, as sent
// over the wire, by 'sends the exact by-day SQL with inclusive from / exclusive to' in
// worker.test.ts. Every PRE-SPLIT string was executed once against the live footprint.trail
// table (HTTP 200) before being pinned; the wide-table rewrites here are pinned by construction
// only — `footprint.trail_wide` does not exist yet (it is created in the migration of the
// column-split design, documents/2026-08-27-footprint-trail-column-split-design.md §7), so each
// one still owes that same live probe before this worker is deployed against it.
// See https://developers.cloudflare.com/r2-sql/sql-reference/scalar-functions/
const CATALOG: QueryDefinition[] = [
  {
    name: 'recent-footprints',
    description: 'Most recent footprints, newest first. Optional uuid narrows to one visitor.',
    parameters: [
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 100 },
      // The visitor-timeline parameter: the overlook sends it only when its catalog probe saw it
      // here, and additionally filters client-side, so an older/newer pairing in either direction
      // stays correct (the pre-uuid worker ignored the unknown parameter and answered site-wide).
      { name: 'uuid', type: 'string', required: false },
    ],
    // verified_bot_category rides along so the recent-views table can tag a row as a bot on
    // Cloudflare's own verdict instead of only on the User-Agent heuristic. It is NOT filtered
    // here, unlike verified-bot-categories below: the value reaches the viewer raw, and the empty
    // string that non-bot requests carry (see VERIFIED_BOT_CONDITION above) means "not a verified
    // bot" — a consumer must treat '' exactly like null.
    buildSQL: (table, values, ownerUUIDs) => {
      // assertOwnerUUID re-validation is defense in depth on top of validateParameters' string
      // branch — the value is quoted into SQL, so it gets the same double gate as OWNER_UUIDS.
      const uuidCondition =
        typeof values.uuid === 'string' ? ` WHERE payload__uuid = '${assertOwnerUUID(values.uuid)}'` : '';
      const ownerCondition = ownerExclusion(values, ownerUUIDs, uuidCondition === '' ? 'WHERE' : 'AND');
      return `SELECT received_at, payload__uuid AS uuid, headers__origin AS origin, payload__location__href AS href, headers__user_agent AS user_agent, payload__arguments AS arguments, ${VERIFIED_BOT_CATEGORY} AS verified_bot_category FROM ${assertTableName(table)}${uuidCondition}${ownerCondition} ORDER BY received_at DESC LIMIT ${values.limit}`;
    },
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
      `SELECT substr(received_at, 1, 10) AS day, COUNT(DISTINCT payload__uuid) AS visitors FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY day ORDER BY day`,
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
      `SELECT payload__location__href AS href, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY payload__location__href ORDER BY footprints DESC LIMIT ${values.limit}`,
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
      `SELECT headers__origin AS origin, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY headers__origin ORDER BY footprints DESC LIMIT ${values.limit}`,
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
      `SELECT COUNT(*) AS views, COUNT(DISTINCT payload__uuid) AS visitors FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')}`,
  },
  {
    name: 'top-referrers',
    description: 'Most common referrers (payload.document.referrer) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // No json_get_* and no octet_length guard anywhere in this query: the split stores
    // document.referrer as its own raw-string column, so this is a plain column read.
    // That is also what fixes it — a referrer is an unbounded URL, and while it lived inside
    // `payload` it dragged that column over the 2000-byte json_get_* ceiling (225 of 280 live
    // rows), which is precisely why this panel read all-NULL before the split. Pinned by 'reads
    // the referrer straight off its own column, with no json_get and no guard' in queries.test.ts.
    // document.referrer is '' for a direct visit and NULL for a row that predates the payload
    // field; both are returned as their own buckets rather than filtered away, because "how much
    // traffic is direct" is exactly what the viewer's 유입 경로 panel is asking. Bucketing the
    // two together is the VIEWER's presentation decision, not this query's.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT payload__document__referrer AS referrer, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY referrer ORDER BY views DESC LIMIT ${values.limit}`,
  },
  {
    name: 'views-by-country',
    description: 'Views and distinct visitors per country (cf.country) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // cf.country — carried in cf_remains after the split — is Cloudflare's own edge
    // geolocation, not a client-reported field, so it cannot be spoofed by the browser. It is
    // NULL when the request carried no cf metadata at all (local development, replayed rows) —
    // a real bucket the viewer labels 미상.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(cf_remains) <= 2000 THEN json_get_str(cf_remains, 'country') END AS country, COUNT(*) AS views, COUNT(DISTINCT payload__uuid) AS visitors FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY country ORDER BY views DESC LIMIT ${values.limit}`,
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
    // what lands in the payload__navigator__userAgentHints column (the subtree the trail worker
    // splits off navigator) — so the read is one level shallower than the pre-split
    // json_get_str(payload, 'navigator', 'userAgentHints', ...): `platform` ('macOS', 'Windows', ...) and
    // `mobile` (boolean) are its low-entropy fields, present without the async
    // getHighEntropyValues() call. Both are NULL on browsers with no navigator.userAgentData
    // (Safari, Firefox), so the null bucket here means "did not report", not "unknown device".
    // See https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload__navigator__userAgentHints) <= 2000 THEN json_get_str(payload__navigator__userAgentHints, 'platform') END AS platform, CASE WHEN octet_length(payload__navigator__userAgentHints) <= 2000 THEN json_get_bool(payload__navigator__userAgentHints, 'mobile') END AS mobile, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY platform, mobile ORDER BY views DESC LIMIT ${values.limit}`,
  },
  {
    name: 'views-by-color-scheme',
    description: 'Views per preferred color scheme (payload.colorScheme) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload_remains) <= 2000 THEN json_get_str(payload_remains, 'colorScheme') END AS color_scheme, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY color_scheme ORDER BY views DESC`,
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
    // a language breakdown means. Both live in payload__navigator (navigator minus userAgent and
    // userAgentHints), which is why the path here is one key, not 'navigator' plus one key.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload__navigator) <= 2000 THEN json_get_str(payload__navigator, 'language') END AS language, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY language ORDER BY views DESC LIMIT ${values.limit}`,
  },
  {
    name: 'views-by-screen-width',
    description: 'Views per screen-width bucket (payload.screen.width) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // Bucketing happens HERE rather than in the viewer so the wire carries five rows instead of
    // one row per distinct pixel width. `screen` was never split into its own column — it stays
    // nested inside payload_remains — so the path keeps both keys and only the column changes.
    // The CASE has no ELSE on purpose: a row whose screen.width is absent yields NULL from
    // json_get_int, every comparison against it is NULL (never true), and a CASE with no matching
    // branch evaluates to NULL — so unreported widths land in their own null bucket instead of
    // being mislabelled as the smallest one. Verified against the live pre-split table before
    // pinning (a bucket probe returned HTTP 200 with a null width_bucket row). The boundaries are the common CSS breakpoints, and the labels are
    // stable identifiers — the Korean display strings live in the viewer.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload_remains) <= 2000 THEN CASE WHEN json_get_int(payload_remains, 'screen', 'width') < 600 THEN 'under-600' WHEN json_get_int(payload_remains, 'screen', 'width') < 1024 THEN '600-to-1023' WHEN json_get_int(payload_remains, 'screen', 'width') < 1440 THEN '1024-to-1439' WHEN json_get_int(payload_remains, 'screen', 'width') < 1920 THEN '1440-to-1919' WHEN json_get_int(payload_remains, 'screen', 'width') >= 1920 THEN '1920-and-above' END END AS width_bucket, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY width_bucket ORDER BY views DESC`,
  },
  {
    name: 'top-events',
    description: 'Most common custom event argument lists within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // payload__arguments (served as `arguments`, the unchanged response field name) is the JSON
    // array string the library sends for footprint(...arguments_); the automatic pageview sends
    // the empty array, stored as the literal two-character string '[]'. The column is NULLABLE:
    // a client that omits `arguments` entirely stores NULL, not a fabricated '[]' — the library
    // always sends the key, so NULL marks non-library POSTs (bots, curl). See toRecord() in
    // workers/footprint-trail-worker/footprints.ts, pinned there by 'tolerates a minimal payload,
    // keeping nullable fields as null'. It has its own column because its length is
    // developer-controlled — an event with a fat argument list is exactly the kind of value that
    // must not be able to push a shared column over the json_get_* ceiling.
    // Comparing against the '[]' literal is therefore the whole "was this an event?" test, and it
    // needs no JSON parsing: `!= '[]'` drops pageviews directly and drops NULL rows through SQL
    // three-valued logic (NULL != '[]' is NULL, never true) — both are "not an event".
    // Grouping on the raw string means two calls with the same
    // arguments in the same order collapse into one row; decoding the JSON for display is the
    // viewer's job.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT payload__arguments AS arguments, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' AND payload__arguments != '[]'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY payload__arguments ORDER BY views DESC LIMIT ${values.limit}`,
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

  // --------------------------------------------------------------------------------------------
  // The eleven queries below were designed against the mock contract first
  // (applications/footprint-overlook/tools/mock-tracker.ts) — row shapes and bucket labels must
  // match it character for character, because the dashboard was built and tested against the
  // mock. Every construct they lean on (window functions, CTEs, JOINs between CTEs, HAVING,
  // regexp_match capture indexing, date_trunc over CAST, now() - INTERVAL) was individually
  // probed against the live pre-split table before any of this was written — R2 SQL documents
  // none of them, and this catalog's house rule is measurement over guessing. The column split
  // renamed the columns those constructs read (uuid → payload__uuid, href →
  // payload__location__href) without touching a single construct, so what was probed still
  // holds; the CTE and subquery internals carry the new names verbatim and only the OUTERMOST
  // select list aliases back to the response field names the contract fixes.
  // --------------------------------------------------------------------------------------------
  {
    name: 'utm-breakdown',
    description: 'Views per UTM source/medium/campaign parsed from payload.location.search.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // location.search is read out of payload__location (location minus href — href moved to its
    // own column precisely because a URL has no length bound), so the path is one key deep.
    // regexp_match returns the capture-group array and indexing is 1-BASED — [1] is the first
    // capture (probed live: [2] on a single-group pattern is NULL, not an error). Visits with no
    // utm_* collapse into the all-null row, which the contract requires ("utm 없는 방문은
    // 전부-null 한 행으로 합산") — the dashboard's 미보고 path renders it.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload__location) <= 2000 THEN regexp_match(json_get_str(payload__location, 'search'), 'utm_source=([^&]+)')[1] END AS source, CASE WHEN octet_length(payload__location) <= 2000 THEN regexp_match(json_get_str(payload__location, 'search'), 'utm_medium=([^&]+)')[1] END AS medium, CASE WHEN octet_length(payload__location) <= 2000 THEN regexp_match(json_get_str(payload__location, 'search'), 'utm_campaign=([^&]+)')[1] END AS campaign, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY source, medium, campaign ORDER BY views DESC`,
  },
  {
    name: 'new-vs-returning-by-day',
    description: 'Per-day split of visitors seen for the first time ever vs. returning visitors.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // first_seen is deliberately UNBOUNDED by the date range: "new" means new to the SITE, not
    // new to the window, so a visitor whose first visit predates `from` counts as returning on
    // every day of the range. Only rows with a uuid participate — a null uuid cannot be tracked
    // across days, and counting it as forever-new would inflate new_visitors.
    buildSQL: (table, values, ownerUUIDs) =>
      `WITH first_seen AS (SELECT payload__uuid, MIN(substr(received_at, 1, 10)) AS first_day FROM ${assertTableName(table)} WHERE payload__uuid IS NOT NULL${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY payload__uuid), daily AS (SELECT DISTINCT substr(received_at, 1, 10) AS day, payload__uuid FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' AND payload__uuid IS NOT NULL${ownerExclusion(values, ownerUUIDs, 'AND')}) SELECT daily.day AS day, COUNT(CASE WHEN first_seen.first_day = daily.day THEN 1 END) AS new_visitors, COUNT(CASE WHEN first_seen.first_day <> daily.day THEN 1 END) AS returning_visitors FROM daily JOIN first_seen ON daily.payload__uuid = first_seen.payload__uuid GROUP BY day ORDER BY day`,
  },
  {
    name: 'visit-depth',
    description: 'Distribution of visitors by how many pages they viewed within the date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // Bucket labels are the mock contract verbatim ('1' | '2' | '3-5' | '6-10' | '11-plus').
    // The CASE tests descend so each row hits exactly one bucket; ELSE '1' carries the remaining
    // single-view visitors.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN footprints >= 11 THEN '11-plus' WHEN footprints >= 6 THEN '6-10' WHEN footprints >= 3 THEN '3-5' WHEN footprints = 2 THEN '2' ELSE '1' END AS depth_bucket, COUNT(*) AS visitors FROM (SELECT payload__uuid, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' AND payload__uuid IS NOT NULL${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY payload__uuid) GROUP BY depth_bucket ORDER BY visitors DESC`,
  },
  {
    name: 'weekly-retention',
    description: 'Weekly cohort retention: distinct visitors per cohort week and activity week.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // SQL returns raw week-start timestamps; mapRows turns them into the contract's ISO week
    // label + small integer offset, and drops offsets outside 0..7 (the matrix the dashboard
    // draws is eight columns wide — SQL doing this arithmetic on TIMESTAMPs would be both
    // unverified dialect territory and harder to pin in tests than plain Date math).
    buildSQL: (table, values, ownerUUIDs) =>
      `WITH cohort AS (SELECT payload__uuid, MIN(date_trunc('week', CAST(received_at AS TIMESTAMP))) AS cohort_week_start FROM ${assertTableName(table)} WHERE payload__uuid IS NOT NULL${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY payload__uuid), activity AS (SELECT DISTINCT payload__uuid, date_trunc('week', CAST(received_at AS TIMESTAMP)) AS active_week_start FROM ${assertTableName(table)} WHERE payload__uuid IS NOT NULL${ownerExclusion(values, ownerUUIDs, 'AND')}) SELECT cohort.cohort_week_start AS cohort_week_start, activity.active_week_start AS active_week_start, COUNT(DISTINCT activity.payload__uuid) AS visitors FROM activity JOIN cohort ON activity.payload__uuid = cohort.payload__uuid WHERE cohort.cohort_week_start >= date_trunc('week', CAST('${values.from}' AS TIMESTAMP)) AND cohort.cohort_week_start < CAST('${values.to}' AS TIMESTAMP) GROUP BY 1, 2 ORDER BY 1, 2`,
    mapRows: (rows) =>
      rows.flatMap((row) => {
        const cohortStart = new Date(String(row.cohort_week_start));
        const activeStart = new Date(String(row.active_week_start));
        if (Number.isNaN(cohortStart.getTime()) || Number.isNaN(activeStart.getTime())) {
          return [];
        }
        const weekOffset = Math.round((activeStart.getTime() - cohortStart.getTime()) / WEEK_MILLISECONDS);
        if (weekOffset < 0 || weekOffset > 7) {
          return [];
        }
        return [{ cohort_week: isoWeekLabel(cohortStart), week_offset: weekOffset, visitors: row.visitors }];
      }),
  },
  {
    name: 'top-landings',
    description: 'Pages that opened a visitor-day (first footprint of each visitor each day).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // "Landing" is per visitor per DAY (ROW_NUMBER partitioned by uuid AND day), not per visitor
    // ever — a returning visitor's next-day entry page is a landing again. href can be NULL
    // (older rows), which stays as its own bucket per the dashboard's 미보고 rule.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT payload__location__href AS href, COUNT(*) AS landings FROM (SELECT payload__location__href, ROW_NUMBER() OVER (PARTITION BY payload__uuid, substr(received_at, 1, 10) ORDER BY received_at) AS visit_index FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' AND payload__uuid IS NOT NULL${ownerExclusion(values, ownerUUIDs, 'AND')}) WHERE visit_index = 1 GROUP BY payload__location__href ORDER BY landings DESC LIMIT ${values.limit}`,
  },
  {
    name: 'page-transitions',
    description: 'Most common page-to-page moves (LAG over each visitor, ordered by time).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 50 },
    ],
    // A row with no predecessor (each visitor's first footprint in the range) is not a
    // transition, so from_href IS NULL is filtered — that null means "nothing before this",
    // unlike the null HREF buckets elsewhere which mean "unreported".
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT from_href, to_href, COUNT(*) AS transitions FROM (SELECT payload__location__href AS to_href, LAG(payload__location__href) OVER (PARTITION BY payload__uuid ORDER BY received_at) AS from_href FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' AND payload__uuid IS NOT NULL${ownerExclusion(values, ownerUUIDs, 'AND')}) WHERE from_href IS NOT NULL GROUP BY from_href, to_href ORDER BY transitions DESC LIMIT ${values.limit}`,
  },
  {
    name: 'connection-types',
    description: 'Views per network effective type (payload.connection.effectiveType).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload_remains) <= 2000 THEN json_get_str(payload_remains, 'connection', 'effectiveType') END AS effective_type, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY effective_type ORDER BY views DESC`,
  },
  {
    name: 'device-capabilities',
    description: 'Views per device-memory bucket (payload.navigator.deviceMemory, gigabytes).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // navigator.deviceMemory reports the coarse steps 0.25/0.5/1/2/4/8; json_get_int floors the
    // sub-1 values to 0, which still lands them in 'under-4' — exactly where a ≤0.5GB device
    // belongs. The nested CASE keeps the single octet_length guard around every json_get_* read
    // (the same shape views-by-screen-width uses).
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload__navigator) <= 2000 THEN CASE WHEN json_get_int(payload__navigator, 'deviceMemory') >= 8 THEN '8-and-above' WHEN json_get_int(payload__navigator, 'deviceMemory') >= 4 THEN '4-to-7' WHEN json_get_int(payload__navigator, 'deviceMemory') >= 0 THEN 'under-4' END END AS memory_bucket, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY memory_bucket ORDER BY views DESC`,
  },
  {
    name: 'accessibility-signals',
    description: 'Views per prefers-reduced-motion signal (payload.reducedMotion).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT CASE WHEN octet_length(payload_remains) <= 2000 THEN json_get_bool(payload_remains, 'reducedMotion') END AS reduced_motion, COUNT(*) AS views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY reduced_motion ORDER BY views DESC`,
  },
  {
    name: 'bots-by-hour',
    description: 'Total vs. bot views per hour of day (same bot verdict as bots-by-day).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // Sparse like views-by-hour (GROUP BY cannot mint empty hours); the dashboard zero-fills.
    // The bot predicate is the same VERIFIED/heuristic OR that bots-by-day uses, so the two bot
    // panels can never disagree about what counts as a bot.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT substr(received_at, 12, 2) AS hour, COUNT(*) AS views, SUM(CASE WHEN (${VERIFIED_BOT_CONDITION}) OR ${BOT_USER_AGENT_CONDITION} THEN 1 ELSE 0 END) AS bot_views FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY hour ORDER BY hour`,
  },
  {
    name: 'views-by-minute',
    description: 'Views per minute over the trailing window, zero-filled (near-real-time panel).',
    parameters: [
      { name: 'minutes', type: 'integer', required: false, default: 30, minimum: 1, maximum: 120 },
    ],
    // The trailing window is anchored server-side with now() so the caller cannot game it and
    // the worker needs no clock parameter in the URL. minutes is a validated, clamped integer —
    // the only reason interpolating it into the INTERVAL literal is safe.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT substr(received_at, 1, 16) AS minute, COUNT(*) AS views FROM ${assertTableName(table)} WHERE CAST(received_at AS TIMESTAMP) >= now() - INTERVAL '${values.minutes}' MINUTE${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY minute ORDER BY minute`,
    // The contract promises every minute of the window, zeros included — GROUP BY cannot mint
    // rows for silent minutes, so the fill happens here. Minutes are UTC ('YYYY-MM-DDTHH:MM',
    // exactly substr(received_at, 1, 16)'s shape) and the window ends at the CURRENT minute.
    mapRows: (rows, values, nowMilliseconds = Date.now()) => {
      const viewsByMinute = new Map(rows.map((row) => [String(row.minute), Number(row.views)]));
      const minutes = typeof values.minutes === 'number' ? values.minutes : 30;
      const filled: Array<Record<string, unknown>> = [];
      for (let index = minutes - 1; index >= 0; index -= 1) {
        const minuteLabel = new Date(nowMilliseconds - index * 60000).toISOString().slice(0, 16);
        filled.push({ minute: minuteLabel, views: viewsByMinute.get(minuteLabel) ?? 0 });
      }
      return filled;
    },
  },
  {
    name: 'user-agents',
    description: 'Views and distinct visitors per User-Agent header within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    // headers__user_agent — the REQUEST HEADER, deliberately not payload__navigator__userAgent
    // (see the COLUMN MAP above): the header arrives on every delivery including non-browser
    // clients, so this panel counts bots and curl alongside real browsers, which is the point —
    // it answers "what is actually hitting the sites". A raw-string scalar column, so no
    // json_get_* and no octet_length guard apply. It is NULL only when a client sent no
    // User-Agent header at all — a real bucket the viewer labels 미보고. Grouping on the exact
    // string is intentional: Chromium's frozen UA makes same-browser visitors collapse into one
    // row (that reduction IS the statistic), while the distinct payload__uuid count alongside
    // shows how many visitors share each string — the same pairing views-by-country serves.
    // Pinned by 'builds user-agents SQL grouping the raw header column' in queries.test.ts.
    buildSQL: (table, values, ownerUUIDs) =>
      `SELECT headers__user_agent AS user_agent, COUNT(*) AS views, COUNT(DISTINCT payload__uuid) AS visitors FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}'${ownerExclusion(values, ownerUUIDs, 'AND')} GROUP BY headers__user_agent ORDER BY views DESC LIMIT ${values.limit}`,
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
