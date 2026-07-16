import { readCookie, writeCookie } from './cookie.ts';
import { readDatabase, writeDatabase } from './indexedDB.ts';
import { readLocal, writeLocal } from './localStorage.ts';
import { readSession, writeSession } from './sessionStorage.ts';
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

const collect = () => {
  const connection: NetworkInformation | undefined =
    'connection' in navigator ? navigator.connection : undefined;
  const userAgentData: NavigatorUAData | undefined =
    'userAgentData' in navigator ? navigator.userAgentData : undefined;
  const documentMode: number | undefined =
    'documentMode' in document ? document.documentMode : undefined;
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
      orientation: screen.orientation.type,
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

const identify = async (): Promise<string> => {
  const existing: string | undefined =
    (await readCookie(KEY)) ??
    readLocal(KEY) ??
    readSession(KEY) ??
    (await readDatabase(KEY).catch(() => undefined));
  const uuid: string = existing ?? crypto.randomUUID();

  await writeCookie(KEY, uuid);
  writeLocal(KEY, uuid);
  writeSession(KEY, uuid);
  await writeDatabase(KEY, uuid).catch(() => {});

  return uuid;
};

const resolveEndpoint = async (): Promise<string | undefined> =>
  (await readDatabase(ENDPOINT_KEY).catch(() => undefined)) ??
  readLocal(ENDPOINT_KEY) ??
  readSession(ENDPOINT_KEY) ??
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

export const step = async (...arguments_: unknown[]): Promise<void> => {
  const [endpoint, uuid, device] = await Promise.all([
    (endpointOnce ??= resolveEndpoint()),
    (uuidOnce ??= identify()),
    getDevice(),
  ]);
  if (!endpoint) {
    return;
  }
  send(endpoint, buildPayload(arguments_, uuid, collect(), device));
};

if (typeof window !== 'undefined') {
  step();
}
