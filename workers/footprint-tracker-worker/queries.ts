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
//   - table name: comes from trusted wrangler config, but is re-validated with
//     /^[A-Za-z0-9_.]+$/ at build time anyway (defense in depth).
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
    };

export type ParameterValues = Record<string, number | string>;

export interface QueryDefinition {
  name: string;
  description: string;
  parameters: ParameterDescriptor[];
  buildSQL: (table: string, values: ParameterValues) => string;
}

// A caller mistake (missing or ill-typed parameter). The route maps this — and only this — to
// HTTP 400; everything else that throws while running a query is treated as server-side.
export class ParameterError extends Error {}

// An operator mistake (e.g. a TABLE_NAME var that fails re-validation). The caller did nothing
// wrong, so the route maps this to 502 alongside upstream failures — never to 400.
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

// The whole v1 query catalog. Time filtering is a plain string comparison against the ISO 8601
// received_at column — sound because RFC 3339 timestamps in UTC sort lexicographically in
// chronological order (https://www.rfc-editor.org/rfc/rfc3339#section-5.1). `from` is
// inclusive and `to` is exclusive, so the viewer passes "the day after the range end" as `to`
// and adjacent ranges chain without overlap. Day bucketing uses substr(received_at, 1, 10) —
// the first ten characters of an ISO timestamp ARE its date — instead of leaning on upstream
// date functions. The exact SQL of every query is pinned character-for-character in
// queries.test.ts and, as sent over the wire, by 'sends the exact by-day SQL with inclusive
// from / exclusive to' in worker.test.ts.
// See https://developers.cloudflare.com/r2-sql/sql-reference/
export const QUERY_DEFINITIONS: QueryDefinition[] = [
  {
    name: 'recent-footprints',
    description: 'Most recent footprints, newest first.',
    parameters: [
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 100 },
    ],
    buildSQL: (table, values) =>
      `SELECT received_at, uuid, origin, href, user_agent, arguments FROM ${assertTableName(table)} ORDER BY received_at DESC LIMIT ${values.limit}`,
  },
  {
    name: 'footprints-by-day',
    description: 'Footprint count per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSQL: (table, values) =>
      `SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' GROUP BY day ORDER BY day`,
  },
  {
    name: 'unique-visitors-by-day',
    description: 'Distinct visitor (uuid) count per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSQL: (table, values) =>
      `SELECT substr(received_at, 1, 10) AS day, COUNT(DISTINCT uuid) AS visitors FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' GROUP BY day ORDER BY day`,
  },
  {
    name: 'top-pages',
    description: 'Most visited pages (by href) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    buildSQL: (table, values) =>
      `SELECT href, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' GROUP BY href ORDER BY footprints DESC LIMIT ${values.limit}`,
  },
  {
    name: 'top-origins',
    description: 'Most active origins within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    buildSQL: (table, values) =>
      `SELECT origin, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' GROUP BY origin ORDER BY footprints DESC LIMIT ${values.limit}`,
  },
  {
    name: 'bots-by-day',
    description: 'Total vs. bot footprint count per day (bot detection by User-Agent heuristic).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // The bot heuristic runs at QUERY time over the stored user_agent column, so it is
    // retroactive: growing BOT_USER_AGENT_HINTS reclassifies all history on the next query,
    // with no backfill or reingestion.
    buildSQL: (table, values) =>
      `SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints, SUM(CASE WHEN ${BOT_USER_AGENT_CONDITION} THEN 1 ELSE 0 END) AS bot_footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' GROUP BY day ORDER BY day`,
  },
];

export const findQuery = (name: string): QueryDefinition | undefined =>
  QUERY_DEFINITIONS.find((definition) => definition.name === name);

// The catalog as served by GET /queries: descriptors only, with the internal buildSQL function
// stripped so implementation details never leak into the API. Pinned by 'does not leak the
// internal buildSQL function' in queries.test.ts.
export const listQueries = (): Array<Omit<QueryDefinition, 'buildSQL'>> =>
  QUERY_DEFINITIONS.map(({ name, description, parameters }) => ({ name, description, parameters }));
