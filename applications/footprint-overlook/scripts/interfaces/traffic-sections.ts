// Interface components for Traffic Sources (유입) analytics:
// referrer classification breakdown and the three UTM rankings.
//
// The UTM fan-out (one combination row counted into source, medium and campaign) is arithmetic and
// lives in tools/utm-aggregation.ts with its own tests; this file only turns the result into bars.

import { groupReferrersByCategory } from '../tools/referrer-classification.ts';
import type { TopReferrerRow, UtmBreakdownRow } from '../tools/tracker-client.ts';
import { aggregateUtmBreakdown, type UtmAggregatedItem } from '../tools/utm-aggregation.ts';
import { createGroupedRanks, type RankedGroup } from './grouped-ranks.ts';
import { createRankedBarList, type RankedItem } from './ranked-bars.ts';

export function createTrafficClassificationPanel(rows: ReadonlyArray<TopReferrerRow>): HTMLElement {
  const grouped = groupReferrersByCategory(rows);
  const items = grouped.map((item) => ({
    label: item.category,
    fullLabel: `${item.category} 유입 (${item.views} 뷰)`,
    value: item.views,
  }));
  // Every category here is a classification of a referrer that WAS reported (Direct included — an
  // empty referrer is how a typed URL or a bookmark looks), so nothing folds.
  return createRankedBarList(items, { foldUnreported: false });
}

function toRankedItems(items: ReadonlyArray<UtmAggregatedItem>): RankedItem[] {
  return items.map((item) => ({
    label: item.label,
    fullLabel: item.label,
    value: item.value,
    isUnreported: item.isUnreported,
  }));
}

export function createUtmBreakdownPanel(rows: ReadonlyArray<UtmBreakdownRow>): HTMLElement {
  const aggregation = aggregateUtmBreakdown(rows);

  const groups: RankedGroup[] = [
    {
      title: 'UTM Source',
      emptyText: 'UTM Source 데이터가 없습니다.',
      items: toRankedItems(aggregation.sources),
    },
    {
      title: 'UTM Medium',
      emptyText: 'UTM Medium 데이터가 없습니다.',
      items: toRankedItems(aggregation.mediums),
    },
    {
      title: 'UTM Campaign',
      emptyText: 'UTM Campaign 데이터가 없습니다.',
      items: toRankedItems(aggregation.campaigns),
    },
  ];

  return createGroupedRanks(groups);
}
