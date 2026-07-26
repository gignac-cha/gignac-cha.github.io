import { describe, expect, it } from 'vitest';

import { shiftHourlyDistribution } from './hourly-timezone.ts';

describe('shiftHourlyDistribution', () => {
  it('normalizes, merges and sorts even when offset is 0 (no shortcut copy)', () => {
    const input = [
      { hour: '11', value: 50 },
      { hour: '9', value: 5 }, // unpadded -- must normalize to '09' and merge with the row below
      { hour: '09', value: 10 },
      { hour: '00', value: 10 },
    ];

    expect(shiftHourlyDistribution(input, 0)).toEqual([
      { hour: '00', value: 10 },
      { hour: '09', value: 15 },
      { hour: '11', value: 50 },
    ]);
  });

  it('shifts UTC hours to KST (+9 hours)', () => {
    const input = [
      { hour: '00', value: 10 }, // 00 UTC -> 09 KST
      { hour: '11', value: 50 }, // 11 UTC -> 20 KST
      { hour: '20', value: 30 }, // 20 UTC -> 05 KST (wraps past midnight)
    ];

    expect(shiftHourlyDistribution(input, 9)).toEqual([
      { hour: '05', value: 30 },
      { hour: '09', value: 10 },
      { hour: '20', value: 50 },
    ]);
  });

  it('shifts by a negative offset (west of UTC)', () => {
    const input = [
      { hour: '00', value: 7 }, // 00 UTC -> 21 the previous UTC-3 hour, wraps to 21
      { hour: '02', value: 3 },
    ];

    expect(shiftHourlyDistribution(input, -3)).toEqual([
      { hour: '21', value: 7 },
      { hour: '23', value: 3 },
    ]);
  });

  it('normalizes an offset beyond +/-24 to its equivalent hour shift', () => {
    const input = [{ hour: '00', value: 1 }];

    expect(shiftHourlyDistribution(input, 33)).toEqual(shiftHourlyDistribution(input, 9));
    expect(shiftHourlyDistribution(input, -33)).toEqual(shiftHourlyDistribution(input, -9));
  });

  it('preserves the total across all 24 hours after shifting by any offset', () => {
    const input = Array.from({ length: 24 }, (_, hour) => ({
      hour: String(hour).padStart(2, '0'),
      value: hour + 1,
    }));
    const total = input.reduce((sum, row) => sum + row.value, 0);

    for (const offset of [0, 9, -5, 24, -24, 47]) {
      const shifted = shiftHourlyDistribution(input, offset);
      expect(shifted.reduce((sum, row) => sum + row.value, 0)).toBe(total);
      expect(shifted).toHaveLength(24);
    }
  });

  it('skips rows whose hour key does not parse as a number', () => {
    const input = [
      { hour: 'not-an-hour', value: 99 },
      { hour: '05', value: 4 },
    ];

    expect(shiftHourlyDistribution(input, 0)).toEqual([{ hour: '05', value: 4 }]);
  });
});
