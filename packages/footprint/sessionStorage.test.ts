import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSession, writeSession } from './sessionStorage.ts';

describe('sessionStorage', () => {
  beforeEach(() => sessionStorage.clear());

  it('writes and reads a value back', () => {
    writeSession('footprint', 'abc');
    expect(readSession('footprint')).toBe('abc');
  });

  it('overwrites an existing value', () => {
    writeSession('footprint', 'first');
    writeSession('footprint', 'second');
    expect(readSession('footprint')).toBe('second');
  });

  it('preserves an empty-string value (only null maps to undefined)', () => {
    writeSession('footprint', '');
    expect(readSession('footprint')).toBe('');
  });

  it('returns undefined for a missing key', () => {
    expect(readSession('missing')).toBeUndefined();
  });

  it('returns undefined instead of throwing when reads are blocked', () => {
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readSession('footprint')).toBeUndefined();
  });

  it('swallows write failures (quota exceeded, private mode)', () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => writeSession('footprint', 'abc')).not.toThrow();
  });
});
