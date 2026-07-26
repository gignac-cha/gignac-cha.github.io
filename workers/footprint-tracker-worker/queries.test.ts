import { describe, expect, it } from 'vitest';
import {
  assertOwnerUUID,
  assertTableName,
  ConfigurationError,
  findQuery,
  isoWeekLabel,
  listQueries,
  ParameterError,
  parseOwnerUUIDs,
  QUERY_DEFINITIONS,
  validateParameters,
  type QueryDefinition,
} from './queries.ts';

const TABLE = 'footprint.trail';
const RANGE = 'from=2026-07-01&to=2026-07-17';

// Every query now takes the validated OWNER_UUIDS list as a third buildSQL argument. It defaults
// to [] here so the pinned-SQL suites read exactly as they did before the feature existed — the
// owner filter has its own suite below, which passes a list explicitly.
const build = (name: string, search: string, ownerUUIDs: string[] = []): string => {
  const definition = findQuery(name) as QueryDefinition;
  const values = validateParameters(definition, new URLSearchParams(search));
  return definition.buildSQL(TABLE, values, ownerUUIDs);
};

const expectRejected = (name: string, search: string) => {
  const definition = findQuery(name) as QueryDefinition;
  expect(() => validateParameters(definition, new URLSearchParams(search))).toThrow(ParameterError);
};

describe('listQueries', () => {
  it('exposes exactly the twenty-seven catalog queries in order', () => {
    expect(listQueries().map((query) => query.name)).toEqual([
      'recent-footprints',
      'footprints-by-day',
      'unique-visitors-by-day',
      'top-pages',
      'top-origins',
      'bots-by-day',
      'period-summary',
      'top-referrers',
      'views-by-country',
      'views-by-hour',
      'top-platforms',
      'views-by-color-scheme',
      'top-languages',
      'views-by-screen-width',
      'top-events',
      'verified-bot-categories',
      'utm-breakdown',
      'new-vs-returning-by-day',
      'visit-depth',
      'weekly-retention',
      'top-landings',
      'page-transitions',
      'connection-types',
      'device-capabilities',
      'accessibility-signals',
      'bots-by-hour',
      'views-by-minute',
    ]);
  });

  it('describes each parameter with name, type and required flag', () => {
    const recent = listQueries().find((query) => query.name === 'recent-footprints');
    expect(recent?.parameters).toEqual([
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 100 },
      { name: 'uuid', type: 'string', required: false },
      { name: 'include_owner', type: 'boolean', required: false, default: false },
    ]);
    const byDay = listQueries().find((query) => query.name === 'footprints-by-day');
    expect(byDay?.parameters).toEqual([
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'include_owner', type: 'boolean', required: false, default: false },
    ]);
  });

  it('offers include_owner on every query', () => {
    // The owner filter is cross-cutting, so a query that silently lacked the opt-out would be a
    // hole in the contract rather than a missing convenience. QUERY_DEFINITIONS appends the
    // descriptor programmatically precisely so this can never drift.
    for (const query of listQueries()) {
      expect(query.parameters).toContainEqual({
        name: 'include_owner',
        type: 'boolean',
        required: false,
        default: false,
      });
    }
  });

  it('does not leak the internal buildSQL function', () => {
    for (const query of listQueries()) {
      expect('buildSQL' in query).toBe(false);
    }
  });
});

// The full-SQL toBe assertions in this suite and the ones below are character-for-character on
// purpose: the SQL string IS the wire contract — r2-sql.ts posts it as one opaque { query } value
// with no bind or AST layer in between — and the QUERY_DEFINITIONS comment in queries.ts delegates
// its "exact SQL is pinned" guarantee to exactly these assertions (the wire side is pinned once
// more by 'sends the exact by-day SQL with inclusive from / exclusive to' in worker.test.ts). Do
// not loosen these to toContain or a regex to make an edit pass quietly: any drift in the emitted
// SQL is a contract change and must fail here first.
describe('recent-footprints SQL', () => {
  it('defaults limit to 20 when omitted and selects the verified-bot category', () => {
    expect(build('recent-footprints', '')).toBe(
      "SELECT received_at, uuid, origin, href, user_agent, arguments, CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END AS verified_bot_category FROM footprint.trail ORDER BY received_at DESC LIMIT 20",
    );
  });

  it('uses a provided in-range limit verbatim', () => {
    expect(build('recent-footprints', 'limit=5')).toContain('LIMIT 5');
  });

  it('clamps limit to [1, 100]', () => {
    expect(build('recent-footprints', 'limit=9999')).toContain('LIMIT 100');
    expect(build('recent-footprints', 'limit=0')).toContain('LIMIT 1');
    expect(build('recent-footprints', 'limit=-40')).toContain('LIMIT 1');
  });

  it('embeds the limit as a bare numeric literal (never quoted)', () => {
    expect(build('recent-footprints', 'limit=7')).toMatch(/LIMIT 7$/);
  });
});

