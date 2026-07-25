import { describe, expect, it } from 'vitest';

import {
  formatCount,
  formatPercentage,
  formatTimestamp,
  formatViewsPerVisitor,
  MISSING_TEXT,
  shortenHref,
  shortenUuid,
  summarizeArguments,
  toDisplayText,
  truncateText,
} from './formatting.ts';

describe('formatCount', () => {
  it('inserts thousands separators', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(42)).toBe('42');
  });

  it('rounds fractions', () => {
    expect(formatCount(3.6)).toBe('4');
  });

  it('renders non-finite values as 0', () => {
    expect(formatCount(Number.NaN)).toBe('0');
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('toDisplayText', () => {
  it('passes a real value through', () => {
    expect(toDisplayText('https://example.com')).toBe('https://example.com');
  });

  it('renders null, undefined and blank input as the missing marker', () => {
    // These are the values the collector stores as SQL null for uuid / origin / href /
    // user_agent; without this the DOM would show the string "null".
    expect(toDisplayText(null)).toBe(MISSING_TEXT);
    expect(toDisplayText(undefined)).toBe(MISSING_TEXT);
    expect(toDisplayText('')).toBe(MISSING_TEXT);
    expect(toDisplayText('   ')).toBe(MISSING_TEXT);
  });

  it('accepts a caller-supplied fallback', () => {
    expect(toDisplayText(null, 'unknown')).toBe('unknown');
  });
});

describe('shortenUuid', () => {
  it('keeps the leading characters and appends an ellipsis', () => {
    expect(shortenUuid('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567…');
  });

  it('leaves a shorter string untouched', () => {
    expect(shortenUuid('abcd')).toBe('abcd');
  });

  it('accepts a custom head length', () => {
    expect(shortenUuid('123e4567-e89b', 4)).toBe('123e…');
  });

  it('renders a missing uuid as the missing marker', () => {
    expect(shortenUuid(null)).toBe(MISSING_TEXT);
    expect(shortenUuid(undefined)).toBe(MISSING_TEXT);
    expect(shortenUuid('')).toBe(MISSING_TEXT);
  });
});

describe('truncateText', () => {
  it('truncates past the maximum length and appends an ellipsis', () => {
    expect(truncateText('abcdefghij', 5)).toBe('abcd…');
  });

  it('leaves text within the maximum length untouched', () => {
    expect(truncateText('abc', 5)).toBe('abc');
  });

  it('does not truncate at exactly the boundary', () => {
    expect(truncateText('abcde', 5)).toBe('abcde');
  });

  it('renders nullish input as an empty string (low-level helper)', () => {
    expect(truncateText(null, 5)).toBe('');
    expect(truncateText(undefined, 5)).toBe('');
  });
});

describe('shortenHref', () => {
  it('strips the scheme and a leading www.', () => {
    expect(shortenHref('https://www.example.com/blog/post')).toBe('example.com/blog/post');
    expect(shortenHref('http://example.com/')).toBe('example.com');
  });

  it('truncates a long href', () => {
    expect(shortenHref('https://example.com/very/long/path/segment/here', 20)).toBe('example.com/very/lo…');
  });

  it('renders a missing href as the missing marker', () => {
    // top-pages / top-origins group by a nullable column, so one bucket can arrive with a null
    // key; it must still be a labelled bar rather than a blank row.
    expect(shortenHref(null)).toBe(MISSING_TEXT);
    expect(shortenHref(undefined)).toBe(MISSING_TEXT);
    expect(shortenHref('')).toBe(MISSING_TEXT);
  });
});

describe('summarizeArguments', () => {
  it('joins a JSON array with commas', () => {
    expect(summarizeArguments('["click","header"]')).toBe('click, header');
  });

  it('renders an empty array as the missing marker', () => {
    expect(summarizeArguments('[]')).toBe(MISSING_TEXT);
  });

  it('renders empty, blank and nullish input as the missing marker', () => {
    expect(summarizeArguments('')).toBe(MISSING_TEXT);
    expect(summarizeArguments('   ')).toBe(MISSING_TEXT);
    expect(summarizeArguments(null)).toBe(MISSING_TEXT);
  });

  it('serializes non-string items as JSON', () => {
    expect(summarizeArguments('[1,{"a":2}]')).toBe('1, {"a":2}');
  });

  it('truncates a long summary', () => {
    expect(summarizeArguments('["aaaaaaaaaa","bbbbbbbbbb"]', 10)).toBe('aaaaaaaaa…');
  });

  it('summarizes unparseable input verbatim instead of dropping it', () => {
    expect(summarizeArguments('not-json')).toBe('not-json');
  });
});

describe('formatTimestamp', () => {
  it('formats an ISO timestamp as MM-DD HH:mm', () => {
    expect(formatTimestamp('2026-07-16T13:45:22Z')).toBe('07-16 13:45');
  });

  it('handles the space-separated SQL form', () => {
    expect(formatTimestamp('2026-07-16 09:05:00')).toBe('07-16 09:05');
  });

  it('does not shift the value into the local time zone', () => {
    // The column is UTC on both the collector and the tracker side; the table header says so.
    // Converting here would put the table on a different axis from the charts.
    expect(formatTimestamp('2026-07-16T23:30:00Z')).toBe('07-16 23:30');
  });

  it('returns unparseable input as-is', () => {
    expect(formatTimestamp('unknown')).toBe('unknown');
  });

  it('renders a missing timestamp as the missing marker', () => {
    expect(formatTimestamp(null)).toBe(MISSING_TEXT);
    expect(formatTimestamp('')).toBe(MISSING_TEXT);
  });
});

describe('formatPercentage', () => {
  it('renders a ratio as an integer percentage', () => {
    expect(formatPercentage(0.5)).toBe('50%');
    expect(formatPercentage(1)).toBe('100%');
  });

  it('renders zero, negative and non-finite ratios as 0%', () => {
    expect(formatPercentage(0)).toBe('0%');
    expect(formatPercentage(-1)).toBe('0%');
    expect(formatPercentage(Number.NaN)).toBe('0%');
  });
});

describe('formatViewsPerVisitor', () => {
  it('divides to one decimal', () => {
    expect(formatViewsPerVisitor(120, 40)).toBe('3.0');
    expect(formatViewsPerVisitor(7, 4)).toBe('1.8');
    expect(formatViewsPerVisitor(1, 3)).toBe('0.3');
  });

  it('keeps the decimal even for a whole quotient', () => {
    // '2' and '2.0' read differently on a card next to '1.4'; the fixed decimal keeps the column
    // of numbers comparable at a glance.
    expect(formatViewsPerVisitor(10, 5)).toBe('2.0');
  });

  it('renders the missing marker when there were no visitors', () => {
    // Not '0.0': zero visitors is a quotient that does not exist, and 0.0 would read as "people
    // came and viewed nothing" instead of "nobody came".
    expect(formatViewsPerVisitor(0, 0)).toBe(MISSING_TEXT);
    expect(formatViewsPerVisitor(12, 0)).toBe(MISSING_TEXT);
    expect(formatViewsPerVisitor(12, -1)).toBe(MISSING_TEXT);
  });

  it('renders the missing marker for a non-finite input', () => {
    expect(formatViewsPerVisitor(Number.NaN, 4)).toBe(MISSING_TEXT);
    expect(formatViewsPerVisitor(4, Number.NaN)).toBe(MISSING_TEXT);
    expect(formatViewsPerVisitor(Number.POSITIVE_INFINITY, 4)).toBe(MISSING_TEXT);
  });

  it('clamps a negative view count to zero rather than printing a negative average', () => {
    expect(formatViewsPerVisitor(-10, 5)).toBe('0.0');
  });
});
