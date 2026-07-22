// 날짜 범위 계산을 담당하는 순수 함수 계층입니다. DOM 의존이 없어 vitest 로 단독 검증할 수 있습니다.
//
// 트래커 API 규약: by-day 계열 쿼리의 `to` 는 배타적(exclusive)입니다. 즉 [from, to) 반열린 구간이며
// `to` 당일은 포함되지 않습니다. 프리셋 버튼은 "오늘을 포함한 최근 N일"을 뜻하므로
// from = 오늘-(N-1)일, to = 내일(배타적) 로 계산합니다.

// 배타적 종료일(to)을 가진 날짜 범위입니다. 두 값 모두 로컬 기준 YYYY-MM-DD 문자열입니다.
export interface DateRange {
  from: string;
  to: string;
}

// 로컬 시간대 기준으로 Date 를 YYYY-MM-DD 문자열로 변환합니다. (UTC 가 아니라 로컬 날짜여야 합니다.)
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// YYYY-MM-DD 문자열을 로컬 자정 Date 로 파싱합니다.
// (new Date('2026-07-16') 은 UTC 자정으로 해석되므로 시간대에 따라 하루가 밀립니다. 이를 피하려고 직접 구성합니다.)
export function parseLocalDate(text: string): Date {
  const [year, month, day] = text.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// "오늘을 포함한 최근 presetDays 일"에 해당하는 [from, to) 범위를 계산합니다.
// from = 오늘-(presetDays-1)일, to = 내일(오늘 다음 날, 배타적).
export function computeDateRange(presetDays: number, today: Date): DateRange {
  const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  fromDate.setDate(fromDate.getDate() - (presetDays - 1));

  const toDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  toDate.setDate(toDate.getDate() + 1);

  return { from: formatLocalDate(fromDate), to: formatLocalDate(toDate) };
}

// [from, to) 반열린 구간의 날짜를 하루 간격으로 나열합니다(to 당일은 제외). 월/연 경계를 안전하게 넘어갑니다.
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = parseLocalDate(from);
  const end = parseLocalDate(to);

  // 방어적으로 최대 반복 횟수를 둬 잘못된 입력(무한 루프)을 막습니다.
  let guard = 0;
  while (cursor.getTime() < end.getTime() && guard < 100000) {
    days.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return days;
}

// [from, to) 구간의 날짜 수(=일 수)를 셉니다.
export function countDays(from: string, to: string): number {
  return enumerateDays(from, to).length;
}
