import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readLocal, writeLocal } from './localStorage.ts';

describe('localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('writes and reads a value back', () => {
    writeLocal('footprint', 'abc');
    expect(readLocal('footprint')).toBe('abc');
  });

  it('overwrites an existing value', () => {
    writeLocal('footprint', 'first');
    writeLocal('footprint', 'second');
    expect(readLocal('footprint')).toBe('second');
  });

  it('preserves an empty-string value (only null maps to undefined)', () => {
    writeLocal('footprint', '');
    expect(readLocal('footprint')).toBe('');
  });

  it('returns undefined for a missing key', () => {
    expect(readLocal('missing')).toBeUndefined();
  });

  it('returns undefined instead of throwing when reads are blocked', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readLocal('footprint')).toBeUndefined();
  });

  it('swallows write failures (quota exceeded, private mode)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => writeLocal('footprint', 'abc')).not.toThrow();
  });
});
