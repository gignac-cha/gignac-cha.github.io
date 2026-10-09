import './residual-network.scss';
import { appear, between, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';

// 29:42 "그런데 여기서 이상한 일이" ~ 31:26 "믿기 힘든 속도였죠".
const start = 1782.2;
const end = 1886.6;

const at = {
  deeper: 1785.8, // 쉰 개 넘게 늘려봤습니다
  worse: 1787.9, // 오히려 성적이 떨어진 거예요
  practice: 1790.6, // 연습 문제 성적까지 나빠졌습니다
  notOverfit: 1793.6, // 외우는 것조차 못 한다는 뜻이니
  overfitNo: 1796.0, // 단순한 과적합이 아니었죠
  why: 1797.6, // 도대체 왜
  game: 1801.4, // 긴 줄로 늘어선 사람들이 귓속말 전달 놀이
  ten: 1804.5, // 10명까지는 말이 그럭저럭 전해져요
  hundred: 1807.6, // 그런데 100명이 되면
  garbled: 1809.6, // 엉망이 됩니다
  back: 1810.6, // 거꾸로 틀린 점을 앞사람에게 알려 주는 것도
  vanishing: 1815.2, // 기울기 소실이 다시 발목을 잡은 겁니다
  lab: 1817.8, // 2015년 중국 베이징의 마이크로소프트 리서치 아시아
  block: 1824.9, // 그들의 해법은
  skip: 1827.2, // 층을 건너뛰는 지름길
  whole: 1830.5, // 입력을 통째로 새로 만들 필요가 없어요
  add: 1832.6, // 받은 입력에 조금만 고칠 부분을 더해서 넘기면
  residual: 1836.9, // 잔차라고 불러요
  name: 1838.3, // 그래서 이름이 잔차 신경망
  resnet: 1839.6, // 레즈넷입니다
  stairs: 1840.8, // 계단을 오를 때를 떠올려 보세요
  elevator: 1843.2, // 엘리베이터가 붙어 있는 건물
  oneByOne: 1845.4, // 굳이 한 계단씩 오르지 않아도
  straight: 1846.9, // 신호가 곧장 위로 올라갈 수 있어요
  idle: 1849.3, // 어떤 층이 할 일이 없으면
  pass: 1850.6, // 그냥 그대로 통과시키면
  noLoss: 1852.5, // 층을 더 쌓아도 적어도 손해는 보지 않게
  experiment: 1855.8, // 반신반의하며 실험을 돌렸습니다
  result: 1857.8, // 결과는 누구도 예상 못 할 만큼 압도적
  layers152: 1860.7, // 레즈넷은 무려 152층까지
  alexnet: 1863.8, // 알렉스넷보다 스무 배 가까이
  error: 1867.3, // 이미지넷 대회 오류율은 3.5%대
  human: 1870.5, // 사람의 오류율은 5% 안팎
  measured: 1873.7, // 한 연구자가 직접 이미지넷 문제를 풀어서 잰 값
  better: 1877.4, // 기계가 사람보다 사진을 더 잘 맞힌 셈
  narrow: 1880.4, // 천 가지 분류라는 좁은 시험
  past: 1884.8, // 불과 3년 전 26%를 떠올리면
};

// 장면 안의 단계. 앞 단계는 사라지고 다음 단계가 나타난다.
const phases = {
  deeper: { from: start, to: at.why + 1.5 },
  whisper: { from: at.why + 1.5, to: at.block },
  block: { from: at.block, to: at.stairs },
  building: { from: at.stairs, to: at.experiment },
  cifar: { from: at.experiment, to: at.layers152 },
  imagenet: { from: at.layers152, to: end + 1 },
};
const visible = (time: number, { from, to }: { from: number; to: number }) => appear(time, from, .5) * (1 - appear(time, to - .5, .5));

const captions: Array<[number, string]> = [
  [start, '층을 더 쌓았더니'],
  [at.worse, '오히려 시험 성적이 떨어졌다'],
  [at.practice, '연습 문제 성적까지 나빠졌다'],
  [at.notOverfit, '외우는 것조차 못 한다 → 과적합이 아니다'],
  [at.why, '도대체 왜?'],
  [at.game, '귓속말 전달 놀이'],
  [at.ten, '10명: 그럭저럭 전해진다'],
  [at.hundred, '100명: 끝에 도착한 말은 엉망'],
  [at.back, '틀린 점을 거꾸로 알려 주기도 어렵다'],
  [at.vanishing, '기울기 소실이 다시 발목을 잡았다'],
  [at.lab, '2015년 · 마이크로소프트 리서치 아시아'],
  [at.skip, '해법: 층을 건너뛰는 지름길'],
  [at.whole, '입력을 통째로 새로 만들 필요 없이'],
  [at.add, '받은 입력에 고칠 부분만 더해 넘긴다'],
  [at.residual, '조금 고칠 부분 = 잔차'],
  [at.name, '그래서 붙은 이름'],
  [at.stairs, '계단 옆에 엘리베이터가 붙은 건물'],
  [at.straight, '신호가 곧장 위로'],
  [at.idle, '할 일이 없는 층은 그대로 통과'],
  [at.noLoss, '더 쌓아도 적어도 손해는 없다'],
  [at.experiment, '반신반의하며 돌린 실험'],
  [at.result, '깊을수록 오히려 좋아졌다'],
  [at.layers152, '152층'],
  [at.error, '이미지넷 대회 오류율 3.57%'],
  [at.human, '사람은 5% 안팎'],
  [at.better, '사람보다 사진을 더 잘 맞혔다'],
  [at.narrow, '1,000가지 분류라는 좁은 시험에서'],
  [at.past, '불과 3년 전엔 26%대'],
];
const captionAt = (time: number) => {
  let current = '';
  for (const [from, content] of captions) {
    if (from <= time) {
      current = content;
    }
  }
  return current;
};

const setText = (element: Element, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

// ── 1. 층을 늘렸더니: 층 더미 두 개와 오류 곡선 두 개 ───────────────────────────────
const stack = { bottom: 800, pitch: 10, width: 112 };
const stackX = { shallow: 150, deep: 300 };

// 곡선 모양은 He et al. 2015 그림 1(CIFAR-10, 20층과 56층)을 따른다. 눈금 수치는 넣지 않는다.
// 학습률을 줄이는 두 지점(전체의 절반, 3/4)에서 오류가 한 번씩 뚝 떨어진다.
const curve = (x: number, plateaus: [number, number, number]) => {
  const decay = Math.exp(-x / .06);
  const [first, second, third] = plateaus;
  const settled = x < .5 ? first : x < .75 ? lerp(first, second, ease(progress(x, .5, .03))) : lerp(second, third, ease(progress(x, .75, .03)));
  return settled + (.95 - first) * decay;
};
const charts = [
  { key: 'test', title: '시험', subtitle: '처음 보는 문제', left: 560, at: at.worse, lines: { shallow: [.5, .34, .31], deep: [.6, .45, .42] } },
  { key: 'practice', title: '연습 문제', subtitle: '학습에 쓴 문제', left: 1060, at: at.practice, lines: { shallow: [.42, .12, .08], deep: [.52, .25, .22] } },
] as const;
const chartBox = { top: 250, height: 380, width: 420 };

// ── 2. 귓속말 전달 놀이 ──────────────────────────────────────────────────────
// 모두 한 줄로 선다. 10명일 때는 크게 보이다가, "100명이 되면" 화면이 뒤로 물러나며 같은 줄이 100명으로 길어진다.
const whisperRow = { y: 540, first10: 220, last10: 1380, first100: 70, last100: 1530 };
const pitch10 = (whisperRow.last10 - whisperRow.first10) / 9;
const pitch100 = (whisperRow.last100 - whisperRow.first100) / 99;
// grow 0 → 1: 사람 사이 간격은 화면을 물리듯 지수적으로 좁아지고, 사람도 작아진다.
const whisperLine = (grow: number) => ({
  first: lerp(whisperRow.first10, whisperRow.first100, grow),
  pitch: pitch10 * (pitch100 / pitch10) ** grow,
  scale: lerp(1, .34, grow),
});
const person = { head: -40, headRadius: 13 };
const message = '오늘 저녁은 김치찌개';
const arrived10 = '오늘 저녁은 김치찌게';
const arrived100 = '오른쪽 저 거기 찍게?';
// 말이 사람을 거칠 때마다 조금씩 바뀐다. heard: [줄에서 지나온 비율, 그때 들리는 말]
interface Run {
  from: number;
  duration: number;
  until: number;
  count: number;
  garble: number;
  line: ReturnType<typeof whisperLine>;
  heard: Array<[number, string]>;
}
const runs: Run[] = [
  { from: at.ten - .2, duration: 1.8, until: at.hundred, count: 10, garble: .3, line: whisperLine(0), heard: [[0, message], [.7, arrived10]] },
  {
    from: at.hundred + .8,
    duration: 1.2,
    until: at.back,
    count: 100,
    garble: 1,
    line: whisperLine(1),
    heard: [[0, message], [.25, arrived10], [.5, '오늘 저녁 김치 찍게'], [.75, arrived100]],
  },
];

// ── 3. 잔차 블록 ────────────────────────────────────────────────────────────
const block = { y: 500, input: 230, layer1: 520, layer2: 790, plus: 1060, output: 1320, arc: 290 };
const vectors = {
  input: [.8, .3, .5],
  residual: [.1, 0, -.1],
  output: [.9, .3, .4],
};

// ── 4. 엘리베이터가 붙은 건물 ─────────────────────────────────────────────────
// 한 층 = 계단 한 줄. 디딤판이 단 높이의 1.6배쯤인 보통 계단 비율로 그린다.
const floor = { height: 62, left: 600, steps: 6, tread: 17, shaftX: 820, shaftWidth: 64, bottom: 800 };
const stairsX = floor.left + 24;
const stairsWidth = floor.steps * floor.tread;
const baseFloors = 6;
const extraFloors = 3;
const idleFloor = 2;

// ── 5. CIFAR-10 결과 (He et al. 2015 표 6, 시험 오류) ──────────────────────────
const cifar = [
  { label: '20층', value: 8.75 },
  { label: '56층', value: 6.97 },
  { label: '110층', value: 6.43 },
];
const cifarChart = { left: 520, baseline: 720, top: 260, max: 10, pitch: 220, width: 140 };

// ── 6. 152층과 이미지넷 오류율 ───────────────────────────────────────────────
// 다섯 번 안에 못 맞힌 비율. 2012년 26%대는 앞 장면(이미지넷 대회 오류율)의 2등 팀,
// 사람 5.1%는 한 연구자(안드레이 카파시)가 직접 풀어 잰 값, 3.57%는 ILSVRC 2015 ResNet.
const errorBars = [
  { key: 'past', label: '2012년', note: '기존 방식', value: 26.2, display: '26%대', at: at.past },
  { key: 'human', label: '사람', note: '직접 풀어 잰 값', value: 5.1, display: '5.1%', at: at.human },
  { key: 'resnet', label: 'ResNet', note: '2015년', value: 3.57, display: '3.57%', at: at.error },
] as const;
const errorChart = { left: 860, baseline: 760, top: 320, max: 30, pitch: 210, width: 130 };
const errorY = (value: number) => errorChart.baseline - (value / errorChart.max) * (errorChart.baseline - errorChart.top);
const tallStack = { bottom: 790, height: 520, alexX: 170, resX: 420, width: 150 };

const createResidualNetwork = () => {
  const { element, root } = createDiagram('residual-network', '잔차 신경망(ResNet)');
  const caption = createSwapText(root, 800, 140, { class: 'resnet-caption' });

  // 1. 층 더미와 곡선
  const deeper = svg('g', { opacity: 0 }, root);
  const shallowLayers = Array.from({ length: 20 }, (_, i) =>
    svg('rect', { class: 'resnet-layer shallow', x: stackX.shallow, y: stack.bottom - (i + 1) * stack.pitch, width: stack.width, height: stack.pitch - 3, rx: 2 }, deeper),
  );
  const deepLayers = Array.from({ length: 56 }, (_, i) =>
    svg('rect', { class: 'resnet-layer deep', x: stackX.deep, y: stack.bottom - (i + 1) * stack.pitch, width: stack.width, height: stack.pitch - 3, rx: 2, opacity: 0 }, deeper),
  );
  text(deeper, stackX.shallow + stack.width / 2, stack.bottom + 44, '20층', { class: 'resnet-stack-label shallow' });
  const deepLabel = text(deeper, stackX.deep + stack.width / 2, stack.bottom + 44, '56층', { class: 'resnet-stack-label deep', opacity: 0 });

  const chartGroups = charts.map((chart) => {
    const group = svg('g', { opacity: 0 }, deeper);
    const right = chart.left + chartBox.width;
    const bottom = chartBox.top + chartBox.height;
    text(group, chart.left, chartBox.top - 48, chart.title, { class: 'resnet-chart-title' });
    text(group, chart.left + 12 + chart.title.length * 32, chartBox.top - 48, chart.subtitle, { class: 'resnet-chart-subtitle' });
    svg('path', { class: 'resnet-axis', d: `M${chart.left},${chartBox.top - 10}V${bottom}H${right}` }, group);
    text(group, chart.left - 14, chartBox.top + 10, '오류', { class: 'resnet-axis-label', 'text-anchor': 'end' });
    text(group, right, bottom + 36, '학습 →', { class: 'resnet-axis-label', 'text-anchor': 'end' });
    const paths = (['shallow', 'deep'] as const).map((key) => {
      const points = Array.from({ length: 121 }, (_, i) => {
        const x = i / 120;
        return `${(chart.left + x * chartBox.width).toFixed(1)},${(bottom - curve(x, chart.lines[key] as unknown as [number, number, number]) * chartBox.height).toFixed(1)}`;
      });
      const path = svg('path', { class: `resnet-curve ${key}`, d: `M${points.join('L')}`, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, group);
      const endY = bottom - curve(1, chart.lines[key] as unknown as [number, number, number]) * chartBox.height;
      const label = text(group, right + 14, endY + 9, key === 'shallow' ? '20층' : '56층', { class: `resnet-curve-label ${key}`, opacity: 0 });
      return { key, path, label };
    });
    return { chart, group, paths };
  });
  const verdict = svg('g', { opacity: 0 }, deeper);
  text(verdict, 1270, 720, '연습 문제도 못 푼다', { class: 'resnet-verdict' });
  const overfit = svg('g', { opacity: 0 }, verdict);
  svg('rect', { class: 'resnet-tag', x: 1170, y: 748, width: 200, height: 52, rx: 26 }, overfit);
  text(overfit, 1270, 784, '과적합 ✕', { class: 'resnet-tag-text' });

  // 2. 귓속말 전달 놀이
  const whisper = svg('g', { opacity: 0 }, root);
  const people = Array.from({ length: 100 }, () => {
    const group = svg('g', {}, whisper);
    const body = svg('path', { class: 'resnet-person', d: 'M-20,0C-20,-26 20,-26 20,0Z' }, group);
    const head = svg('circle', { class: 'resnet-person', cy: person.head, r: person.headRadius }, group);
    return { group, parts: [body, head] };
  });
  // 줄 아래 괄호와 인원 수: 줄이 길어지는 것을 보여 준다.
  const lineBracket = svg('path', { class: 'resnet-line-bracket' }, whisper);
  const lineCount = text(whisper, 800, whisperRow.y + 74, '', { class: 'resnet-line-count' });
  // 말을 들고 줄을 따라 가는 자리와 그때 들리는 말.
  const travelText = text(whisper, 0, 0, '', { class: 'resnet-travel-text' });
  const firstBubble = svg('g', { opacity: 0 }, whisper);
  svg('rect', { class: 'resnet-bubble', x: 120, y: 240, width: 340, height: 64, rx: 20 }, firstBubble);
  text(firstBubble, 290, 282, message, { class: 'resnet-bubble-text' });
  const lastBubble = svg('g', { opacity: 0 }, whisper);
  const lastRect = svg('rect', { class: 'resnet-bubble', x: 1140, y: 240, width: 340, height: 64, rx: 20 }, lastBubble);
  const lastText = text(lastBubble, 1310, 282, '', { class: 'resnet-bubble-text' });
  const runner = svg('circle', { class: 'resnet-runner', r: 0 }, whisper);
  const backRunner = svg('circle', { class: 'resnet-back-runner', r: 0 }, whisper);
  const backNote = text(whisper, 800, 760, '"틀렸어!"가 앞사람에게 갈수록 흐려진다', { class: 'resnet-back-note', opacity: 0 });

  // 3. 잔차 블록
  const residualBlock = svg('g', { opacity: 0 }, root);
  const blockBox = (x: number, label: string, className: string) => {
    const group = svg('g', {}, residualBlock);
    svg('rect', { class: `resnet-box ${className}`, x: x - 90, y: block.y - 48, width: 180, height: 96, rx: 18 }, group);
    text(group, x, block.y + 11, label, { class: 'resnet-box-text' });
    return group;
  };
  blockBox(block.input, '입력 x', 'io');
  blockBox(block.layer1, '층', 'layer');
  blockBox(block.layer2, '층', 'layer');
  blockBox(block.output, '출력', 'io');
  svg('path', { class: 'resnet-flow', d: `M${block.input + 90},${block.y}H${block.layer1 - 90}M${block.layer1 + 90},${block.y}H${block.layer2 - 90}M${block.layer2 + 90},${block.y}H${block.plus - 34}M${block.plus + 34},${block.y}H${block.output - 90}` }, residualBlock);
  svg('circle', { class: 'resnet-plus', cx: block.plus, cy: block.y, r: 34 }, residualBlock);
  text(residualBlock, block.plus, block.y + 14, '+', { class: 'resnet-plus-text' });
  const skipArc = svg('path', {
    class: 'resnet-skip',
    d: `M${block.input},${block.y - 48}C${block.input},${block.arc - 40} ${block.plus},${block.arc - 40} ${block.plus},${block.y - 34}`,
    pathLength: 1,
    'stroke-dasharray': '1 1',
    'stroke-dashoffset': 1,
  }, residualBlock);
  const skipLabel = text(residualBlock, (block.input + block.plus) / 2, block.arc - 20, '지름길: 입력을 그대로', { class: 'resnet-skip-label', opacity: 0 });
  const residualLabel = createSwapText(residualBlock, (block.layer1 + block.layer2) / 2, block.y + 100, { class: 'resnet-residual-label' });
  const strike = svg('g', { opacity: 0 }, residualBlock);
  text(strike, (block.layer1 + block.layer2) / 2, block.y - 80, '통째로 새로 만들기', { class: 'resnet-strike-text' });
  svg('line', { class: 'resnet-strike-line', x1: (block.layer1 + block.layer2) / 2 - 140, y1: block.y - 90, x2: (block.layer1 + block.layer2) / 2 + 140, y2: block.y - 90 }, strike);
  // 숫자 세 개짜리 예: 입력 + 고칠 부분 = 출력.
  const vectorGroup = (x: number, values: number[], className: string, signed: boolean) => {
    const group = svg('g', { opacity: 0 }, residualBlock);
    values.forEach((value, i) => {
      const y = block.y + 170 + i * 46;
      svg('rect', { class: `resnet-chip ${className}`, x: x - 70, y: y - 30, width: 140, height: 40, rx: 10 }, group);
      text(group, x, y - 2, signed ? (value > 0 ? `+${value.toFixed(1)}` : value < 0 ? `−${Math.abs(value).toFixed(1)}` : '0') : value.toFixed(1), { class: 'resnet-chip-text' });
    });
    return group;
  };
  const inputVector = vectorGroup(block.input, vectors.input, 'io', false);
  const residualVector = vectorGroup((block.layer1 + block.layer2) / 2, vectors.residual, 'residual', true);
  const outputVector = vectorGroup(block.output, vectors.output, 'io', false);
  const operators = svg('g', { opacity: 0 }, residualBlock);
  text(operators, (block.input + (block.layer1 + block.layer2) / 2) / 2, block.y + 200, '+', { class: 'resnet-operator' });
  text(operators, ((block.layer1 + block.layer2) / 2 + block.output) / 2, block.y + 200, '=', { class: 'resnet-operator' });
  const nameGroup = svg('g', { opacity: 0 }, residualBlock);
  const nameText = createSwapText(nameGroup, 800, 850, { class: 'resnet-name' });
  const pulse = svg('circle', { class: 'resnet-pulse', r: 0 }, residualBlock);
  const skipPulse = svg('circle', { class: 'resnet-pulse skip', r: 0 }, residualBlock);

  // 4. 건물
  const building = svg('g', { opacity: 0 }, root);
  const floors = Array.from({ length: baseFloors + extraFloors }, (_, i) => {
    const group = svg('g', {}, building);
    const y = floor.bottom - (i + 1) * floor.height;
    svg('rect', { class: 'resnet-floor', x: floor.left, y, width: floor.shaftX + floor.shaftWidth + 30 - floor.left, height: floor.height }, group);
    // 계단: 한 층을 오르는 계단 한 줄. 디딤판 아래를 채워 계단 덩어리로 보이게 한다.
    const stepHeight = floor.height / floor.steps;
    let d = `M${stairsX},${y + floor.height}`;
    for (let s = 0; s < floor.steps; s++) {
      d += `V${y + floor.height - (s + 1) * stepHeight}H${stairsX + (s + 1) * floor.tread}`;
    }
    d += `V${y + floor.height}Z`;
    const stairs = svg('path', { class: 'resnet-stairs', d }, group);
    // 할 일 없는 층의 설명은 건물 왼쪽에 붙인다.
    const idle = text(group, floor.left - 18, y + floor.height / 2 + 8, '', { class: 'resnet-idle-text' });
    return { group, y, stairs, idle };
  });
  const shaft = svg('rect', { class: 'resnet-shaft', x: floor.shaftX, width: floor.shaftWidth }, building);
  const car = svg('rect', { class: 'resnet-car', x: floor.shaftX + 6, width: floor.shaftWidth - 12, height: floor.height - 14, rx: 6 }, building);
  const stairsPulse = svg('circle', { class: 'resnet-pulse stairs', r: 0 }, building);
  const buildingNotes = svg('g', {}, building);
  const stairsNote = text(buildingNotes, stairsX + stairsWidth / 2, floor.bottom + 46, '계단 = 층', { class: 'resnet-building-label' });
  const shaftNote = text(buildingNotes, floor.shaftX + floor.shaftWidth / 2, floor.bottom + 46, '엘리베이터 = 지름길', { class: 'resnet-building-label skip' });
  // 오른쪽: 신호 세기 비교.
  const meters = svg('g', { opacity: 0 }, building);
  text(meters, 1080, 330, '꼭대기에 닿는 신호', { class: 'resnet-meter-title' });
  const meterRows = [
    { label: '계단만', className: 'stairs', y: 400 },
    { label: '엘리베이터', className: 'skip', y: 480 },
  ].map((row) => {
    text(meters, 1080, row.y + 8, row.label, { class: 'resnet-meter-label' });
    svg('rect', { class: 'resnet-meter-track', x: 1240, y: row.y - 18, width: 260, height: 28, rx: 14 }, meters);
    const bar = svg('rect', { class: `resnet-meter ${row.className}`, x: 1240, y: row.y - 18, width: 0, height: 28, rx: 14 }, meters);
    return { ...row, bar };
  });
  const noLossNote = text(building, 1290, 640, '+3층 · 적어도 손해 없음', { class: 'resnet-noloss', opacity: 0 });

  // 5. CIFAR-10
  const cifarGroup = svg('g', { opacity: 0 }, root);
  text(cifarGroup, cifarChart.left, cifarChart.top - 50, 'CIFAR-10 시험 오류 · 지름길을 붙인 신경망', { class: 'resnet-chart-title small' });
  svg('line', { class: 'resnet-baseline', x1: cifarChart.left - 30, y1: cifarChart.baseline, x2: cifarChart.left + cifarChart.pitch * 2 + cifarChart.width + 30, y2: cifarChart.baseline }, cifarGroup);
  const cifarBars = cifar.map((item, i) => {
    const x = cifarChart.left + i * cifarChart.pitch;
    const bar = svg('rect', { class: 'resnet-cifar-bar', x, y: cifarChart.baseline, width: cifarChart.width, height: 0, rx: 8 }, cifarGroup);
    text(cifarGroup, x + cifarChart.width / 2, cifarChart.baseline + 44, item.label, { class: 'resnet-bar-label' });
    const value = text(cifarGroup, x + cifarChart.width / 2, cifarChart.baseline - 16, `${item.value}%`, { class: 'resnet-bar-value', opacity: 0 });
    return { item, bar, value };
  });
  const cifarArrow = text(cifarGroup, cifarChart.left + cifarChart.pitch * 3 + 40, cifarChart.baseline - 160, '깊을수록 ↓', { class: 'resnet-better', opacity: 0 });

  // 6. 152층과 이미지넷
  const imagenet = svg('g', { opacity: 0 }, root);
  const resPitch = tallStack.height / 152;
  const resLayers = Array.from({ length: 152 }, (_, i) =>
    svg('rect', { class: 'resnet-layer deep', x: tallStack.resX, y: tallStack.bottom - (i + 1) * resPitch, width: tallStack.width, height: Math.max(resPitch - .7, 1.2), opacity: 0 }, imagenet),
  );
  const alexGroup = svg('g', { opacity: 0 }, imagenet);
  for (let i = 0; i < 8; i++) {
    svg('rect', { class: 'resnet-layer alex', x: tallStack.alexX, y: tallStack.bottom - (i + 1) * resPitch, width: tallStack.width, height: Math.max(resPitch - .7, 1.2) }, alexGroup);
  }
  text(alexGroup, tallStack.alexX + tallStack.width / 2, tallStack.bottom + 44, 'AlexNet 8층', { class: 'resnet-stack-label alex' });
  const ratio = text(alexGroup, tallStack.alexX + tallStack.width / 2, tallStack.bottom - 70, '약 19배 →', { class: 'resnet-ratio', opacity: 0 });
  const resCount = text(imagenet, tallStack.resX + tallStack.width / 2, tallStack.bottom + 44, '', { class: 'resnet-stack-label deep' });

  const errorGroup = svg('g', { opacity: 0 }, imagenet);
  text(errorGroup, errorChart.left - 30, errorChart.top - 60, '이미지넷 · 다섯 번 안에 못 맞힌 비율', { class: 'resnet-chart-title small' });
  const narrowNote = text(errorGroup, errorChart.left - 30, errorChart.top - 22, '1,000가지 분류 시험', { class: 'resnet-chart-subtitle', opacity: 0 });
  svg('line', { class: 'resnet-baseline', x1: errorChart.left - 30, y1: errorChart.baseline, x2: errorChart.left + errorChart.pitch * 2 + errorChart.width + 30, y2: errorChart.baseline }, errorGroup);
  const humanLine = svg('line', { class: 'resnet-human-line', x1: errorChart.left - 30, x2: errorChart.left + errorChart.pitch * 2 + errorChart.width + 60, y1: errorY(5.1), y2: errorY(5.1), opacity: 0 }, errorGroup);
  const errorItems = errorBars.map((item, i) => {
    const x = errorChart.left + i * errorChart.pitch;
    const group = svg('g', { opacity: 0 }, errorGroup);
    const bar = svg('rect', { class: `resnet-error-bar ${item.key}`, x, y: errorChart.baseline, width: errorChart.width, height: 0, rx: 8 }, group);
    text(group, x + errorChart.width / 2, errorChart.baseline + 42, item.label, { class: 'resnet-bar-label' });
    const note = text(group, x + errorChart.width / 2, errorChart.baseline + 76, item.note, { class: 'resnet-bar-note' });
    const value = text(group, x + errorChart.width / 2, errorY(item.value) - 16, item.display, { class: `resnet-bar-value ${item.key}` });
    return { item, group, bar, note, value };
  });

  const update = (time: number) => {
    caption.update(time, captionAt);

    // 1. 층을 늘렸더니
    setAttributes(deeper, { opacity: visible(time, phases.deeper).toFixed(3) });
    shallowLayers.forEach((layer, i) => setAttributes(layer, { opacity: appear(time, start + i * .02, .2).toFixed(3) }));
    deepLayers.forEach((layer, i) => setAttributes(layer, { opacity: appear(time, at.deeper - 1.2 + i * .025, .2).toFixed(3) }));
    setAttributes(deepLabel, { opacity: appear(time, at.deeper, .3).toFixed(3) });
    chartGroups.forEach(({ chart, group, paths }) => {
      setAttributes(group, { opacity: appear(time, chart.at - .3, .4).toFixed(3) });
      paths.forEach(({ key, path, label }) => {
        const drawn = ease(progress(time, chart.at + (key === 'deep' ? .25 : 0), 1.3));
        setAttributes(path, { 'stroke-dashoffset': (1 - drawn).toFixed(4) });
        setAttributes(label, { opacity: appear(time, chart.at + 1.3 + (key === 'deep' ? .25 : 0), .3).toFixed(3) });
      });
    });
    setAttributes(verdict, { opacity: appear(time, at.notOverfit, .4).toFixed(3) });
    setAttributes(overfit, { opacity: appear(time, at.overfitNo, .4).toFixed(3) });
    chartGroups[1].group.classList.toggle('highlight', time >= at.notOverfit);

    // 2. 귓속말: 한 줄로 선 10명. "100명이 되면" 화면이 뒤로 물러나며 같은 줄이 100명으로 길어진다.
    setAttributes(whisper, { opacity: (visible(time, phases.whisper) * (time >= at.lab ? lerp(1, .25, appear(time, at.lab, .6)) : 1)).toFixed(3) });
    const grow = ease(progress(time, at.hundred, .8));
    const line = whisperLine(grow);
    // 지금 말을 전하는 중인(또는 막 전한) 줄: 들은 사람은 노랑에서, 말이 엉망이 될수록 빨강으로 물든다.
    const run = runs.find((candidate) => time >= candidate.from && time < candidate.until);
    const reached = run ? clamp((time - run.from) / run.duration, 0, 1) * (run.count - 1) : -1;
    people.forEach(({ group, parts }, i) => {
      const x = line.first + i * line.pitch;
      // 처음 10명은 차례로 나타나고, 나머지 90명은 화면이 물러날 때 오른쪽에서 줄을 잇는다.
      const shown = i < 10 ? appear(time, at.game + i * .06, .3) : clamp(grow * 4, 0, 1);
      setAttributes(group, {
        transform: `translate(${x.toFixed(1)},${whisperRow.y}) scale(${line.scale.toFixed(3)})`,
        opacity: shown.toFixed(3),
        'stroke-width': lerp(3, 1.5, grow).toFixed(2),
      });
      const heard = run && i < run.count && i <= reached;
      const red = heard ? Math.round(((i / (run.count - 1)) * run.garble * 100) / 5) * 5 : 0;
      const style = heard ? `fill: color-mix(in srgb, var(--diagram-red) ${red}%, var(--diagram-yellow)); stroke: none` : '';
      parts.forEach((part) => setAttributes(part, { style }));
    });
    // 괄호는 지금 줄에 선 사람(오른쪽에서 이어 붙는 사람 포함)을 감싼다.
    const lastIndex = lerp(9, 99, clamp(grow * 4, 0, 1));
    const lineFirst = line.first - 24 * line.scale;
    const lineLast = line.first + lastIndex * line.pitch + 24 * line.scale;
    const bracketY = whisperRow.y + 22;
    setAttributes(lineBracket, { d: `M${lineFirst.toFixed(1)},${bracketY - 10}V${bracketY}H${Math.min(lineLast, 1560).toFixed(1)}V${bracketY - 10}` });
    setText(lineCount, grow > .5 ? '100명 · 한 줄' : '10명 · 한 줄');
    setAttributes(lineCount, { x: ((lineFirst + Math.min(lineLast, 1560)) / 2).toFixed(1) });
    setAttributes(firstBubble, { opacity: appear(time, at.game + .6, .3).toFixed(3) });
    // 말이 전해지는 자리와 그 순간 들리는 말.
    const moving = run && reached >= 0 && time - run.from < run.duration;
    if (run && moving) {
      const x = run.line.first + reached * run.line.pitch;
      const headY = whisperRow.y + (person.head - person.headRadius) * run.line.scale;
      setAttributes(runner, { cx: x.toFixed(1), cy: (whisperRow.y + person.head * run.line.scale).toFixed(1), r: run.count === 10 ? 10 : 7 });
      const u = reached / (run.count - 1);
      const stage = run.heard.reduce((index, [from], candidate) => (u >= from ? candidate : index), 0);
      setText(travelText, run.heard[stage][1]);
      travelText.classList.toggle('garbled', run.count === 100 && stage >= 2);
      setAttributes(travelText, { x: clamp(x, 200, 1400).toFixed(1), y: (headY - 26).toFixed(1), opacity: 1 });
    } else {
      setAttributes(runner, { r: 0 });
      setAttributes(travelText, { opacity: 0 });
    }
    const arrivedNow = time >= at.garbled ? arrived100 : time >= at.ten + 1.6 ? arrived10 : '';
    setText(lastText, arrivedNow);
    lastRect.classList.toggle('broken', time >= at.garbled);
    lastText.classList.toggle('broken', time >= at.garbled);
    setAttributes(lastBubble, { opacity: (arrivedNow ? (time >= at.hundred && time < at.garbled ? .25 : 1) : 0).toFixed(3) });
    // 거꾸로: 끝에서 처음으로, 갈수록 흐려진다.
    const backward = between(time, at.back, at.back + 2.6) ? (time - at.back) / 2.6 : -1;
    if (backward >= 0) {
      const position = backward * 99;
      const index = 99 - Math.floor(position);
      const long = whisperLine(1);
      const x = long.first + Math.max(index, 0) * long.pitch;
      const strength = .965 ** position;
      setAttributes(backRunner, { cx: x.toFixed(1), cy: (whisperRow.y + person.head * long.scale).toFixed(1), r: (4 + 12 * strength).toFixed(1), opacity: Math.max(strength, .05).toFixed(3) });
    } else {
      setAttributes(backRunner, { r: 0 });
    }
    setAttributes(backNote, { opacity: appear(time, at.back + .6, .4).toFixed(3) });

    // 3. 잔차 블록
    setAttributes(residualBlock, { opacity: visible(time, phases.block).toFixed(3) });
    setAttributes(skipArc, { 'stroke-dashoffset': (1 - ease(progress(time, at.skip, .9))).toFixed(4) });
    setAttributes(skipLabel, { opacity: appear(time, at.skip + .7, .4).toFixed(3) });
    setAttributes(strike, { opacity: (appear(time, at.whole, .3) * (1 - appear(time, at.add + 1.2, .4))).toFixed(3) });
    setAttributes(inputVector, { opacity: appear(time, at.add - .3, .4).toFixed(3) });
    setAttributes(residualVector, { opacity: appear(time, at.add + .6, .4).toFixed(3) });
    setAttributes(operators, { opacity: appear(time, at.add + .6, .4).toFixed(3) });
    setAttributes(outputVector, { opacity: appear(time, at.add + 1.6, .4).toFixed(3) });
    residualLabel.update(time, (t) => (t >= at.residual ? '잔차' : t >= at.add + .6 ? '고칠 부분' : ''));
    setAttributes(nameGroup, { opacity: appear(time, at.name, .4).toFixed(3) });
    nameText.update(time, (t) => (t >= at.resnet ? '잔차 신경망 · ResNet' : t >= at.name ? '잔차 신경망' : ''));
    // 신호: 층을 지나는 길과 지름길을 동시에 흘러 + 에서 만난다.
    const flow = (time - (at.add + .2)) / 1.4;
    if (flow > 0 && flow < 1) {
      const x = lerp(block.input + 90, block.plus - 34, flow);
      setAttributes(pulse, { cx: x.toFixed(1), cy: block.y, r: 12 });
      // 지름길 곡선 위 점(3차 베지어).
      const u = flow;
      const p0 = { x: block.input, y: block.y - 48 };
      const p1 = { x: block.input, y: block.arc - 40 };
      const p2 = { x: block.plus, y: block.arc - 40 };
      const p3 = { x: block.plus, y: block.y - 34 };
      const b = (a: number, b1: number, c: number, d: number) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b1 + 3 * (1 - u) * u * u * c + u ** 3 * d;
      setAttributes(skipPulse, { cx: b(p0.x, p1.x, p2.x, p3.x).toFixed(1), cy: b(p0.y, p1.y, p2.y, p3.y).toFixed(1), r: 12 });
    } else {
      setAttributes(pulse, { r: 0 });
      setAttributes(skipPulse, { r: 0 });
    }

    // 4. 건물
    setAttributes(building, { opacity: visible(time, phases.building).toFixed(3) });
    const floorsShown = baseFloors + Math.round(extraFloors * ease(progress(time, at.noLoss, 1)));
    floors.forEach(({ group, stairs, idle }, i) => {
      const shown = i < baseFloors ? appear(time, at.stairs + i * .08, .3) : appear(time, at.noLoss + (i - baseFloors) * .3, .3);
      setAttributes(group, { opacity: shown.toFixed(3) });
      const resting = i === idleFloor && time >= at.idle;
      stairs.classList.toggle('idle', resting);
      setText(idle, resting ? (time >= at.pass ? '할 일 없음 → 그대로' : '할 일 없음') : '');
    });
    const topY = floor.bottom - floorsShown * floor.height;
    setAttributes(shaft, { y: topY.toFixed(1), height: (floor.bottom - topY).toFixed(1), opacity: appear(time, at.elevator, .4).toFixed(3) });
    // 엘리베이터는 "곧장 위로"에서 맨 아래부터 꼭대기까지 단숨에 오르고, 층을 더 쌓으면 새 꼭대기까지 따라 오른다.
    const ride = ease(progress(time, at.straight, 1.1));
    const topFloor = baseFloors + extraFloors * ease(progress(time, at.noLoss + .2, 1.1));
    const carY = lerp(floor.bottom - floor.height + 7, floor.bottom - topFloor * floor.height + 7, ride);
    setAttributes(car, { y: carY.toFixed(1), opacity: appear(time, at.elevator, .4).toFixed(3) });
    car.classList.toggle('moving', between(time, at.straight, at.straight + 1.1));
    // 계단으로 오르는 신호는 층을 지날 때마다 약해진다.
    const climb = progress(time, at.oneByOne, 1.4);
    if (climb > 0 && climb < 1) {
      const level = climb * baseFloors;
      const strength = .55 ** level;
      setAttributes(stairsPulse, {
        cx: (stairsX + (level % 1) * stairsWidth).toFixed(1),
        cy: (floor.bottom - level * floor.height).toFixed(1),
        r: (5 + 10 * strength).toFixed(1),
        opacity: Math.max(strength, .06).toFixed(3),
      });
    } else {
      setAttributes(stairsPulse, { r: 0 });
    }
    setAttributes(stairsNote, { opacity: appear(time, at.stairs + .3, .4).toFixed(3) });
    setAttributes(shaftNote, { opacity: appear(time, at.elevator, .4).toFixed(3) });
    setAttributes(meters, { opacity: appear(time, at.oneByOne, .4).toFixed(3) });
    meterRows.forEach(({ className, bar }) => {
      const value = className === 'stairs' ? .55 ** baseFloors * ease(progress(time, at.oneByOne + 1.2, .4)) : ease(progress(time, at.straight + 1, .4));
      setAttributes(bar, { width: Math.max(260 * value, value > 0 ? 6 : 0).toFixed(1) });
    });
    setAttributes(noLossNote, { opacity: appear(time, at.noLoss + .8, .4).toFixed(3) });

    // 5. CIFAR-10: 지름길을 붙이면 깊을수록 오류가 줄었다.
    setAttributes(cifarGroup, { opacity: visible(time, phases.cifar).toFixed(3) });
    cifarBars.forEach(({ item, bar, value }, i) => {
      const grown = ease(progress(time, at.experiment + .6 + i * .5, .6));
      const height = (item.value / cifarChart.max) * (cifarChart.baseline - cifarChart.top) * grown;
      setAttributes(bar, { y: (cifarChart.baseline - height).toFixed(1), height: height.toFixed(1) });
      setAttributes(value, { y: (cifarChart.baseline - height - 16).toFixed(1), opacity: appear(time, at.experiment + 1 + i * .5, .3).toFixed(3) });
    });
    setAttributes(cifarArrow, { opacity: appear(time, at.result, .4).toFixed(3) });

    // 6. 152층, 그리고 오류율
    setAttributes(imagenet, { opacity: visible(time, phases.imagenet).toFixed(3) });
    const built = progress(time, at.layers152, 1.6);
    resLayers.forEach((layer, i) => setAttributes(layer, { opacity: (built * 152 > i ? 1 : 0).toFixed(0) }));
    setText(resCount, `ResNet ${Math.min(152, Math.round(built * 152))}층`);
    setAttributes(alexGroup, { opacity: appear(time, at.alexnet, .4).toFixed(3) });
    setAttributes(ratio, { opacity: appear(time, at.alexnet + .7, .3).toFixed(3) });
    setAttributes(errorGroup, { opacity: appear(time, at.error - .4, .4).toFixed(3) });
    setAttributes(narrowNote, { opacity: appear(time, at.narrow, .4).toFixed(3) });
    errorItems.forEach(({ item, group, bar, note, value }) => {
      const grown = ease(progress(time, item.at, .7));
      const height = (item.value / errorChart.max) * (errorChart.baseline - errorChart.top) * grown;
      setAttributes(group, { opacity: appear(time, item.at - .1, .3).toFixed(3) });
      setAttributes(bar, { y: (errorChart.baseline - height).toFixed(1), height: height.toFixed(1) });
      setAttributes(value, { y: (errorChart.baseline - height - 16).toFixed(1) });
      setAttributes(note, { opacity: (item.key === 'human' ? appear(time, at.measured, .4) : 1).toFixed(3) });
    });
    setAttributes(humanLine, { opacity: appear(time, at.better, .4).toFixed(3) });
    errorItems[2].bar.classList.toggle('winner', time >= at.better);
  };

  return { element, update };
};

export const createResidualNetworkScene = (): Scene => ({
  ...createResidualNetwork(),
  title: '잔차 신경망(ResNet)',
  start,
  end,
  chapters: [
    { time: start, title: '깊을수록 나빠진 성적' },
    { time: at.game, title: '귓속말 전달 놀이' },
    { time: at.skip, title: '층을 건너뛰는 지름길' },
    { time: at.residual, title: '잔차' },
    { time: at.stairs, title: '계단 옆 엘리베이터' },
    { time: at.idle, title: '할 일 없으면 그대로 통과' },
    { time: at.experiment, title: '깊을수록 좋아진 결과' },
    { time: at.layers152, title: '152층' },
    { time: at.error, title: '사람보다 낮은 오류율' },
  ],
});
