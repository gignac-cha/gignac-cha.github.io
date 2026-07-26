// Parsing and serialization of URL hash state for deep linking.
// SECURITY RULE: Endpoint URL MUST NEVER be parsed from or written into the URL hash.

import { formatUTCDate, parseUTCDate } from './date-ranges.ts';

export interface HashState {
  rangeDays?: number;
  dateRange?: {
    from: string;
    to: string;
  };
  highlightUUID?: string | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MINIMUM_RANGE_DAYS = 1;
const MAXIMUM_RANGE_DAYS = 365;
const DEFAULT_RANGE_DAYS = 30;

// A YYYY-MM-DD string only names a real date when it both matches the pattern AND round-trips
// through parseUTCDate unchanged. Date.UTC() (which parseUTCDate delegates to) silently normalizes
// an out-of-range calendar day -- e.g. 2026-02-30 becomes 2026-03-02 -- instead of failing, so
// pattern-matching alone would accept a value that formatUTCDate would never itself produce. See
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC
function isValidCalendarDateText(text: string): boolean {
  if (!DATE_PATTERN.test(text)) {
    return false;
  }
  const parsed = parseUTCDate(text);
  return !Number.isNaN(parsed.getTime()) && formatUTCDate(parsed) === text;
}

export function parseUrlHash(hashString: string): HashState {
  const rawHash = hashString.startsWith('#') ? hashString.slice(1) : hashString;
  if (rawHash.trim().length === 0) {
    return {};
  }

  const parameters = new URLSearchParams(rawHash);
  const state: HashState = {};

  const rangeParameter = parameters.get('range');
  if (rangeParameter && /^\d+$/.test(rangeParameter)) {
    const days = parseInt(rangeParameter, 10);
    if (days >= MINIMUM_RANGE_DAYS && days <= MAXIMUM_RANGE_DAYS) {
      state.rangeDays = days;
    }
  }

  const fromParameter = parameters.get('from');
  const toParameter = parameters.get('to');
  if (
    fromParameter &&
    toParameter &&
    isValidCalendarDateText(fromParameter) &&
    isValidCalendarDateText(toParameter) &&
    parseUTCDate(fromParameter).getTime() < parseUTCDate(toParameter).getTime()
  ) {
    state.dateRange = { from: fromParameter, to: toParameter };
  }

  const highlightParameter = parameters.get('highlight');
  if (highlightParameter && highlightParameter.trim().length > 0) {
    state.highlightUUID = highlightParameter.trim();
  }

  // 'endpoint' is deliberately never read from `parameters` here -- see the SECURITY RULE above.
  // HashState has no endpoint field, so there is no field for a future edit to accidentally fill.
  return state;
}

export function serializeUrlHash(state: HashState): string {
  const parameters = new URLSearchParams();

  if (state.dateRange) {
    parameters.set('from', state.dateRange.from);
    parameters.set('to', state.dateRange.to);
  } else if (state.rangeDays !== undefined && state.rangeDays !== DEFAULT_RANGE_DAYS) {
    parameters.set('range', String(state.rangeDays));
  }

  if (state.highlightUUID) {
    parameters.set('highlight', state.highlightUUID);
  }

  const serialized = parameters.toString();
  return serialized.length > 0 ? `#${serialized}` : '';
}
