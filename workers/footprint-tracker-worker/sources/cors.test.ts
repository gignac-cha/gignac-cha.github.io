import { describe, expect, it } from 'vitest';
import { corsHeaders, parseAllowlist } from './cors.ts';

describe('parseAllowlist', () => {
  it('splits a comma-separated list and trims whitespace', () => {
    expect(parseAllowlist('http://localhost:5173, http://127.0.0.1:5173')).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('drops empty entries from stray or trailing commas', () => {
    expect(parseAllowlist('a,,b, ,c,')).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for empty or undefined input', () => {
    expect(parseAllowlist('')).toEqual([]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});

describe('corsHeaders', () => {
  const allowlist = ['http://localhost:5173', 'https://footprint-viewer.pages.dev'];

  it('reflects an exactly matching origin and sets Vary: Origin', () => {
    expect(corsHeaders('http://localhost:5173', allowlist)).toEqual({
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      Vary: 'Origin',
    });
  });

  it('returns no headers for a non-matching origin', () => {
    expect(corsHeaders('https://evil.example', allowlist)).toEqual({});
  });

  it('matches only exactly — not by prefix, suffix or trailing slash', () => {
    expect(corsHeaders('http://localhost:5173/', allowlist)).toEqual({});
    expect(corsHeaders('http://localhost:51730', allowlist)).toEqual({});
    expect(corsHeaders('https://sub.footprint-viewer.pages.dev', allowlist)).toEqual({});
  });

  it('returns no headers when there is no Origin', () => {
    expect(corsHeaders(null, allowlist)).toEqual({});
  });

  it('returns no headers when the allowlist is empty', () => {
    expect(corsHeaders('http://localhost:5173', [])).toEqual({});
  });
});
