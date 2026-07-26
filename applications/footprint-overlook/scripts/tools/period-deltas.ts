// Delta percentage calculation between current and previous date range.
// Used for displaying ▲▼% change indicators on KPI cards.

import { formatUTCDate, parseUTCDate } from './date-ranges.ts';

export interface DeltaResult {
  percent: number;
  text: string;
  direction: 'up' | 'down' | 'neutral';
}

// Returns null (meaning: render nothing, not "0%") whenever a delta cannot be honestly computed:
// no previous value, a non-positive previous value (division by it would be undefined or a
// meaningless sign flip), or a non-finite current/previous (a failed fetch surfacing as NaN must
// not be displayed as a percentage).
export function computePeriodDelta(current: number, previous: number | undefined): DeltaResult | null {
  if (!Number.isFinite(current)) {
    return null;
  }
  if (previous === undefined || previous <= 0 || !Number.isFinite(previous)) {
    return null;
  }

  const rawPercent = ((current - previous) / previous) * 100;
  const percent = Math.round(rawPercent * 10) / 10;

  if (percent > 0) {
    return {
      percent,
      text: `▲ +${percent.toFixed(1)}%`,
      direction: 'up',
    };
  }

  if (percent < 0) {
    return {
      percent,
      text: `▼ ${percent.toFixed(1)}%`,
      direction: 'down',
    };
  }

  return {
    percent: 0,
    text: '0.0%',
    direction: 'neutral',
  };
}

// Computes the immediately-preceding date range of equal length, for "vs. previous period"
// comparisons: e.g. [2026-07-01, 2026-07-31) -> [2026-06-01, 2026-07-01). Returns null instead of
// throwing on an invalid `from`/`to` -- the same defensive stance date-ranges.ts takes with dates
// it cannot parse, since this feeds a KPI card comparison, not a code path that should ever crash
// the dashboard render.
export function computePreviousDateRange(from: string, to: string): { from: string; to: string } | null {
  const fromDate = parseUTCDate(from);
  const toDate = parseUTCDate(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }

  const durationInMilliseconds = toDate.getTime() - fromDate.getTime();

  const previousToDate = new Date(fromDate.getTime());
  const previousFromDate = new Date(previousToDate.getTime() - durationInMilliseconds);

  return {
    from: formatUTCDate(previousFromDate),
    to: formatUTCDate(previousToDate),
  };
}
