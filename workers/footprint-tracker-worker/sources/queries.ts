// 이 모듈은 전부 순수 함수입니다. workerd 없이 단위 테스트할 수 있습니다.
// 핵심 보안 규칙: 사용자 입력은 절대 자유 문자열로 SQL 에 들어가지 않습니다.
//   - integer 는 파싱 후 Number.isInteger 검사 + [minimum, maximum] 로 clamp 하여 "숫자 리터럴" 로만 삽입.
//   - date 는 ^\d{4}-\d{2}-\d{2}$ 정규식을 통과한 값만 작은따옴표로 감싸 삽입(정규식 통과 값은 따옴표를 깨뜨릴 수 없음).
//   - 테이블 이름은 신뢰된 설정(var)에서 오지만 사용 시점에 ^[A-Za-z0-9_.]+$ 로 한 번 더 검증합니다.

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
  buildSql: (table: string, values: ParameterValues) => string;
}

// 잘못된 파라미터 값 → HTTP 400 으로 매핑됩니다.
export class ParameterError extends Error {}

// 설정(테이블 이름 등)이 잘못된 경우 → 업스트림/서버 오류로 취급(HTTP 502).
export class ConfigurationError extends Error {}

const TABLE_NAME_PATTERN = /^[A-Za-z0-9_.]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 봇 판별용 User-Agent 힌트(전부 코드 안의 상수). ILIKE 로 대소문자 무시 부분일치를 봅니다.
// 반드시 작은따옴표·LIKE 와일드카드(%, _)를 포함하지 않아야 합니다(그래야 리터럴로 안전하게 삽입됨).
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

// user_agent 가 위 힌트 중 하나라도 부분일치하면 봇으로 봅니다. user_agent 가 NULL 이면 ILIKE 는 NULL → 봇 아님.
const BOT_USER_AGENT_CONDITION = BOT_USER_AGENT_HINTS.map(
  (hint) => `user_agent ILIKE '%${hint}%'`,
).join(' OR ');

// 신뢰된 설정이라도 SQL 에 이어붙이기 전에 반드시 검증합니다.
export const assertTableName = (table: string): string => {
  if (!TABLE_NAME_PATTERN.test(table)) {
    throw new ConfigurationError(`invalid table name: ${JSON.stringify(table)}`);
  }
  return table;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

// URLSearchParams 를 받아 파라미터를 타입별로 검증/정규화합니다. 실패 시 ParameterError.
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
      const parsed = Number(raw);
      if (!Number.isInteger(parsed)) {
        throw new ParameterError(`parameter ${parameter.name} must be an integer`);
      }
      values[parameter.name] = clamp(parsed, parameter.minimum, parameter.maximum);
      continue;
    }

    // date
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

// 시간 필터는 ISO received_at 컬럼에 대한 순수 문자열 비교로 처리합니다(사전식 정렬이라 그대로 동작).
// from 은 포함(inclusive), to 는 제외(exclusive) — 뷰어가 to 로 "범위 끝 다음 날" 을 넘겨줍니다.
// 일 단위 버킷은 날짜 함수 의존을 피하려고 substr(received_at, 1, 10) 을 씁니다.
export const QUERY_DEFINITIONS: QueryDefinition[] = [
  {
    name: 'recent-footprints',
    description: 'Most recent footprints, newest first.',
    parameters: [
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 100 },
    ],
    buildSql: (table, values) =>
      `SELECT received_at, uuid, origin, href, user_agent, arguments FROM ${assertTableName(table)} ORDER BY received_at DESC LIMIT ${values.limit}`,
  },
  {
    name: 'footprints-by-day',
    description: 'Footprint count per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSql: (table, values) =>
      `SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' GROUP BY day ORDER BY day`,
  },
  {
    name: 'unique-visitors-by-day',
    description: 'Distinct visitor (uuid) count per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    buildSql: (table, values) =>
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
    buildSql: (table, values) =>
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
    buildSql: (table, values) =>
      `SELECT origin, COUNT(*) AS footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' GROUP BY origin ORDER BY footprints DESC LIMIT ${values.limit}`,
  },
  {
    name: 'bots-by-day',
    description: 'Total vs. bot footprint count per day (bot detection by User-Agent heuristic).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // 봇 판별은 저장된 user_agent 컬럼에 대해 질의 시점에 적용되므로, 이미 쌓인 데이터에도 소급 적용됩니다.
    buildSql: (table, values) =>
      `SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS footprints, SUM(CASE WHEN ${BOT_USER_AGENT_CONDITION} THEN 1 ELSE 0 END) AS bot_footprints FROM ${assertTableName(table)} WHERE received_at >= '${values.from}' AND received_at < '${values.to}' GROUP BY day ORDER BY day`,
  },
];

export const findQuery = (name: string): QueryDefinition | undefined =>
  QUERY_DEFINITIONS.find((definition) => definition.name === name);

// GET /queries 응답용 서술자 목록(내부 buildSql 은 제외).
export const listQueries = (): Array<Omit<QueryDefinition, 'buildSql'>> =>
  QUERY_DEFINITIONS.map(({ name, description, parameters }) => ({ name, description, parameters }));
