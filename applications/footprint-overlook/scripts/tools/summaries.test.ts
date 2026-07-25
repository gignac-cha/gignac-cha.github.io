import { describe, expect, it } from 'vitest';

import {
  averageDailyValue,
  computeBotRatio,
  findValueForDay,
  isEmptyPeriod,
  maxDailyValue,
  maxRowValue,
  sumDailyValues,
  sumRowValues,
} from './summaries.ts';

const SERIES = [
  { day: '2026-07-10', value: 5 },
  { day: '2026-07-11', value: 0 },
  { day: '2026-07-12', value: 10 },
];

describe('sumDailyValues', () => {
  it('adds up the daily values', () => {
    expect(sumDailyValues(SERIES)).toBe(15);
  });

  it('returns 0 for an empty series', () => {
    expect(sumDailyValues([])).toBe(0);
  });
});

describe('findValueForDay', () => {
  it('finds the value for a given day', () => {
    expect(findValueForDay(SERIES, '2026-07-12')).toBe(10);
  });

  it('returns 0 for a day outside the series', () => {
    expect(findValueForDay(SERIES, '2026-07-20')).toBe(0);
  });
});

describe('maxDailyValue', () => {
  it('finds the busiest day', () => {
    expect(maxDailyValue(SERIES)).toBe(10);
  });

  it('returns 0 for an empty series', () => {
    expect(maxDailyValue([])).toBe(0);
  });
});

describe('averageDailyValue', () => {
  it('computes the daily average', () => {
    expect(averageDailyValue(SERIES)).toBe(5);
  });

  it('returns 0 for an empty series', () => {
    expect(averageDailyValue([])).toBe(0);
  });
});

describe('isEmptyPeriod', () => {
  it('reports a period whose total is 0 as empty', () => {
    expect(isEmptyPeriod([{ day: '2026-07-10', value: 0 }])).toBe(true);
    expect(isEmptyPeriod([])).toBe(true);
  });

  it('reports a period with footprints as not empty', () => {
    expect(isEmptyPeriod(SERIES)).toBe(false);
  });
});

describe('sumRowValues / maxRowValue', () => {
  const rows = [
    { href: '/a', footprints: 12 },
    { href: '/b', footprints: 3 },
  ];

  it('adds up a ranked list', () => {
    expect(sumRowValues(rows)).toBe(15);
  });

  it('finds the largest value in a ranked list', () => {
    expect(maxRowValue(rows)).toBe(12);
  });

  it('returns 0 for an empty list', () => {
    expect(sumRowValues([])).toBe(0);
    expect(maxRowValue([])).toBe(0);
  });
});

describe('computeBotRatio', () => {
  it('computes bot footprints over total footprints', () => {
    expect(computeBotRatio(123, 632)).toBeCloseTo(0.1946, 3);
    expect(computeBotRatio(50, 100)).toBe(0.5);
  });

  it('returns 0 when the total is 0 (no division by zero)', () => {
    expect(computeBotRatio(0, 0)).toBe(0);
    expect(computeBotRatio(5, 0)).toBe(0);
  });

  it('clamps the ratio to 0..1', () => {
    expect(computeBotRatio(150, 100)).toBe(1);
    expect(computeBotRatio(-5, 100)).toBe(0);
  });

  it('defends against non-finite input', () => {
    expect(computeBotRatio(Number.NaN, 100)).toBe(0);
    expect(computeBotRatio(10, Number.NaN)).toBe(0);
  });
});
