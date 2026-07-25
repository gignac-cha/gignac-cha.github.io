import { describe, expect, it } from 'vitest';

import { matchesHighlight, normalizeHighlightUUID } from './highlight-uuid.ts';

// read/write touch localStorage (browser only), so only the pure normalize/matches pair is
// covered here — the same split tracker-endpoint.test.ts uses.

describe('normalizeHighlightUUID', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeHighlightUUID('  c2524296-8e3b-489b-b301-2bca8c595b43  ')).toBe(
      'c2524296-8e3b-489b-b301-2bca8c595b43',
    );
  });

  it('normalizes non-string and blank input to an empty string', () => {
    expect(normalizeHighlightUUID('')).toBe('');
    expect(normalizeHighlightUUID('   ')).toBe('');
    expect(normalizeHighlightUUID(undefined as unknown as string)).toBe('');
  });
});

describe('matchesHighlight', () => {
  const uuid = 'c2524296-8e3b-489b-b301-2bca8c595b43';

  it('matches only on exact equality', () => {
    expect(matchesHighlight(uuid, uuid)).toBe(true);
    expect(matchesHighlight(uuid, ` ${uuid} `)).toBe(true); // pasted with whitespace
  });

  it('never matches on a prefix, even the 8 characters the table displays', () => {
    // The table shows an 8-character prefix, which makes it the obvious thing to paste — but
    // prefixes collide, so a prefix rule would eventually highlight strangers.
    expect(matchesHighlight(uuid, 'c2524296')).toBe(false);
    expect(matchesHighlight(uuid, 'c2524296…')).toBe(false);
  });

  it('never matches a null or empty row uuid', () => {
    // Null is the collector's "no identity reported" — the opposite of a known visitor.
    expect(matchesHighlight(null, uuid)).toBe(false);
    expect(matchesHighlight('', uuid)).toBe(false);
  });

  it('matches nothing while no uuid is highlighted', () => {
    expect(matchesHighlight(uuid, null)).toBe(false);
    expect(matchesHighlight(uuid, '')).toBe(false);
    expect(matchesHighlight(uuid, '   ')).toBe(false);
  });
});
