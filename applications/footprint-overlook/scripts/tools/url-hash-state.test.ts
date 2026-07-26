import { describe, expect, it } from 'vitest';

import { parseUrlHash, serializeUrlHash } from './url-hash-state.ts';

describe('parseUrlHash', () => {
  it('parses empty or invalid hash', () => {
    expect(parseUrlHash('')).toEqual({});
    expect(parseUrlHash('#')).toEqual({});
  });

  it('parses range and highlight from hash', () => {
    const parsed = parseUrlHash('#range=7&highlight=123e4567-e89b-12d3-a456-426614174000');
    expect(parsed.rangeDays).toBe(7);
    expect(parsed.highlightUUID).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('parses a custom date range from hash', () => {
    const parsed = parseUrlHash('#from=2026-07-01&to=2026-07-15');
    expect(parsed.dateRange).toEqual({ from: '2026-07-01', to: '2026-07-15' });
  });

  it('clamps range to [1, 365], rejecting out-of-bounds or malformed values', () => {
    expect(parseUrlHash('#range=1').rangeDays).toBe(1);
    expect(parseUrlHash('#range=365').rangeDays).toBe(365);
    expect(parseUrlHash('#range=0').rangeDays).toBeUndefined();
    expect(parseUrlHash('#range=366').rangeDays).toBeUndefined();
    expect(parseUrlHash('#range=-7').rangeDays).toBeUndefined();
    expect(parseUrlHash('#range=abc').rangeDays).toBeUndefined();
  });

  it('rejects a date range where from is not strictly before to', () => {
    expect(parseUrlHash('#from=2026-07-15&to=2026-07-01').dateRange).toBeUndefined();
    expect(parseUrlHash('#from=2026-07-01&to=2026-07-01').dateRange).toBeUndefined();
  });

  it('rejects a calendar date that does not exist, even though it matches the YYYY-MM-DD pattern', () => {
    // Date.UTC() would silently roll 2026-02-30 into 2026-03-02 and 2026-13-40 into a date in
    // 2027; the round-trip check must reject both instead of trusting the pattern match.
    expect(parseUrlHash('#from=2026-02-30&to=2026-03-05').dateRange).toBeUndefined();
    expect(parseUrlHash('#from=2026-01-01&to=2026-13-40').dateRange).toBeUndefined();
  });

  it('never exposes an endpoint field, even if one is present in the hash', () => {
    const parsed = parseUrlHash('#endpoint=https://evil.example&range=7');
    expect(parsed).not.toHaveProperty('endpoint');
    expect(Object.keys(parsed)).toEqual(['rangeDays']);
  });
});

describe('serializeUrlHash', () => {
  it('serializes range and highlight to hash', () => {
    const hash = serializeUrlHash({ rangeDays: 7, highlightUUID: 'test-uuid' });
    expect(hash).toBe('#range=7&highlight=test-uuid');
  });

  it('omits default 30-day range when serializing', () => {
    const hash = serializeUrlHash({ rangeDays: 30 });
    expect(hash).toBe('');
  });

  it('serializes a custom date range', () => {
    const hash = serializeUrlHash({ dateRange: { from: '2026-07-01', to: '2026-07-15' } });
    expect(hash).toBe('#from=2026-07-01&to=2026-07-15');
  });

  it('never serializes an endpoint parameter', () => {
    const hash = serializeUrlHash({ rangeDays: 7 });
    expect(hash).not.toContain('endpoint');
    expect(hash).not.toContain('http');
  });
});
