import { readCookie, writeCookie } from './cookie.ts';
import { readIndexedDB, writeIndexedDB } from './indexedDB.ts';
import { readLocalStorage, writeLocalStorage } from './localStorage.ts';
import { readSessionStorage, writeSessionStorage } from './sessionStorage.ts';
import { buildPayload, mergeUserAgentHints, pointerFrom } from './payload.ts';

type NetworkInformation = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: string;
  downlinkMax?: number;
};

type NavigatorUABrandVersion = {
  brand: string;
  version: string;
};

type HighEntropyUserAgentData = {
  architecture?: string;
  bitness?: string;
  model?: string;
  platformVersion?: string;
  fullVersionList?: NavigatorUABrandVersion[];
  wow64?: boolean;
};

type NavigatorUAData = {
  brands?: NavigatorUABrandVersion[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyUserAgentData>;
};

type BatteryManagerLike = {
  charging: boolean;
  level: number;
  chargingTime: number;
  dischargingTime: number;
};

type MemoryInfo = {
  jsHeapSizeLimit?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
};

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    userAgentData?: NavigatorUAData;
    deviceMemory?: number;
    globalPrivacyControl?: boolean;
    getBattery?: () => Promise<BatteryManagerLike>;
  }
  interface Document {
    documentMode?: number;
  }
  interface Screen {
    isExtended?: boolean;
  }
  interface Performance {
    memory?: MemoryInfo;
  }
}

const KEY: string = 'footprint';
const ENDPOINT_KEY: string = 'footprint:endpoint';
// Auto-pageview retry schedule: 3 attempts with 100 ms * 2^n backoff between them (100 ms,
// 200 ms — ~300 ms total) to absorb the race with the endpoint-seeding script; see
// resolveEndpointWithRetry below. The 450 ms "did not send" waits in footprint.test.ts are
// derived from this total — keep them in sync if these values ever change.
const ENDPOINT_RETRY_ATTEMPTS = 3;
const ENDPOINT_RETRY_BASE_DELAY_MILLISECONDS = 100;

const collect = () => {
  const connection: NetworkInformation | undefined =
    'connection' in navigator ? navigator.connection : undefined;
  const userAgentData: NavigatorUAData | undefined =
    'userAgentData' in navigator ? navigator.userAgentData : undefined;
  const documentMode: number | undefined =
    'documentMode' in document ? document.documentMode : undefined;
  const orientation: ScreenOrientation | undefined =
    'orientation' in screen ? screen.orientation : undefined;
  const memory: MemoryInfo | undefined = 'memory' in performance ? performance.memory : undefined;
  const intl: Intl.ResolvedDateTimeFormatOptions = Intl.DateTimeFormat().resolvedOptions();
  return {
    location: {
      href: location.href,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    },
    document: {
      referrer: document.referrer,
      documentMode,
      visibilityState: document.visibilityState,
      characterSet: document.characterSet,
    },
    navigator: {
      userAgent: navigator.userAgent,
      // Low-entropy snapshot only (brands / mobile / platform): collect() is synchronous, and
      // the high-entropy fields need the async getHighEntropyValues(). buildPayload() in
      // payload.ts overwrites this value once the async result lands and keeps it as the
      // fallback when that call fails — see the comment there.
      userAgentHints: mergeUserAgentHints(userAgentData),
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints,
      language: navigator.language,
      languages: [...navigator.languages],
      vendor: navigator.vendor,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      webdriver: navigator.webdriver,
      pdfViewerEnabled: navigator.pdfViewerEnabled,
      doNotTrack: navigator.doNotTrack,
      globalPrivacyControl: navigator.globalPrivacyControl,
    },
    connection: {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
      type: connection?.type,
      downlinkMax: connection?.downlinkMax,
    },
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: orientation?.type,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      isExtended: screen.isExtended,
    },
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      screenX: window.screenX,
      screenY: window.screenY,
    },
    intl: {
      locale: intl.locale,
      timeZone: intl.timeZone,
      calendar: intl.calendar,
      numberingSystem: intl.numberingSystem,
      hourCycle: intl.hourCycle,
    },
    memory: {
      jsHeapSizeLimit: memory?.jsHeapSizeLimit,
      totalJSHeapSize: memory?.totalJSHeapSize,
      usedJSHeapSize: memory?.usedJSHeapSize,
    },
    colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches,
    forcedColors: matchMedia('(forced-colors: active)').matches,
    invertedColors: matchMedia('(inverted-colors: inverted)').matches,
    pointer: pointerFrom(matchMedia('(pointer: coarse)').matches, matchMedia('(pointer: fine)').matches),
    hover: matchMedia('(hover: hover)').matches,
  };
};

