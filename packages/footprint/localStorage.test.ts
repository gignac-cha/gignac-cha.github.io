import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readLocalStorage, writeLocalStorage } from './localStorage.ts';

describe('localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('writes and reads a value back', () => {
    writeLocalStorage('footprint', 'abc');
    expect(readLocalStorage('footprint')).toBe('abc');
  });

  it('overwrites an existing value', () => {
    writeLocalStorage('footprint', 'first');
    writeLocalStorage('footprint', 'second');
    expect(readLocalStorage('footprint')).toBe('second');
  });

  it('preserves an empty-string value (only null maps to undefined)', () => {
    writeLocalStorage('footprint', '');
    expect(readLocalStorage('footprint')).toBe('');
  });

  it('returns undefined for a missing key', () => {
    expect(readLocalStorage('missing')).toBeUndefined();
  });

  it('returns undefined instead of throwing when reads are blocked', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readLocalStorage('footprint')).toBeUndefined();
  });

  it('swallows write failures (quota exceeded, private mode)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => writeLocalStorage('footprint', 'abc')).not.toThrow();
  });
});
