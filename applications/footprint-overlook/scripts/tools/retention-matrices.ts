// Pure matrix calculation for weekly retention cohort analysis.
// Computes retention percentages relative to week 0 cohort baseline.

import type { WeeklyRetentionRow } from './tracker-client.ts';

export interface RetentionCell {
  visitors: number;
  percentage: number;
}

export interface RetentionRow {
  cohortWeek: string;
  baselineVisitors: number;
  cells: Map<number, RetentionCell>;
}

export interface RetentionMatrix {
  cohorts: RetentionRow[];
  maxOffset: number;
}

export function buildRetentionMatrix(rows: ReadonlyArray<WeeklyRetentionRow>): RetentionMatrix {
  const cohortMap = new Map<string, Map<number, number>>();

  for (const row of rows) {
    if (!cohortMap.has(row.cohort_week)) {
      cohortMap.set(row.cohort_week, new Map());
    }
    cohortMap.get(row.cohort_week)?.set(row.week_offset, row.visitors);
  }

  const sortedCohortWeeks = Array.from(cohortMap.keys()).sort();
  let maxOffset = 0;

  const cohorts: RetentionRow[] = sortedCohortWeeks.map((cohortWeek) => {
    const offsets = cohortMap.get(cohortWeek) ?? new Map<number, number>();
    const baselineVisitors = offsets.get(0) ?? 0;
    const cells = new Map<number, RetentionCell>();

    for (const [offset, visitors] of offsets.entries()) {
      if (offset > maxOffset) {
        maxOffset = offset;
      }
      const percentage = baselineVisitors > 0 ? Math.round((visitors / baselineVisitors) * 100) : 0;
      cells.set(offset, { visitors, percentage });
    }

    return { cohortWeek, baselineVisitors, cells };
  });

  return { cohorts, maxOffset };
}
