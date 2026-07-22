# footprint-trail-worker

Cloudflare Worker that collects [footprint](../../packages/footprint) beacons — the trail of footprints.

Each `POST` (a CORS-simple `text/plain` request, so **no CORS configuration exists or is needed**) is validated and forwarded to a [Cloudflare Pipelines](https://developers.cloudflare.com/pipelines/) stream. The pipeline batches events into an **R2 Data Catalog table** (Apache Iceberg on R2 — columnar, permanent, cheap), queried with **R2 SQL only** (wrangler / REST API / dashboard SQL editor — zero extra dependencies). Responses are bodyless status codes; the tracker never reads them.

```
footprint (browser) ──POST text/plain──▶ this worker ──STREAM.send()──▶ Pipelines
                                                                            │ batches
                                                                            ▼
                                                 R2 SQL ◀──query── R2 Data Catalog (Iceberg)
```

The table format is open (Iceberg), so heavier ad-hoc engines (DuckDB, PyIceberg, …) can attach to the same catalog later without ever becoming a project dependency.

## Behavior

| Request | Response |
|---|---|
| `POST` any path, JSON object body | `204`, one record sent to the stream |
| `POST` invalid / non-object JSON | `400`, nothing sent |
| `POST` body over 64KiB (sendBeacon queue limit) | `413`, nothing sent |
| `GET /healthz` | `200 ok` |
| anything else (including `OPTIONS` — no preflight ever happens) | `405` |

Record fields (nested values stay JSON strings so the columnar schema is stable): `received_at`, `uuid`, `origin`, `href`, `user_agent`, `arguments` (verbatim `step()` arguments), `cf` (Cloudflare request metadata: country, colo, …), `payload` (full original JSON — lossless, replayable).

## Development

```sh
pnpm dev        # wrangler dev (local)
pnpm test       # vitest in real workerd; the stream binding is stubbed to capture sent batches
pnpm build      # wrangler deploy --dry-run --outdir outputs (bundle validation only)
pnpm types      # regenerate worker-configuration.d.ts from wrangler.jsonc
pnpm typecheck  # tsc
```

## Setup at deploy time (not done yet — name not final)

1. `wrangler pipelines setup` — interactive: creates the stream (use the record fields above as the structured schema), an **R2 Data Catalog sink** (Iceberg — required for R2 SQL), and the pipeline connecting them.
2. Put the created stream id into `wrangler.jsonc` (`pipelines[0].stream`, currently a placeholder).
3. `wrangler deploy`.
4. Query: `wrangler r2 sql query <warehouse> "SELECT …"`, the dashboard SQL editor, or the REST API with a read-only token (for the viewer).

## Not yet done

- Deployment + pipeline/stream/sink creation (see above).
- Origin allowlist + rate limiting.
- The separate trail-viewing application querying the catalog through the R2 SQL REST API.
