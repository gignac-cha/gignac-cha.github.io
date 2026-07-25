// Fills the gaps in the bucketed responses (by day, by hour), as pure functions verified in
// zero-filling.test.ts.
//
// Tracker contract: the by-day queries are GROUP BY over rows that exist, so a day with no
// footprints produces no row at all — the response is sparse. Plotting it directly would compress
// the x axis and silently redraw quiet days as if they never happened, so every series is expanded
// to the full [from, to) window with 0 for the days the response omitted. The window is
// enumerated in UTC (see the module header of date-ranges.ts), matching the UTC day keys the
// tracker returns from substr(received_at, 1, 10) — filling against a locally-enumerated window
// would leave the first and last bars permanently empty because their keys would never match.

import { enumerateDays } from './date-ranges.ts';

// One numeric value for one day.
export interface DayValue {
  day: string;
  value: number;
}

// Expands sparse rows into one entry per day of [from, to).
// - valueKey: the field to read from each row ('footprints', 'visitors').
// - a missing day, or a value that is not a finite number, becomes 0.
export function fillMissingDays(
  rows: ReadonlyArray<object>,
  from: string,
  to: string,
  valueKey: string,
): DayValue[] {
  const valueByDay = new Map<string, number>();

  for (const row of rows) {
    // Indexed loosely on purpose: this one function serves every by-day row type, which differ
    // only in the name of their value column.
    const record = row as Record<string, unknown>;
    const day = record['day'];
    const value = record[valueKey];
    if (typeof day === 'string' && typeof value === 'number' && Number.isFinite(value)) {
      valueByDay.set(day, value);
    }
  }

  return enumerateDays(from, to).map((day) => ({
    day,
    value: valueByDay.get(day) ?? 0,
  }));
}

// Projects values out of a DayValue list (chart geometry input).
export function extractValues(dayValues: ReadonlyArray<DayValue>): number[] {
  return dayValues.map((dayValue) => dayValue.value);
}

// bots-by-day carries two counts per day, filled together.
export interface BotDayValue {
  day: string;
  footprints: number;
  botFootprints: number;
}

// Same expansion as fillMissingDays, for the two columns of bots-by-day at once.
export function fillMissingBotDays(
  rows: ReadonlyArray<object>,
  from: string,
  to: string,
): BotDayValue[] {
  const footprintsByDay = new Map<string, number>();
  const botFootprintsByDay = new Map<string, number>();

  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const day = record['day'];
    if (typeof day !== 'string') {
      continue;
    }
    const footprints = record['footprints'];
    const botFootprints = record['bot_footprints'];
    if (typeof footprints === 'number' && Number.isFinite(footprints)) {
      footprintsByDay.set(day, footprints);
    }
    if (typeof botFootprints === 'number' && Number.isFinite(botFootprints)) {
      botFootprintsByDay.set(day, botFootprints);
    }
  }

  return enumerateDays(from, to).map((day) => {
    const footprints = footprintsByDay.get(day) ?? 0;
    const rawBot = botFootprintsByDay.get(day) ?? 0;
    return {
      day,
      footprints,
      // The query guarantees bot_footprints <= footprints (both are aggregates over the same
      // rows), but the clamp keeps a partial or corrupted response from producing a bot ratio
      // above 100% or a chart series that escapes its own y axis.
      botFootprints: Math.min(Math.max(0, rawBot), Math.max(0, footprints)),
    };
  });
}

// Projects the bot counts as a plain series (the chart's third line).
export function toBotFootprintSeries(botDayValues: ReadonlyArray<BotDayValue>): DayValue[] {
  return botDayValues.map((botDayValue) => ({ day: botDayValue.day, value: botDayValue.botFootprints }));
}

// One numeric value for one hour-of-day bin.
export interface HourValue {
  hour: string; // '00'..'23'
  value: number;
}

// The 24 hour keys, in order. Built once rather than per call — the list is constant.
const HOUR_KEYS: readonly string[] = Array.from({ length: 24 }, (_unused, hour) =>
  String(hour).padStart(2, '0'),
);

// Expands the sparse views-by-hour response into all 24 bins.
//
// Same sparseness problem as the by-day series, with a sharper consequence: an hour histogram is
// read as a SHAPE (when does this site get traffic?), and a GROUP BY that emits only the busy
// hours would draw the quiet ones as if they did not exist — 24 bars would silently become 9,
// each one wider, and the night-time trough that is the actual finding would disappear. The bins
// are the UTC hours the tracker groups by (substr(received_at, 12, 2)), matching the rest of the
// viewer's UTC axis; the panel labels them as UTC rather than converting.
//
// Row keys are padded to two digits before lookup so an upstream that answers '7' instead of '07'
// lands in the same bin instead of being dropped, and anything that still does not match one of the
// 24 keys is ignored rather than inventing a 25th bar.
// Pinned by the 'fillMissingHours' suite in zero-filling.test.ts.
export function fillMissingHours(rows: ReadonlyArray<object>, valueKey: string): HourValue[] {
  const valueByHour = new Map<string, number>();

  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const hour = record['hour'];
    const value = record[valueKey];
    if (typeof hour !== 'string' && typeof hour !== 'number') {
      continue;
    }
    const hourKey = String(hour).padStart(2, '0');
    if (typeof value === 'number' && Number.isFinite(value)) {
      valueByHour.set(hourKey, value);
    }
  }

  return HOUR_KEYS.map((hour) => ({ hour, value: valueByHour.get(hour) ?? 0 }));
}
