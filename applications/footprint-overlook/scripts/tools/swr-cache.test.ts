import { describe, expect, it } from 'vitest';

import { buildCacheKey, formatCacheTime, readQueryCache, writeQueryCache } from './swr-cache.ts';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

// Simulates a storage quota exceeded (or permission-denied) error, which is a real browser failure
// mode (private browsing, full quota) that writeQueryCache must survive without throwing.
class ThrowingStorage implements Storage {
  length = 0;

  clear(): void {}

  getItem(): string | null {
    return null;
  }

  key(): string | null {
    return null;
  }

  removeItem(): void {}

  setItem(): void {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  }
}

describe('swr-cache', () => {
  it('builds standard cache keys', () => {
    expect(buildCacheKey('top-pages', '2026-07-01:2026-07-31')).toBe(
      'footprint:cache:top-pages:2026-07-01:2026-07-31',
    );
  });

  it('reads and writes query cache successfully', () => {
    const storage = new MemoryStorage();
    const rows = [{ href: 'https://example.com', footprints: 42 }];
    const timestamp = 1700000000000;

    writeQueryCache('top-pages', 'range-30', rows, { storage, timestamp });
    const cached = readQueryCache<{ href: string; footprints: number }>('top-pages', 'range-30', storage);

    expect(cached).not.toBeNull();
    expect(cached?.storedAt).toBe(timestamp);
    expect(cached?.rows).toEqual(rows);
  });

  it('defaults the write timestamp to roughly Date.now() when options.timestamp is omitted', () => {
    const storage = new MemoryStorage();
    const before = Date.now();
    writeQueryCache('top-pages', 'range-30', [], { storage });
    const after = Date.now();

    const cached = readQueryCache('top-pages', 'range-30', storage);
    expect(cached?.storedAt).toBeGreaterThanOrEqual(before);
    expect(cached?.storedAt).toBeLessThanOrEqual(after);
  });

  it('falls back to the ambient default storage when options is entirely omitted', () => {
    // No `options` argument at all -- must not throw and must resolve `storage` the same way the
    // single-argument default did before the options-object rewrite (localStorage when available,
    // otherwise a no-op). This environment has no global localStorage, so it is a silent no-op.
    expect(() => writeQueryCache('top-pages', 'range-30', [{ a: 1 }])).not.toThrow();
  });

  it('no-ops only when storage is explicitly null, not merely omitted', () => {
    const storage = new MemoryStorage();

    writeQueryCache('top-pages', 'range-explicit', [{ a: 1 }], { storage });
    expect(readQueryCache('top-pages', 'range-explicit', storage)).not.toBeNull();

    writeQueryCache('top-pages', 'range-null', [{ a: 1 }], { storage: null });
    expect(readQueryCache('top-pages', 'range-null', storage)).toBeNull();
  });

  it('silently ignores a storage quota / permission failure on write', () => {
    const storage = new ThrowingStorage();
    expect(() => writeQueryCache('top-pages', 'range-30', [{ a: 1 }], { storage })).not.toThrow();
  });

  it('returns null for missing or invalid version cache', () => {
    const storage = new MemoryStorage();
    expect(readQueryCache('top-pages', 'missing', storage)).toBeNull();

    storage.setItem(
      'footprint:cache:top-pages:invalid',
      JSON.stringify({
        version: 'v0',
        storedAt: Date.now(),
        rows: [],
      }),
    );
    expect(readQueryCache('top-pages', 'invalid', storage)).toBeNull();
  });

  it('handles corrupt JSON gracefully', () => {
    const storage = new MemoryStorage();
    storage.setItem('footprint:cache:top-pages:corrupt', 'not valid json {{{');
    expect(readQueryCache('top-pages', 'corrupt', storage)).toBeNull();
  });

  it('handles JSON that parses but is not the envelope shape ("42", "null")', () => {
    const storage = new MemoryStorage();
    storage.setItem('footprint:cache:top-pages:number', '42');
    storage.setItem('footprint:cache:top-pages:literal-null', 'null');

    expect(readQueryCache('top-pages', 'number', storage)).toBeNull();
    expect(readQueryCache('top-pages', 'literal-null', storage)).toBeNull();
  });

  it('rejects a non-finite storedAt, including an Infinity that overflowed during JSON parsing', () => {
    const storage = new MemoryStorage();
    // `1e400` is a syntactically valid JSON number literal that overflows double precision to
    // Infinity once parsed -- this has to be raw text (not JSON.stringify'd from a JS object),
    // since JSON.stringify(Infinity) itself serializes to "null" long before this code ever runs.
    storage.setItem('footprint:cache:top-pages:infinity', '{"version":"v1","storedAt":1e400,"rows":[]}');

    expect(readQueryCache('top-pages', 'infinity', storage)).toBeNull();
  });

  it('formats timestamp as HH:mm', () => {
    const date = new Date(2026, 6, 26, 14, 5);
    expect(formatCacheTime(date.getTime())).toBe('14:05');
  });
});
