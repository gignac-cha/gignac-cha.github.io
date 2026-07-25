// Client-side visitor highlighting for the 최근 조회 table: the viewer remembers ONE uuid and the
// table emphasizes every row that belongs to it.
//
// This is deliberately a VIEWER-ONLY feature, not a tracker query: highlighting changes how rows
// already on screen are painted, so shipping it client-side needs no API surface, no redeploy of
// the worker, and works against any tracker version. (Server-side owner handling is a different
// feature — OWNER_UUIDS excludes the owner from the STATISTICS; this one makes a visitor easy to
// SPOT.) The uuid cannot be auto-detected here: the visitor uuid lives in the TRACKED site's
// localStorage (gignac-cha.github.io), a different origin from this dashboard, and browsers do
// not share localStorage across origins — hence the paste-or-click flows the interface offers.
// See https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
//
// normalize/matches are pure and unit-tested (highlight-uuid.test.ts); read/write touch storage
// and stay thin, following the same split as tracker-endpoint.ts.

// Distinct from 'footprint' (the tracked site's visitor identity) and 'footprint:tracker' (this
// viewer's data source): this key only remembers which visitor the table should emphasize.
export const HIGHLIGHT_STORAGE_KEY = 'footprint:highlight';

// Normalizes pasted input: surrounding whitespace is the only forgivable noise in a uuid.
export function normalizeHighlightUUID(rawValue: string): string {
  if (typeof rawValue !== 'string') {
    return '';
  }
  return rawValue.trim();
}

// True when a row belongs to the highlighted visitor. EXACT match only: uuid prefixes collide by
// design (the table itself displays an 8-character prefix), and a substring rule would silently
// highlight strangers once traffic grows. A row whose uuid is null can never match — the collector
// stores null when the client reported no identity, which is the opposite of "this known visitor".
// Pinned by the 'matchesHighlight' suite in highlight-uuid.test.ts.
export function matchesHighlight(
  rowUUID: string | null | undefined,
  highlightedUUID: string | null | undefined,
): boolean {
  if (typeof rowUUID !== 'string' || rowUUID.length === 0) {
    return false;
  }
  if (typeof highlightedUUID !== 'string') {
    return false;
  }
  const normalized = normalizeHighlightUUID(highlightedUUID);
  return normalized.length > 0 && rowUUID === normalized;
}

// Reads the remembered uuid, or null when absent, blank or unreadable (private mode etc. — the
// feature quietly degrades to "nothing highlighted", never to a broken table).
export function readHighlightedUUID(): string | null {
  try {
    const stored = localStorage.getItem(HIGHLIGHT_STORAGE_KEY);
    if (stored === null) {
      return null;
    }
    const normalized = normalizeHighlightUUID(stored);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

// Stores the uuid to highlight; null clears it. Write failures are swallowed for the same reason
// as above — the highlight then simply does not survive a reload.
export function writeHighlightedUUID(uuidValue: string | null): void {
  try {
    const normalized = uuidValue === null ? '' : normalizeHighlightUUID(uuidValue);
    if (normalized.length === 0) {
      localStorage.removeItem(HIGHLIGHT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(HIGHLIGHT_STORAGE_KEY, normalized);
  } catch {
    // Storage may be blocked; the in-memory highlight still works for this page view.
  }
}
