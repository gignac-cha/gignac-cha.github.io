// 요약 카드 수치를 계산하는 순수 함수 계층입니다. DOM 의존이 없어 vitest 로 단독 검증할 수 있습니다.

import type { DayValue } from './zero-filling.ts';

// DayValue 배열의 합계입니다(예: 기간 총 발자국 수, 일별 고유 방문자 합).
export function sumDailyValues(dayValues: ReadonlyArray<DayValue>): number {
  return dayValues.reduce((total, dayValue) => total + (Number.isFinite(dayValue.value) ? dayValue.value : 0), 0);
}

// 특정 날짜의 값을 찾습니다(예: 오늘 발자국). 없으면 0.
export function findValueForDay(dayValues: ReadonlyArray<DayValue>, day: string): number {
  const found = dayValues.find((dayValue) => dayValue.day === day);
  return found ? found.value : 0;
}

// 일별 최댓값입니다(고유 방문자를 "최대 일"로 정직하게 보여줄 때의 대안 지표).
export function maxDailyValue(dayValues: ReadonlyArray<DayValue>): number {
  return dayValues.reduce((maximum, dayValue) => Math.max(maximum, dayValue.value), 0);
}

// 일 평균값입니다(반올림하지 않은 원값 — 표기 단계에서 포맷).
export function averageDailyValue(dayValues: ReadonlyArray<DayValue>): number {
  if (dayValues.length === 0) {
    return 0;
  }
  return sumDailyValues(dayValues) / dayValues.length;
}

// 발자국이 하나도 없는 기간인지 판정합니다(빈 상태 표시용).
export function isEmptyPeriod(dayValues: ReadonlyArray<DayValue>): boolean {
  return sumDailyValues(dayValues) === 0;
}

// 상위 목록(top-pages/top-origins) row 들의 값 합계입니다(막대 비율 계산의 분모가 아니라 참고용 합).
export function sumRowValues(rows: ReadonlyArray<{ footprints: number }>): number {
  return rows.reduce((total, row) => total + (Number.isFinite(row.footprints) ? row.footprints : 0), 0);
}

// 랭크 목록에서 최대 값을 찾습니다(막대 폭 비율의 분모).
export function maxRowValue(rows: ReadonlyArray<{ footprints: number }>): number {
  return rows.reduce((maximum, row) => Math.max(maximum, row.footprints), 0);
}

// 봇 비율(0~1)을 계산합니다. 총 발자국이 0 이하이면 0(0으로 나눔 방어).
export function computeBotRatio(botFootprints: number, totalFootprints: number): number {
  if (!Number.isFinite(totalFootprints) || totalFootprints <= 0) {
    return 0;
  }
  const safeBot = Number.isFinite(botFootprints) ? botFootprints : 0;
  // 방어적으로 0..1 범위로 클램프합니다(잘못된 데이터가 100% 를 넘기지 않도록).
  return Math.min(1, Math.max(0, safeBot / totalFootprints));
}
