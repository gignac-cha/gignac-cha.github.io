// Upstream client for R2 SQL, Cloudflare's serverless query engine over Iceberg tables in the
// R2 Data Catalog (https://developers.cloudflare.com/r2-sql/). It POSTs one SQL string to
// R2_SQL_URL and normalizes the answer to rows: object[].
//
// The contract below is OBSERVED, not fully documented — read out of wrangler 4.111's
// `r2 sql query` implementation and cross-checked against the official docs:
//   POST https://api.sql.cloudflarestorage.com/api/v1/accounts/{ACCOUNT_ID}/r2-sql/query/{BUCKET_NAME}
//   headers:  Authorization: Bearer <token>, Content-Type: application/json
//   body:     { "query": "SELECT ..." }   (wrangler additionally sends a warehouse field)
//   response: { success: boolean, errors: [{ code, message }], result: { schema, rows, metrics } }
//             → the result rows live at result.rows.
// Because the envelope is not a published stable schema, parsing is deliberately TOLERANT
// (result.rows ?? rows ?? data — see normalizeRows()), so a lateral change upstream degrades
// to empty rows instead of a crash.

// The single failure type for every way the upstream can disappoint: unreachable, non-2xx,
// non-JSON body, or a success:false envelope. Collapsing them means the route needs exactly
// one mapping — R2SQLError → 502 — while `status` preserves the upstream HTTP status for the
// logs. Pinned by the three 502 tests in worker.test.ts.
export class R2SQLError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'R2SQLError';
    this.status = status;
  }
}

// Type-level trust, not validation: the cast asserts Record<string, unknown> elements without
// inspecting any of them, because this worker never reads row properties — the route returns
// rows verbatim inside json({ name, rows }) (worker.ts), so per-element checks would add cost
// and reject nothing that matters. Returning undefined (never []) on a non-array is what lets
// normalizeRows() below chain the three candidate row locations with ??. Pinned by 'normalizes
// upstream rows found at result.rows, rows or data' in worker.test.ts.
const asObjectArray = (value: unknown): Record<string, unknown>[] | undefined =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : undefined;

// Finds the row array wherever the envelope put it (result.rows, then rows, then data); any
// unrecognizable shape degrades to []. Pure function. Pinned by 'normalizes upstream rows
// found at result.rows, rows or data' in worker.test.ts.
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

// Flattens the observed errors envelope ([{ code, message }] — see the module header) into one
// 'code: message' string, entries joined with '; ', for the R2SQLError message. Returning
// undefined — never '' — is the deliberate "nothing usable" signal: both call sites in
// queryR2SQL() chain it with ?? to fall back to a status-based or generic detail, and an empty
// string would silently shadow that fallback. Like normalizeRows() above it parses the
// unpublished envelope tolerantly — a non-object entry, or an absent code or message, is
// dropped rather than thrown — because it runs exclusively on the failure path, where a throw
// would replace the real upstream detail with an unrelated TypeError in the 502 body and the
// logs. Pinned by 'answers 502 when R2 SQL returns a non-200' in worker.test.ts, which asserts
// the flattened '40003: bad sql' detail surfaces in the 502 body.
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
      if (typeof entry !== 'object' || entry === null) {
        return '';
      }
      const { code, message } = entry as { code?: unknown; message?: unknown };
      return [code, message].filter((part) => part !== undefined && part !== null).join(': ');
    })
    .filter((text) => text.length > 0)
    .join('; ');
};

export const queryR2SQL = async (
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
    throw new R2SQLError(`failed to reach R2 SQL: ${reason}`);
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Even an HTTP 200 with a non-JSON body is an upstream failure — propagating garbage
    // would only crash later with a worse message.
    throw new R2SQLError('malformed R2 SQL response', response.status);
  }

  if (!response.ok) {
    const detail = describeErrors(parsed) ?? `status ${response.status}`;
    throw new R2SQLError(`R2 SQL query failed: ${detail}`, response.status);
  }

  // Cloudflare-style envelopes can report failure as success:false INSIDE an HTTP 200, so the
  // status check alone is not enough. Pinned by 'answers 502 when R2 SQL returns success:false
  // at HTTP 200' in worker.test.ts.
  if ((parsed as { success?: unknown }).success === false) {
    const detail = describeErrors(parsed) ?? 'query rejected';
    throw new R2SQLError(`R2 SQL query failed: ${detail}`, response.status);
  }

  return normalizeRows(parsed);
};
