// Display-string formatting, as PURE functions with no DOM access, so every rule unit-tests in
// plain node (formatting.test.ts).
//
// Every text formatter here accepts `string | null | undefined`, and that is a contract detail
// rather than defensive habit: the trail collector writes an explicit null for uuid, origin, href
// and user_agent whenever the browser or the request did not supply one (see toRecord in
// footprint-trail-worker/footprints.ts, which keeps the column set stable by storing null instead
// of omitting the field), and the tracker returns those rows verbatim. A viewer that typed these
// as plain strings would not crash — it would quietly render the four-character text "null" into
// a table cell or a tooltip. Missing values therefore collapse to one visible marker, MISSING_TEXT,
// applied at the formatter rather than at each of the ~10 call sites.
// Pinned by the 'missing values' assertions throughout formatting.test.ts.

// The single rendering of "this value does not exist" (em dash). Exported so the interface layer
// can use the same marker for raw values it shows without formatting (tooltips, titles).
export const MISSING_TEXT = '—';

// Formats a number with Korean-locale thousands separators. Intl is available in both the browser
// and node, so this stays testable outside a DOM.
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

// Renders a possibly-missing raw string for places that show the value as-is (title attributes).
// Whitespace-only counts as missing, because a title of " " is indistinguishable from a bug.
export function toDisplayText(value: string | null | undefined, fallback = MISSING_TEXT): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }
  return value;
}

// Truncates to a maximum length and appends an ellipsis. Low-level helper: it renders a nullish
// input as an empty string and leaves the missing-value decision to its callers below.
export function truncateText(text: string | null | undefined, maximumLength: number): string {
  if (typeof text !== 'string') {
    return '';
  }
  if (text.length <= maximumLength) {
    return text;
  }
  if (maximumLength <= 1) {
    return '…';
  }
  return `${text.slice(0, maximumLength - 1)}…`;
}

// Shortens a uuid to its leading characters to save table width. A shorter original is kept whole.
export function shortenUuid(uuid: string | null | undefined, headLength = 8): string {
  if (typeof uuid !== 'string' || uuid.length === 0) {
    return MISSING_TEXT;
  }
  if (uuid.length <= headLength) {
    return uuid;
  }
  return `${uuid.slice(0, headLength)}…`;
}

// Shortens an href (or an origin — the same shape) for display: drops the scheme and a leading
// www., then truncates. Also used for the ranked-bar labels, where a GROUP BY over a nullable
// column produces one bucket whose key is null; MISSING_TEXT keeps that bar labelled instead of
// blank. Pinned by 'renders a missing href as the missing marker' in formatting.test.ts.
export function shortenHref(href: string | null | undefined, maximumLength = 48): string {
  if (typeof href !== 'string' || href.length === 0) {
    return MISSING_TEXT;
  }
  const withoutScheme = href.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const trimmed = withoutScheme.replace(/\/$/, '');
  return truncateText(trimmed.length > 0 ? trimmed : withoutScheme, maximumLength);
}

// Summarizes the `arguments` column — a JSON array serialized to a string by the collector — into
// a short human-readable line. An empty array is nothing to show (MISSING_TEXT); a value that does
// not parse is truncated verbatim rather than dropped, so malformed data stays visible.
export function summarizeArguments(argumentsText: string | null | undefined, maximumLength = 60): string {
  if (typeof argumentsText !== 'string' || argumentsText.trim().length === 0) {
    return MISSING_TEXT;
  }

  try {
    const parsed: unknown = JSON.parse(argumentsText);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return MISSING_TEXT;
      }
      const joined = parsed
        .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
        .join(', ');
      return truncateText(joined, maximumLength);
    }
    // Not an array: summarize the raw text instead of guessing at a shape.
    return truncateText(argumentsText, maximumLength);
  } catch {
    return truncateText(argumentsText, maximumLength);
  }
}

// Formats a received_at timestamp as 'MM-DD HH:mm'. It deliberately does NOT convert time zones:
// received_at is stamped in UTC by the collector and bucketed as UTC by the tracker (see the
// module header of date-ranges.ts), so rendering the string's own components keeps the table on
// the same axis as the charts and keeps this function deterministic and testable. The UI labels
// the column as UTC rather than shifting the value. Unparseable input is returned as-is.
export function formatTimestamp(text: string | null | undefined): string {
  if (typeof text !== 'string' || text.length === 0) {
    return MISSING_TEXT;
  }
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) {
    return text;
  }
  const [, , month, day, hour, minute] = match;
  return `${month}-${day} ${hour}:${minute}`;
}

// Formats a 0..1 ratio as an integer percentage (bar labels, the bot-ratio card).
export function formatPercentage(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return '0%';
  }
  return `${Math.round(ratio * 100)}%`;
}

// Average page views per visitor (the '방문자당 페이지 뷰' card), to one decimal.
//
// Zero visitors is not "0.0 views each" — it is a quotient that does not exist, and printing 0.0
// would read as "visitors came and looked at nothing" instead of "nobody came". The whole
// undefined case therefore collapses to MISSING_TEXT, including a non-finite input, which is the
// same convention every other formatter in this module follows for absent data.
//
// One decimal, via toFixed rather than Intl: the value lives in a narrow band (1.0..~5.0 for a
// personal site), the extra digit is the only thing separating 1.0 from 1.4, and toFixed keeps the
// output locale-independent so the test can pin exact strings. Rounding is toFixed's own
// half-away-from-zero-on-the-decimal-string behaviour, which is fine for a display figure.
// Pinned by the 'formatViewsPerVisitor' suite in formatting.test.ts.
export function formatViewsPerVisitor(views: number, visitors: number): string {
  if (!Number.isFinite(views) || !Number.isFinite(visitors) || visitors <= 0) {
    return MISSING_TEXT;
  }
  return (Math.max(0, views) / visitors).toFixed(1);
}
