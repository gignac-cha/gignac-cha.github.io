import { describe, expect, it } from 'vitest';

import { isValidTrackerEndpoint, normalizeTrackerEndpoint } from './tracker-endpoint.ts';

// read/write touch localStorage (browser only), so only the pure normalize/validate pair is
// covered here — which is where every rule that can be wrong actually lives.

describe('normalizeTrackerEndpoint', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTrackerEndpoint('  http://127.0.0.1:8788  ')).toBe('http://127.0.0.1:8788');
  });

  it('drops trailing slashes', () => {
    // `${base}/queries` would otherwise become a double slash, which is a different path to the
    // worker's router and falls through to its 404.
    expect(normalizeTrackerEndpoint('http://127.0.0.1:8788/')).toBe('http://127.0.0.1:8788');
    expect(normalizeTrackerEndpoint('http://127.0.0.1:8788///')).toBe('http://127.0.0.1:8788');
  });

  it('keeps a path and strips only its trailing slash', () => {
    expect(normalizeTrackerEndpoint('https://tracker.example.com/api/')).toBe('https://tracker.example.com/api');
  });
});

describe('isValidTrackerEndpoint', () => {
  it('accepts absolute http and https URLs', () => {
    expect(isValidTrackerEndpoint('http://127.0.0.1:8788')).toBe(true);
    expect(isValidTrackerEndpoint('https://tracker.example.com')).toBe(true);
  });

  it('rejects blank input, scheme-less input and other schemes', () => {
    expect(isValidTrackerEndpoint('')).toBe(false);
    expect(isValidTrackerEndpoint('   ')).toBe(false);
    expect(isValidTrackerEndpoint('127.0.0.1:8788')).toBe(false);
    expect(isValidTrackerEndpoint('ftp://example.com')).toBe(false);
    expect(isValidTrackerEndpoint('not a url')).toBe(false);
  });
});
