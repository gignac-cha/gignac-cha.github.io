import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

const COLLECTOR = 'http://127.0.0.1:4174';
const PAGE_ORIGIN = 'http://127.0.0.1:4173';
const KEY = 'footprint';
const ENDPOINT_KEY = 'footprint:endpoint';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Collected = {
  method: string;
  path: string;
  origin: string | null;
  contentType: string | null;
  body: string;
};

declare global {
  interface Window {
    step: (...arguments_: unknown[]) => Promise<void>;
  }
}

const newEndpoint = () => {
  const path = `/collect/${randomUUID()}`;
  return { path, url: `${COLLECTOR}${path}` };
};

const collected = async (request: APIRequestContext, path: string): Promise<Collected[]> => {
  const response = await request.get(`${COLLECTOR}/requests?path=${encodeURIComponent(path)}`);
  return response.json();
};

const waitForPosts = async (request: APIRequestContext, path: string, count: number) => {
  await expect
    .poll(async () => (await collected(request, path)).filter((entry) => entry.method === 'POST').length, {
      timeout: 10_000,
    })
    .toBe(count);
  return (await collected(request, path)).filter((entry) => entry.method === 'POST');
};

const seedLocalEndpoint = (page: Page, url: string) =>
  page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [ENDPOINT_KEY, url] as [string, string],
  );

test('auto-fires a pageview on load and delivers it cross-origin without preflight', async ({ page, request }) => {
  const endpoint = newEndpoint();
  await seedLocalEndpoint(page, endpoint.url);
  await page.goto('/app.html');
  const [hit] = await waitForPosts(request, endpoint.path, 1);
  const preflights = (await collected(request, endpoint.path)).filter((entry) => entry.method === 'OPTIONS');
  expect(preflights).toHaveLength(0);
  expect(hit.origin).toBe(PAGE_ORIGIN);
  expect(hit.contentType).toContain('text/plain');
  const body = JSON.parse(hit.body);
  expect(body.arguments).toEqual([]);
  expect(body.uuid).toMatch(UUID_PATTERN);
  expect(body.location.href).toBe(`${PAGE_ORIGIN}/app.html`);
});

test('collects real browser data in the grouped mirror structure', async ({ page, request }) => {
  const endpoint = newEndpoint();
  await seedLocalEndpoint(page, endpoint.url);
  await page.goto('/app.html');
  const [hit] = await waitForPosts(request, endpoint.path, 1);
  const body = JSON.parse(hit.body);
  expect(body.navigator.userAgent).toContain('Chrome');
  expect(body.navigator.userAgentHints.brands.length).toBeGreaterThan(0);
  expect(body.navigator.userAgentHints.platform).toBeTruthy();
  expect(body.navigator.userAgentHints.architecture).toBeTruthy();
  expect(body.navigator.hardwareConcurrency).toBeGreaterThan(0);
  expect(body.navigator.language).toBeTruthy();
  expect(body.screen.width).toBeGreaterThan(0);
  expect(body.screen.orientation).toBeTruthy();
  expect(body.window.innerWidth).toBeGreaterThan(0);
  expect(body.window.devicePixelRatio).toBeGreaterThan(0);
  expect(body.document.characterSet).toBe('UTF-8');
  expect(body.document.visibilityState).toBe('visible');
  expect(body.intl.locale).toBeTruthy();
  expect(body.intl.timeZone).toBeTruthy();
  expect(['light', 'dark']).toContain(body.colorScheme);
  expect(['coarse', 'fine', 'none']).toContain(body.pointer);
  expect(body.storage).toMatchObject({ quota: expect.any(Number), usage: expect.any(Number) });
});

test('step() sends manual events with args verbatim, in order, reusing the visitor uuid', async ({
  page,
  request,
}) => {
  const endpoint = newEndpoint();
  await seedLocalEndpoint(page, endpoint.url);
  await page.goto('/app.html');
  const [pageview] = await waitForPosts(request, endpoint.path, 1);
  await page.evaluate(() => window.step('cta-click', { plan: 'pro', tags: ['a', 'b'] }, 42));
  const posts2 = await waitForPosts(request, endpoint.path, 2);
  await page.evaluate(() => window.step('scroll-end'));
  const posts3 = await waitForPosts(request, endpoint.path, 3);
  const first = JSON.parse(pageview.body);
  const second = JSON.parse(posts2[1].body);
  const third = JSON.parse(posts3[2].body);
  expect(second.arguments).toEqual(['cta-click', { plan: 'pro', tags: ['a', 'b'] }, 42]);
  expect(third.arguments).toEqual(['scroll-end']);
  expect(second.uuid).toBe(first.uuid);
  expect(third.uuid).toBe(first.uuid);
});

