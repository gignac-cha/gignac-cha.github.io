// by-day 계열 응답의 빈 날(발자국 0인 날)을 0 으로 메우는 순수 함수 계층입니다.
//
// 트래커 규약: footprints-by-day / unique-visitors-by-day 의 rows 는 값이 0 인 날을 아예 생략합니다(GAPS).
// 차트가 끊기지 않도록 [from, to) 모든 날을 채우고, 응답에 없는 날은 0 으로 둡니다.

import { enumerateDays } from './date-ranges.ts';

// 날짜 하나에 대응하는 수치 한 개입니다.
export interface DayValue {
  day: string;
  value: number;
}

// rows(빈 날 생략 가능)를 [from, to) 전 구간에 대해 { day, value } 배열로 채웁니다.
// - valueKey: 각 row 에서 수치를 읽을 필드명(예: 'footprints', 'visitors').
// - 응답에 없는 날 또는 수치가 숫자가 아닌 날은 0 으로 채웁니다.
export function fillMissingDays(
  rows: ReadonlyArray<object>,
  from: string,
  to: string,
  valueKey: string,
): DayValue[] {
  const valueByDay = new Map<string, number>();

  for (const row of rows) {
    // 타입이 다른 row 형(FootprintsByDayRow 등)도 받도록 느슨하게 인덱싱합니다.
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

// DayValue 배열에서 수치만 뽑습니다(차트 지오메트리 입력용).
export function extractValues(dayValues: ReadonlyArray<DayValue>): number[] {
  return dayValues.map((dayValue) => dayValue.value);
}

// bots-by-day 의 두 필드(footprints, bot_footprints)를 한 번에 채운 값입니다.
export interface BotDayValue {
  day: string;
  footprints: number;
  botFootprints: number;
}

// bots-by-day rows(빈 날 생략 가능)를 [from, to) 전 구간에 대해 두 필드를 함께 0 으로 채웁니다.
// bot_footprints <= footprints 규약을 방어적으로 클램프합니다(잘못된 데이터가 비율을 100% 넘기지 않도록).
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
      // 봇 수가 총합을 넘지 않도록 클램프합니다(0..footprints).
      botFootprints: Math.min(Math.max(0, rawBot), Math.max(0, footprints)),
    };
  });
}

// BotDayValue 배열을 봇 발자국 시리즈(DayValue) 로 투영합니다(차트 3번째 시리즈용).
export function toBotFootprintSeries(botDayValues: ReadonlyArray<BotDayValue>): DayValue[] {
  return botDayValues.map((botDayValue) => ({ day: botDayValue.day, value: botDayValue.botFootprints }));
}