// Transport contract — do NOT change the Content-Type. The JSON body is deliberately shipped as
// `text/plain`, because that is one of only three media types the Fetch Standard counts as a
// CORS-safelisted `Content-Type` (`application/x-www-form-urlencoded`, `multipart/form-data`,
// `text/plain`). That keeps both the sendBeacon call and the fetch() fallback "CORS-simple"
// requests: any origin can POST to the collector with no preflight and no CORS response headers,
// and the collector worker intentionally serves none (the Playwright suite runs it with no CORS
// headers to prove this). "Fixing" this to `application/json` makes every cross-origin send
// trigger an OPTIONS preflight that the collector rejects — tracking dies silently with no error.
// See Fetch Standard, "CORS-safelisted request-header":
// https://fetch.spec.whatwg.org/#cors-safelisted-request-header (also MDN's CORS guide on
// simple requests).
// The fallback exists because navigator.sendBeacon(url, data) returns false whenever the user
// agent cannot queue the payload — e.g. the per-page beacon quota (~64 KiB in practice) is
// exhausted — and the API itself may be absent. In that case we retry with the identical body via
// fetch(..., { keepalive: true }), which like a beacon may outlive an unloading page. Errors are
// swallowed: transport is fire-and-forget and must never surface an unhandled rejection.
// See the W3C Beacon spec (https://www.w3.org/TR/beacon/) and
// https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
const send = (endpoint: string, payload: object): boolean => {
  const body: string = JSON.stringify(payload);
  const blob: Blob = new Blob([body], { type: 'text/plain; charset=utf-8' });
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(endpoint, blob)) {
    return true;
  }
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body,
    keepalive: true,
  }).catch(() => {});
  return false;
};

