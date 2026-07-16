import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCookie, readCookie, serializeCookie, writeCookie } from './cookie.ts';

const DAY = 24 * 60 * 60 * 1000;

const clearCookies = () => {
  for (const entry of document.cookie.split('; ')) {
    const name = entry.split('=')[0];
    if (name) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  }
};

describe('cookie (round-trip through the document.cookie shim)', () => {
  beforeEach(clearCookies);

  it('writes and reads a value back', async () => {
    await writeCookie('footprint', 'abc');
    expect(await readCookie('footprint')).toBe('abc');
  });

  it('overwrites an existing value', async () => {
    await writeCookie('footprint', 'first');
    await writeCookie('footprint', 'second');
    expect(await readCookie('footprint')).toBe('second');
  });

  it('coexists with unrelated cookies', async () => {
    document.cookie = 'other=1';
    await writeCookie('footprint', 'abc');
    expect(await readCookie('footprint')).toBe('abc');
    expect(await readCookie('other')).toBe('1');
  });

  it('returns undefined for a missing cookie', async () => {
    expect(await readCookie('missing')).toBeUndefined();
  });
});

describe('parseCookie', () => {
  it('extracts a value by name', () => {
    expect(parseCookie('a=1; footprint=xyz; b=2', 'footprint')).toBe('xyz');
  });

  it('does not match a name that only shares a prefix', () => {
    expect(parseCookie('footprint2=x; a=1', 'footprint')).toBeUndefined();
  });

  it('keeps "=" characters inside the value', () => {
    expect(parseCookie('token=a=b=c', 'token')).toBe('a=b=c');
  });

  it('returns the first entry when the name is duplicated', () => {
    expect(parseCookie('a=1; a=2', 'a')).toBe('1');
  });

  it('returns an empty string for an empty value', () => {
    expect(parseCookie('a=; b=2', 'a')).toBe('');
  });

  it('returns undefined when the name is absent', () => {
    expect(parseCookie('a=1; b=2', 'footprint')).toBeUndefined();
  });

  it('returns undefined for an empty cookie string', () => {
    expect(parseCookie('', 'footprint')).toBeUndefined();
  });
});

describe('serializeCookie', () => {
  it('builds name=value with default Path and SameSite', () => {
    expect(serializeCookie({ name: 'footprint', value: 'x' })).toBe('footprint=x; Path=/; SameSite=lax');
  });

  it('honors a custom path and sameSite', () => {
    expect(serializeCookie({ name: 'a', value: 'b', path: '/app', sameSite: 'strict' })).toBe(
      'a=b; Path=/app; SameSite=strict',
    );
  });

  it('adds Secure only when secure is true', () => {
    expect(serializeCookie({ name: 'a', value: 'b', secure: true })).toContain('; Secure');
    expect(serializeCookie({ name: 'a', value: 'b', secure: false })).not.toContain('Secure');
  });

  it('formats a numeric expires as a UTC date string', () => {
    expect(serializeCookie({ name: 'a', value: 'b', expires: 0 })).toBe(
      'a=b; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=lax',
    );
  });

  it('omits Expires when expires is null or absent', () => {
    expect(serializeCookie({ name: 'a', value: 'b', expires: null })).not.toContain('Expires');
    expect(serializeCookie({ name: 'a', value: 'b' })).not.toContain('Expires');
  });

  it('keeps a stable attribute order with everything set', () => {
    expect(
      serializeCookie({ name: 'a', value: 'b', path: '/', expires: 0, sameSite: 'none', secure: true }),
    ).toBe('a=b; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=none; Secure');
  });
});

describe('cookieStore API (when the browser provides it)', () => {
  type CookieStoreMock = {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  const host = window as { cookieStore?: unknown };

  const importWith = async (cookieStore: CookieStoreMock) => {
    host.cookieStore = cookieStore;
    vi.resetModules();
    return import('./cookie.ts');
  };

  afterEach(() => {
    delete host.cookieStore;
  });

  it('reads through cookieStore.get and unwraps the entry value', async () => {
    const get = vi.fn(async (name: string) => ({ name, value: 'from-store' }));
    const fresh = await importWith({ get, set: vi.fn(async () => {}) });
    expect(await fresh.readCookie('footprint')).toBe('from-store');
    expect(get).toHaveBeenCalledWith('footprint');
  });

  it('normalizes the spec-mandated null (missing cookie) to undefined', async () => {
    const fresh = await importWith({ get: vi.fn(async () => null), set: vi.fn(async () => {}) });
    expect(await fresh.readCookie('missing')).toBeUndefined();
  });

  it('degrades to undefined when cookieStore.get rejects', async () => {
    const fresh = await importWith({
      get: vi.fn(async () => {
        throw new DOMException('blocked', 'SecurityError');
      }),
      set: vi.fn(async () => {}),
    });
    expect(await fresh.readCookie('footprint')).toBeUndefined();
  });

  it('writes through cookieStore.set with Path=/, SameSite=lax and a 400-day expiry', async () => {
    const set = vi.fn(async () => {});
    const fresh = await importWith({ get: vi.fn(async () => null), set });
    const before = Date.now();
    await fresh.writeCookie('footprint', 'abc');
    const options = set.mock.calls[0][0] as { name: string; value: string; path: string; sameSite: string; expires: number };
    expect(options).toMatchObject({ name: 'footprint', value: 'abc', path: '/', sameSite: 'lax' });
    expect(options.expires - before).toBeGreaterThanOrEqual(400 * DAY - 1000);
    expect(options.expires - before).toBeLessThanOrEqual(400 * DAY + 1000);
  });

  it('swallows write failures from cookieStore.set', async () => {
    const fresh = await importWith({
      get: vi.fn(async () => null),
      set: vi.fn(async () => {
        throw new DOMException('denied', 'SecurityError');
      }),
    });
    await expect(fresh.writeCookie('footprint', 'abc')).resolves.toBeUndefined();
  });
});
