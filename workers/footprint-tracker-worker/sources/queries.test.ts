import { describe, expect, it } from 'vitest';
import {
  assertTableName,
  ConfigurationError,
  findQuery,
  listQueries,
  ParameterError,
  QUERY_DEFINITIONS,
  validateParameters,
  type QueryDefinition,
} from './queries.ts';

const TABLE = 'footprint.trail';

const build = (name: string, search: string): string => {
  const definition = findQuery(name) as QueryDefinition;
  const values = validateParameters(definition, new URLSearchParams(search));
  return definition.buildSql(TABLE, values);
};

const expectRejected = (name: string, search: string) => {
  const definition = findQuery(name) as QueryDefinition;
  expect(() => validateParameters(definition, new URLSearchParams(search))).toThrow(ParameterError);
};

describe('listQueries', () => {
  it('exposes exactly the six v1 queries', () => {
    expect(listQueries().map((query) => query.name)).toEqual([
      'recent-footprints',
      'footprints-by-day',
      'unique-visitors-by-day',
      'top-pages',
      'top-origins',
      'bots-by-day',
    ]);
  });

  it('describes each parameter with name, type and required flag', () => {
    const recent = listQueries().find((query) => query.name === 'recent-footprints');
    expect(recent?.parameters).toEqual([
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 100 },
    ]);
    const byDay = listQueries().find((query) => query.name === 'footprints-by-day');
    expect(byDay?.parameters).toEqual([
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ]);
  });

  it('does not leak the internal buildSql function', () => {
    for (const query of listQueries()) {
      expect('buildSql' in query).toBe(false);
    }
  });
});

describe('recent-footprints SQL', () => {
  it('defaults limit to 20 when omitted', () => {
    expect(build('recent-footprints', '')).toBe(
      'SELECT received_at, uuid, origin, href, user_agent, arguments FROM footprint.trail ORDER BY received_at DESC LIMIT 20',
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
    expect(build('footprints-by-day', 'from=2026-07-01&to=2026-07-17')).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY day ORDER BY day",
    );
  });

  it('builds unique-visitors-by-day with COUNT(DISTINCT uuid)', () => {
    expect(build('unique-visitors-by-day', 'from=2026-07-01&to=2026-07-17')).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(DISTINCT uuid) AS visitors FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY day ORDER BY day",
    );
  });

  it('builds bots-by-day with a total count and a conditional bot sum over the UA heuristic', () => {
    expect(build('bots-by-day', 'from=2026-07-01&to=2026-07-17')).toBe(
      "SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints, SUM(CASE WHEN user_agent ILIKE '%bot%' OR user_agent ILIKE '%crawler%' OR user_agent ILIKE '%spider%' OR user_agent ILIKE '%headless%' OR user_agent ILIKE '%scraper%' OR user_agent ILIKE '%python-requests%' OR user_agent ILIKE '%curl%' OR user_agent ILIKE '%wget%' THEN 1 ELSE 0 END) AS bot_footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY day ORDER BY day",
    );
  });

  it('keeps the bot User-Agent hints free of single quotes and LIKE wildcards', () => {
    const sql = build('bots-by-day', 'from=2026-07-01&to=2026-07-17');
    const hints = sql.match(/ILIKE '%([^%]+)%'/g) ?? [];
    expect(hints).toHaveLength(8);
    for (const clause of hints) {
      const hint = clause.replace(/^ILIKE '%/, '').replace(/%'$/, '');
      expect(hint).not.toMatch(/['%_]/);
    }
  });
});

describe('top-* SQL', () => {
  it('builds top-pages grouped by href with default limit 10', () => {
    expect(build('top-pages', 'from=2026-07-01&to=2026-07-17')).toBe(
      "SELECT href, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY href ORDER BY footprints DESC LIMIT 10",
    );
  });

  it('builds top-origins grouped by origin', () => {
    expect(build('top-origins', 'from=2026-07-01&to=2026-07-17')).toBe(
      "SELECT origin, COUNT(*) AS footprints FROM footprint.trail WHERE received_at >= '2026-07-01' AND received_at < '2026-07-17' GROUP BY origin ORDER BY footprints DESC LIMIT 10",
    );
  });

  it('clamps the top-* limit to a maximum of 50', () => {
    expect(build('top-pages', 'from=2026-07-01&to=2026-07-17&limit=9999')).toContain('LIMIT 50');
  });
});

describe('parameter validation failures', () => {
  it('rejects a missing required date', () => {
    expectRejected('footprints-by-day', 'from=2026-07-01');
    expectRejected('footprints-by-day', '');
  });

  it('rejects a non-integer limit', () => {
    expectRejected('recent-footprints', 'limit=abc');
    expectRejected('recent-footprints', 'limit=1.5');
  });

  it('rejects a malformed date', () => {
    expectRejected('footprints-by-day', 'from=2026-7-1&to=2026-07-17');
    expectRejected('footprints-by-day', 'from=2026/07/01&to=2026-07-17');
    expectRejected('footprints-by-day', 'from=yesterday&to=2026-07-17');
  });

  it('treats an out-of-calendar but well-formed date as a lexical value (no throw, no rows guarantee)', () => {
    // 보안 경계는 "형식"이라 2026-13-45 같은 값도 통과합니다(주입 불가). 결과가 비는 건 R2 SQL 몫.
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

  it('rejects a statement-injection limit', () => {
    expectRejected('recent-footprints', 'limit=20;DROP TABLE x');
    expectRejected('recent-footprints', 'limit=20 OR 1=1');
    expectRejected('top-pages', 'from=2026-07-01&to=2026-07-17&limit=1);DROP TABLE x;--');
  });

  it('never lets an injected date reach the SQL string', () => {
    const definition = findQuery('footprints-by-day') as QueryDefinition;
    try {
      const values = validateParameters(
        definition,
        new URLSearchParams("from=2026-01-01' OR '1'='1&to=2026-07-17"),
      );
      // 검증을 통과했다면(그럴 리 없지만) SQL 에 주입 문자열이 없어야 합니다.
      expect(definition.buildSql(TABLE, values)).not.toContain("OR '1'='1");
      throw new Error('expected validation to reject the injected date');
    } catch (error) {
      expect(error).toBeInstanceOf(ParameterError);
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

  it('makes buildSql throw a ConfigurationError for a poisoned table name', () => {
    const definition = findQuery('recent-footprints') as QueryDefinition;
    const values = validateParameters(definition, new URLSearchParams(''));
    expect(() => definition.buildSql("trail; DROP TABLE x", values)).toThrow(ConfigurationError);
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
