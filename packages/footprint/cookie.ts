type CookieEntry = { name: string; value: string };
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

declare global {
  interface Window {
    cookieStore?: CookieStoreLike;
  }
}

const cookieStore: CookieStoreLike = window.cookieStore ?? {
  get: (name: string): Promise<CookieEntry | null> => {
    const prefix: string = `${name}=`;
    const found: string | undefined = document.cookie
      .split('; ')
      .find((entry: string) => entry.startsWith(prefix));
    return Promise.resolve(found ? { name, value: found.slice(prefix.length) } : null);
  },
  set: (options: CookieOptions): Promise<void> => {
    const parts: string[] = [`${options.name}=${options.value}`];
    parts.push(`Path=${options.path ?? '/'}`);
    if (typeof options.expires === 'number') {
      parts.push(`Expires=${new Date(options.expires).toUTCString()}`);
    }
    parts.push(`SameSite=${options.sameSite ?? 'lax'}`);
    if (options.secure ?? location.protocol === 'https:') {
      parts.push('Secure');
    }
    document.cookie = parts.join('; ');
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
