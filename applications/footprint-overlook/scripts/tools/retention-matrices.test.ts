import { describe, expect, it } from 'vitest';

import { buildRetentionMatrix } from './retention-matrices.ts';

describe('retention-matrices', () => {
  it('builds cohort retention matrix with calculated percentages', () => {
    const input = [
      { cohort_week: '2026-W28', week_offset: 0, visitors: 100 },
      { cohort_week: '2026-W28', week_offset: 1, visitors: 45 },
      { cohort_week: '2026-W28', week_offset: 2, visitors: 20 },
      { cohort_week: '2026-W29', week_offset: 0, visitors: 200 },
      { cohort_week: '2026-W29', week_offset: 1, visitors: 100 },
    ];

    const matrix = buildRetentionMatrix(input);

    expect(matrix.maxOffset).toBe(2);
    expect(matrix.cohorts).toHaveLength(2);

    const w28 = matrix.cohorts[0];
    expect(w28.cohortWeek).toBe('2026-W28');
    expect(w28.baselineVisitors).toBe(100);
    expect(w28.cells.get(0)).toEqual({ visitors: 100, percentage: 100 });
    expect(w28.cells.get(1)).toEqual({ visitors: 45, percentage: 45 });
    expect(w28.cells.get(2)).toEqual({ visitors: 20, percentage: 20 });

    const w29 = matrix.cohorts[1];
    expect(w29.cohortWeek).toBe('2026-W29');
    expect(w29.baselineVisitors).toBe(200);
    expect(w29.cells.get(1)).toEqual({ visitors: 100, percentage: 50 });
  });
});
