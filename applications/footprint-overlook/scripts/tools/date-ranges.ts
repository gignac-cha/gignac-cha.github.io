// Date-range arithmetic for the range presets, as PURE functions with no DOM access, so the whole
// time axis unit-tests in plain node (date-ranges.test.ts).
//
// THE time invariant of this viewer: every date it computes, sends and labels is UTC.
// That is not a preference, it is dictated by the pipeline. The trail collector stamps
// received_at server-side with new Date().toISOString() — UTC (see footprints.ts in
// footprint-trail-worker) — and the tracker buckets days with substr(received_at, 1, 10),
// i.e. the first ten characters of that UTC timestamp (see QUERY_DEFINITIONS in
// footprint-tracker-worker/queries.ts). Computing `from`/`to` or "today" from the browser's LOCAL
// calendar would therefore shift every bucket by the viewer's offset — in KST (UTC+9) the "today"
// card would read 0 until 09:00 local and the first nine hours of each local day would land in the
// previous bar. Local-time helpers are deliberately absent from this module so no caller can
// reintroduce that skew; the UI labels the axis as UTC instead of silently converting.
// See https://www.rfc-editor.org/rfc/rfc3339#section-5.1 (UTC timestamps sort chronologically as
// strings, which is what makes the tracker's lexical range filter correct) and
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getUTCDate
//
// Tracker API contract: `to` is EXCLUSIVE on every by-day query, so a range is the half-open
// interval [from, to). A preset button means "the last N days including today", hence
// from = today - (N - 1) days and to = tomorrow.

// A date range with an exclusive end. Both values are UTC YYYY-MM-DD strings.
export interface DateRange {
  from: string;
  to: string;
}

// Formats a Date as a UTC YYYY-MM-DD string. Uses the getUTC* accessors rather than toISOString()
// slicing only because the intent is explicit at the call site; both are UTC. Pinned by the
// 'formatUTCDate' suite in date-ranges.test.ts.
export function formatUTCDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parses a YYYY-MM-DD string into the Date at UTC midnight of that day, via Date.UTC() rather than
// the Date(string) constructor: the constructor's handling of date-only forms is what makes
// new Date('2026-07-16') UTC midnight but new Date('2026/07/16') LOCAL midnight, and relying on
// that distinction is how a one-day drift creeps back in. Building the timestamp explicitly keeps
// the round trip parse -> format stable in every time zone. Pinned by 'parse -> format round trip'
// in date-ranges.test.ts.
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC
export function parseUTCDate(text: string): Date {
  const [year, month, day] = text.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Computes the half-open [from, to) range for "the last presetDays days including today (UTC)":
// from = today - (presetDays - 1) days, to = tomorrow (exclusive). The incoming Date is normalized
// to its UTC midnight first, so the wall-clock time of day it carries cannot shift the result.
// Pinned by the 'computeDateRange' suite in date-ranges.test.ts.
export function computeDateRange(presetDays: number, today: Date): DateRange {
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const fromDate = new Date(startOfToday);
  fromDate.setUTCDate(fromDate.getUTCDate() - (presetDays - 1));

  const toDate = new Date(startOfToday);
  toDate.setUTCDate(toDate.getUTCDate() + 1);

  return { from: formatUTCDate(fromDate), to: formatUTCDate(toDate) };
}

// Enumerates every day in the half-open interval [from, to), one step per day, excluding `to`
// itself. Stepping with setUTCDate() delegates month, year and leap-day rollover to the Date
// implementation instead of hand-rolled calendar arithmetic — and because the cursor sits at UTC
// midnight, no daylight-saving transition can turn a step into 23 or 25 hours and duplicate or
// skip a day. Pinned by the month, year and leap-year cases in date-ranges.test.ts.
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = parseUTCDate(from);
  const end = parseUTCDate(to);

  // Defensive iteration ceiling: a malformed or inverted input must not spin forever inside a
  // render path. 100000 days (~274 years) is far beyond any range this viewer can request.
  let guard = 0;
  while (cursor.getTime() < end.getTime() && guard < 100000) {
    days.push(formatUTCDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }

  return days;
}

// Number of days in [from, to).
export function countDays(from: string, to: string): number {
  return enumerateDays(from, to).length;
}
