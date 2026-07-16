# footprint

Tiny page-access footprint tracker. One `step()` call, `sendBeacon` transport (POST + `text/plain`, no CORS preflight), and a worker endpoint resolved from browser storage instead of being hardcoded.

Self-contained package: `pnpm build` emits `outputs/` with unbundled ESM + type declarations and a single-file browser bundle (`outputs/footprint.bundle.js`).

## Configure the endpoint (no hardcoding)

Seed the worker endpoint once under the key `footprint:endpoint`. It is resolved with this priority: **IndexedDB → localStorage → sessionStorage → cookie** (first hit wins). localStorage is the simplest:

```js
localStorage.setItem('footprint:endpoint', 'https://your-worker.example.workers.dev/');
```

Whichever store you seed, the resolved value is cached after the first read.

## Use

Importing the module fires one footprint automatically on page load — zero extra code:

```js
import { step } from 'footprint';
```

Call the same `step()` for anything else. Arguments are sent verbatim as an array — no interpretation:

```js
step('cta-click', { plan: 'pro' });
button.addEventListener('click', () => step('signup'));
```

## Static pages (no bundler)

Serve the built single-file bundle (`outputs/footprint.bundle.js`) anywhere and load it:

```html
<script type="module">
  localStorage.setItem('footprint:endpoint', 'https://your-worker.example.workers.dev/');
  import('/path/to/footprint.bundle.js');
</script>
```

## Payload

Each `step()` sends:

```
{ arguments, uuid, location, document, navigator, connection, screen, window, intl, colorScheme }
```

- `arguments` — whatever you passed to `step()`, as an array (`[]` for the auto page-load footprint).
- `uuid` — visitor id, upserted across cookie / localStorage / sessionStorage / IndexedDB.
- the rest mirrors the corresponding Web API objects.

## Development

Everything runs inside this package — it carries its own devDependencies and tsconfig:

```sh
pnpm test          # vitest unit tests (node environment, global overrides)
pnpm test:browser  # build + Playwright end-to-end in real Chromium
pnpm build         # tsc -> outputs/*.js + *.d.ts, esbuild -> outputs/footprint.bundle.js
```

The browser tests spin up two local origins — a page server and a collector that deliberately sends **no CORS headers** — so a payload only ever arrives when the request really is CORS-simple (no preflight).

## Notes

- Transport is fire-and-forget; the response is never read. Sending `text/plain` keeps it a CORS-simple request, so a single worker can receive from any origin without CORS configuration.
- `step()` arguments must be JSON-serializable.
- The auto page-load footprint fires once per full page load. For SPA route changes, call `step()` yourself.
