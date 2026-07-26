// Circular hour-only timezone shift for hourly distribution bars.
//
// The tracker buckets views into 24 UTC hour keys ('00'..'23') with no date attached to any
// individual bucket -- "hour 03" means "views received during UTC hour 03 on whichever day this
// query's range covers," not a specific calendar instant. That is exactly what makes a plain
// circular shift, `(hour + offsetHours) mod 24`, a safe and complete timezone conversion here: with
// no date component to roll over, there is no midnight boundary this function could get wrong. A
// KST toggle (+9) moves the 00 UTC bucket to display as 09, because KST is UTC+9 with no daylight
// saving; hours that would fall below 00 or above 23 wrap around modulo 24 instead of spilling into
// an adjacent (nonexistent, in this data) day.
//
// Offset 0 still runs through the same normalize/merge/sort pipeline as any other offset, rather
// than short-circuiting to a raw copy of the input: an unpadded or duplicated hour key (e.g. '9'
// alongside '09') must merge and sort identically regardless of which offset is applied, or the
// "no shift" toggle state would silently render different bars than every other state.

export interface HourValue {
  hour: string;
  value: number;
}

export function shiftHourlyDistribution(
  rows: ReadonlyArray<{ hour: string; value: number }>,
  offsetHours: number,
): HourValue[] {
  const hourMap = new Map<string, number>();

  for (const row of rows) {
    const rawHour = parseInt(row.hour, 10);
    if (Number.isNaN(rawHour)) {
      continue;
    }
    const shiftedHour = ((rawHour + offsetHours) % 24 + 24) % 24;
    const shiftedKey = String(shiftedHour).padStart(2, '0');
    hourMap.set(shiftedKey, (hourMap.get(shiftedKey) ?? 0) + row.value);
  }

  // Rebuilding by walking 0..23 (rather than sorting hourMap's insertion-ordered keys) is what
  // guarantees ascending hour order regardless of the input's order or the offset applied.
  const result: HourValue[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const hourKey = String(hour).padStart(2, '0');
    if (hourMap.has(hourKey)) {
      result.push({ hour: hourKey, value: hourMap.get(hourKey) ?? 0 });
    }
  }

  return result;
}
