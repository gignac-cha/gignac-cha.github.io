import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDatabase, writeDatabase } from './indexedDB.ts';

const KEY = 'footprint';
const ENDPOINT_KEY = 'footprint:endpoint';
const ENDPOINT = 'https://worker.test/';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const importStep = async () => (await import('./footprint.ts')).step;

const navigatorKeys: string[] = [];
const defineNavigator = (properties: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(navigator, key, { configurable: true, writable: true, value });
    navigatorKeys.push(key);
  }
};

const setBeacon = (implementation: (url: string, data: Blob) => boolean) =>
  defineNavigator({ sendBeacon: implementation });

const captureBeacon = () => {
  const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
  setBeacon(beacon);
  return beacon;
};

const bodyOf = async (blob: Blob) => JSON.parse(await blob.text());
const nthBody = async (beacon: ReturnType<typeof captureBeacon>, index: number) =>
  bodyOf(beacon.mock.calls[index][1]);

const fire = async () => {
  localStorage.setItem(ENDPOINT_KEY, ENDPOINT);
  const beacon = captureBeacon();
  const step = await importStep();
  await vi.waitFor(() => expect(beacon).toHaveBeenCalledTimes(1));
  return { beacon, step, body: await nthBody(beacon, 0) };
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  for (const key of navigatorKeys.splice(0)) {
    delete (navigator as unknown as Record<string, unknown>)[key];
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('endpoint resolution', () => {
  it('does not send at all when no endpoint is configured anywhere', async () => {
    const beacon = captureBeacon();
    await importStep();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(beacon).not.toHaveBeenCalled();
  });

  it('prefers IndexedDB over every other store', async () => {
    await writeDatabase(ENDPOINT_KEY, 'https://indexeddb.test/');
    localStorage.setItem(ENDPOINT_KEY, 'https://local.test/');
    sessionStorage.setItem(ENDPOINT_KEY, 'https://session.test/');
    document.cookie = `${ENDPOINT_KEY}=https://cookie.test/`;
    const beacon = captureBeacon();
    await importStep();
    await vi.waitFor(() => expect(beacon).toHaveBeenCalled());
    expect(beacon.mock.calls[0][0]).toBe('https://indexeddb.test/');
  });

  it('falls back to localStorage over sessionStorage and cookie', async () => {
    localStorage.setItem(ENDPOINT_KEY, 'https://local.test/');
    sessionStorage.setItem(ENDPOINT_KEY, 'https://session.test/');
    document.cookie = `${ENDPOINT_KEY}=https://cookie.test/`;
    const beacon = captureBeacon();
    await importStep();
    await vi.waitFor(() => expect(beacon).toHaveBeenCalled());
    expect(beacon.mock.calls[0][0]).toBe('https://local.test/');
  });

  it('falls back to sessionStorage over cookie', async () => {
    sessionStorage.setItem(ENDPOINT_KEY, 'https://session.test/');
    document.cookie = `${ENDPOINT_KEY}=https://cookie.test/`;
    const beacon = captureBeacon();
    await importStep();
    await vi.waitFor(() => expect(beacon).toHaveBeenCalled());
    expect(beacon.mock.calls[0][0]).toBe('https://session.test/');
  });

  it('reads the cookie as the last resort', async () => {
    document.cookie = `${ENDPOINT_KEY}=https://cookie.test/`;
    const beacon = captureBeacon();
    await importStep();
    await vi.waitFor(() => expect(beacon).toHaveBeenCalled());
    expect(beacon.mock.calls[0][0]).toBe('https://cookie.test/');
  });

  it('memoizes the endpoint for the lifetime of the page', async () => {
    localStorage.setItem(ENDPOINT_KEY, 'https://first.test/');
    const beacon = captureBeacon();
    const step = await importStep();
    await vi.waitFor(() => expect(beacon).toHaveBeenCalledTimes(1));
    localStorage.setItem(ENDPOINT_KEY, 'https://second.test/');
    await step();
    expect(beacon.mock.calls.map(([url]) => url)).toEqual(['https://first.test/', 'https://first.test/']);
  });
});

describe('visitor uuid', () => {
  it('auto-fires a pageview on load with arguments:[] and a fresh uuid', async () => {
    const { beacon, body } = await fire();
    expect(beacon.mock.calls[0][0]).toBe(ENDPOINT);
    expect(body.arguments).toEqual([]);
    expect(body.uuid).toMatch(UUID_PATTERN);
    expect(body.location.href).toBeTruthy();
  });

  it('upserts the uuid into cookie, localStorage, sessionStorage and IndexedDB', async () => {
    const { body } = await fire();
    expect(localStorage.getItem(KEY)).toBe(body.uuid);
    expect(sessionStorage.getItem(KEY)).toBe(body.uuid);
    expect(document.cookie).toContain(`${KEY}=${body.uuid}`);
    expect(await readDatabase(KEY)).toBe(body.uuid);
  });

  it('adopts an existing uuid from the cookie ahead of other stores', async () => {
    document.cookie = `${KEY}=cookie-uuid`;
    localStorage.setItem(KEY, 'local-uuid');
    const { body } = await fire();
    expect(body.uuid).toBe('cookie-uuid');
    expect(localStorage.getItem(KEY)).toBe('cookie-uuid');
    expect(sessionStorage.getItem(KEY)).toBe('cookie-uuid');
  });

  it('adopts a uuid from localStorage when the cookie is empty', async () => {
    localStorage.setItem(KEY, 'local-uuid');
    const { body } = await fire();
    expect(body.uuid).toBe('local-uuid');
    expect(document.cookie).toContain(`${KEY}=local-uuid`);
  });

  it('keeps the same uuid across multiple step() calls', async () => {
    const { beacon, step, body } = await fire();
    await step('again');
    await vi.waitFor(() => expect(beacon).toHaveBeenCalledTimes(2));
    const second = await nthBody(beacon, 1);
    expect(second.uuid).toBe(body.uuid);
  });
});

describe('payload', () => {
  it('mirrors Web API objects with verbatim source keys', async () => {
    const { body } = await fire();
    expect(body.location).toEqual({ href: 'http://localhost/', pathname: '/', search: '', hash: '' });
    expect(body.screen).toMatchObject({
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: 'landscape-primary',
    });
    expect(body.window).toEqual({
      innerWidth: 1280,
      innerHeight: 720,
      outerWidth: 1280,
      outerHeight: 800,
      devicePixelRatio: 2,
      screenX: 0,
      screenY: 0,
    });
    expect(body.navigator).toMatchObject({
      userAgent: 'vitest',
      language: 'en-US',
      languages: ['en-US', 'en'],
      hardwareConcurrency: 8,
      maxTouchPoints: 0,
      cookieEnabled: true,
      onLine: true,
      webdriver: false,
      pdfViewerEnabled: false,
    });
    expect(body.document).toMatchObject({ referrer: '', visibilityState: 'visible', characterSet: 'UTF-8' });
    expect(body.intl.locale).toBeTruthy();
    expect(body.intl.timeZone).toBeTruthy();
  });

  it('computes flat media-query values with quiet defaults', async () => {
    const { body } = await fire();
    expect(body.colorScheme).toBe('light');
    expect(body.reducedMotion).toBe(false);
    expect(body.forcedColors).toBe(false);
    expect(body.pointer).toBe('none');
    expect(body.hover).toBe(false);
  });

  it('reflects matchMedia results (dark scheme, coarse pointer, reduced motion)', async () => {
    const matching = new Set([
      '(prefers-color-scheme: dark)',
      '(pointer: coarse)',
      '(prefers-reduced-motion: reduce)',
    ]);
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: matching.has(media), media }));
    const { body } = await fire();
    expect(body.colorScheme).toBe('dark');
    expect(body.pointer).toBe('coarse');
    expect(body.reducedMotion).toBe(true);
  });

  it('merges async device info (UA hints, gpu, storage, battery) into the payload', async () => {
    defineNavigator({
      userAgentData: {
        brands: [{ brand: 'Chromium', version: '126' }],
        mobile: false,
        platform: 'macOS',
        getHighEntropyValues: async () => ({
          architecture: 'arm',
          bitness: '64',
          platformVersion: '15.0.0',
          wow64: false,
        }),
      },
      gpu: {
        requestAdapter: async () => ({
          info: { vendor: 'apple', architecture: 'metal-3', device: '', description: 'Apple M4' },
        }),
      },
      storage: { estimate: async () => ({ quota: 1000, usage: 10 }) },
      getBattery: async () => ({ charging: true, level: 0.87, chargingTime: 1200, dischargingTime: 0 }),
    });
    const { body } = await fire();
    expect(body.navigator.userAgentHints).toMatchObject({
      brands: [{ brand: 'Chromium', version: '126' }],
      mobile: false,
      platform: 'macOS',
      architecture: 'arm',
      bitness: '64',
      platformVersion: '15.0.0',
      wow64: false,
    });
    expect(body.gpu).toEqual({ vendor: 'apple', architecture: 'metal-3', device: '', description: 'Apple M4' });
    expect(body.storage).toEqual({ quota: 1000, usage: 10 });
    expect(body.battery).toEqual({ charging: true, level: 0.87, chargingTime: 1200, dischargingTime: 0 });
  });

  it('degrades every device group gracefully when the APIs reject', async () => {
    defineNavigator({
      userAgentData: {
        brands: [{ brand: 'Chromium', version: '126' }],
        mobile: false,
        platform: 'macOS',
        getHighEntropyValues: () => Promise.reject(new Error('denied')),
      },
      gpu: { requestAdapter: () => Promise.reject(new Error('lost')) },
      storage: { estimate: () => Promise.reject(new Error('nope')) },
      getBattery: () => Promise.reject(new Error('none')),
    });
    const { body } = await fire();
    expect(body.navigator.userAgentHints).toMatchObject({ platform: 'macOS' });
    expect(body.navigator.userAgentHints.architecture).toBeUndefined();
    expect(body.gpu).toBeUndefined();
    expect(body.storage).toBeUndefined();
    expect(body.battery).toBeUndefined();
  });

  it('sends step() arguments verbatim as an array, deeply nested', async () => {
    const { beacon, step } = await fire();
    await step('cta-click', { plan: 'pro', tags: ['a', 'b'] }, 3, null, [true, { deep: { nested: 1 } }]);
    await vi.waitFor(() => expect(beacon).toHaveBeenCalledTimes(2));
    const body = await nthBody(beacon, 1);
    expect(body.arguments).toEqual(['cta-click', { plan: 'pro', tags: ['a', 'b'] }, 3, null, [true, { deep: { nested: 1 } }]]);
  });
});

