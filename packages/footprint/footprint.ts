import { readCookie, writeCookie } from './cookie.js';
import { readDatabase, writeDatabase } from './indexedDB.js';
import { readLocal, writeLocal } from './localStorage.js';
import { readSession, writeSession } from './sessionStorage.js';

type NetworkInformation = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
};

type NavigatorUABrand = {
  brand: string;
  version: string;
};

type NavigatorUAData = {
  brands?: NavigatorUABrand[];
  mobile?: boolean;
  platform?: string;
};

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    userAgentData?: NavigatorUAData;
  }
  interface Document {
    documentMode?: number;
  }
}

const collect = () => {
  const connection: NetworkInformation | undefined =
    'connection' in navigator ? navigator.connection : undefined;
  const userAgentData: NavigatorUAData | undefined =
    'userAgentData' in navigator ? navigator.userAgentData : undefined;
  const documentMode: number | undefined =
    'documentMode' in document ? document.documentMode : undefined;
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
    },
    navigator: {
      userAgent: navigator.userAgent,
      userAgentHints: {
        brands: userAgentData?.brands,
        mobile: userAgentData?.mobile,
        platform: userAgentData?.platform,
      },
    },
    connection: {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
    },
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: screen.orientation.type,
    },
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    intl: {
      locale: intl.locale,
      timeZone: intl.timeZone,
    },
    colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
};

const send = (endpoint: string, payload: object = collect()): boolean => {
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

const KEY: string = 'footprint';

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

export { collect, send, identify };
