// Arithmetic behind the summary cards, as pure functions verified in summaries.test.ts.

import type { DayValue } from './zero-filling.ts';

// Total across the period. Non-finite entries count as 0 so one bad value cannot turn the whole
// sum into NaN and blank a card.
export function sumDailyValues(dayValues: ReadonlyArray<DayValue>): number {
  return dayValues.reduce((total, dayValue) => total + (Number.isFinite(dayValue.value) ? dayValue.value : 0), 0);
}

// Value for one specific day (the "today" card), or 0 when the day is not in the series.
export function findValueForDay(dayValues: ReadonlyArray<DayValue>, day: string): number {
  const found = dayValues.find((dayValue) => dayValue.day === day);
  return found ? found.value : 0;
}

// Busiest single day of the period.
export function maxDailyValue(dayValues: ReadonlyArray<DayValue>): number {
  return dayValues.reduce((maximum, dayValue) => Math.max(maximum, dayValue.value), 0);
}

// Daily average, unrounded — formatting is the display layer's job.
export function averageDailyValue(dayValues: ReadonlyArray<DayValue>): number {
  if (dayValues.length === 0) {
    return 0;
  }
  return sumDailyValues(dayValues) / dayValues.length;
}

// True when the whole period is empty (drives the chart's empty state rather than drawing a flat
// line along zero).
export function isEmptyPeriod(dayValues: ReadonlyArray<DayValue>): boolean {
  return sumDailyValues(dayValues) === 0;
}

// Sum of a ranked list's values.
export function sumRowValues(rows: ReadonlyArray<{ footprints: number }>): number {
  return rows.reduce((total, row) => total + (Number.isFinite(row.footprints) ? row.footprints : 0), 0);
}

// Largest value in a ranked list (the denominator for bar widths).
export function maxRowValue(rows: ReadonlyArray<{ footprints: number }>): number {
  return rows.reduce((maximum, row) => Math.max(maximum, row.footprints), 0);
}

// Bot share of the period as a 0..1 ratio. A period with no footprints yields 0 rather than NaN
// (division by zero), and the result is clamped so inconsistent inputs cannot render "120%".
export function computeBotRatio(botFootprints: number, totalFootprints: number): number {
  if (!Number.isFinite(totalFootprints) || totalFootprints <= 0) {
    return 0;
  }
  const safeBot = Number.isFinite(botFootprints) ? botFootprints : 0;
  return Math.min(1, Math.max(0, safeBot / totalFootprints));
}
