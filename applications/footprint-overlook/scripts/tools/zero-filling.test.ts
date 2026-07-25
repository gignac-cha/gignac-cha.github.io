import { describe, expect, it } from 'vitest';

import {
  extractValues,
  fillMissingBotDays,
  fillMissingDays,
  fillMissingHours,
  toBotFootprintSeries,
} from './zero-filling.ts';

describe('fillMissingDays', () => {
  it('fills the days the response omitted with 0', () => {
    const rows = [
      { day: '2026-07-10', footprints: 5 },
      { day: '2026-07-12', footprints: 8 },
    ];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-13', 'footprints')).toEqual([
      { day: '2026-07-10', value: 5 },
      { day: '2026-07-11', value: 0 },
      { day: '2026-07-12', value: 8 },
    ]);
  });

  it('yields an all-zero window for an empty response', () => {
    expect(fillMissingDays([], '2026-07-10', '2026-07-12', 'footprints')).toEqual([
      { day: '2026-07-10', value: 0 },
      { day: '2026-07-11', value: 0 },
    ]);
  });

  it('reads the value column named by valueKey', () => {
    const rows = [{ day: '2026-07-10', visitors: 3 }];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-11', 'visitors')).toEqual([
      { day: '2026-07-10', value: 3 },
    ]);
  });

  it('ignores rows outside the window', () => {
    const rows = [
      { day: '2026-07-01', footprints: 99 }, // before `from` -> ignored
      { day: '2026-07-11', footprints: 4 },
    ];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-12', 'footprints')).toEqual([
      { day: '2026-07-10', value: 0 },
      { day: '2026-07-11', value: 4 },
    ]);
  });

  it('treats a non-numeric or NaN value as 0', () => {
    const rows = [
      { day: '2026-07-10', footprints: 'oops' },
      { day: '2026-07-11', footprints: Number.NaN },
    ];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-12', 'footprints')).toEqual([
      { day: '2026-07-10', value: 0 },
      { day: '2026-07-11', value: 0 },
    ]);
  });

  it('keeps an explicit zero (indistinguishable from a filled zero by design)', () => {
    const rows = [{ day: '2026-07-10', footprints: 0 }];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-11', 'footprints')).toEqual([
      { day: '2026-07-10', value: 0 },
    ]);
  });
});

describe('extractValues', () => {
  it('projects the values in order', () => {
    expect(
      extractValues([
        { day: '2026-07-10', value: 5 },
        { day: '2026-07-11', value: 0 },
      ]),
    ).toEqual([5, 0]);
  });
});

describe('fillMissingBotDays', () => {
  it('fills both columns together', () => {
    const rows = [
      { day: '2026-07-10', footprints: 10, bot_footprints: 3 },
      { day: '2026-07-12', footprints: 8, bot_footprints: 2 },
    ];
    expect(fillMissingBotDays(rows, '2026-07-10', '2026-07-13')).toEqual([
      { day: '2026-07-10', footprints: 10, botFootprints: 3 },
      { day: '2026-07-11', footprints: 0, botFootprints: 0 },
      { day: '2026-07-12', footprints: 8, botFootprints: 2 },
    ]);
  });

  it('yields an all-zero window for an empty response', () => {
    expect(fillMissingBotDays([], '2026-07-10', '2026-07-12')).toEqual([
      { day: '2026-07-10', footprints: 0, botFootprints: 0 },
      { day: '2026-07-11', footprints: 0, botFootprints: 0 },
    ]);
  });

  it('clamps bot_footprints above footprints down to footprints', () => {
    const rows = [{ day: '2026-07-10', footprints: 5, bot_footprints: 9 }];
    expect(fillMissingBotDays(rows, '2026-07-10', '2026-07-11')).toEqual([
      { day: '2026-07-10', footprints: 5, botFootprints: 5 },
    ]);
  });

  it('clamps a negative bot_footprints up to 0', () => {
    const rows = [{ day: '2026-07-10', footprints: 5, bot_footprints: -2 }];
    expect(fillMissingBotDays(rows, '2026-07-10', '2026-07-11')).toEqual([
      { day: '2026-07-10', footprints: 5, botFootprints: 0 },
    ]);
  });

  it('treats non-numeric columns as 0', () => {
    const rows = [{ day: '2026-07-10', footprints: 'x', bot_footprints: null }];
    expect(fillMissingBotDays(rows, '2026-07-10', '2026-07-11')).toEqual([
      { day: '2026-07-10', footprints: 0, botFootprints: 0 },
    ]);
  });
});

describe('fillMissingHours', () => {
  it('always returns all 24 bins in order, zero-filling the quiet hours', () => {
    // views-by-hour groups over the rows that exist, so a night with no traffic is simply absent
    // from the response. The histogram is read as a shape, so the missing hours have to come back
    // as explicit zeros — otherwise 24 bars silently become 3 and the trough disappears.
    const filled = fillMissingHours(
      [
        { hour: '09', views: 12 },
        { hour: '13', views: 4 },
        { hour: '23', views: 1 },
      ],
      'views',
    );
    expect(filled).toHaveLength(24);
    expect(filled[0]).toEqual({ hour: '00', value: 0 });
    expect(filled[9]).toEqual({ hour: '09', value: 12 });
    expect(filled[13]).toEqual({ hour: '13', value: 4 });
    expect(filled[23]).toEqual({ hour: '23', value: 1 });
    expect(filled.map((bin) => bin.hour)).toEqual([
      '00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11',
      '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23',
    ]);
  });

  it('returns 24 zeros for an empty response', () => {
    const filled = fillMissingHours([], 'views');
    expect(filled).toHaveLength(24);
    expect(filled.every((bin) => bin.value === 0)).toBe(true);
  });

  it('pads an unpadded hour key into the same bin', () => {
    // The tracker's substr() yields '07', but a mock or a future upstream answering 7 must land in
    // the same bar rather than being dropped as an unknown key.
    expect(fillMissingHours([{ hour: '7', views: 3 }], 'views')[7]).toEqual({ hour: '07', value: 3 });
    expect(fillMissingHours([{ hour: 7, views: 3 }], 'views')[7]).toEqual({ hour: '07', value: 3 });
  });

  it('ignores a key outside 00..23 instead of inventing a 25th bin', () => {
    const filled = fillMissingHours([{ hour: '24', views: 9 }, { hour: 'xx', views: 9 }], 'views');
    expect(filled).toHaveLength(24);
    expect(filled.every((bin) => bin.value === 0)).toBe(true);
  });

  it('treats a non-numeric value as 0', () => {
    expect(fillMissingHours([{ hour: '05', views: null }], 'views')[5]).toEqual({ hour: '05', value: 0 });
    expect(fillMissingHours([{ hour: '05', views: Number.NaN }], 'views')[5]).toEqual({ hour: '05', value: 0 });
  });
});

describe('toBotFootprintSeries', () => {
  it('projects BotDayValue into a plain bot-footprint series', () => {
    expect(
      toBotFootprintSeries([
        { day: '2026-07-10', footprints: 10, botFootprints: 3 },
        { day: '2026-07-11', footprints: 0, botFootprints: 0 },
      ]),
    ).toEqual([
      { day: '2026-07-10', value: 3 },
      { day: '2026-07-11', value: 0 },
    ]);
  });
});
