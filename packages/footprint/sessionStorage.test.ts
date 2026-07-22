import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSessionStorage, writeSessionStorage } from './sessionStorage.ts';

describe('sessionStorage', () => {
  beforeEach(() => sessionStorage.clear());

  it('writes and reads a value back', () => {
    writeSessionStorage('footprint', 'abc');
    expect(readSessionStorage('footprint')).toBe('abc');
  });

  it('overwrites an existing value', () => {
    writeSessionStorage('footprint', 'first');
    writeSessionStorage('footprint', 'second');
    expect(readSessionStorage('footprint')).toBe('second');
  });

  it('preserves an empty-string value (only null maps to undefined)', () => {
    writeSessionStorage('footprint', '');
    expect(readSessionStorage('footprint')).toBe('');
  });

  it('returns undefined for a missing key', () => {
    expect(readSessionStorage('missing')).toBeUndefined();
  });

  it('returns undefined instead of throwing when reads are blocked', () => {
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readSessionStorage('footprint')).toBeUndefined();
  });

  it('swallows write failures (quota exceeded, private mode)', () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => writeSessionStorage('footprint', 'abc')).not.toThrow();
  });
});
