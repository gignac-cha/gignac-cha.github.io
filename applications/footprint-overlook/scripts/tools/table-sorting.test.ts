import { describe, expect, it } from 'vitest';

import { compareRecentRows, sortRecentRows, type SortableRecentRow } from './table-sorting.ts';

function makeRow(overrides: Partial<SortableRecentRow>): SortableRecentRow {
  return {
    received_at: '2026-07-20T00:00:00.000Z',
    uuid: 'uuid-a',
    href: 'https://example.com/a',
    arguments: '[]',
    ...overrides,
  };
}

describe('sortRecentRows', () => {
  it('orders timestamps chronologically without parsing them', () => {
    const rows = [
      makeRow({ received_at: '2026-07-20T09:00:00.000Z' }),
      makeRow({ received_at: '2026-07-20T07:30:00.000Z' }),
      makeRow({ received_at: '2026-07-21T00:00:00.000Z' }),
    ];

    expect(sortRecentRows(rows, 'time', true).map((row) => row.received_at)).toEqual([
      '2026-07-20T07:30:00.000Z',
      '2026-07-20T09:00:00.000Z',
      '2026-07-21T00:00:00.000Z',
    ]);
    expect(sortRecentRows(rows, 'time', false).map((row) => row.received_at)).toEqual([
      '2026-07-21T00:00:00.000Z',
      '2026-07-20T09:00:00.000Z',
      '2026-07-20T07:30:00.000Z',
    ]);
  });

  it('keeps unreported values last in both directions', () => {
    const rows = [
      makeRow({ uuid: null }),
      makeRow({ uuid: 'b' }),
      makeRow({ uuid: 'a' }),
    ];

    expect(sortRecentRows(rows, 'uuid', true).map((row) => row.uuid)).toEqual(['a', 'b', null]);
    expect(sortRecentRows(rows, 'uuid', false).map((row) => row.uuid)).toEqual(['b', 'a', null]);
  });

  it('treats an empty string as unreported too', () => {
    const rows = [makeRow({ href: '' }), makeRow({ href: 'https://example.com/z' })];

    expect(sortRecentRows(rows, 'href', true).map((row) => row.href)).toEqual([
      'https://example.com/z',
      '',
    ]);
  });

  it('sorts href with numeric collation so /page10 follows /page2', () => {
    const rows = [
      makeRow({ href: 'https://example.com/page10' }),
      makeRow({ href: 'https://example.com/page2' }),
      makeRow({ href: 'https://example.com/page1' }),
    ];

    expect(sortRecentRows(rows, 'href', true).map((row) => row.href)).toEqual([
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page10',
    ]);
  });

  it('sorts the arguments column, which is never null', () => {
    const rows = [makeRow({ arguments: '["b"]' }), makeRow({ arguments: '["a"]' })];

    expect(sortRecentRows(rows, 'arguments', true).map((row) => row.arguments)).toEqual([
      '["a"]',
      '["b"]',
    ]);
  });

  it('does not mutate the input array', () => {
    const rows = [makeRow({ uuid: 'b' }), makeRow({ uuid: 'a' })];
    const sorted = sortRecentRows(rows, 'uuid', true);

    expect(rows.map((row) => row.uuid)).toEqual(['b', 'a']);
    expect(sorted).not.toBe(rows);
  });

  it('reports two unreported values as equal', () => {
    expect(compareRecentRows(makeRow({ uuid: null }), makeRow({ uuid: '' }), 'uuid', true)).toBe(0);
    expect(compareRecentRows(makeRow({ uuid: null }), makeRow({ uuid: '' }), 'uuid', false)).toBe(0);
  });
});