describe('by-day SQL', () => {
  it('builds footprints-by-day with inclusive from / exclusive to', () => {
    expect(build('footprints-by-day', RANGE)).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY day ORDER BY day",
    );
  });

  it('builds unique-visitors-by-day with COUNT(DISTINCT uuid)', () => {
    expect(build('unique-visitors-by-day', RANGE)).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(DISTINCT uuid) AS visitors FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY day ORDER BY day",
    );
  });

  it('builds bots-by-day ORing the verified-bot category with the UA heuristic', () => {
    expect(build('bots-by-day', RANGE)).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints, SUM(CASE WHEN (CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END IS NOT NULL AND CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END != '') OR user_agent ILIKE '%bot%' OR user_agent ILIKE '%crawler%' OR user_agent ILIKE '%spider%' OR user_agent ILIKE '%headless%' OR user_agent ILIKE '%scraper%' OR user_agent ILIKE '%python-requests%' OR user_agent ILIKE '%curl%' OR user_agent ILIKE '%wget%' THEN 1 ELSE 0 END) AS bot_footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY day ORDER BY day",
    );
  });

  it('keeps the bot User-Agent hints free of single quotes and LIKE wildcards', () => {
    const sql = build('bots-by-day', RANGE);
    const hints = sql.match(/ILIKE '%([^%]+)%'/g) ?? [];
    expect(hints).toHaveLength(8);
    for (const clause of hints) {
      const hint = clause.replace(/^ILIKE '%/, '').replace(/%'$/, '');
      expect(hint).not.toMatch(/['%_]/);
    }
  });

  it('shares one verified-bot predicate between bots-by-day and verified-bot-categories', () => {
    // The two panels would silently disagree about what "verified bot" means if either grew its
    // own copy of the predicate, so the shared constant is asserted here rather than assumed.
    const predicate =
      "CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END IS NOT NULL AND CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END != ''";
    expect(build('bots-by-day', RANGE)).toContain(predicate);
    expect(build('verified-bot-categories', RANGE)).toContain(predicate);
  });
});

describe('top-* SQL', () => {
  it('builds top-pages grouped by href with default limit 10', () => {
    expect(build('top-pages', RANGE)).toBe(
      "SELECT href, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY href ORDER BY footprints DESC LIMIT 10",
    );
  });

  it('builds top-origins grouped by origin', () => {
    expect(build('top-origins', RANGE)).toBe(
      "SELECT origin, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY origin ORDER BY footprints DESC LIMIT 10",
    );
  });

  it('clamps the top-* limit to a maximum of 50', () => {
    expect(build('top-pages', `${RANGE}&limit=9999`)).toContain('LIMIT 50');
  });
});

// Each of the strings pinned below was executed once, verbatim, against the live footprint.trail
// table (read-only, HTTP 200) before being pinned — the R2 SQL dialect is a subset with no
// published grammar, so "it compiles in TypeScript" proves nothing about whether the engine
// accepts json_get_bool in a GROUP BY or a CASE with no ELSE.
describe('period-summary SQL', () => {
  it('builds a single-row total views / distinct visitors summary', () => {
    expect(build('period-summary', RANGE)).toBe(
      "SELECT COUNT(*) AS views, COUNT(DISTINCT uuid) AS visitors FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17'",
    );
  });

  it('takes no limit parameter', () => {
    const definition = findQuery('period-summary') as QueryDefinition;
    expect(definition.parameters.map((parameter) => parameter.name)).toEqual([
      'from',
      'to',
      'include_owner',
    ]);
  });
});

