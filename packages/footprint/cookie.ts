type CookieEntry = { name?: string; value?: string };
type CookieOptions = {
  name: string;
  value: string;
  path?: string;
  expires?: number | null;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
};
type CookieStoreLike = {
  get(name: string): Promise<CookieEntry | null>;
  set(options: CookieOptions): Promise<void>;
};

export const parseCookie = (cookie: string, name: string): string | undefined => {
  const prefix = `${name}=`;
  const found = cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
};

export const serializeCookie = (options: CookieOptions): string => {
  const parts: string[] = [`${options.name}=${options.value}`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (typeof options.expires === 'number') {
    parts.push(`Expires=${new Date(options.expires).toUTCString()}`);
  }
  parts.push(`SameSite=${options.sameSite ?? 'lax'}`);
  if (options.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
};

const cookieStore: CookieStoreLike = window.cookieStore ?? {
  get: (name: string): Promise<CookieEntry | null> => {
    const value = parseCookie(document.cookie, name);
    return Promise.resolve(value === undefined ? null : { name, value });
  },
  set: (options: CookieOptions): Promise<void> => {
    document.cookie = serializeCookie({ ...options, secure: options.secure ?? location.protocol === 'https:' });
    return Promise.resolve();
  },
};

export const readCookie = async (key: string): Promise<string | undefined> => {
  const entry: CookieEntry | null = await cookieStore.get(key).catch(() => null);
  return entry?.value;
};

export const writeCookie = async (key: string, value: string): Promise<void> => {
  const expires: number = Date.now() + 60 * 60 * 24 * 400 * 1000;
  await cookieStore.set({ name: key, value, path: '/', expires, sameSite: 'lax' }).catch(() => {});
};
