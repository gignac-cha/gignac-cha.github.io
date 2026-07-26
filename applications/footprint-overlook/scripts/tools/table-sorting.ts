// Ordering rules for the 최근 조회 table's four sortable columns, kept pure so the behaviour that
// is easy to get wrong (nulls, ties, direction) can be pinned by tests while the DOM factory
// (interfaces/recent-table.ts) only asks for a sorted copy.
//
// Two decisions are worth stating, because both differ from the obvious `''` fallback the table
// used to inline:
//
// 1) Nulls sort LAST in both directions. Every column except received_at can arrive as SQL null
//    (see RecentFootprintRow in tools/tracker-client.ts), and a null there means "never reported",
//    not "the empty string". Coercing to '' makes the unreported rows the smallest value, so
//    ascending order opens with a block of blanks and the reader has to scroll past the rows that
//    carry no information to reach the ones that do. Pushing them to the end keeps a direction
//    flip a re-ordering of real data.
//
// 2) received_at is compared as a plain string, not through localeCompare or Date parsing. The
//    tracker emits it as a UTC ISO-8601 timestamp with fixed-width fields, and for that shape
//    lexicographic order IS chronological order — no timezone, no parse, no locale involved. The
//    other three columns are human-facing text and do go through localeCompare with numeric
//    collation, so '/page10' sorts after '/page2' instead of before it.
//    https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare

export type RecentTableSortColumn = 'time' | 'uuid' | 'href' | 'arguments';

// The subset of RecentFootprintRow the comparators read. Declared structurally so the sort can be
// unit-tested with plain literals and still accept the full row type at the call site.
export interface SortableRecentRow {
  received_at: string;
  uuid: string | null;
  href: string | null;
  arguments: string;
}

// The sort key for one column, or null when the row never reported that value.
function toSortKey(row: SortableRecentRow, column: RecentTableSortColumn): string | null {
  if (column === 'time') {
    return row.received_at;
  }
  if (column === 'uuid') {
    return row.uuid;
  }
  if (column === 'href') {
    return row.href;
  }
  return row.arguments;
}

// Fixed-width UTC ISO timestamps: byte order is time order.
function compareTimestamps(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

// Comparator for one column in one direction. `ascending` flips only the comparison of two present
// values; the null-last rule is direction-independent on purpose (see the module header).
export function compareRecentRows(
  left: SortableRecentRow,
  right: SortableRecentRow,
  column: RecentTableSortColumn,
  ascending: boolean,
): number {
  const leftKey = toSortKey(left, column);
  const rightKey = toSortKey(right, column);

  if (leftKey === null || leftKey.length === 0) {
    return rightKey === null || rightKey.length === 0 ? 0 : 1;
  }
  if (rightKey === null || rightKey.length === 0) {
    return -1;
  }

  const comparison = column === 'time'
    ? compareTimestamps(leftKey, rightKey)
    : leftKey.localeCompare(rightKey, undefined, { numeric: true });

  return ascending ? comparison : -comparison;
}

// Sorted copy. Array.prototype.sort mutates in place, and the rows handed to the table are the
// fetched response the dashboard keeps for its next render, so the input is never touched.
export function sortRecentRows<Row extends SortableRecentRow>(
  rows: ReadonlyArray<Row>,
  column: RecentTableSortColumn,
  ascending: boolean,
): Row[] {
  return [...rows].sort((left, right) => compareRecentRows(left, right, column, ascending));
}
