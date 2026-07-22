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
  it('일별 값을 모두 더한다', () => {
    expect(sumDailyValues(SERIES)).toBe(15);
  });

  it('빈 배열이면 0 이다', () => {
    expect(sumDailyValues([])).toBe(0);
  });
});

describe('findValueForDay', () => {
  it('해당 날짜 값을 찾는다', () => {
    expect(findValueForDay(SERIES, '2026-07-12')).toBe(10);
  });

  it('없는 날짜면 0 이다', () => {
    expect(findValueForDay(SERIES, '2026-07-20')).toBe(0);
  });
});

describe('maxDailyValue', () => {
  it('일별 최댓값을 구한다', () => {
    expect(maxDailyValue(SERIES)).toBe(10);
  });

  it('빈 배열이면 0 이다', () => {
    expect(maxDailyValue([])).toBe(0);
  });
});

describe('averageDailyValue', () => {
  it('일 평균을 구한다', () => {
    expect(averageDailyValue(SERIES)).toBe(5);
  });

  it('빈 배열이면 0 이다', () => {
    expect(averageDailyValue([])).toBe(0);
  });
});

describe('isEmptyPeriod', () => {
  it('합이 0 이면 빈 기간이다', () => {
    expect(isEmptyPeriod([{ day: '2026-07-10', value: 0 }])).toBe(true);
    expect(isEmptyPeriod([])).toBe(true);
  });

  it('발자국이 있으면 빈 기간이 아니다', () => {
    expect(isEmptyPeriod(SERIES)).toBe(false);
  });
});

describe('sumRowValues / maxRowValue', () => {
  const rows = [
    { href: '/a', footprints: 12 },
    { href: '/b', footprints: 3 },
  ];

  it('랭크 목록 값의 합을 구한다', () => {
    expect(sumRowValues(rows)).toBe(15);
  });

  it('랭크 목록 최대 값을 구한다', () => {
    expect(maxRowValue(rows)).toBe(12);
  });

  it('빈 목록이면 0 이다', () => {
    expect(sumRowValues([])).toBe(0);
    expect(maxRowValue([])).toBe(0);
  });
});

describe('computeBotRatio', () => {
  it('봇 발자국 / 총 발자국 비율을 구한다', () => {
    expect(computeBotRatio(123, 632)).toBeCloseTo(0.1946, 3);
    expect(computeBotRatio(50, 100)).toBe(0.5);
  });

  it('총 발자국이 0 이면 0 이다(0으로 나눔 방어)', () => {
    expect(computeBotRatio(0, 0)).toBe(0);
    expect(computeBotRatio(5, 0)).toBe(0);
  });

  it('0..1 범위로 클램프한다', () => {
    expect(computeBotRatio(150, 100)).toBe(1);
    expect(computeBotRatio(-5, 100)).toBe(0);
  });

  it('비정상 입력을 방어한다', () => {
    expect(computeBotRatio(Number.NaN, 100)).toBe(0);
    expect(computeBotRatio(10, Number.NaN)).toBe(0);
  });
});
