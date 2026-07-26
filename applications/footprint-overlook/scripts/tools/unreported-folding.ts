// Partitioning logic for unreported / unknown (미보고/미상) items in ranked lists.
// Moves unreported items to a footnote by default while keeping total counts transparent.
//
// This module intentionally does not decide what counts as unreported. An earlier version
// guessed from label text (matching against literal Korean strings like '미보고' or '미상'), which
// broke the moment a real page path, referrer, or UUID happened to contain one of those
// substrings -- and, worse, could misclassify legitimate 'Direct' traffic as unreported. The
// caller (the dashboard render step, which knows whether the underlying row's dimension was
// actually null) sets `isUnreported` on each item up front; this module only partitions on that
// pre-set flag.

export interface PartitionedUnreportedItems<T> {
  reported: T[];
  unreported: T[];
}

export function partitionUnreportedItems<T extends { isUnreported?: boolean }>(
  items: readonly T[],
): PartitionedUnreportedItems<T> {
  const reported: T[] = [];
  const unreported: T[] = [];

  for (const item of items) {
    if (item.isUnreported === true) {
      unreported.push(item);
    } else {
      reported.push(item);
    }
  }

  return { reported, unreported };
}