describe('dimensional SQL (payload / cf JSON columns)', () => {
  it('builds top-referrers grouped by payload.document.referrer', () => {
    expect(build('top-referrers', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'document', 'referrer') END AS referrer, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY referrer ORDER BY views DESC LIMIT 10",
    );
  });

  it('builds views-by-country with both views and distinct visitors', () => {
    expect(build('views-by-country', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'country') END AS country, COUNT(*) AS views, COUNT(DISTINCT uuid) AS visitors FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY country ORDER BY views DESC LIMIT 10",
    );
  });

  it('builds views-by-hour bucketing on the UTC hour characters of received_at', () => {
    expect(build('views-by-hour', RANGE)).toBe(
      "SELECT substr(received_at, 12, 2) AS hour, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY hour ORDER BY hour",
    );
  });

  it('builds top-platforms grouped by the client-hint platform and mobile flag', () => {
    expect(build('top-platforms', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'navigator', 'userAgentHints', 'platform') END AS platform, CASE WHEN octet_length(payload) <= 2000 THEN json_get_bool(payload, 'navigator', 'userAgentHints', 'mobile') END AS mobile, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY platform, mobile ORDER BY views DESC LIMIT 10",
    );
  });

  it('builds views-by-color-scheme grouped by payload.colorScheme', () => {
    expect(build('views-by-color-scheme', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'colorScheme') END AS color_scheme, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY color_scheme ORDER BY views DESC",
    );
  });

  it('builds top-languages grouped by payload.navigator.language', () => {
    expect(build('top-languages', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'navigator', 'language') END AS language, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY language ORDER BY views DESC LIMIT 10",
    );
  });

  it('builds views-by-screen-width with the five CSS-breakpoint buckets and no ELSE', () => {
    // No ELSE is the point: an absent payload.screen.width must land in its own NULL bucket
    // instead of being folded into 'under-600'.
    expect(build('views-by-screen-width', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN CASE WHEN json_get_int(payload, 'screen', 'width') < 600 THEN 'under-600' WHEN json_get_int(payload, 'screen', 'width') < 1024 THEN '600-to-1023' WHEN json_get_int(payload, 'screen', 'width') < 1440 THEN '1024-to-1439' WHEN json_get_int(payload, 'screen', 'width') < 1920 THEN '1440-to-1919' WHEN json_get_int(payload, 'screen', 'width') >= 1920 THEN '1920-and-above' END END AS width_bucket, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY width_bucket ORDER BY views DESC",
    );
  });

  it('builds top-events excluding the empty argument list', () => {
    expect(build('top-events', RANGE)).toBe(
      "SELECT arguments, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND arguments != '[]' GROUP BY arguments ORDER BY views DESC LIMIT 10",
    );
  });

  it('builds verified-bot-categories excluding null and empty categories', () => {
    expect(build('verified-bot-categories', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END AS category, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END IS NOT NULL AND CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END != '' GROUP BY category ORDER BY views DESC",
    );
  });

  it('reads the JSON paths the footprint library actually writes', () => {
    // Guards against a rename in packages/footprint (collect() / mergeUserAgentHints()) silently
    // turning these columns into all-NULL: the paths are asserted as literal argument lists, so a
    // drifting key breaks a test here instead of quietly blanking a dashboard panel.
    const paths = [
      ["top-referrers", "CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'document', 'referrer') END"],
      ["top-platforms", "CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'navigator', 'userAgentHints', 'platform') END"],
      ["top-platforms", "CASE WHEN octet_length(payload) <= 2000 THEN json_get_bool(payload, 'navigator', 'userAgentHints', 'mobile') END"],
      ["top-languages", "CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'navigator', 'language') END"],
      ["views-by-color-scheme", "CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'colorScheme') END"],
      ["views-by-screen-width", "json_get_int(payload, 'screen', 'width')"],
      ["views-by-country", "CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'country') END"],
      ["verified-bot-categories", "CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END"],
    ] as const;
    for (const [name, path] of paths) {
      expect(build(name, RANGE)).toContain(path);
    }
  });

  it('clamps the dimensional limits to a maximum of 50 and defaults them to 10', () => {
    for (const name of ['top-referrers', 'views-by-country', 'top-platforms', 'top-languages', 'top-events']) {
      expect(build(name, RANGE)).toContain('LIMIT 10');
      expect(build(name, `${RANGE}&limit=9999`)).toContain('LIMIT 50');
      expect(build(name, `${RANGE}&limit=0`)).toContain('LIMIT 1');
    }
  });
});

// The whole point of the feature: the operator's own uuids never reach the dashboard unless the
// caller asks for them explicitly. All four directions are pinned — filter on, filter off (empty
// config), explicit opt-in, and the two WHERE/AND shapes the catalog has.
describe('owner exclusion (OWNER_UUIDS)', () => {
  const OWNERS = ['owner-1', 'owner-2'];

  it('appends an AND uuid NOT IN clause to a ranged query', () => {
    expect(build('footprints-by-day', RANGE, OWNERS)).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND uuid NOT IN ('owner-1', 'owner-2') GROUP BY day ORDER BY day",
    );
  });

  it('inserts a WHERE uuid NOT IN clause into recent-footprints, which has no WHERE of its own', () => {
    expect(build('recent-footprints', '', OWNERS)).toBe(
      "SELECT received_at, uuid, origin, href, user_agent, arguments, CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END AS verified_bot_category FROM footprint.trail WHERE uuid NOT IN ('owner-1', 'owner-2') ORDER BY received_at DESC LIMIT 20",
    );
  });

  it('adds nothing at all when OWNER_UUIDS is empty', () => {
    for (const definition of QUERY_DEFINITIONS) {
      const values = validateParameters(definition, new URLSearchParams(RANGE));
      expect(definition.buildSQL(TABLE, values, [])).not.toContain('uuid NOT IN');
    }
  });

  it('is bypassed by include_owner=true on every query', () => {
    for (const definition of QUERY_DEFINITIONS) {
      const values = validateParameters(
        definition,
        new URLSearchParams(`${RANGE}&include_owner=true`),
      );
      expect(definition.buildSQL(TABLE, values, OWNERS)).not.toContain('uuid NOT IN');
    }
  });

  it('applies the filter on every query when include_owner is false or absent', () => {
    for (const search of [RANGE, `${RANGE}&include_owner=false`, `${RANGE}&include_owner=`]) {
      for (const definition of QUERY_DEFINITIONS) {
        const values = validateParameters(definition, new URLSearchParams(search));
        expect(definition.buildSQL(TABLE, values, OWNERS)).toContain(
          "uuid NOT IN ('owner-1', 'owner-2')",
        );
      }
    }
  });

  it('keeps the exclusion inside the WHERE clause, before GROUP BY / ORDER BY / LIMIT', () => {
    // A fragment appended in the wrong place would either be a syntax error upstream (a 502 the
    // viewer cannot act on) or, worse, silently parse as something else. Ordering is asserted by
    // index rather than by re-pinning every string.
    for (const name of ['top-pages', 'top-referrers', 'views-by-screen-width', 'top-events']) {
      const sql = build(name, RANGE, OWNERS);
      const exclusion = sql.indexOf('uuid NOT IN');
      expect(exclusion).toBeGreaterThan(sql.indexOf('WHERE'));
      expect(exclusion).toBeLessThan(sql.indexOf('GROUP BY'));
    }
  });
});

describe('parseOwnerUUIDs', () => {
  it('returns an empty list for an empty, whitespace-only or absent value', () => {
    expect(parseOwnerUUIDs('')).toEqual([]);
    expect(parseOwnerUUIDs('   ')).toEqual([]);
    expect(parseOwnerUUIDs(',, ,')).toEqual([]);
    expect(parseOwnerUUIDs(undefined)).toEqual([]);
  });

  it('splits on commas and trims each entry', () => {
    expect(parseOwnerUUIDs('a-1, b_2 ,c3')).toEqual(['a-1', 'b_2', 'c3']);
    expect(parseOwnerUUIDs('550e8400-e29b-41d4-a716-446655440000')).toEqual([
      '550e8400-e29b-41d4-a716-446655440000',
    ]);
  });

  it('rejects an OWNER_UUIDS entry that tries to break out of its quotes', () => {
    // Operator config, not caller input — so ConfigurationError (→ 502), never ParameterError.
    for (const bad of [
      "a') OR 1=1--",
      "owner'",
      'owner;DROP TABLE x',
      'owner uuid',
      'owner%',
      'a'.repeat(129),
    ]) {
      expect(() => parseOwnerUUIDs(bad)).toThrow(ConfigurationError);
    }
  });

  it('rejects the whole list when only one entry is malformed', () => {
    // Skipping the bad entry would leak exactly the footprints the operator asked to hide.
    expect(() => parseOwnerUUIDs("good-1,bad';--,good-2")).toThrow(ConfigurationError);
  });
});

describe('parameter validation failures', () => {
  it('rejects a missing required date', () => {
    expectRejected('footprints-by-day', 'from=2026-07-01');
    expectRejected('footprints-by-day', '');
  });

  it('rejects a missing required date on every ranged query', () => {
    for (const definition of QUERY_DEFINITIONS) {
      if (!definition.parameters.some((parameter) => parameter.name === 'from')) {
        continue;
      }
      expectRejected(definition.name, '');
      expectRejected(definition.name, 'from=2026-07-01');
      expectRejected(definition.name, 'to=2026-07-17');
    }
  });

  it('rejects a non-integer limit', () => {
    expectRejected('recent-footprints', 'limit=abc');
    expectRejected('recent-footprints', 'limit=1.5');
  });

  it('rejects a non-integer limit on the new dimensional queries too', () => {
    for (const name of ['top-referrers', 'views-by-country', 'top-platforms', 'top-languages', 'top-events']) {
      expectRejected(name, `${RANGE}&limit=abc`);
      expectRejected(name, `${RANGE}&limit=1.5`);
    }
  });

  it('rejects non-decimal integer notations (scientific, hexadecimal, sign, space)', () => {
    // Without the INTEGER_PATTERN gate these would slip through: Number('1e2') === 100 and
    // Number('0x1f') === 31 both satisfy Number.isInteger. The API accepts decimal only.
    expectRejected('recent-footprints', 'limit=1e2');
    expectRejected('recent-footprints', 'limit=0x1f');
    expectRejected('recent-footprints', 'limit=+5');
    expectRejected('recent-footprints', 'limit=%205'); // ' 5'
  });

  it('rejects a malformed date', () => {
    expectRejected('footprints-by-day', 'from=2026-7-1&to=2026-07-17');
    expectRejected('footprints-by-day', 'from=2026/07/01&to=2026-07-17');
    expectRejected('footprints-by-day', 'from=yesterday&to=2026-07-17');
  });

  it('rejects an include_owner value that is not true or false', () => {
    for (const bad of ['1', '0', 'yes', 'TRUE', 'False', 'ture', 'null']) {
      expectRejected('footprints-by-day', `${RANGE}&include_owner=${bad}`);
    }
  });

  it('names include_owner in the boolean rejection message', () => {
    const definition = findQuery('footprints-by-day') as QueryDefinition;
    expect(() =>
      validateParameters(definition, new URLSearchParams(`${RANGE}&include_owner=1`)),
    ).toThrow('parameter include_owner must be true or false');
  });

  it('defaults include_owner to false and accepts both spellings', () => {
    const definition = findQuery('footprints-by-day') as QueryDefinition;
    expect(
      validateParameters(definition, new URLSearchParams(RANGE)).include_owner,
    ).toBe(false);
    expect(
      validateParameters(definition, new URLSearchParams(`${RANGE}&include_owner=false`))
        .include_owner,
    ).toBe(false);
    expect(
      validateParameters(definition, new URLSearchParams(`${RANGE}&include_owner=true`))
        .include_owner,
    ).toBe(true);
  });

  it('treats an out-of-calendar but well-formed date as a lexical value (no throw, no rows guarantee)', () => {
    // The security boundary is lexical, not calendar-aware: a well-formed 2026-13-45 cannot
    // escape its quotes, so it passes. Whether it matches any rows is R2 SQL's business.
    expect(build('footprints-by-day', 'from=2026-13-45&to=2026-99-99')).toContain(
      "received_at >= '2026-13-45' AND received_at < '2026-99-99'",
    );
  });
});

describe('SQL injection attempts are rejected', () => {
  it('rejects a quote-breakout date', () => {
    expectRejected('footprints-by-day', "from=2026-01-01' OR '1'='1&to=2026-07-17");
    expectRejected('footprints-by-day', "from=2026-01-01';DROP TABLE trail;--&to=2026-07-17");
  });

  it('rejects injected dates on bots-by-day too', () => {
    expectRejected('bots-by-day', "from=2026-01-01' OR '1'='1&to=2026-07-17");
    expectRejected('bots-by-day', "from=2026-07-01&to=2026-07-17' UNION SELECT 1");
    expectRejected('bots-by-day', 'from=2026-07-01'); // missing required `to`
  });

  it('rejects injected dates and limits on every new query', () => {
    // The catalog grew from six queries to sixteen; the injection matrix grows with it rather
    // than staying pinned to the two originals.
    for (const definition of QUERY_DEFINITIONS) {
      const names = definition.parameters.map((parameter) => parameter.name);
      if (names.includes('from')) {
        expectRejected(definition.name, "from=2026-01-01' OR '1'='1&to=2026-07-17");
        expectRejected(definition.name, "from=2026-07-01&to=2026-07-17';DROP TABLE trail;--");
      }
      if (names.includes('limit')) {
        const range = names.includes('from') ? `${RANGE}&` : '';
        expectRejected(definition.name, `${range}limit=1);DROP TABLE x;--`);
        expectRejected(definition.name, `${range}limit=1 UNION SELECT 1`);
      }
      expectRejected(
        definition.name,
        `${names.includes('from') ? `${RANGE}&` : ''}include_owner=true' OR '1'='1`,
      );
    }
  });

  it('rejects a statement-injection limit', () => {
    expectRejected('recent-footprints', 'limit=20;DROP TABLE x');
    expectRejected('recent-footprints', 'limit=20 OR 1=1');
    expectRejected('top-pages', `${RANGE}&limit=1);DROP TABLE x;--`);
  });

  it('never lets an injected date reach the SQL string', () => {
    const definition = findQuery('footprints-by-day') as QueryDefinition;
    try {
      const values = validateParameters(
        definition,
        new URLSearchParams("from=2026-01-01' OR '1'='1&to=2026-07-17"),
      );
      // Belt and braces: if validation ever regressed and let the value through, the built
      // SQL still must not contain the injected fragment.
      expect(definition.buildSQL(TABLE, values, [])).not.toContain("OR '1'='1");
      throw new Error('expected validation to reject the injected date');
    } catch (error) {
      expect(error).toBeInstanceOf(ParameterError);
    }
  });

  it('emits no single quote in the built SQL that is not part of a code-constant literal', () => {
    // A structural check on top of the per-parameter ones: every query is built with the most
    // hostile values that PASS validation, and the resulting quote count must equal the count for
    // benign values — proof that no user value ever contributes an extra quote.
    for (const definition of QUERY_DEFINITIONS) {
      const benign = validateParameters(definition, new URLSearchParams(`${RANGE}&limit=10`));
      const hostile = validateParameters(
        definition,
        new URLSearchParams('from=9999-99-99&to=0000-00-00&limit=99999&include_owner=false'),
      );
      const quotesIn = (sql: string) => (sql.match(/'/g) ?? []).length;
      expect(quotesIn(definition.buildSQL(TABLE, hostile, []))).toBe(
        quotesIn(definition.buildSQL(TABLE, benign, [])),
      );
    }
  });
});

describe('assertTableName', () => {
  it('accepts namespace.table style names', () => {
    expect(assertTableName('footprint.trail')).toBe('footprint.trail');
    expect(assertTableName('namespace_1.table_2')).toBe('namespace_1.table_2');
  });

  it('rejects names with spaces, quotes or semicolons', () => {
    for (const bad of ['foo bar', "foo'; DROP", 'foo;bar', 'foo-bar', 'foo`bar']) {
      expect(() => assertTableName(bad)).toThrow(ConfigurationError);
    }
  });

  it('makes buildSQL throw a ConfigurationError for a poisoned table name', () => {
    const definition = findQuery('recent-footprints') as QueryDefinition;
    const values = validateParameters(definition, new URLSearchParams(''));
    expect(() => definition.buildSQL("trail; DROP TABLE x", values, [])).toThrow(ConfigurationError);
  });
});

describe('assertOwnerUUID', () => {
  it('accepts library-minted uuids and short fallback ids', () => {
    expect(assertOwnerUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(assertOwnerUUID('v3-1-ec005d')).toBe('v3-1-ec005d');
    expect(assertOwnerUUID('A_b-9')).toBe('A_b-9');
  });

  it('rejects anything that could escape a single-quoted literal', () => {
    for (const bad of ['', "a'", 'a b', 'a;b', 'a)b', 'a%b', 'a.b', 'a'.repeat(129)]) {
      expect(() => assertOwnerUUID(bad)).toThrow(ConfigurationError);
    }
  });

  it('makes buildSQL throw a ConfigurationError for a poisoned owner uuid', () => {
    // Defense in depth: buildSQL re-validates the list it is handed, so a caller that skipped
    // parseOwnerUUIDs still cannot inject.
    const definition = findQuery('recent-footprints') as QueryDefinition;
    const values = validateParameters(definition, new URLSearchParams(''));
    expect(() => definition.buildSQL(TABLE, values, ["x') OR 1=1--"])).toThrow(ConfigurationError);
  });
});

describe('json_get_* byte-size guard', () => {
  it('guards every json_get_* read against the 2000-byte limit', () => {
    // R2 SQL fails the WHOLE query (code 40004) when json_get_*() meets an input value over
    // 2000 bytes — measured live when the first real browser payload hit 2013 bytes and five
    // panels 502'd at once. The CASE WHEN octet_length(...) guard is what turns an oversized
    // row into a NULL bucket instead; this test makes an unguarded call a failing build. See
    // the dimensional-queries comment block in queries.ts for the measurement.
    const sampleSearch = new URLSearchParams('from=2026-07-01&to=2026-07-17&limit=10');
    for (const definition of QUERY_DEFINITIONS) {
      const values = validateParameters(
        definition,
        definition.parameters.some((parameter) => parameter.type === 'date')
          ? sampleSearch
          : new URLSearchParams(''),
      );
      const sql = definition.buildSQL(TABLE, values, []);
      // Scope-aware scan rather than a fixed lookbehind window: views-by-screen-width nests five
      // json_get_int calls inside ONE outer guard, so the guard can sit far away textually. The
      // walk keeps a CASE stack and requires every json_get_* to have at least one enclosing
      // CASE that opened as an octet_length guard.
      const tokenPattern = /CASE WHEN octet_length\(|CASE|END|json_get_/g;
      const caseStack: boolean[] = [];
      for (const match of sql.matchAll(tokenPattern)) {
        if (match[0] === 'CASE WHEN octet_length(') {
          caseStack.push(true);
        } else if (match[0] === 'CASE') {
          caseStack.push(false);
        } else if (match[0] === 'END') {
          caseStack.pop();
        } else {
          expect(
            caseStack.includes(true),
            `${definition.name}: unguarded json_get_* at index ${match.index}`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('findQuery', () => {
  it('returns undefined for an unknown query name', () => {
    expect(findQuery('does-not-exist')).toBeUndefined();
  });

  it('returns each defined query', () => {
    for (const definition of QUERY_DEFINITIONS) {
      expect(findQuery(definition.name)).toBe(definition);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// The eleven queries added for the overlook's new analytics sections. Every pinned string below
// was executed once against the live footprint.trail table (HTTP 200, plausible rows) before
// being pinned — the same house rule as the original sixteen. The constructs they rely on
// (window functions, CTE JOINs, regexp_match indexing, now() - INTERVAL, date_trunc over CAST)
// were probed individually first; see the comment block above the queries in queries.ts.
// ------------------------------------------------------------------------------------------------
describe('new analytics SQL (batch of eleven)', () => {
  it('builds utm-breakdown with one guard per regexp extraction and 1-based capture index', () => {
    expect(build('utm-breakdown', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN regexp_match(json_get_str(payload, 'location', 'search'), 'utm_source=([^&]+)')[1] END AS source, CASE WHEN octet_length(payload) <= 2000 THEN regexp_match(json_get_str(payload, 'location', 'search'), 'utm_medium=([^&]+)')[1] END AS medium, CASE WHEN octet_length(payload) <= 2000 THEN regexp_match(json_get_str(payload, 'location', 'search'), 'utm_campaign=([^&]+)')[1] END AS campaign, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY source, medium, campaign ORDER BY views DESC",
    );
  });

  it('builds new-vs-returning-by-day with an unbounded first_seen CTE and a range-bound daily CTE', () => {
    expect(build('new-vs-returning-by-day', RANGE)).toBe(
      "WITH first_seen AS (SELECT uuid, MIN(substr(received_at, 1, 10)) AS first_day FROM footprint.trail WHERE uuid IS NOT NULL GROUP BY uuid), daily AS (SELECT DISTINCT substr(received_at, 1, 10) AS day, uuid FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND uuid IS NOT NULL) SELECT daily.day AS day, COUNT(CASE WHEN first_seen.first_day = daily.day THEN 1 END) AS new_visitors, COUNT(CASE WHEN first_seen.first_day <> daily.day THEN 1 END) AS returning_visitors FROM daily JOIN first_seen ON daily.uuid = first_seen.uuid GROUP BY day ORDER BY day",
    );
  });

  it('builds visit-depth with the contract bucket labels in descending CASE order', () => {
    expect(build('visit-depth', RANGE)).toBe(
      "SELECT CASE WHEN footprints >= 11 THEN '11-plus' WHEN footprints >= 6 THEN '6-10' WHEN footprints >= 3 THEN '3-5' WHEN footprints = 2 THEN '2' ELSE '1' END AS depth_bucket, COUNT(*) AS visitors FROM (SELECT uuid, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND uuid IS NOT NULL GROUP BY uuid) GROUP BY depth_bucket ORDER BY visitors DESC",
    );
  });

  it('builds weekly-retention over cohort/activity CTEs joined on uuid', () => {
    expect(build('weekly-retention', RANGE)).toBe(
      "WITH cohort AS (SELECT uuid, MIN(date_trunc('week', CAST(received_at AS TIMESTAMP))) AS cohort_week_start FROM footprint.trail WHERE uuid IS NOT NULL GROUP BY uuid), activity AS (SELECT DISTINCT uuid, date_trunc('week', CAST(received_at AS TIMESTAMP)) AS active_week_start FROM footprint.trail WHERE uuid IS NOT NULL) SELECT cohort.cohort_week_start AS cohort_week_start, activity.active_week_start AS active_week_start, COUNT(DISTINCT activity.uuid) AS visitors FROM activity JOIN cohort ON activity.uuid = cohort.uuid WHERE cohort.cohort_week_start >= date_trunc('week', CAST('2026-07-01' AS TIMESTAMP)) AND cohort.cohort_week_start < CAST('2026-07-17' AS TIMESTAMP) GROUP BY 1, 2 ORDER BY 1, 2",
    );
  });

  it('builds top-landings from a ROW_NUMBER window partitioned by visitor AND day', () => {
    expect(build('top-landings', `${RANGE}&limit=10`)).toBe(
      "SELECT href, COUNT(*) AS landings FROM (SELECT href, ROW_NUMBER() OVER (PARTITION BY uuid, substr(received_at, 1, 10) ORDER BY received_at) AS visit_index FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND uuid IS NOT NULL) WHERE visit_index = 1 GROUP BY href ORDER BY landings DESC LIMIT 10",
    );
  });

  it('builds page-transitions from LAG pairs, dropping rows with no predecessor', () => {
    expect(build('page-transitions', `${RANGE}&limit=10`)).toBe(
      "SELECT from_href, to_href, COUNT(*) AS transitions FROM (SELECT href AS to_href, LAG(href) OVER (PARTITION BY uuid ORDER BY received_at) AS from_href FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' AND uuid IS NOT NULL) WHERE from_href IS NOT NULL GROUP BY from_href, to_href ORDER BY transitions DESC LIMIT 10",
    );
  });

  it('builds connection-types guarded', () => {
    expect(build('connection-types', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_str(payload, 'connection', 'effectiveType') END AS effective_type, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY effective_type ORDER BY views DESC",
    );
  });

  it('builds device-capabilities with one outer guard around the nested bucket CASE', () => {
    expect(build('device-capabilities', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN CASE WHEN json_get_int(payload, 'navigator', 'deviceMemory') >= 8 THEN '8-and-above' WHEN json_get_int(payload, 'navigator', 'deviceMemory') >= 4 THEN '4-to-7' WHEN json_get_int(payload, 'navigator', 'deviceMemory') >= 0 THEN 'under-4' END END AS memory_bucket, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY memory_bucket ORDER BY views DESC",
    );
  });

  it('builds accessibility-signals guarded', () => {
    expect(build('accessibility-signals', RANGE)).toBe(
      "SELECT CASE WHEN octet_length(payload) <= 2000 THEN json_get_bool(payload, 'reducedMotion') END AS reduced_motion, COUNT(*) AS views FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY reduced_motion ORDER BY views DESC",
    );
  });

  it('builds bots-by-hour with the same bot predicate bots-by-day uses', () => {
    const sql = build('bots-by-hour', RANGE);
    expect(sql).toContain("substr(received_at, 12, 2) AS hour");
    expect(sql).toContain('SUM(CASE WHEN (CASE WHEN octet_length(cf) <= 2000 THEN');
    // The heuristic OR-chain must be byte-identical to bots-by-day's, so the two panels can
    // never disagree about what a bot is.
    const botsByDay = build('bots-by-day', RANGE);
    const heuristicOf = (text: string) => text.slice(text.indexOf('OR user_agent ILIKE'), text.indexOf(' THEN 1 ELSE 0'));
    expect(heuristicOf(sql)).toBe(heuristicOf(botsByDay));
  });

  it('builds views-by-minute anchored to now() with the clamped minutes literal', () => {
    expect(build('views-by-minute', '')).toBe(
      "SELECT substr(received_at, 1, 16) AS minute, COUNT(*) AS views FROM footprint.trail WHERE CAST(received_at AS TIMESTAMP) >= now() - INTERVAL '30' MINUTE GROUP BY minute ORDER BY minute",
    );
    expect(build('views-by-minute', 'minutes=9999')).toContain("INTERVAL '120' MINUTE");
    expect(build('views-by-minute', 'minutes=0')).toContain("INTERVAL '1' MINUTE");
  });
});

describe('recent-footprints uuid parameter', () => {
  it('narrows to the visitor when uuid is provided', () => {
    expect(build('recent-footprints', 'limit=20&uuid=abc-123')).toBe(
      "SELECT received_at, uuid, origin, href, user_agent, arguments, CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END AS verified_bot_category FROM footprint.trail WHERE uuid = 'abc-123' ORDER BY received_at DESC LIMIT 20",
    );
  });

  it('keeps the pre-uuid SQL byte-identical when uuid is absent', () => {
    expect(build('recent-footprints', 'limit=20')).toBe(
      "SELECT received_at, uuid, origin, href, user_agent, arguments, CASE WHEN octet_length(cf) <= 2000 THEN json_get_str(cf, 'verifiedBotCategory') END AS verified_bot_category FROM footprint.trail ORDER BY received_at DESC LIMIT 20",
    );
  });

  it('chains uuid and owner exclusion with AND', () => {
    expect(build('recent-footprints', 'uuid=abc-123', ['owner-1'])).toContain(
      "WHERE uuid = 'abc-123' AND uuid NOT IN ('owner-1')",
    );
  });

  it('rejects a uuid that tries to break out of its quotes', () => {
    expectRejected('recent-footprints', "uuid=abc'; DROP TABLE footprint.trail; --");
    expectRejected('recent-footprints', 'uuid=abc 123');
    expectRejected('recent-footprints', `uuid=${'a'.repeat(129)}`);
  });

  it('treats an empty uuid as absent (URLSearchParams yields empty strings)', () => {
    expect(build('recent-footprints', 'uuid=')).not.toContain('WHERE uuid =');
  });
});

describe('isoWeekLabel', () => {
  it('matches the ISO-8601 week-of-Thursday rule across year boundaries', () => {
    // 2026-01-01 is a Thursday → its week is W01 of 2026.
    expect(isoWeekLabel(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    // 2026-07-20 is a Monday; live probe grouped the current traffic into this week start and
    // the retention row served '2026-W30'.
    expect(isoWeekLabel(new Date('2026-07-20T00:00:00Z'))).toBe('2026-W30');
    // 2020 had 53 ISO weeks; Dec 31 still belongs to it.
    expect(isoWeekLabel(new Date('2020-12-31T00:00:00Z'))).toBe('2020-W53');
    // 2023-01-01 is a Sunday — ISO puts it in the LAST week of 2022.
    expect(isoWeekLabel(new Date('2023-01-01T00:00:00Z'))).toBe('2022-W52');
  });
});

describe('mapRows post-processing', () => {
  it('zero-fills views-by-minute up to the current minute', () => {
    const definition = findQuery('views-by-minute') as QueryDefinition;
    const nowMilliseconds = Date.parse('2026-07-26T12:05:30Z');
    const rows = definition.mapRows?.(
      [{ minute: '2026-07-26T12:04', views: 3 }],
      { minutes: 5 },
      nowMilliseconds,
    );
    expect(rows).toEqual([
      { minute: '2026-07-26T12:01', views: 0 },
      { minute: '2026-07-26T12:02', views: 0 },
      { minute: '2026-07-26T12:03', views: 0 },
      { minute: '2026-07-26T12:04', views: 3 },
      { minute: '2026-07-26T12:05', views: 0 },
    ]);
  });

  it('maps weekly-retention week starts to ISO labels and offsets, dropping offsets past 7', () => {
    const definition = findQuery('weekly-retention') as QueryDefinition;
    const rows = definition.mapRows?.(
      [
        { cohort_week_start: '2026-07-20T00:00:00.000000000Z', active_week_start: '2026-07-20T00:00:00.000000000Z', visitors: 15 },
        { cohort_week_start: '2026-07-20T00:00:00.000000000Z', active_week_start: '2026-07-27T00:00:00.000000000Z', visitors: 4 },
        { cohort_week_start: '2026-05-04T00:00:00.000000000Z', active_week_start: '2026-07-20T00:00:00.000000000Z', visitors: 1 },
        { cohort_week_start: 'garbage', active_week_start: '2026-07-20T00:00:00Z', visitors: 9 },
      ],
      {},
    );
    expect(rows).toEqual([
      { cohort_week: '2026-W30', week_offset: 0, visitors: 15 },
      { cohort_week: '2026-W30', week_offset: 1, visitors: 4 },
      // 2026-05-04 → 2026-07-20 is 11 weeks: outside the eight-column matrix, dropped.
      // The garbage timestamp row is dropped rather than served as NaN.
    ]);
  });
});
