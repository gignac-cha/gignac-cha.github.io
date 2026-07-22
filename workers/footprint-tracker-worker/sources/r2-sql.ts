// R2 SQL 업스트림 클라이언트. R2_SQL_URL 로 SQL 을 POST 하고, 응답을 rows: object[] 로 정규화합니다.
//
// 관찰된 실제 계약(wrangler 4.111 의 `r2 sql query` 구현 + 공식 문서 기준):
//   POST https://api.sql.cloudflarestorage.com/api/v1/accounts/{ACCOUNT_ID}/r2-sql/query/{BUCKET_NAME}
//   headers: Authorization: Bearer <token>, Content-Type: application/json
//   body:    { "query": "SELECT ..." }   (wrangler 는 추가로 warehouse 필드도 보냄)
//   응답:     { success: boolean, errors: [{ code, message }], result: { schema, rows, metrics } }
//            → 결과 행은 result.rows 에 있습니다.
// 응답 형태가 문서로 완전히 확정되지 않아 파싱은 관대하게(result.rows ?? rows ?? data) 처리합니다.

export class R2SqlError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'R2SqlError';
    this.status = status;
  }
}

const asObjectArray = (value: unknown): Record<string, unknown>[] | undefined =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : undefined;

// 여러 후보 위치에서 행 배열을 찾아 정규화합니다(순수 함수).
export const normalizeRows = (parsed: unknown): Record<string, unknown>[] => {
  if (typeof parsed !== 'object' || parsed === null) {
    return [];
  }
  const body = parsed as { result?: unknown; rows?: unknown; data?: unknown };
  const result = typeof body.result === 'object' && body.result !== null
    ? (body.result as { rows?: unknown })
    : undefined;
  return asObjectArray(result?.rows) ?? asObjectArray(body.rows) ?? asObjectArray(body.data) ?? [];
};

const describeErrors = (parsed: unknown): string | undefined => {
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const errors = (parsed as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined;
  }
  return errors
    .map((entry) => {
      const { code, message } = entry as { code?: unknown; message?: unknown };
      return [code, message].filter((part) => part !== undefined && part !== null).join(': ');
    })
    .filter((text) => text.length > 0)
    .join('; ');
};

export const queryR2Sql = async (
  environment: Env,
  sql: string,
): Promise<Record<string, unknown>[]> => {
  let response: Response;
  try {
    response = await fetch(environment.R2_SQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${environment.R2_SQL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new R2SqlError(`failed to reach R2 SQL: ${reason}`);
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // 200 이라도 JSON 이 아니면 업스트림 실패로 취급합니다.
    throw new R2SqlError('malformed R2 SQL response', response.status);
  }

  if (!response.ok) {
    const detail = describeErrors(parsed) ?? `status ${response.status}`;
    throw new R2SqlError(`R2 SQL query failed: ${detail}`, response.status);
  }

  // 상태는 200 이어도 봉투에서 success:false 로 실패를 알릴 수 있습니다.
  if ((parsed as { success?: unknown }).success === false) {
    const detail = describeErrors(parsed) ?? 'query rejected';
    throw new R2SqlError(`R2 SQL query failed: ${detail}`, response.status);
  }

  return normalizeRows(parsed);
};
