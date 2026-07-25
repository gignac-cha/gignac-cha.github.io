// Reads and writes the tracker endpoint in browser storage.
//
// Family rule: the endpoint is never hardcoded. The tracking library resolves where to WRITE
// footprints from browser storage, and this dashboard resolves where to READ them the same way —
// from localStorage['footprint:tracker']. The two keys are deliberately distinct: 'footprint:
// endpoint' addresses the collector (footprint-trail), this one addresses the query API
// (footprint-tracker), and a page may legitimately have one, both, or neither.
//
// normalize/validate are pure and unit-tested (tracker-endpoint.test.ts); read/write are kept thin
// because they are the only part that needs a browser.

export const TRACKER_STORAGE_KEY = 'footprint:tracker';

// Normalizes a user-entered URL: trims surrounding whitespace and drops trailing slashes.
// Request URLs are assembled by concatenation (`${base}/queries`), so a trailing slash would
// produce a double slash — which is a different path to the worker's router, not a cosmetic
// difference, and would fall through to its 404.
export function normalizeTrackerEndpoint(rawUrl: string): string {
  if (typeof rawUrl !== 'string') {
    return '';
  }
  return rawUrl.trim().replace(/\/+$/, '');
}

// Accepts only absolute http(s) URLs. The scheme check is explicit rather than left to the URL
// parser alone, because new URL() also accepts schemes a fetch could never use here (mailto:,
// data:, javascript:) and storing one would leave the dashboard permanently unable to load.
// See https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
export function isValidTrackerEndpoint(rawUrl: string): boolean {
  const normalized = normalizeTrackerEndpoint(rawUrl);
  if (normalized.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Reads the stored endpoint, or undefined when absent or unreadable.
export function readTrackerEndpoint(): string | undefined {
  try {
    const stored = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (stored === null) {
      return undefined;
    }
    const normalized = normalizeTrackerEndpoint(stored);
    return normalized.length > 0 ? normalized : undefined;
  } catch {
    // localStorage access throws rather than returning null when storage is blocked (private
    // mode, a cookie-blocking policy). Treating that as "no endpoint stored" degrades to the
    // setup card instead of an unhandled exception on page load.
    return undefined;
  }
}

// Stores the endpoint, normalized.
export function writeTrackerEndpoint(rawUrl: string): void {
  try {
    localStorage.setItem(TRACKER_STORAGE_KEY, normalizeTrackerEndpoint(rawUrl));
  } catch {
    // Same reasoning as the read path, plus QuotaExceededError: a failed write must not take the
    // page down. The dashboard still opens for this session; only persistence is lost.
  }
}