// Three-tier fallback because the ideal API is not always present:
// 1. crypto.randomUUID() — the right tool, but exposed only in secure contexts (HTTPS or
//    localhost), so a tracker loaded on a plain-http page lacks it even in current browsers.
//    See https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
// 2. crypto.getRandomValues() — not secure-context-gated and still a CSPRNG; the v4 UUID is then
//    assembled by hand below.
// 3. Math.random() — last resort for legacy/embedded contexts with no WebCrypto at all. Not
//    cryptographically strong, but this value is a visitor-correlation token, not a security
//    credential, so a weaker source is an acceptable worst case.
// The manual paths are exercised by the 'device resilience' tests in footprint.test.ts, which
// delete crypto.randomUUID / crypto.getRandomValues and still expect a well-formed v4 UUID.
const createUUID = (): string => {
  const hasCrypto = typeof crypto !== 'undefined';
  if (hasCrypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (hasCrypto && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  // Stamp the RFC 4122 / RFC 9562 UUIDv4 invariants onto the random bytes: octet 6's high
  // nibble is forced to 0b0100 (version 4) and octet 8's top two bits to 0b10 (the IETF
  // variant). Without these two lines the output would be 128 random bits merely formatted like
  // a UUID — it would fail validators, and footprint.test.ts's UUID_V4_PATTERN asserts the third
  // group starts with '4' and the fourth with [89ab]. See RFC 9562, Section 5.4 "UUID Version 4"
  // (https://www.rfc-editor.org/rfc/rfc9562.html), which obsoletes RFC 4122 (Section 4.4).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Visitor-uuid read priority is cookie -> localStorage -> sessionStorage -> IndexedDB, which is
// the exact REVERSE of resolveEndpoint below (IndexedDB -> localStorage -> sessionStorage ->
// cookie). This asymmetry is a deliberate, documented contract, not an inconsistency to
// normalize: the uuid favors the cookie — the most established visitor-ID store, and the only
// one that also travels with HTTP requests — while the endpoint order matches the README's
// "Configure the endpoint" resolution priority, favoring the programmatic store a seeding
// script writes. Both orders are pinned test by test in footprint.test.ts ('adopts an existing
// uuid from the cookie ahead of other stores', 'prefers IndexedDB over every other store',
// and the fallback chain tests) — "unifying" them breaks which store wins on conflict.
// After reading, the winning value is upserted into ALL four stores so they re-converge and the
// id survives any single store being cleared.
const identify = async (): Promise<string> => {
  const existing: string | undefined =
    (await readCookie(KEY)) ??
    readLocalStorage(KEY) ??
    readSessionStorage(KEY) ??
    (await readIndexedDB(KEY).catch(() => undefined));
  const uuid: string = existing ?? createUUID();

  await writeCookie(KEY, uuid);
  writeLocalStorage(KEY, uuid);
  writeSessionStorage(KEY, uuid);
  await writeIndexedDB(KEY, uuid).catch(() => {});

  return uuid;
};

// Endpoint priority: IndexedDB -> localStorage -> sessionStorage -> cookie (first hit wins),
// per the README — intentionally the reverse of identify() above; see the comment there.
const resolveEndpoint = async (): Promise<string | undefined> =>
  (await readIndexedDB(ENDPOINT_KEY).catch(() => undefined)) ??
  readLocalStorage(ENDPOINT_KEY) ??
  readSessionStorage(ENDPOINT_KEY) ??
  (await readCookie(ENDPOINT_KEY));

const resolveUserAgentHints = async () => {
  const userAgentData: NavigatorUAData | undefined =
    'userAgentData' in navigator ? navigator.userAgentData : undefined;
  if (!userAgentData) {
    return undefined;
  }
  const high: HighEntropyUserAgentData | undefined = userAgentData.getHighEntropyValues
    ? await userAgentData
        .getHighEntropyValues(['architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList', 'wow64'])
        .catch(() => undefined)
    : undefined;
  return mergeUserAgentHints(userAgentData, high);
};

const resolveGpu = async () => {
  if (!navigator.gpu) {
    return undefined;
  }
  const adapter: GPUAdapter | null = await navigator.gpu.requestAdapter().catch(() => null);
  const info: GPUAdapterInfo | undefined = adapter?.info;
  if (!info) {
    return undefined;
  }
  return {
    vendor: info.vendor,
    architecture: info.architecture,
    device: info.device,
    description: info.description,
  };
};

const resolveStorage = async () => {
  if (!navigator.storage?.estimate) {
    return undefined;
  }
  const estimate: StorageEstimate | undefined = await navigator.storage.estimate().catch(() => undefined);
  if (!estimate) {
    return undefined;
  }
  return {
    quota: estimate.quota,
    usage: estimate.usage,
  };
};

const resolveBattery = async () => {
  if (!navigator.getBattery) {
    return undefined;
  }
  const battery: BatteryManagerLike | undefined = await navigator.getBattery().catch(() => undefined);
  if (!battery) {
    return undefined;
  }
  return {
    charging: battery.charging,
    level: battery.level,
    chargingTime: battery.chargingTime,
    dischargingTime: battery.dischargingTime,
  };
};

let endpointOnce: Promise<string | undefined> | undefined;
let uuidOnce: Promise<string> | undefined;
let deviceOnce:
  | Promise<{
      userAgentHints: Awaited<ReturnType<typeof resolveUserAgentHints>>;
      gpu: Awaited<ReturnType<typeof resolveGpu>>;
      storage: Awaited<ReturnType<typeof resolveStorage>>;
      battery: Awaited<ReturnType<typeof resolveBattery>>;
    }>
  | undefined;

const getDevice = () =>
  (deviceOnce ??= Promise.all([
    resolveUserAgentHints(),
    resolveGpu(),
    resolveStorage(),
    resolveBattery(),
  ]).then(([userAgentHints, gpu, storage, battery]) => ({ userAgentHints, gpu, storage, battery })));

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

// Memoization that deliberately caches only success. A plain "once" memoizer would also cache
// the "no endpoint yet" outcome — and since the endpoint is seeded into browser storage by an
// external script that may run after this module, the first miss would then pin every later
// step() call to `undefined` for the lifetime of the page. So: concurrent callers share the one
// in-flight promise, but when the scan resolves empty the cache is cleared so the next call
// re-reads storage (this is what lets resolveEndpointWithRetry's later attempts see a
// late-seeded endpoint at all).
// The `endpointOnce === pending` identity check is load-bearing: by the time this (stale, empty)
// result resolves, a newer attempt may already have replaced `endpointOnce`; resetting it
// unconditionally would wipe out that newer in-flight attempt — a lost-update race between
// concurrent step() calls and the auto-fire retry loop. identifyOnce below applies the same
// discipline to rejections. Do not "simplify" either into a plain memoize.
const resolveEndpointOnce = async (): Promise<string | undefined> => {
  const pending = (endpointOnce ??= resolveEndpoint());
  const endpoint = await pending;
  if (!endpoint && endpointOnce === pending) {
    endpointOnce = undefined;
  }
  return endpoint;
};

// Same non-caching discipline as resolveEndpointOnce above, but for failure instead of
// emptiness: a rejected identify() (a storage API throwing mid-flight) must not stay memoized,
// or one transient error would poison every future step() with the same rejection. The identity
// check again protects a newer concurrent attempt from being cleared by a stale one.
const identifyOnce = async (): Promise<string> => {
  const pending = (uuidOnce ??= identify());
  try {
    return await pending;
  } catch (error) {
    if (uuidOnce === pending) {
      uuidOnce = undefined;
    }
    throw error;
  }
};

// Used by the automatic pageview ONLY. The endpoint is never hardcoded — a seeding script on the
// host page writes it into browser storage — and nothing guarantees that script runs before this
// module's import-time auto-fire. This bounded retry (ENDPOINT_RETRY_ATTEMPTS = 3 lookups with
// exponential backoff of 100 ms then 200 ms, ~300 ms worst case, then give up silently) absorbs
// that load-order race so the initial pageview is not dropped.
// Manual step() intentionally does NOT wait: it resolves the endpoint once via
// resolveEndpointOnce() and bails immediately, because a user-triggered event must not stall on
// configuration that may never arrive. Do not "unify" the two strategies — the split is part of
// the documented contract (README "Use" section) and is pinned by footprint.test.ts
// ('auto-fire waits for an endpoint seeded shortly after load' vs
// 'manual step() checks the endpoint once without waiting').
const resolveEndpointWithRetry = async (): Promise<string | undefined> => {
  for (let attempt = 0; attempt < ENDPOINT_RETRY_ATTEMPTS; attempt++) {
    const endpoint = await resolveEndpointOnce();
    if (endpoint) {
      return endpoint;
    }
    if (attempt < ENDPOINT_RETRY_ATTEMPTS - 1) {
      await sleep(ENDPOINT_RETRY_BASE_DELAY_MILLISECONDS * 2 ** attempt);
    }
  }
  return undefined;
};

const stepWith = async (
  resolveEndpointStrategy: () => Promise<string | undefined>,
  arguments_: unknown[],
): Promise<void> => {
  const [endpoint, uuid, device] = await Promise.all([
    resolveEndpointStrategy(),
    identifyOnce(),
    getDevice(),
  ]);
  if (!endpoint) {
    return;
  }
  send(endpoint, buildPayload(arguments_, uuid, collect(), device));
};

export const step = (...arguments_: unknown[]): Promise<void> =>
  stepWith(resolveEndpointOnce, arguments_);

// Import-time side effect, on purpose: merely importing this module sends exactly one automatic
// pageview (a step() with empty arguments). This is the package's core contract — the README
// promises "zero extra code" — so do not refactor it into an exported init() the caller must
// invoke. Because the entire feature lives in a side effect, the published manifest pins
// `sideEffects: true` (see publish.ts); the two are a matched pair — without that flag, bundlers
// would tree-shake this very block out of consumer builds and tracking would silently vanish.
// The `typeof window` guard makes the module safe to import under Node/vitest, where there is no
// page to track; the test setup aliases `window` to globalThis precisely to opt back in
// (vitest.setup.ts). The trailing catch(() => {}) guarantees a failed auto-fire can never become
// an unhandled rejection in the host page.
if (typeof window !== 'undefined') {
  void stepWith(resolveEndpointWithRetry, []).catch(() => {});
}
