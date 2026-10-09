// 57:44 ~ 1:00:46 내레이션이 시간 순서로 짚는 사건들. 날짜·이름·설명은 모두 내레이션(과 같은 내용의 영상 자막 카드)에 나온 것만 쓴다.
// 축 위치는 2025년 1월 1일부터 센 달 수. 날짜가 달까지만 나오면 그 달 가운데에 둔다.
// 내레이션이 날짜를 말하지 않은 것(클로드의 강세, 코드 레드, GPT-5.2)은 날짜 글자 없이 내레이션의 순서·간격("한 달 뒤")대로만 놓는다.
export const month = (year: number, monthOfYear: number, day = 15) => (year - 2025) * 12 + (monthOfYear - 1) + (day - 1) / 30;

export type Lane = 'openai' | 'rival';
export type Kind = 'release' | 'alarm' | 'incident' | 'closed' | 'stat' | 'today';

export interface Note {
  at: number;
  text: string;
}

export interface TimelineEvent {
  id: string;
  // 축과 카드에 나타나는 시각(내레이션이 그 사건을 말하는 순간).
  at: number;
  date: number;
  // 점 대신 기간(봄, 그 무렵)으로 나타낼 때.
  span?: [number, number];
  lane: Lane;
  kind: Kind;
  // 카드 윗줄(날짜·회사). 비우면 날짜 없이.
  dateLabel: string;
  title: string;
  // 축 이름표. 없으면 title, false 면 축에는 점만(카드 전용).
  label?: string | false;
  // 축 이름표 줄: 전체 보기 / 확대 보기(2026년 7~9월).
  row: number;
  zoomRow?: number;
  notes: Note[];
}

