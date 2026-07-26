import { describe, expect, it } from 'vitest';

import { computePeriodDelta, computePreviousDateRange } from './period-deltas.ts';

describe('computePeriodDelta', () => {
  it('computes positive delta correctly', () => {
    const delta = computePeriodDelta(150, 100);
    expect(delta).toEqual({
      percent: 50,
      text: '▲ +50.0%',
      direction: 'up',
    });
  });

  it('computes negative delta correctly', () => {
    const delta = computePeriodDelta(80, 100);
    expect(delta).toEqual({
      percent: -20,
      text: '▼ -20.0%',
      direction: 'down',
    });
  });

  it('returns neutral delta for zero change', () => {
    const delta = computePeriodDelta(100, 100);
    expect(delta).toEqual({
      percent: 0,
      text: '0.0%',
      direction: 'neutral',
    });
  });

  it('returns null when previous value is undefined, zero, or negative', () => {
    expect(computePeriodDelta(100, undefined)).toBeNull();
    expect(computePeriodDelta(100, 0)).toBeNull();
    expect(computePeriodDelta(100, -5)).toBeNull();
  });

  it('returns null when current is non-finite (a failed fetch must not render a percentage)', () => {
    expect(computePeriodDelta(NaN, 100)).toBeNull();
    expect(computePeriodDelta(Infinity, 100)).toBeNull();
    expect(computePeriodDelta(-Infinity, 100)).toBeNull();
  });

  it('returns null when previous is non-finite', () => {
    expect(computePeriodDelta(100, NaN)).toBeNull();
    expect(computePeriodDelta(100, Infinity)).toBeNull();
  });

  it('rounds an exact half-way point (raw scaled value of x.5) up, not down', () => {
    // 112.25 vs. 100 is exact in floating point: rawPercent = 12.25, *10 = 122.5 exactly, and
    // Math.round(122.5) = 123 (JS rounds halves toward +Infinity) -> 12.3%.
    const delta = computePeriodDelta(112.25, 100);
    expect(delta).toEqual({
      percent: 12.3,
      text: '▲ +12.3%',
      direction: 'up',
    });
  });

  it('rounds a small negative delta to exactly zero, landing in the neutral branch', () => {
    // 99.95 vs. 100 -> rawPercent is a hair under -0.05 in floating point, *10 rounds to -0
    // (Math.round(-0) === -0), and -0 is neither > 0 nor < 0, so this falls through to the
    // hardcoded neutral return rather than displaying a stray '-0.0%'.
    const delta = computePeriodDelta(99.95, 100);
    expect(delta).toEqual({
      percent: 0,
      text: '0.0%',
      direction: 'neutral',
    });
  });
});

describe('computePreviousDateRange', () => {
  it('computes previous date range of equal duration (30-day case)', () => {
    expect(computePreviousDateRange('2026-07-01', '2026-07-31')).toEqual({
      from: '2026-06-01',
      to: '2026-07-01',
    });
  });

  it('computes the previous date range for a 7-day preset', () => {
    // [2026-07-10, 2026-07-17) is "last 7 days"; the immediately preceding 7-day window is
    // [2026-07-03, 2026-07-10), with no gap and no overlap.
    expect(computePreviousDateRange('2026-07-10', '2026-07-17')).toEqual({
      from: '2026-07-03',
      to: '2026-07-10',
    });
  });

  it('returns null instead of throwing on an invalid date string', () => {
    expect(computePreviousDateRange('not-a-date', '2026-07-17')).toBeNull();
    expect(computePreviousDateRange('2026-07-10', 'not-a-date')).toBeNull();
    expect(computePreviousDateRange('', '')).toBeNull();
  });
});
