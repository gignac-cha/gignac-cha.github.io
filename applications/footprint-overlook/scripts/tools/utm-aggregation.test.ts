import { describe, expect, it } from 'vitest';

import type { UtmBreakdownRow } from './tracker-client.ts';
import { aggregateUtmBreakdown } from './utm-aggregation.ts';

describe('aggregateUtmBreakdown', () => {
  it('counts one combination row into all three dimensions', () => {
    const rows: UtmBreakdownRow[] = [
      { source: 'newsletter', medium: 'email', campaign: 'spring', views: 7 },
    ];

    const aggregation = aggregateUtmBreakdown(rows);

    expect(aggregation.sources).toEqual([{ label: 'newsletter', value: 7, isUnreported: false }]);
    expect(aggregation.mediums).toEqual([{ label: 'email', value: 7, isUnreported: false }]);
    expect(aggregation.campaigns).toEqual([{ label: 'spring', value: 7, isUnreported: false }]);
  });

  it('merges combinations that share a dimension value', () => {
    const rows: UtmBreakdownRow[] = [
      { source: 'newsletter', medium: 'email', campaign: 'spring', views: 4 },
      { source: 'newsletter', medium: 'email', campaign: 'summer', views: 6 },
    ];

    const aggregation = aggregateUtmBreakdown(rows);

    expect(aggregation.sources).toEqual([{ label: 'newsletter', value: 10, isUnreported: false }]);
    expect(aggregation.campaigns.map((item) => item.label)).toEqual(['summer', 'spring']);
  });

  it('keeps every dimension total equal to the total views', () => {
    const rows: UtmBreakdownRow[] = [
      { source: 'newsletter', medium: null, campaign: 'spring', views: 5 },
      { source: null, medium: 'cpc', campaign: null, views: 3 },
    ];

    const aggregation = aggregateUtmBreakdown(rows);
    const sum = (items: ReadonlyArray<{ value: number }>): number =>
      items.reduce((total, item) => total + item.value, 0);

    expect(sum(aggregation.sources)).toBe(8);
    expect(sum(aggregation.mediums)).toBe(8);
    expect(sum(aggregation.campaigns)).toBe(8);
  });

  it('flags null dimensions as unreported instead of dropping them', () => {
    const rows: UtmBreakdownRow[] = [
      { source: null, medium: null, campaign: null, views: 2 },
      { source: null, medium: 'cpc', campaign: 'x', views: 3 },
    ];

    const aggregation = aggregateUtmBreakdown(rows);

    expect(aggregation.sources).toEqual([
      { label: '미보고 (source 없음)', value: 5, isUnreported: true },
    ]);
    expect(aggregation.mediums.find((item) => item.isUnreported)?.value).toBe(2);
  });

  it('treats an empty string dimension as unreported', () => {
    const rows: UtmBreakdownRow[] = [{ source: '', medium: 'cpc', campaign: 'x', views: 1 }];

    expect(aggregateUtmBreakdown(rows).sources[0].isUnreported).toBe(true);
  });

  it('sorts by views descending with the label as the tie-breaker', () => {
    const rows: UtmBreakdownRow[] = [
      { source: 'b', medium: 'm', campaign: 'c', views: 1 },
      { source: 'a', medium: 'm', campaign: 'c', views: 1 },
      { source: 'z', medium: 'm', campaign: 'c', views: 9 },
    ];

    expect(aggregateUtmBreakdown(rows).sources.map((item) => item.label)).toEqual(['z', 'a', 'b']);
  });

  it('ignores a non-finite views value rather than poisoning the whole bucket', () => {
    const rows: UtmBreakdownRow[] = [
      { source: 'a', medium: 'm', campaign: 'c', views: Number.NaN },
      { source: 'a', medium: 'm', campaign: 'c', views: 4 },
    ];

    expect(aggregateUtmBreakdown(rows).sources).toEqual([{ label: 'a', value: 4, isUnreported: false }]);
  });

  it('returns three empty rankings for an empty response', () => {
    expect(aggregateUtmBreakdown([])).toEqual({ sources: [], mediums: [], campaigns: [] });
  });
});
