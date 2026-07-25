import { describe, expect, it } from 'vitest';

import {
  computeDateRange,
  countDays,
  enumerateDays,
  formatUTCDate,
  parseUTCDate,
} from './date-ranges.ts';

describe('formatUTCDate', () => {
  it('formats a Date as a UTC YYYY-MM-DD string', () => {
    expect(formatUTCDate(new Date(Date.UTC(2026, 6, 16)))).toBe('2026-07-16');
  });

  it('zero-pads month and day', () => {
    expect(formatUTCDate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
  });

  it('reads the UTC calendar, not the local one', () => {
    // 2026-07-16T23:30:00Z is already 2026-07-17 in KST (UTC+9) and still 2026-07-16 in UTC.
    // The UTC answer is the only correct one here: the tracker buckets days by the first ten
    // characters of the UTC received_at, so a local-calendar reading would file this instant
    // under a day the server never uses.
    expect(formatUTCDate(new Date('2026-07-16T23:30:00Z'))).toBe('2026-07-16');
    expect(formatUTCDate(new Date('2026-07-17T00:30:00Z'))).toBe('2026-07-17');
  });
});

describe('parseUTCDate', () => {
  it('parses YYYY-MM-DD as UTC midnight of that day', () => {
    const date = parseUTCDate('2026-07-16');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(6);
    expect(date.getUTCDate()).toBe(16);
    expect(date.toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });

  it('parse -> format round trip', () => {
    expect(formatUTCDate(parseUTCDate('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('computeDateRange', () => {
  const today = new Date('2026-07-16T12:00:00Z');

  it('7-day preset: from is today - 6 days, to is tomorrow (exclusive)', () => {
    expect(computeDateRange(7, today)).toEqual({ from: '2026-07-10', to: '2026-07-17' });
  });

  it('30-day preset', () => {
    expect(computeDateRange(30, today)).toEqual({ from: '2026-06-17', to: '2026-07-17' });
  });

  it('90-day preset', () => {
    expect(computeDateRange(90, today)).toEqual({ from: '2026-04-18', to: '2026-07-17' });
  });

  it('always ends the day after today, so today is included and `to` is not', () => {
    const range = computeDateRange(7, today);
    const days = enumerateDays(range.from, range.to);
    expect(days).toContain('2026-07-16');
    expect(days).not.toContain('2026-07-17');
    expect(days).toHaveLength(7);
  });

  it('ignores the time of day carried by the input Date', () => {
    expect(computeDateRange(7, new Date('2026-07-16T00:00:00Z'))).toEqual({
      from: '2026-07-10',
      to: '2026-07-17',
    });
    expect(computeDateRange(7, new Date('2026-07-16T23:59:59Z'))).toEqual({
      from: '2026-07-10',
      to: '2026-07-17',
    });
  });

  it('anchors on the UTC day even when the local day differs', () => {
    // Still 2026-07-16 in UTC, already 2026-07-17 in KST. Anchoring locally would ask the
    // tracker for a range ending one day late and leave the newest bar permanently empty.
    expect(computeDateRange(7, new Date('2026-07-16T22:00:00Z'))).toEqual({
      from: '2026-07-10',
      to: '2026-07-17',
    });
  });
});

describe('enumerateDays', () => {
  it('excludes `to`, so the last day is the day before it', () => {
    expect(enumerateDays('2026-07-10', '2026-07-13')).toEqual(['2026-07-10', '2026-07-11', '2026-07-12']);
  });

  it('returns an empty list when from equals to', () => {
    expect(enumerateDays('2026-07-10', '2026-07-10')).toEqual([]);
  });

  it('crosses a month boundary', () => {
    expect(enumerateDays('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01']);
  });

  it('crosses a year boundary', () => {
    expect(enumerateDays('2025-12-30', '2026-01-02')).toEqual(['2025-12-30', '2025-12-31', '2026-01-01']);
  });

  it('handles a leap-year February', () => {
    // 2028 is a leap year, so February 29 exists.
    expect(enumerateDays('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29']);
  });

  it('emits exactly one entry per day across a long range (no DST duplicates or gaps)', () => {
    // A 90-day window spanning the northern-hemisphere DST transitions. With a local-midnight
    // cursor one of these steps would be 23 or 25 hours long and could repeat or skip a day;
    // stepping at UTC midnight cannot.
    const days = enumerateDays('2026-02-15', '2026-05-16');
    expect(days).toHaveLength(90);
    expect(new Set(days).size).toBe(90);
    expect(days[0]).toBe('2026-02-15');
    expect(days[days.length - 1]).toBe('2026-05-15');
  });
});

describe('countDays', () => {
  it('counts the days in the range', () => {
    expect(countDays('2026-07-10', '2026-07-17')).toBe(7);
    expect(countDays('2026-07-10', '2026-07-10')).toBe(0);
  });
});
