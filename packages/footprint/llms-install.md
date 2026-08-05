# footprint — agent integration guide

You are integrating `footprint`, a tiny page-access tracker, into an application.
README.md (next to this file) is the source of truth for the API; this file is the
workflow to follow when applying it.

## 1. Resolve these values first

Two values are required before writing any code:

1. **`<package-name>`** — the name this package is published under. Take it from
   the user's instructions, or from the path you found this file at
   (`node_modules/<package-name>/llms-install.md`). If neither is available, ask
   the user. Every `<package-name>` below means this value.
2. **`<endpoint-url>`** — the address of the user's deployed footprint collector
   worker. It has no default and cannot be derived: **ask the user**. Do not
   invent one, and do not copy an example or placeholder URL into the app.

Optionally also ask whether the user wants custom events beyond the automatic
pageview. If unsure, integrate the automatic pageview only.

## 2. Install

```sh
npm install <package-name>
```

Use the project's own package manager (pnpm / yarn / bun) if it differs.

## 3. Integrate — two lines, in existing files

Seed the endpoint, in code that runs during startup — a one-line inline script
in the host page, or the top level of a module in the startup path:

```html
<script>localStorage.setItem('footprint:endpoint', '<endpoint-url>');</script>
```

Then add the bare import to code that already runs at startup:

```js
import '<package-name>';
```

That is the complete integration. The import fires one pageview automatically.

## 4. Rules

- Do not create a new file, wrapper module, initialization function, or
  framework lifecycle hook for this integration.
- Do not call `step()` for the initial pageview — it auto-fires on import,
  whatever binding you import.
- Do not seed the endpoint after render (components, lifecycle hooks, event
  handlers) — the auto-fire waits ~300ms at startup, then gives up silently.
- For custom events, prefer the default import so the call stays namespaced:
  `import footprint from '<package-name>'`, then
  `footprint.step('event-name', { any: 'data' })`.
- The automatic pageview fires once per full page load. For SPA route changes,
  call `footprint.step()` on navigation yourself — or, to fire every pageview
  manually, import `<package-name>/step` instead (no auto-fire at all).

## 5. Verify

Run the app, load a page, and confirm one POST request reaches `<endpoint-url>`
(Network tab: `sendBeacon` or fetch, `text/plain` body, fired on page load). If
no request appears, the endpoint was seeded too late or not at all — fix the
seeding location; do not add retry logic of your own.
