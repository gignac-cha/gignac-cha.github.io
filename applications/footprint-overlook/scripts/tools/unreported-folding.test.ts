import { describe, expect, it } from 'vitest';

import { partitionUnreportedItems } from './unreported-folding.ts';

describe('partitionUnreportedItems', () => {
  it('partitions items by the isUnreported flag, not by label text', () => {
    const items = [
      { label: '/blog', value: 100, isUnreported: false },
      { label: 'https://example.com', value: 25, isUnreported: true },
      { label: '/about', value: 50 },
    ];

    const result = partitionUnreportedItems(items);

    expect(result.reported).toEqual([
      { label: '/blog', value: 100, isUnreported: false },
      { label: '/about', value: 50 },
    ]);
    expect(result.unreported).toEqual([{ label: 'https://example.com', value: 25, isUnreported: true }]);
  });

  it('never guesses from label text: a "미보고"-looking label without the flag stays reported', () => {
    // This is the regression the label-sniffing predicate used to get wrong: a legitimate page
    // path or referrer that happens to contain '미보고' or '미상' must not be folded away just
    // because of its text. Only the explicit flag, set by the caller from the real row data,
    // decides.
    // isUnreported is spelled out as undefined (rather than omitted) purely so this array literal
    // shares a property name with the `{ isUnreported?: boolean }` constraint -- TypeScript's weak
    // type detection otherwise rejects an argument with zero properties in common with an
    // all-optional constraint, which would make this the one legitimate case a real caller could
    // never hit (every RankedItem always has other required fields alongside the flag).
    const items = [
      { label: '미보고', value: 10, isUnreported: undefined },
      { label: 'Direct', value: 5, isUnreported: undefined },
    ];

    const result = partitionUnreportedItems(items);

    expect(result.reported).toEqual([
      { label: '미보고', value: 10 },
      { label: 'Direct', value: 5 },
    ]);
    expect(result.unreported).toEqual([]);
  });

  it('treats items with isUnreported explicitly false the same as items with the flag absent', () => {
    const items = [
      { label: 'a', value: 1, isUnreported: false },
      { label: 'b', value: 2 },
    ];

    expect(partitionUnreportedItems(items)).toEqual({
      reported: items,
      unreported: [],
    });
  });

  it('returns empty partitions for an empty list', () => {
    expect(partitionUnreportedItems([])).toEqual({ reported: [], unreported: [] });
  });
});
