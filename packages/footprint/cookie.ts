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

// The Cookie Store API cannot be assumed: Chromium has shipped it since Chrome 87, but Safari
// and Firefox only added it in 2025 (Safari ~18.4–18.5, Firefox 138), so older engines have
// nothing — and
// the API is exposed only in secure contexts, meaning even a current Chrome has no
// window.cookieStore on a plain http:// page. Rather than branching at every call site, this
// shim rebuilds the two operations we use (get/set) on top of document.cookie behind the same
// promise-based shape, so readCookie/writeCookie below are written once against the async
// interface and work everywhere.
// The `secure: options.secure ?? location.protocol === 'https:'` default makes cookies written
// from HTTPS pages carry the Secure attribute (matching the secure-context posture of the real
// API) while still letting plain-HTTP local development write the cookie at all — a Secure
// cookie set from http:// would simply be rejected by the browser.
// See https://developer.mozilla.org/en-US/docs/Web/API/CookieStore
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
  // 400 days (seconds-per-day * 400, * 1000 for milliseconds) is not an arbitrary "long time" —
  // it is the maximum cookie lifetime browsers enforce. draft-ietf-httpbis-rfc6265bis (the
  // RFC 6265 revision, "Cookie Lifetime Limits") requires user agents to cap Expires/Max-Age,
  // recommends the cap not exceed 400 days, and mandates that longer values be silently reduced
  // to the cap. Chrome has enforced exactly 400 days since M104 (2022). Asking for the classic
  // "10 years" would therefore buy nothing; writing exactly the cap yields the longest lifetime
  // actually honored, and every visit rewrites the cookie, sliding the window forward.
  // Spec: rfc6265bis §5.5 (Storage Model) — "The limit SHOULD NOT be greater than 400 days
  // (34560000 seconds) in the future. The RECOMMENDED limit is 400 days":
  // https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html
  // Chrome rollout: https://developer.chrome.com/blog/cookie-max-age-expires
  const expires: number = Date.now() + 60 * 60 * 24 * 400 * 1000;
  await cookieStore.set({ name: key, value, path: '/', expires, sameSite: 'lax' }).catch(() => {});
};