describe('transport', () => {
  it('sends a text/plain blob so the request stays a CORS-simple request', async () => {
    const { beacon } = await fire();
    const blob = beacon.mock.calls[0][1];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/plain; charset=utf-8');
  });

  it('falls back to fetch(keepalive) with the same body when sendBeacon refuses', async () => {
    localStorage.setItem(ENDPOINT_KEY, ENDPOINT);
    const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => false);
    setBeacon(beacon);
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetchMock);
    await importStep();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(requestInit.method).toBe('POST');
    expect(requestInit.keepalive).toBe(true);
    expect(requestInit.headers).toEqual({ 'Content-Type': 'text/plain; charset=utf-8' });
    expect(JSON.parse(requestInit.body as string)).toEqual(await nthBody(beacon, 0));
  });

  it('uses fetch(keepalive) when sendBeacon does not exist at all', async () => {
    localStorage.setItem(ENDPOINT_KEY, ENDPOINT);
    delete (navigator as unknown as Record<string, unknown>).sendBeacon;
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetchMock);
    await importStep();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0] as unknown).toBe(ENDPOINT);
  });

  it('swallows network failures instead of surfacing an unhandled rejection', async () => {
    localStorage.setItem(ENDPOINT_KEY, ENDPOINT);
    setBeacon(() => false);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const step = await importStep();
    await expect(step('after-failure')).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});
