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
| `GET /health` | `200 ok` (no CORS) |
| `GET /queries` | `200` `{ queries: [...] }` — the query catalog |
| `GET /queries/{name}?...` | `200` `{ name, rows }` |
| invalid / missing parameter value | `400` `{ error }` |
| unknown query name or unknown path | `404` `{ error }` |
| method other than `GET` / `OPTIONS` | `405` |
| `OPTIONS` on a `/queries` path | `204` + CORS (if origin allowed) + `Access-Control-Allow-Methods: GET` |
| R2 SQL upstream failure | `502` `{ error }` |
| malformed `TABLE_NAME` / `OWNER_UUIDS` config | `502` `{ error }` (operator error, never `400`) |

## API contract

### `GET /queries`

```jsonc
{
  "queries": [
    {
      "name": "recent-footprints",
      "description": "...",
      "parameters": [
        { "name": "limit", "type": "integer", "required": false, "default": 20, "minimum": 1, "maximum": 100 },
        { "name": "include_owner", "type": "boolean", "required": false, "default": false }
      ]
    }
    // ...
  ]
}
```

Parameter `type` is `"integer"`, `"date"` or `"boolean"`. Integer parameters carry `default` / `minimum` / `maximum`; boolean parameters carry `default`; date parameters are `required` and carry none.

### `GET /queries/{name}`

Returns `{ "name": string, "rows": object[] }`. `rows` is passed through from R2 SQL (`result.rows`) verbatim.

Time filters use plain string comparison on the ISO `received_at` column (lexicographic order matches chronological order). Day bucketing uses `substr(received_at, 1, 10)` and hour bucketing uses `substr(received_at, 12, 2)`, so the queries do not depend on date functions — and both are **UTC** by construction, because `received_at` is stamped in UTC by the collector. **`from` is inclusive, `to` is exclusive** — the viewer passes `to` = the day *after* the range end.

| Query | Parameters | Row shape |
|---|---|---|
| `recent-footprints` | `limit` (int, default 20, 1–100) | `{ received_at, uuid, origin, href, user_agent, arguments, verified_bot_category }` |
| `footprints-by-day` | `from`, `to` (date, required) | `{ day, footprints }` |
| `unique-visitors-by-day` | `from`, `to` (date, required) | `{ day, visitors }` |
| `top-pages` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ href, footprints }` |
| `top-origins` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ origin, footprints }` |
| `bots-by-day` | `from`, `to` (date, required) | `{ day, footprints, bot_footprints }` |
| `period-summary` | `from`, `to` (date, required) | `{ views, visitors }` — **one row** for the whole range |
| `top-referrers` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ referrer, views }` — `referrer` is `''` for direct visits, `null` when unreported |
| `views-by-country` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ country, views, visitors }` — `country` is `null` when the request carried no `cf` |
| `views-by-hour` | `from`, `to` (date, required) | `{ hour, views }` — `hour` is `'00'`…`'23'` **UTC**; empty hours are absent (sparse) |
| `top-platforms` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ platform, mobile, views }` — both `null` on browsers without client hints |
| `views-by-color-scheme` | `from`, `to` (date, required) | `{ color_scheme, views }` — `'dark'` / `'light'` / `null` |
| `top-languages` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ language, views }` |
| `views-by-screen-width` | `from`, `to` (date, required) | `{ width_bucket, views }` — `'under-600'`, `'600-to-1023'`, `'1024-to-1439'`, `'1440-to-1919'`, `'1920-and-above'`, or `null` when unreported |
| `top-events` | `from`, `to` (required); `limit` (int, default 10, 1–50) | `{ arguments, views }` — the JSON array string, plain page views (`'[]'`) excluded |
| `verified-bot-categories` | `from`, `to` (date, required) | `{ category, views }` — null/empty categories excluded, so only real verified bots appear |

