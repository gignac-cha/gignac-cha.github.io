# footprint-tracker-worker

Cloudflare Worker that exposes a small, parameterized **analytics query API** over the [footprint](../../packages/footprint) trail — a read-only JSON API on top of **R2 SQL**.

The sibling [`footprint-trail-worker`](../footprint-trail-worker) collects beacons into an **R2 Data Catalog table** (Apache Iceberg on R2). This worker turns a fixed set of named, safe queries into HTTP endpoints so a viewer application can render charts without ever writing SQL or holding a catalog token.

```
viewer (browser) ──GET /queries/{name}──▶ this worker ──POST { query }──▶ R2 SQL ──▶ R2 Data Catalog (Iceberg)
```

Only a **closed set of predefined queries** is reachable. No user input ever reaches SQL as free text (see [Security](#security)).

## Behavior

| Request | Response |
|---|---|
| `GET /healthz` | `200 ok` (no CORS) |
| `GET /queries` | `200` `{ queries: [...] }` — the query catalog |
| `GET /queries/{name}?...` | `200` `{ name, rows }` |
| invalid / missing parameter value | `400` `{ error }` |
| unknown query name or unknown path | `404` `{ error }` |
| method other than `GET` / `OPTIONS` | `405` |
| `OPTIONS` on a `/queries` path | `204` + CORS (if origin allowed) + `Access-Control-Allow-Methods: GET` |
| R2 SQL upstream failure | `502` `{ error }` |

## API contract

### `GET /queries`

```jsonc
{
  "queries": [
    {
      "name": "recent-footprints",
      "description": "...",
      "parameters": [
        { "name": "limit", "type": "integer", "required": false, "default": 20, "minimum": 1, "maximum": 100 }
      ]
    }
    // ...
  ]
}
```

Parameter `type` is `"integer"` or `"date"`. Integer parameters carry `default` / `minimum` / `maximum`; date parameters are `required` and carry none.

### `GET /queries/{name}`

Returns `{ "name": string, "rows": object[] }`. `rows` is passed through from R2 SQL (`result.rows`) verbatim.

Time filters use plain string comparison on the ISO `received_at` column (lexicographic order matches chronological order). Day bucketing uses `substr(received_at, 1, 10)` so the queries do not depend on date functions. **`from` is inclusive, `to` is exclusive** — the viewer passes `to` = the day *after* the range end.

| Query | Parameters | Row shape |
|---|---|---|
| `recent-footprints` | `limit` (int, default 20, 1–100) | `{ received_at, uuid, origin, href, user_agent, arguments }` |
| `footprints-by-day` | `from`, `to` (date, required) | `{ day, footprints }` |
| `unique-visitors-by-day` | `from`, `to` (date, required) | `{ day, visitors }` |
| `top-pages` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ href, footprints }` |
| `top-origins` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ origin, footprints }` |
| `bots-by-day` | `from`, `to` (date, required) | `{ day, footprints, bot_footprints }` |

Defaulting the range to "last 30 days" is the **viewer's** job; the worker makes `from`/`to` **required** for every ranged query.

### Bot detection (`bots-by-day`)

The footprint collector records **all** access, including bots, so the viewer can show a bot ratio. `bots-by-day` returns, per day, the total footprint count and how many of those look like bots (`footprints` and `bot_footprints`; the viewer computes the ratio).

Detection is a **User-Agent heuristic** applied *at query time* via a single conditional aggregate — `SUM(CASE WHEN <bot condition> THEN 1 ELSE 0 END)`. The condition is a case-insensitive substring match (`user_agent ILIKE '%hint%'`) against the stored `user_agent` column for any of these hints: `bot`, `crawler`, `spider`, `headless`, `scraper`, `python-requests`, `curl`, `wget`. Because it runs at query time (not at collection time), refining the heuristic later **retroactively re-classifies all already-stored data with no migration**. The hints are constants in code — none contain a single quote or a `LIKE` wildcard (`%`/`_`), so they interpolate as safe literals. Rows with a `NULL` `user_agent` count toward `footprints` but never `bot_footprints` (`ILIKE` on `NULL` is `NULL`).

## CORS / auth posture

- When the request `Origin` **exactly** matches an entry in `VIEWER_ORIGINS`, it is reflected in `Access-Control-Allow-Origin` with `Vary: Origin` on **all** `/queries` responses (success *and* error). No match → no CORS headers, but the request is still served (this is a **public read API for now**).
- `OPTIONS` on `/queries` paths → `204` with those CORS headers (when the origin is allowed) plus `Access-Control-Allow-Methods: GET`.
- There is **no API authentication yet** — see [Not yet done](#not-yet-done).

## Security

No user input is ever concatenated into SQL as free text:

- **integer** parameters are parsed, checked with `Number.isInteger`, then **clamped** to `[minimum, maximum]` and embedded as a bare numeric literal. `limit=20;DROP TABLE x` fails the integer check → `400`.
- **date** parameters must match `^\d{4}-\d{2}-\d{2}$` before being embedded inside single quotes. A value that passes that regex cannot contain a quote or semicolon, so it cannot break out of the string. `from=2026-01-01' OR '1'='1` fails the regex → `400`.
- The **table name** comes from the trusted `TABLE_NAME` var but is still validated against `^[A-Za-z0-9_.]+$` at use time.

The unit tests include an explicit injection matrix proving these rejections.

## R2 SQL REST API (findings)

Researched from the Cloudflare docs and cross-checked against Wrangler 4.111's own `r2 sql query` implementation.

- **Endpoint** (`R2_SQL_URL` holds the full URL):

  ```
  POST https://api.sql.cloudflarestorage.com/api/v1/accounts/{ACCOUNT_ID}/r2-sql/query/{BUCKET_NAME}
  ```

  `{BUCKET_NAME}` is the trailing half of the warehouse identifier `{ACCOUNT_ID}_{BUCKET_NAME}`.
- **Auth**: `Authorization: Bearer <token>` — a Cloudflare API token with **R2 SQL (read)**, **R2 Data Catalog (read)** and **R2 storage** permissions. Read-only catalog tokens are supported (changelog 2026-07-09).
- **Request body**: `{ "query": "SELECT ... limit 10;" }`, `Content-Type: application/json`.
  - *Observation:* Wrangler additionally sends a `warehouse` field in the body (`{ warehouse, query }`); the documented REST example sends only `{ query }`, and the bucket is already identified by the URL path, so this worker sends `{ query }`.
- **Response** (from Wrangler's `formatSqlResults`):

  ```jsonc
  {
    "success": true,
    "errors": [{ "code": 40003, "message": "..." }],
    "result": {
      "schema":  [{ "name": "col", "type": "..." }],
      "rows":    [{ "col": value, ... }],
      "metrics": { "bytes_scanned": 0, "files_scanned": 0 }
    }
  }
  ```

  Result rows live at **`result.rows`**. This worker throws (→ `502`) on a non-200 status *or* `success: false`.

  **Uncertainty:** the exact success-response envelope is not spelled out in the public REST docs (only the request is), so `result.rows` is inferred from Wrangler's client code. Parsing is therefore **tolerant**: rows are read from `result.rows ?? rows ?? data` and default to `[]`.

Docs consulted:
- <https://developers.cloudflare.com/r2-sql/query-data/> — REST endpoint, auth, request body.
- <https://developers.cloudflare.com/r2-sql/sql-reference/> — `GROUP BY`, column aliases (supported in all clauses), `COUNT`, `COUNT(DISTINCT ...)`, `substr`, `SUM`, `CASE`, and `ILIKE` pattern matching (`WHERE department ILIKE '%eng%'`) used by `bots-by-day`.
- <https://developers.cloudflare.com/r2-sql/sql-reference/scalar-functions/> — string/JSON functions (`contains`, `lower`, `strpos`, `json_get_bool`) considered for bot detection.
- <https://developers.cloudflare.com/r2-sql/reference/limitations-best-practices/> — error codes (40003 invalid SQL, 40004 invalid query, 80001 retryable), read-only engine.
- <https://developers.cloudflare.com/changelog/post/2026-07-09-r2-data-catalog-read-only-tokens/> — read-only tokens.

## Development

```sh
pnpm dev        # wrangler dev (local); provide R2_SQL_TOKEN via .dev.vars
pnpm test       # vitest in real workerd; the R2 SQL upstream (global fetch) is stubbed
pnpm build      # wrangler deploy --dry-run --outdir outputs (bundle validation only)
pnpm types      # regenerate worker-configuration.d.ts from wrangler.jsonc
pnpm typecheck  # tsc
```

Local secret — create `.dev.vars` (git-ignored):

```
R2_SQL_TOKEN=<a read-only R2 SQL token>
```

## Setup at deploy time (not done yet — name/table not final)

1. Create a **read-only** R2 API token (R2 SQL read + R2 Data Catalog read + R2 storage read) — see [Authenticate your Iceberg engine](https://developers.cloudflare.com/r2/data-catalog/manage-catalogs/#authenticate-your-iceberg-engine).
2. Set the secret: `wrangler secret put R2_SQL_TOKEN`.
3. Fill in `wrangler.jsonc` vars with real values:
   - `R2_SQL_URL` — the full query endpoint for your account + bucket.
   - `TABLE_NAME` — the fully-qualified `namespace.table` the collector's sink writes to.
   - `VIEWER_ORIGINS` — the real viewer origin(s), including the deployed `*.pages.dev`.
4. `wrangler deploy`.

## Not yet done

- Deployment (token, secret, real vars, `wrangler deploy`).
- **API authentication** — the read API is currently public to any origin (CORS only gates browser reflection, not access). Decide between a signed viewer token, Cloudflare Access, or a shared key.
- Rate limiting / abuse protection.
- Confirm the R2 SQL success-response envelope against a live account (the shaping is tolerant but inferred).
- **Refine bot detection.** v1 is a User-Agent heuristic only. R2 SQL added JSON functions (`json_get_bool`, 2026-04), so a future version could also OR in `navigator.webdriver === true` read from the stored `payload` JSON string — but it's unverified whether `json_get_*` operates on a plain string column (vs a JSON-typed column) and whether the payload carries that field, so it was intentionally left out rather than guessed. Being query-time, adding it later needs no data migration.