test('stays completely silent when no endpoint is configured', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'POST') {
      posts.push(outgoing.url());
    }
  });
  await page.goto('/app.html');
  await page.waitForTimeout(800);
  expect(posts).toHaveLength(0);
});

test('prefers the localStorage endpoint over sessionStorage', async ({ page, request }) => {
  const localEndpoint = newEndpoint();
  const sessionEndpoint = newEndpoint();
  await page.addInitScript(
    ([key, localUrl, sessionUrl]) => {
      localStorage.setItem(key, localUrl);
      sessionStorage.setItem(key, sessionUrl);
    },
    [ENDPOINT_KEY, localEndpoint.url, sessionEndpoint.url] as [string, string, string],
  );
  await page.goto('/app.html');
  await waitForPosts(request, localEndpoint.path, 1);
  expect(await collected(request, sessionEndpoint.path)).toHaveLength(0);
});

test('prefers the IndexedDB endpoint over localStorage', async ({ page, request }) => {
  const indexedDBEndpoint = newEndpoint();
  const localEndpoint = newEndpoint();
  await page.goto('/blank.html');
  await page.evaluate(
    async ([key, indexedDBUrl, localUrl]) => {
      localStorage.setItem(key, localUrl);
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(key, 1);
        open.onupgradeneeded = () => open.result.createObjectStore(key);
        open.onsuccess = () => {
          const transaction = open.result.transaction(key, 'readwrite');
          transaction.objectStore(key).put(indexedDBUrl, key);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        };
        open.onerror = () => reject(open.error);
      });
    },
    [ENDPOINT_KEY, indexedDBEndpoint.url, localEndpoint.url] as [string, string, string],
  );
  await page.goto('/app.html');
  await waitForPosts(request, indexedDBEndpoint.path, 1);
  expect(await collected(request, localEndpoint.path)).toHaveLength(0);
});

test('reads the endpoint from a cookie as the last resort', async ({ page, request }) => {
  const endpoint = newEndpoint();
  await page.addInitScript(
    ([key, value]) => {
      document.cookie = `${key}=${value}`;
    },
    [ENDPOINT_KEY, endpoint.url] as [string, string],
  );
  await page.goto('/app.html');
  const [hit] = await waitForPosts(request, endpoint.path, 1);
  expect(JSON.parse(hit.body).arguments).toEqual([]);
});

test('persists the visitor uuid across navigations and into all four stores', async ({ page, request }) => {
  const endpoint = newEndpoint();
  await seedLocalEndpoint(page, endpoint.url);
  await page.goto('/app.html');
  const [first] = await waitForPosts(request, endpoint.path, 1);
  const uuid = JSON.parse(first.body).uuid;
  await page.reload();
  const posts = await waitForPosts(request, endpoint.path, 2);
  expect(JSON.parse(posts[1].body).uuid).toBe(uuid);
  const stores = await page.evaluate(async (key) => {
    const idb = await new Promise((resolve) => {
      const open = indexedDB.open(key, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(key);
      open.onsuccess = () => {
        const get = open.result.transaction(key, 'readonly').objectStore(key).get(key);
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => resolve(undefined);
      };
      open.onerror = () => resolve(undefined);
    });
    return {
      local: localStorage.getItem(key),
      session: sessionStorage.getItem(key),
      cookie: document.cookie,
      idb,
    };
  }, KEY);
  expect(stores.local).toBe(uuid);
  expect(stores.session).toBe(uuid);
  expect(stores.cookie).toContain(`${KEY}=${uuid}`);
  expect(stores.idb).toBe(uuid);
});

test('adopts a pre-existing uuid from the cookie instead of minting a new one', async ({ page, request }) => {
  const endpoint = newEndpoint();
  const fixed = randomUUID();
  await seedLocalEndpoint(page, endpoint.url);
  await page.addInitScript(
    ([key, value]) => {
      document.cookie = `${key}=${value}`;
    },
    [KEY, fixed] as [string, string],
  );
  await page.goto('/app.html');
  const [hit] = await waitForPosts(request, endpoint.path, 1);
  expect(JSON.parse(hit.body).uuid).toBe(fixed);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(fixed);
});

test('still delivers through fetch(keepalive) when sendBeacon is unavailable', async ({ page, request }) => {
  const endpoint = newEndpoint();
  await seedLocalEndpoint(page, endpoint.url);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'sendBeacon', { configurable: true, value: undefined });
  });
  await page.goto('/app.html');
  const [hit] = await waitForPosts(request, endpoint.path, 1);
  const preflights = (await collected(request, endpoint.path)).filter((entry) => entry.method === 'OPTIONS');
  expect(preflights).toHaveLength(0);
  expect(hit.contentType).toContain('text/plain');
  expect(JSON.parse(hit.body).uuid).toMatch(UUID_PATTERN);
});