Every query additionally accepts `include_owner` (boolean, default `false`) — see [Owner-visit exclusion](#owner-visit-exclusion-owner_uuids).

Defaulting the range to "last 30 days" is the **viewer's** job; the worker makes `from`/`to` **required** for every ranged query.

The dimensional queries read the **split columns** of the wide table (`footprint.trail_wide`), which the collector derives from the request at write time. Scalars — `payload__uuid`, `payload__location__href`, `payload__document__referrer`, `payload__arguments`, `headers__origin`, `headers__user_agent` — are raw strings and are read directly, then aliased back to their contract field names (`payload__uuid AS uuid`, …). The remaining containers — `payload_remains`, `payload__location`, `payload__navigator`, `payload__navigator__userAgentHints`, `cf_remains` — are JSON and are read with R2 SQL's `json_get_str` / `json_get_int` / `json_get_bool`, where nested paths are extra **arguments**, not a dotted string: `json_get_str(payload__location, 'search')`.

The original `headers` / `cf` / `payload` JSON columns are still stored byte-for-byte, but **no query reads them**: `json_get_*()` fails the whole query on any input over 2000 bytes (error `40004`, an undocumented hard limit), and `payload` was over it on 225 of 280 rows, which is what turned the referrer, language, screen and colour panels into all-`null`. Every `json_get_*` call is still wrapped in `CASE WHEN octet_length(<column>) <= 2000 THEN … END` on the split columns too — insurance for the day a variable-length field grows, at zero cost while it never fires. `null` is a legitimate bucket everywhere except `verified-bot-categories`: it means "the client did not report this", not "error".

### Owner-visit exclusion (`OWNER_UUIDS`)

The `OWNER_UUIDS` var holds a comma-separated list of visitor `uuid`s — the site owner's own browsers — whose footprints are **hidden from every query by default**, so the owner's own browsing does not inflate their own analytics. An empty value (the committed default) turns the feature off.

- Rows are **not** deleted or skipped at collection time; only the read API hides them. `AND payload__uuid NOT IN ('…', '…')` is appended to the `WHERE` clause of every query (`recent-footprints`, which has no `WHERE`, gets one).
- A caller opts back in per request with `?include_owner=true`. Anything other than `true` / `false` is a `400` (`parameter include_owner must be true or false`); absent means `false`. The viewer never sends it, so the dashboard is always owner-free.
- Each entry is validated against `^[A-Za-z0-9_-]{1,128}$` **before** it is embedded, and again at every SQL build. A malformed entry fails the request with a **`502`** — it is an operator configuration error, not a caller error, and silently dropping it would leak exactly the footprints the operator asked to hide.

Find your uuid by reading the value `footprint` stored under the `footprint` key in `localStorage` on your own site. One browser profile is one uuid, so list every browser and device you browse from.

### Bot detection (`bots-by-day`, `verified-bot-categories`, `recent-footprints`)

The footprint collector records **all** access, including bots, so the viewer can show a bot ratio. `bots-by-day` returns, per day, the total footprint count and how many of those look like bots (`footprints` and `bot_footprints`; the viewer computes the ratio). The output column names stay `footprints` / `bot_footprints` even though the viewer now labels them "페이지 뷰" / "봇" — the row shape is the API contract, the labels are UI copy.

Two signals are OR-ed inside one conditional aggregate — `SUM(CASE WHEN <verified bot> OR <UA heuristic> THEN 1 ELSE 0 END)`:

1. **Cloudflare's verified-bot verdict.** `cf.verifiedBotCategory` names the category (`Search Engine Crawler`, `Monitoring & Analytics`, …) for a bot Cloudflare has *verified*. Cloudflare always **sets** this key: for a request that is not a verified bot it is the **empty string**, never absent (confirmed against the live table). The predicate is therefore `json_get_str(cf_remains, 'verifiedBotCategory') IS NOT NULL AND … != ''` — the `!= ''` carries the ordinary case, the `IS NOT NULL` carries rows whose whole `cf_remains` column is `NULL` (local development, non-Cloudflare replays). The same predicate is what `verified-bot-categories` filters on, so the two panels can never disagree.
2. **The User-Agent heuristic.** A case-insensitive substring match (`headers__user_agent ILIKE '%hint%'`) against the stored `headers__user_agent` column for any of these hints: `bot`, `crawler`, `spider`, `headless`, `scraper`, `python-requests`, `curl`, `wget`. The hints are constants in code — none contain a single quote or a `LIKE` wildcard (`%`/`_`), so they interpolate as safe literals. Rows with a `NULL` `headers__user_agent` never match (`ILIKE` on `NULL` is `NULL`).

`recent-footprints` selects the raw `verified_bot_category` so a single row can be tagged on the strong signal, falling back to the UA heuristic client-side. **A consumer must treat `''` exactly like `null`** there.

Because both signals run at query time (not at collection time), refining either — growing the hint list, or Cloudflare verifying a new bot operator — **retroactively re-classifies all already-stored data with no migration**.

## CORS / auth posture

- When the request `Origin` **exactly** matches an entry in `VIEWER_ORIGINS`, it is reflected in `Access-Control-Allow-Origin` with `Vary: Origin` on **all** `/queries` responses (success *and* error). No match → no CORS headers, but the request is still served (this is a **public read API for now**).
- `OPTIONS` on `/queries` paths → `204` with those CORS headers (when the origin is allowed) plus `Access-Control-Allow-Methods: GET`.
- There is **no API authentication yet** — see [Not yet done](#not-yet-done).

## Security

No user input is ever concatenated into SQL as free text:

- **integer** parameters are parsed, checked with `Number.isInteger`, then **clamped** to `[minimum, maximum]` and embedded as a bare numeric literal. `limit=20;DROP TABLE x` fails the integer check → `400`.
- **date** parameters must match `^\d{4}-\d{2}-\d{2}$` before being embedded inside single quotes. A value that passes that regex cannot contain a quote or semicolon, so it cannot break out of the string. `from=2026-01-01' OR '1'='1` fails the regex → `400`.
- **boolean** parameters must be exactly `true` or `false`; the value never reaches SQL as text at all, only as a branch between two code-constant fragments. `include_owner=1` → `400`.
- The **table name** comes from the trusted `TABLE_NAME` var but is still validated against `^[A-Za-z0-9_.]+$` at use time.
- The **owner uuids** come from the trusted `OWNER_UUIDS` var but are still validated against `^[A-Za-z0-9_-]{1,128}$`, once at parse time and again at every SQL build. A violating entry → `502`.

The unit tests include an explicit injection matrix proving these rejections, run against **every** query in the catalog rather than a hand-picked few.

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
- <https://developers.cloudflare.com/r2-sql/sql-reference/scalar-functions/> — string/JSON functions (`substr`, `strpos`, `json_get_str`, `json_get_int`, `json_get_bool`) used by the dimensional queries and by bot detection. Nested paths are extra arguments: `json_get_str(payload__location, 'search')`. `json_extract` and the `->>` operator are **not** supported.
- <https://developers.cloudflare.com/bots/concepts/bot/#verified-bots> — `cf.verifiedBotCategory` and the verified-bot categories.
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

> **Fresh checkout / after pulling a `wrangler.jsonc` change: run `pnpm types` before
> `pnpm typecheck`.** The `Env` type lives in the git-ignored, generated
> `worker-configuration.d.ts`, so a stale copy is missing any newly added var (for example
> `OWNER_UUIDS`) and `tsc` fails on `environment.<var>` until the file is regenerated. The
> command runs fully offline.

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
   - `OWNER_UUIDS` — optional; your own visitor uuid(s), comma-separated. Leave empty to keep your own visits in the numbers.
4. `wrangler deploy`.

## Not yet done

- Deployment (token, secret, real vars, `wrangler deploy`).
- **API authentication** — the read API is currently public to any origin (CORS only gates browser reflection, not access). Decide between a signed viewer token, Cloudflare Access, or a shared key.
- Rate limiting / abuse protection.
- **Refine bot detection further.** v2 ORs Cloudflare's verified-bot verdict with the User-Agent heuristic. A future version could also OR in `navigator.webdriver === true` (`json_get_bool(payload__navigator, 'webdriver')` — the library does collect it). Being query-time, adding it needs no data migration.
- **Session / bounce metrics.** `uuid` identifies a browser profile, not a session, so "sessions" and "bounce rate" would need a windowing definition (and R2 SQL window-function support) this API does not have yet.

Resolved since v1: the R2 SQL success-response envelope, `json_get_*` on plain string columns, `GROUP BY` on a `json_get_*` alias, `CASE` with no `ELSE`, `IS NOT NULL` / `!= ''` on `json_get_str` results, and `NOT IN` are all **confirmed against the live account** — every SQL string in the catalog was executed once, read-only, before being pinned. Those probes ran against the pre-split `footprint.trail`; the column split changed the column names only, so each rewritten string still owes one live read against `footprint.trail_wide` once that table exists.
