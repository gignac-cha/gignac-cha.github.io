import { describe, expect, it } from 'vitest';

import { extractValues, fillMissingBotDays, fillMissingDays, toBotFootprintSeries } from './zero-filling.ts';

describe('fillMissingDays', () => {
  it('빠진 날을 0 으로 채운다', () => {
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

  it('rows 가 비어 있으면 전 구간이 0 이다', () => {
    expect(fillMissingDays([], '2026-07-10', '2026-07-12', 'footprints')).toEqual([
      { day: '2026-07-10', value: 0 },
      { day: '2026-07-11', value: 0 },
    ]);
  });

  it('valueKey 로 다른 필드(visitors)를 읽는다', () => {
    const rows = [{ day: '2026-07-10', visitors: 3 }];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-11', 'visitors')).toEqual([
      { day: '2026-07-10', value: 3 },
    ]);
  });

  it('범위 밖의 row 는 무시한다', () => {
    const rows = [
      { day: '2026-07-01', footprints: 99 }, // from 이전 → 무시
      { day: '2026-07-11', footprints: 4 },
    ];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-12', 'footprints')).toEqual([
      { day: '2026-07-10', value: 0 },
      { day: '2026-07-11', value: 4 },
    ]);
  });

  it('수치가 숫자가 아니거나 NaN 이면 0 으로 채운다', () => {
    const rows = [
      { day: '2026-07-10', footprints: 'oops' },
      { day: '2026-07-11', footprints: Number.NaN },
    ];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-12', 'footprints')).toEqual([
      { day: '2026-07-10', value: 0 },
      { day: '2026-07-11', value: 0 },
    ]);
  });

  it('0 값 날도 보존한다(명시적 0 vs 누락 0 구분 없음)', () => {
    const rows = [{ day: '2026-07-10', footprints: 0 }];
    expect(fillMissingDays(rows, '2026-07-10', '2026-07-11', 'footprints')).toEqual([
      { day: '2026-07-10', value: 0 },
    ]);
  });
});

describe('extractValues', () => {
  it('수치만 순서대로 뽑는다', () => {
    expect(
      extractValues([
        { day: '2026-07-10', value: 5 },
        { day: '2026-07-11', value: 0 },
      ]),
    ).toEqual([5, 0]);
  });
});

describe('fillMissingBotDays', () => {
  it('두 필드(footprints, bot_footprints)를 함께 0 으로 채운다', () => {
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

  it('rows 가 비어 있으면 전 구간이 0/0 이다', () => {
    expect(fillMissingBotDays([], '2026-07-10', '2026-07-12')).toEqual([
      { day: '2026-07-10', footprints: 0, botFootprints: 0 },
      { day: '2026-07-11', footprints: 0, botFootprints: 0 },
    ]);
  });

  it('bot_footprints 가 footprints 를 넘으면 footprints 로 클램프한다', () => {
    const rows = [{ day: '2026-07-10', footprints: 5, bot_footprints: 9 }];
    expect(fillMissingBotDays(rows, '2026-07-10', '2026-07-11')).toEqual([
      { day: '2026-07-10', footprints: 5, botFootprints: 5 },
    ]);
  });

  it('음수 bot_footprints 는 0 으로 클램프한다', () => {
    const rows = [{ day: '2026-07-10', footprints: 5, bot_footprints: -2 }];
    expect(fillMissingBotDays(rows, '2026-07-10', '2026-07-11')).toEqual([
      { day: '2026-07-10', footprints: 5, botFootprints: 0 },
    ]);
  });

  it('숫자가 아닌 필드는 0 으로 채운다', () => {
    const rows = [{ day: '2026-07-10', footprints: 'x', bot_footprints: null }];
    expect(fillMissingBotDays(rows, '2026-07-10', '2026-07-11')).toEqual([
      { day: '2026-07-10', footprints: 0, botFootprints: 0 },
    ]);
  });
});

describe('toBotFootprintSeries', () => {
  it('BotDayValue 를 봇 발자국 DayValue 시리즈로 투영한다', () => {
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
