import { describe, expect, it } from 'vitest';

import {
  computeDateRange,
  countDays,
  enumerateDays,
  formatLocalDate,
  parseLocalDate,
} from './date-ranges.ts';

describe('formatLocalDate', () => {
  it('로컬 시간대 기준으로 YYYY-MM-DD 로 변환한다', () => {
    expect(formatLocalDate(new Date(2026, 6, 16))).toBe('2026-07-16');
  });

  it('월/일을 0 으로 채운다', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseLocalDate', () => {
  it('YYYY-MM-DD 를 로컬 자정 Date 로 파싱한다(하루 밀림 없음)', () => {
    const date = parseLocalDate('2026-07-16');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(16);
  });

  it('parse -> format 왕복이 일치한다', () => {
    expect(formatLocalDate(parseLocalDate('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('computeDateRange', () => {
  const today = new Date(2026, 6, 16); // 2026-07-16

  it('7일 프리셋: from 은 오늘-6일, to 는 내일(배타적)', () => {
    expect(computeDateRange(7, today)).toEqual({ from: '2026-07-10', to: '2026-07-17' });
  });

  it('30일 프리셋', () => {
    expect(computeDateRange(30, today)).toEqual({ from: '2026-06-17', to: '2026-07-17' });
  });

  it('90일 프리셋', () => {
    expect(computeDateRange(90, today)).toEqual({ from: '2026-04-18', to: '2026-07-17' });
  });

  it('to 는 항상 오늘의 다음 날이며 오늘을 포함(배타적 종료)한다', () => {
    const range = computeDateRange(7, today);
    // 실제 나열된 날에 오늘이 포함되고 to 당일은 빠져야 합니다.
    const days = enumerateDays(range.from, range.to);
    expect(days).toContain('2026-07-16');
    expect(days).not.toContain('2026-07-17');
    expect(days).toHaveLength(7);
  });

  it('전달의 입력 Date 시각(시/분)에 영향받지 않는다', () => {
    const noisyToday = new Date(2026, 6, 16, 23, 59, 59);
    expect(computeDateRange(7, noisyToday)).toEqual({ from: '2026-07-10', to: '2026-07-17' });
  });
});

describe('enumerateDays', () => {
  it('to 는 배타적이라 마지막 날은 to 하루 전이다', () => {
    expect(enumerateDays('2026-07-10', '2026-07-13')).toEqual(['2026-07-10', '2026-07-11', '2026-07-12']);
  });

  it('from == to 이면 빈 배열이다', () => {
    expect(enumerateDays('2026-07-10', '2026-07-10')).toEqual([]);
  });

  it('월 경계를 넘어간다', () => {
    expect(enumerateDays('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01']);
  });

  it('연 경계를 넘어간다', () => {
    expect(enumerateDays('2025-12-30', '2026-01-02')).toEqual(['2025-12-30', '2025-12-31', '2026-01-01']);
  });

  it('윤년 2월을 올바르게 다룬다', () => {
    // 2028 은 윤년이므로 2월 29일이 존재합니다.
    expect(enumerateDays('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29']);
  });
});

describe('countDays', () => {
  it('구간 일 수를 센다', () => {
    expect(countDays('2026-07-10', '2026-07-17')).toBe(7);
    expect(countDays('2026-07-10', '2026-07-10')).toBe(0);
  });
});
