# footprint

Tiny page-access footprint tracker. One `step()` call, `sendBeacon` transport (POST + `text/plain`, no CORS preflight), and a worker endpoint resolved from browser storage instead of being hardcoded.

The package ships unbundled ESM + type declarations, single-file CommonJS entries (`index.cjs`, `footprint.cjs`) for bundlers that resolve the `require` condition, and a single-file browser bundle (`footprint.bundle.js`). Everything targets the browser — the CommonJS builds exist for bundlers, not for running under Node.

## Configure the endpoint (no hardcoding)

Seed the worker endpoint once under the key `footprint:endpoint`. It is resolved with this priority: **IndexedDB → localStorage → sessionStorage → cookie** (first hit wins). localStorage is the simplest:

```js
localStorage.setItem('footprint:endpoint', 'https://your-worker.example.workers.dev/');
```

Whichever store you seed, the resolved value is cached after the first read.

## Use

Importing the module fires one footprint automatically on page load — zero extra code. To absorb load-order races with the seeding script, this initial pageview waits for the endpoint key with up to 3 attempts (exponential backoff: 100ms, 200ms) and stays silent if it never appears. Manual `step()` calls never wait — they check storage once at call time:

```js
import { step } from 'footprint';
```

Call the same `step()` for anything else. Arguments are sent verbatim as an array — no interpretation:

```js
step('cta-click', { plan: 'pro' });
button.addEventListener('click', () => step('signup'));
```

### Opt out of the automatic pageview

The default entry auto-fires on import. To use `step()` **without** the automatic page-load footprint — for example to fire every pageview yourself in an SPA — import the pure `footprint/step` entry instead. It has no import-time side effect:

```js
import { step } from 'footprint/step'; // no auto-fire — step() only
```

## Static pages (no bundler)

Serve the built single-file bundle (`footprint.bundle.js`) anywhere and load it:

```html
<script type="module">
  localStorage.setItem('footprint:endpoint', 'https://your-worker.example.workers.dev/');
  import('/path/to/footprint.bundle.js');
</script>
```

## Payload

Each `step()` sends:

```
{ arguments, uuid, location, document, navigator, connection, screen, window, intl, memory,
  colorScheme, reducedMotion, reducedTransparency, forcedColors, invertedColors, pointer, hover,
  gpu, storage, battery }
```

- `arguments` — whatever you passed to `step()`, as an array (`[]` for the auto page-load footprint).
- `uuid` — visitor id, upserted across cookie / localStorage / sessionStorage / IndexedDB.
- `gpu` / `storage` / `battery` and the high-entropy `navigator.userAgentHints` fields resolve asynchronously once per page; each degrades to `undefined` when its API is unavailable or rejects.
- the rest mirrors the corresponding Web API objects and media queries.

## Development

Everything runs inside this package — it carries its own devDependencies and tsconfig:

```sh
pnpm test          # vitest unit tests (node environment, global overrides)
pnpm test:browser  # build + Playwright end-to-end in real Chromium
pnpm build         # tsc -> outputs/*.js + *.d.ts, esbuild -> footprint.bundle.js + index.cjs + footprint.cjs
```

The browser tests spin up two local origins — a page server and a collector that deliberately sends **no CORS headers** — so a payload only ever arrives when the request really is CORS-simple (no preflight).

## Notes

- Transport is fire-and-forget; the response is never read. Sending `text/plain` keeps it a CORS-simple request, so a single worker can receive from any origin without CORS configuration.
- `step()` arguments must be JSON-serializable.
- The auto page-load footprint fires once per full page load. For SPA route changes, call `step()` yourself.
