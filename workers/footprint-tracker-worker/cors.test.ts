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

  // The shape the Wrangler config actually declares: workerd delivers a JSON array var to the
  // Worker as a real array, so the parser must take one without splitting it into characters.
  it('takes an array as-is, trimming and dropping empty entries', () => {
    expect(parseAllowlist(['http://localhost:5173', ' https://viewer.example ', '', '  '])).toEqual([
      'http://localhost:5173',
      'https://viewer.example',
    ]);
    expect(parseAllowlist([])).toEqual([]);
  });

  it('produces the same list from both shapes', () => {
    expect(parseAllowlist(['a', 'b', 'c'])).toEqual(parseAllowlist('a, b, c'));
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

  it('returns only Vary: Origin for a non-matching origin', () => {
    expect(corsHeaders('https://evil.example', allowlist)).toEqual({ Vary: 'Origin' });
  });

  // Pins the exact-match rule against the classic CORS allowlist bypasses: prefix, suffix, or
  // substring matching is how "allowlisted" reflection gets widened to attacker-registered
  // origins that merely contain the allowed one (see corsHeaders in ./cors.ts).
  it('matches only exactly — not by prefix, suffix or trailing slash', () => {
    expect(corsHeaders('http://localhost:5173/', allowlist)).toEqual({ Vary: 'Origin' });
    expect(corsHeaders('http://localhost:51730', allowlist)).toEqual({ Vary: 'Origin' });
    expect(corsHeaders('https://sub.footprint-viewer.pages.dev', allowlist)).toEqual({ Vary: 'Origin' });
  });

  it('returns only Vary: Origin when there is no Origin', () => {
    expect(corsHeaders(null, allowlist)).toEqual({ Vary: 'Origin' });
  });

  it('returns only Vary: Origin when the allowlist is empty', () => {
    expect(corsHeaders('http://localhost:5173', [])).toEqual({ Vary: 'Origin' });
  });
});