export const events: TimelineEvent[] = [
  {
    id: 'gpt5', at: 3464.8, date: month(2025, 8, 7), lane: 'openai', kind: 'release', dateLabel: '2025.8.7', title: 'GPT-5', row: 0,
    notes: [
      { at: 3465.6, text: 'ChatGPT 주간 사용자 7억 명' },
      { at: 3467.9, text: 'ChatGPT가 나온 지 3년이 채 안 됐을 때' },
    ],
  },
  {
    id: 'claude', at: 3471.5, date: month(2025, 9, 15), span: [month(2025, 8, 1), month(2025, 11, 1)], lane: 'rival', kind: 'release', dateLabel: '앤트로픽', title: '클로드', label: '클로드 · 코딩 에이전트 강세', row: 1,
    notes: [{ at: 3472.3, text: '코딩 에이전트 분야에서 강세' }],
  },
  {
    id: 'gemini3', at: 3475.0, date: month(2025, 11), lane: 'rival', kind: 'release', dateLabel: '2025.11 · 구글', title: 'Gemini 3', row: 0,
    notes: [{ at: 3477.7, text: '여러 평가에서 앞서 나감' }],
  },
  {
    id: 'codeRed', at: 3479.5, date: month(2025, 12, 1), lane: 'openai', kind: 'alarm', dateLabel: '', title: '오픈AI에 코드 레드', label: '코드 레드', row: 0,
    notes: [
      { at: 3481.8, text: '3년 전 ChatGPT 때문에 구글이 울렸던 그 경보' },
      { at: 3485.2, text: '처지가 정반대로 뒤바뀌었다' },
    ],
  },
  {
    id: 'gpt52', at: 3492.4, date: month(2026, 1, 1), lane: 'openai', kind: 'release', dateLabel: '', title: 'GPT-5.2', row: 1,
    notes: [
      { at: 3493.8, text: '코드 레드 한 달 뒤, 서둘러 출시' },
      { at: 3495.7, text: '이때부터 새 모델이 나오는 간격이 눈에 띄게 짧아졌다' },
    ],
  },
  {
    id: 'coding', at: 3499.3, date: month(2026, 2), lane: 'openai', kind: 'release', dateLabel: '2026.2', title: '코딩 전용 모델', row: 0,
    notes: [],
  },
  {
    id: 'gpt54', at: 3502.8, date: month(2026, 3), lane: 'openai', kind: 'release', dateLabel: '2026.3', title: 'GPT-5.4', row: 1,
    notes: [{ at: 3504.6, text: '아주 긴 문서 여러 개를 한 번에 읽는다' }],
  },
  {
    id: 'gpt55', at: 3507.5, date: month(2026, 4, 10), lane: 'openai', kind: 'release', dateLabel: '2026.4', title: 'GPT-5.5', row: 0,
    notes: [
      { at: 3510.0, text: '몇 시간씩 이어지는 긴 작업을 끝까지' },
      { at: 3513.0, text: '거의 매달 새 모델이 나온 셈' },
    ],
  },
  {
    id: 'sora', at: 3517.4, date: month(2026, 4, 20), lane: 'openai', kind: 'closed', dateLabel: '2026.4', title: 'Sora 앱 종료', row: 2,
    notes: [
      { at: 3521.0, text: '영상 생성에 드는 연산 비용에 비해 벌이가 부족(보도)' },
      { at: 3524.4, text: '연산을 어디에 쓸지가 중요한 시대' },
    ],
  },
  {
    id: 'incident', at: 3529.6, date: month(2026, 7, 21), lane: 'openai', kind: 'incident', dateLabel: '2026.7.21 공개', title: '에이전트 탈출 사건', row: 2, zoomRow: 0,
    notes: [
      { at: 3534.7, text: '보안 시험 중이던 에이전트 1,200개쯤이 시험장을 빠져나감' },
      { at: 3538.8, text: '7월, 허깅페이스 서버 침입 · 여러 단계의 해킹을 스스로' },
      { at: 3546.4, text: '7월 21일 오픈AI·허깅페이스가 함께 발표' },
    ],
  },
  {
    id: 'gpt56', at: 3553.0, date: month(2026, 7, 9), lane: 'openai', kind: 'release', dateLabel: '2026.7.9', title: 'GPT-5.6', row: 0, zoomRow: 0,
    notes: [
      { at: 3557.3, text: '처음 붙은 등급: 솔(가장 강함) · 테라(중간) · 루나(싸고 빠름)' },
      { at: 3563.6, text: '미국 정부 요청으로 일부 파트너에게 먼저' },
      { at: 3570.8, text: '7월 9일에야 정식 출시' },
    ],
  },
  {
    id: 'work', at: 3573.6, date: month(2026, 7, 9), lane: 'openai', kind: 'release', dateLabel: '2026.7.9', title: 'ChatGPT Work', row: 1, zoomRow: 1,
    notes: [{ at: 3574.4, text: '같은 날 · 몇 시간씩 업무를 맡아 처리' }],
  },
  {
    id: 'astra', at: 3578.3, date: month(2026, 9, 3), lane: 'openai', kind: 'release', dateLabel: '2026.9.3', title: 'GPT-6 아스트라', row: 0, zoomRow: 0,
    notes: [
      { at: 3582.4, text: '한 번에 100만 토큰 넘게 · 브록먼 "AGI 시대의 시작"' },
      { at: 3592.8, text: '사이버 보안 관련 요청은 막아 둔 채 출시' },
      { at: 3596.7, text: '여름에 있었던 사건의 그림자' },
    ],
  },
  {
    id: 'solLuna', at: 3598.2, date: month(2026, 9, 22), lane: 'openai', kind: 'release', dateLabel: '2026.9.22', title: 'GPT-6 솔 · 루나', row: 1, zoomRow: 0,
    notes: [{ at: 3599.4, text: '더 싸고 가벼운 모델' }],
  },
  {
    id: 'devDay', at: 3602.9, date: month(2026, 9, 29), lane: 'openai', kind: 'release', dateLabel: '2026.9.29 · 바로 어제', title: '개발자 행사', label: 'GPT-6.1 솔', row: 2, zoomRow: 1,
    notes: [
      { at: 3606.7, text: 'GPT-6.1 솔 발표' },
      { at: 3609.7, text: '아스트라에 가까운 성능을 1/5 가격에' },
    ],
  },
  {
    id: 'astra61', at: 3613.6, date: month(2026, 9, 29), lane: 'openai', kind: 'closed', dateLabel: '2026.9.29', title: 'GPT-6.1 아스트라 불발', label: '6.1 아스트라 불발', row: 3, zoomRow: 2,
    notes: [
      { at: 3619.4, text: '내부 시험에서 사람을 속이려는 성향이 높게 나왔다(보도)' },
      { at: 3623.3, text: '똑똑하게 만드는 것만큼 믿을 수 있게 만드는 게 어려워졌다' },
    ],
  },
  {
    id: 'users', at: 3627.8, date: month(2026, 9, 29), lane: 'openai', kind: 'stat', dateLabel: '2026.9.29 발표', title: 'ChatGPT 주간 사용자 12억 명', label: false, row: 0,
    notes: [{ at: 3629.2, text: '2025년 8월 7억 명에서' }],
  },
  {
    id: 'opus', at: 3633.6, date: month(2026, 9, 22), lane: 'rival', kind: 'release', dateLabel: '2026.9.22 · 앤트로픽', title: 'Claude Opus 5.5', row: 1, zoomRow: 1,
    notes: [{ at: 3632.2, text: '경쟁자들도 바짝 붙어 있다' }],
  },
  {
    id: 'gemini38', at: 3637.9, date: month(2026, 9, 5), lane: 'rival', kind: 'release', dateLabel: '2026.9 초 · 구글', title: 'Gemini 3.8 Flash', row: 0, zoomRow: 0,
    notes: [],
  },
  {
    id: 'deepseek', at: 3640.6, date: month(2026, 4, 15), span: [month(2026, 3, 1), month(2026, 6, 1)], lane: 'rival', kind: 'release', dateLabel: '2026 봄 · 중국', title: 'DeepSeek 새 모델', row: 0,
    notes: [],
  },
  {
    id: 'today', at: 3642.8, date: month(2026, 9, 30), lane: 'openai', kind: 'today', dateLabel: '', title: '오늘의 풍경', label: false, row: 0,
    notes: [{ at: 3643.6, text: '퍼셉트론이 나온 지 70년 가까이' }],
  },
];

// 전체 보기(2025년 7월 ~ 2026년 10월)와 확대 보기(2026년 7~9월).
export const fullView = { from: month(2025, 7, 10), to: month(2026, 10, 20) };
export const zoomView = { from: month(2026, 6, 25), to: month(2026, 10, 8) };

// "2026년, 바로 지금"과 "거의 매달 새 모델".
export const yearAt = 3487.9;
export const monthlyAt = 3513.0;
export const monthlySpan: [number, number] = [month(2026, 1, 1), month(2026, 4, 10)];
// 마지막 "오늘의 풍경": 모든 사건을 다시 밝힌다.
export const landscapeAt = 3642.8;
