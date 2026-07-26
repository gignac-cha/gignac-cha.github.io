// utm-breakdown answers with one row per (source, medium, campaign) COMBINATION, but the panel
// shows three independent rankings — which source, which medium, which campaign — so every row has
// to be counted into three different buckets. That fan-out is the whole computation behind the
// panel, and it is arithmetic rather than markup, so it lives here with tests instead of inside the
// DOM factory (interfaces/traffic-sections.ts).
//
// Two rules the folded output has to carry:
//   - A null dimension is a real observation ("this visit arrived with no utm_medium"), not a row
//     to drop: dropping it would let the three columns sum to different totals and quietly
//     overstate the share of the campaigns that DID tag their links. It gets the 미보고 label and,
//     more importantly, an explicit isUnreported flag — the flag is decided here, where the null is
//     still visible, so no later stage has to guess it back out of the label text (see
//     tools/unreported-folding.ts).
//   - Buckets come back sorted by views descending, ties broken by label. The tracker sorts its
//     rows by the combination's view count, and re-summing three ways destroys that order, so the
//     list would otherwise be ordered by first appearance — which looks like a ranking and is not.

import type { UtmBreakdownRow } from './tracker-client.ts';

export interface UtmAggregatedItem {
  label: string;
  value: number;
  isUnreported: boolean;
}

export interface UtmAggregation {
  sources: UtmAggregatedItem[];
  mediums: UtmAggregatedItem[];
  campaigns: UtmAggregatedItem[];
}

const UNREPORTED_LABELS = {
  source: '미보고 (source 없음)',
  medium: '미보고 (medium 없음)',
  campaign: '미보고 (campaign 없음)',
} as const;

type DimensionTotals = Map<string, UtmAggregatedItem>;

// Adds one row's views to one dimension. Several nulls merge into a single bucket, the way the
// tracker would have grouped them had it grouped on that column alone.
function accumulate(
  totals: DimensionTotals,
  dimensionValue: string | null,
  unreportedLabel: string,
  views: number,
): void {
  if (typeof views !== 'number' || !Number.isFinite(views)) {
    return;
  }
  const isUnreported = dimensionValue === null || dimensionValue.length === 0;
  const label = isUnreported ? unreportedLabel : dimensionValue;
  const existing = totals.get(label);
  if (existing === undefined) {
    totals.set(label, { label, value: views, isUnreported });
    return;
  }
  existing.value += views;
}

function toSortedItems(totals: DimensionTotals): UtmAggregatedItem[] {
  return Array.from(totals.values()).sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }
    return left.label.localeCompare(right.label);
  });
}

export function aggregateUtmBreakdown(rows: ReadonlyArray<UtmBreakdownRow>): UtmAggregation {
  const sourceTotals: DimensionTotals = new Map();
  const mediumTotals: DimensionTotals = new Map();
  const campaignTotals: DimensionTotals = new Map();

  for (const row of rows) {
    accumulate(sourceTotals, row.source, UNREPORTED_LABELS.source, row.views);
    accumulate(mediumTotals, row.medium, UNREPORTED_LABELS.medium, row.views);
    accumulate(campaignTotals, row.campaign, UNREPORTED_LABELS.campaign, row.views);
  }

  return {
    sources: toSortedItems(sourceTotals),
    mediums: toSortedItems(mediumTotals),
    campaigns: toSortedItems(campaignTotals),
  };
}
