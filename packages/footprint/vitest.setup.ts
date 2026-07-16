import { beforeEach } from 'vitest';

class MemoryStorage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
}

const define = (target: object, properties: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  }
};

const cookieJar = new Map<string, string>();
const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();

const indexedDBData = new Map<string, Map<string, unknown>>();

const makeRequest = () => {
  const listeners = new Map<string, () => void>();
  return {
    result: undefined as unknown,
    error: null as unknown,
    addEventListener(type: string, listener: () => void) {
      listeners.set(type, listener);
    },
    fire(type: string) {
      listeners.get(type)?.();
    },
  };
};

const makeStore = (name: string) => ({
  get(key: string) {
    const request = makeRequest();
    request.result = indexedDBData.get(name)?.get(key);
    queueMicrotask(() => request.fire('success'));
    return request;
  },
  put(value: unknown, key: string) {
    indexedDBData.get(name)?.set(key, value);
    const request = makeRequest();
    queueMicrotask(() => request.fire('success'));
    return request;
  },
});

const makeTransaction = (name: string) => {
  const listeners = new Map<string, () => void>();
  queueMicrotask(() => listeners.get('complete')?.());
  return {
    objectStore: () => makeStore(name),
    addEventListener(type: string, listener: () => void) {
      listeners.set(type, listener);
    },
  };
};

const makeDatabase = (name: string) => ({
  createObjectStore: () => ({}),
  transaction: () => makeTransaction(name),
});

const indexedDB = {
  open(name: string) {
    const request = makeRequest();
    const isNew = !indexedDBData.has(name);
    if (isNew) {
      indexedDBData.set(name, new Map());
    }
    request.result = makeDatabase(name);
    queueMicrotask(() => {
      if (isNew) {
        request.fire('upgradeneeded');
      }
      request.fire('success');
    });
    return request;
  },
};

define(globalThis, {
  window: globalThis,
  indexedDB,
  localStorage,
  sessionStorage,
  innerWidth: 1280,
  innerHeight: 720,
  outerWidth: 1280,
  outerHeight: 800,
  devicePixelRatio: 2,
  screenX: 0,
  screenY: 0,
  matchMedia: (media: string) => ({ matches: false, media }),
  location: {
    href: 'http://localhost/',
    protocol: 'http:',
    hostname: 'localhost',
    pathname: '/',
    search: '',
    hash: '',
  },
  navigator: {
    userAgent: 'vitest',
    language: 'en-US',
    languages: ['en-US', 'en'],
    vendor: '',
    hardwareConcurrency: 8,
    maxTouchPoints: 0,
    cookieEnabled: true,
    onLine: true,
    webdriver: false,
    pdfViewerEnabled: false,
    doNotTrack: null,
  },
  screen: {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
    orientation: { type: 'landscape-primary', angle: 0 },
  },
  document: {
    referrer: '',
    visibilityState: 'visible',
    characterSet: 'UTF-8',
    get cookie(): string {
      return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    },
    set cookie(raw: string) {
      const pair = raw.split('; ', 1)[0];
      const equalsIndex = pair.indexOf('=');
      const name = pair.slice(0, equalsIndex);
      const value = pair.slice(equalsIndex + 1);
      if (/max-age=0/i.test(raw) || /expires=[^;]*1970/i.test(raw)) {
        cookieJar.delete(name);
      } else {
        cookieJar.set(name, value);
      }
    },
  },
});

beforeEach(() => {
  cookieJar.clear();
  indexedDBData.clear();
  localStorage.clear();
  sessionStorage.clear();
});
