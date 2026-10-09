import './self-attention.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';

// 36:25.9 "그때까지 언어를 다루는 주인공은" ~ 37:48.8 "GPU의 수천 개 계산기가 전부 일하기 시작했습니다".
const start = 2185.9;
const end = 2268.8;
const at = {
  rnn: 2187.8,
  lstm: 2188.9,
  sentence: 2190.6,
  // "첫 단어를 읽고 나서야 둘째 단어로, 그다음 셋째 단어로" 에 맞춰 한 단어씩, 이어서 같은 걸음으로 끝까지.
  reads: [2192.8, 2194.1, 2195.3, 2196.6, 2197.9, 2199.2, 2200.5],
  bank: 2196.6,
  queue: 2200.4,
  gpu: 2205.6,
  cores: 2207.6,
  together: 2210.1,
  oneByOne: 2211.9,
  idle: 2214.4,
  memory: 2216.7,
  question: 2221.4,
  remove: 2223.1,
  attentionOnly: 2224.3,
  selfAttention: 2226.7,
  allWords: 2229.1,
  meeting: 2235.6,
  example: 2239.8,
  // "그 동물은 너무 피곤해서 길을 건너지 않았다" 를 읽는 대로.
  readExample: [2241.7, 2241.8, 2242.3, 2242.5, 2243.2, 2243.4, 2243.8],
  who: 2244.7,
  animal: 2245.3,
  road: 2246.2,
  human: 2247.6,
  strong: 2250.8,
  scores: 2252.4,
  atOnce: 2256.7,
  noQueue: 2260.2,
  windows: 2262.4,
  gpuAgain: 2264.9,
  allCores: 2267,
};

const words = ['그', '동물은', '너무', '피곤해서', '길을', '건너지', '않았다'];
const tired = 3;
const animal = 1;
const road = 4;
const widths = words.map((word) => Math.max(84, word.length * 30 + 44));
const gap = 18;
const total = widths.reduce((sum, width) => sum + width, 0) + gap * (words.length - 1);
const centers = widths.map((width, i) => 580 - total / 2 + widths.slice(0, i).reduce((sum, w) => sum + w, 0) + gap * i + width / 2);
const rowY = 300;

// 단어마다 문장 속 어느 단어와 얼마나 이어지는지(설명용 값, 실제 모델에서 잰 값이 아니다).
// "피곤해서"는 "동물은"을 가장 강하게 본다.
const weights = [
  [0, .7, .05, .1, .05, .05, .05],
  [.25, 0, .05, .35, .05, .2, .1],
  [.05, .1, 0, .7, .05, .05, .05],
  [.04, .62, .1, 0, .1, .08, .06],
  [.03, .1, .02, .05, 0, .7, .1],
  [.03, .3, .02, .05, .35, 0, .25],
  [.03, .15, .02, .2, .1, .5, 0],
];
const pairs = words.flatMap((_, i) => words.map((__, j) => [i, j] as const).filter(([a, b]) => a < b));
const scoreStep = .6;

// GPU: P100 한 장의 CUDA 코어 3,584개를 64×56 칸으로.
const gpu = { x: 1136, y: 200, columns: 64, rows: 56, pitch: 6 };

// 은행: 창구 하나에 줄 선 손님(앞에서 한 명씩 빠진다), 나중엔 단어 수만큼 창구.
const bank = { windowX: 200, y: 680, spacing: 70, period: 1.3 };

const chip = (parent: SVGElement, x: number, y: number, label: string, width: number) => {
  const group = svg('g', { class: 'sa-chip', transform: `translate(${x} ${y})` }, parent);
  svg('rect', { x: -width / 2, y: -32, width, height: 64, rx: 32 }, group);
  text(group, 0, 11, label);
  return group;
};

const person = (parent: SVGElement, className = '') => {
  const group = svg('g', { class: `sa-person ${className}` }, parent);
  svg('circle', { cx: 0, cy: -34, r: 13 }, group);
  svg('rect', { x: -18, y: -16, width: 36, height: 42, rx: 14 }, group);
  return group;
};

const booth = (parent: SVGElement, x: number) => {
  const group = svg('g', { class: 'sa-booth', transform: `translate(${x} ${bank.y})` }, parent);
  svg('rect', { class: 'sa-booth-frame', x: -46, y: -80, width: 92, height: 58, rx: 10 }, group);
  text(group, 0, -92, '창구', { class: 'sa-booth-label' });
  svg('line', { class: 'sa-booth-desk', x1: -56, y1: -22, x2: 56, y2: -22 }, group);
  return group;
};

// 위로 굽은 호(어텐션 연결). 멀리 떨어진 단어일수록 높이 솟는다.
const arcPath = (a: number, b: number) => {
  const x1 = centers[a];
  const x2 = centers[b];
  const lift = 60 + Math.abs(x2 - x1) * .36;
  return `M${x1.toFixed(1)} ${rowY - 34} Q${((x1 + x2) / 2).toFixed(1)} ${(rowY - 34 - lift).toFixed(1)} ${x2.toFixed(1)} ${rowY - 34}`;
};

// 아래로 굽은 점선(질문: 피곤한 건 누구?).
const questionPath = (a: number, b: number) => {
  const x1 = centers[a];
  const x2 = centers[b];
  return `M${x1.toFixed(1)} ${rowY + 34} Q${((x1 + x2) / 2).toFixed(1)} ${rowY + 34 + 110} ${x2.toFixed(1)} ${rowY + 34}`;
};

// 시점마다 호 21개의 굵기. 단계가 바뀌면 0.35초 동안 앞 단계에서 옮겨 간다.
const focusWeights = (focus: number) => pairs.map(([a, b]) => (a === focus ? weights[a][b] : b === focus ? weights[b][a] : 0));
const phases = [
  { at: at.allWords, w: pairs.map(() => .35) },
  { at: at.example, w: pairs.map(() => .06) },
  { at: at.strong, w: focusWeights(tired) },
  ...words.map((_, k) => ({ at: at.scores + k * scoreStep, w: focusWeights(k) })),
  { at: at.atOnce, w: pairs.map(([a, b]) => Math.min((weights[a][b] + weights[b][a]) * .8, 1)) },
];
const arcWeightsAt = (time: number) => {
  let current = phases[0].w;
  for (const phase of phases.slice(1)) {
    if (time < phase.at) {
      break;
    }
    const t = ease(progress(time, phase.at, .35));
    current = current.map((w, i) => lerp(w, phase.w[i], t));
  }
  return current;
};
const scoreFocusAt = (time: number) => (time >= at.scores && time < at.atOnce ? Math.min(Math.floor((time - at.scores) / scoreStep), words.length - 1) : -1);

const captionAt = (time: number) => {
  const steps: [number, string][] = [
    [at.sentence, '한 단어씩 차례로 읽기'],
    [at.bank, '창구가 하나뿐인 은행 · 한 명씩 줄서기'],
    [at.memory - .9, '긴 문장일수록 앞부분이 흐려진다'],
    [at.question, '순서대로 읽는 부분을 빼면?'],
    [at.attentionOnly, '어텐션만 남기면?'],
    [at.selfAttention, '셀프 어텐션 · 모든 단어가 서로를 동시에'],
    [at.who, '피곤한 건 동물? 길?'],
    [at.strong, '"피곤해서"가 "동물은"을 강하게 본다'],
    [at.scores, '단어마다 누구와 얼마나 이어지는지 점수'],
    [at.atOnce, '모든 단어를 한꺼번에 계산'],
    [at.noQueue, '줄서기 끝 · 창구가 손님 수만큼'],
  ];
  let current = '';
  for (const [time0, label] of steps) {
    if (time >= time0) {
      current = label;
    }
  }
  return current;
};

const gpuCaptionAt = (time: number) => {
  if (time >= at.allCores) {
    return '계산기 전부가 일한다';
  }
  if (time >= at.remove) {
    return '';
  }
  if (time >= at.idle) {
    return '나머지는 놀고 있다';
  }
  if (time >= at.oneByOne) {
    return '한 번에 한 단어 · 계산기 하나만';
  }
  if (time >= at.cores) {
    return '작은 계산기 수천 개를 한꺼번에';
  }
  return '';
};

const createGPU = (root: SVGElement) => {
  const group = svg('g', { class: 'sa-gpu' }, root);
  const defs = svg('defs', {}, group);
  const pattern = (id: string, className: string) => {
    const element = svg('pattern', { id, width: gpu.pitch, height: gpu.pitch, patternUnits: 'userSpaceOnUse', x: gpu.x, y: gpu.y }, defs);
    svg('rect', { class: className, width: gpu.pitch - 1.5, height: gpu.pitch - 1.5, rx: .8 }, element);
  };
  pattern('sa-core-idle', 'sa-core-idle');
  pattern('sa-core-lit', 'sa-core-lit');
  const width = gpu.columns * gpu.pitch;
  const height = gpu.rows * gpu.pitch;
  svg('rect', { class: 'sa-gpu-board', x: gpu.x - 18, y: gpu.y - 18, width: width + 36, height: height + 36, rx: 16 }, group);
  text(group, gpu.x - 18, gpu.y - 36, 'GPU', { class: 'sa-gpu-title' });
  text(group, gpu.x + width + 18, gpu.y - 36, 'P100 한 장 · 코어 3,584개', { class: 'sa-gpu-note', 'text-anchor': 'end' });
  const idle = svg('rect', { x: gpu.x, y: gpu.y, width, height, fill: 'url(#sa-core-idle)' }, group);
  const lit = svg('rect', { x: gpu.x, y: gpu.y, width, height, fill: 'url(#sa-core-lit)', opacity: 0 }, group);
  const single = svg('g', {}, group);
  svg('rect', { class: 'sa-core-lit', x: -(gpu.pitch - 1.5) / 2, y: -(gpu.pitch - 1.5) / 2, width: gpu.pitch - 1.5, height: gpu.pitch - 1.5 }, single);
  svg('circle', { class: 'sa-core-ring', r: 12 }, single);
  const caption = createSwapText(group, gpu.x + width / 2, gpu.y + height + 66, { class: 'sa-gpu-caption', 'text-anchor': 'middle' });

  return (time: number) => {
    setAttributes(group, { opacity: appear(time, at.gpu, .5).toFixed(3) });
    setAttributes(idle, { opacity: appear(time, at.cores, .5).toFixed(3) });
    // "한꺼번에": 전부가 한 번 켜졌다 꺼지고, 끝에서 "전부 일하기 시작"하면 다 켜진 채로.
    const pulse = Math.sin(Math.PI * progress(time, at.together, 1.4));
    const full = ease(progress(time, at.gpuAgain, at.allCores - at.gpuAgain + .3));
    setAttributes(lit, { opacity: Math.max(pulse, full).toFixed(3) });
    // 한 단어씩: 계산기 하나만 옮겨 다니며 켜진다.
    const stepping = time >= at.oneByOne && time < at.remove;
    const k = Math.floor((time - at.oneByOne) / .6);
    const column = (7 + k * 9) % gpu.columns;
    const row = (11 + k * 5) % gpu.rows;
    setAttributes(single, {
      transform: `translate(${(gpu.x + column * gpu.pitch + (gpu.pitch - 1.5) / 2).toFixed(1)} ${(gpu.y + row * gpu.pitch + (gpu.pitch - 1.5) / 2).toFixed(1)})`,
      opacity: stepping ? (1 - appear(time, at.remove - .4, .4)).toFixed(3) : '0',
    });
    group.classList.toggle('idle', time >= at.idle && time < at.gpuAgain);
    caption.update(time, gpuCaptionAt);
  };
};

const createBank = (root: SVGElement) => {
  // 창구 하나: 줄 선 손님이 한 명씩 빠지고 줄이 당겨진다(손님은 끝없이 이어진다).
  const single = svg('g', { class: 'sa-bank' }, root);
  booth(single, bank.windowX);
  const teller = person(single, 'teller');
  setAttributes(teller, { transform: `translate(${bank.windowX} ${bank.y - 26}) scale(.62)` });
  const queue = Array.from({ length: 11 }, () => person(single));

  // 단어 수만큼 창구: 단어 아래마다 창구가 열리고 손님이 한꺼번에 처리된다.
  const many = svg('g', { class: 'sa-bank many' }, root);
  const windows = centers.map((x) => {
    const group = svg('g', {}, many);
    booth(group, x);
    const guest = person(group);
    setAttributes(guest, { transform: `translate(${x} ${bank.y + 92})` });
    const tellerMany = person(group, 'teller');
    setAttributes(tellerMany, { transform: `translate(${x} ${bank.y - 26}) scale(.62)` });
    const glow = svg('rect', { class: 'sa-booth-glow', x: x - 46, y: bank.y - 80, width: 92, height: 58, rx: 10 }, group);
    return { group, glow };
  });

  return (time: number) => {
    const shown = appear(time, at.bank, .5) * (1 - appear(time, at.remove, .6));
    setAttributes(single, { opacity: shown.toFixed(3) });
    const phase = Math.max(time - at.queue, 0) / bank.period;
    const step = time >= at.queue ? ease(clamp((phase - Math.floor(phase)) / .45)) : 0;
    queue.forEach((guest, i) => {
      const slot = i - step;
      const x = bank.windowX + slot * bank.spacing;
      // 맨 앞 손님은 창구 앞에서 일을 보고 위로 빠진다.
      const leaving = i === 0 ? step : 0;
      setAttributes(guest, {
        transform: `translate(${x.toFixed(1)} ${(bank.y + 92 - leaving * 30).toFixed(1)})`,
        opacity: (i === 0 ? 1 - leaving : i === queue.length - 1 ? step : 1).toFixed(3),
      });
    });

    const opened = appear(time, at.windows, .5);
    setAttributes(many, { opacity: opened.toFixed(3) });
    windows.forEach(({ group, glow }, i) => {
      setAttributes(group, { transform: `translate(0 ${((1 - appear(time, at.windows + i * .05, .45)) * 24).toFixed(1)})` });
      // 모든 창구가 같은 박자로 손님을 받는다.
      const beat = time >= at.windows + .5 ? .5 + .5 * Math.sin((time - at.windows) * Math.PI * 2 / 1.3) : 0;
      setAttributes(glow, { opacity: (beat * .7).toFixed(3) });
    });
  };
};

export const createSelfAttentionScene = (): Scene => {
  const { element, root } = createDiagram('sa', '셀프 어텐션');

  const arcs = svg('g', { class: 'sa-arcs' }, root);
  const arcPaths = pairs.map(([a, b]) => svg('path', { class: 'sa-arc', d: arcPath(a, b), pathLength: 1 }, arcs));
  const ripples = centers.map((x) => svg('circle', { class: 'sa-ripple', cx: x, cy: rowY }, root));

  const questions = svg('g', { class: 'sa-questions' }, root);
  const questionTargets = [
    { target: animal, at: at.animal },
    { target: road, at: at.road },
  ].map(({ target, at: time0 }) => {
    const group = svg('g', {}, questions);
    svg('path', { class: 'sa-question', d: questionPath(tired, target) }, group);
    text(group, (centers[tired] + centers[target]) / 2, rowY + 34 + 74, '?', { class: 'sa-question-mark', 'text-anchor': 'middle' });
    return { group, at: time0 };
  });

  const bars = svg('g', { class: 'sa-bars' }, root);
  const barRects = centers.map((x) => svg('rect', { class: 'sa-bar', x: x - 22, width: 44, rx: 6 }, bars));
  const barBase = 470;

  const chips = words.map((word, i) => chip(root, centers[i], rowY, word, widths[i]));
  const check = svg('g', { class: 'sa-check' }, root);
  svg('circle', { cx: 0, cy: 0, r: 18 }, check);
  svg('path', { d: 'M-8 0 L-2 7 L9 -6' }, check);

  // 차례로 읽는 칸(순환 신경망 · LSTM).
  // 읽는 칸은 화면 안쪽(GPU 판과 겹치지 않게)에 머물고, 화살표가 지금 읽는 단어를 가리킨다.
  const readerArrow = svg('path', { class: 'sa-reader-arrow' }, root);
  const reader = svg('g', { class: 'sa-reader' }, root);
  svg('rect', { class: 'sa-reader-box', x: -140, y: -40, width: 280, height: 80, rx: 18 }, reader);
  const readerLabel = text(reader, 0, 11, '', { class: 'sa-reader-label' });
  const rnnSpan = svg('tspan', {}, readerLabel);
  rnnSpan.textContent = '순환 신경망';
  const lstmSpan = svg('tspan', {}, readerLabel);
  lstmSpan.textContent = ' · LSTM';
  const strike = svg('path', { class: 'sa-strike', d: 'M-150 -48 L150 48 M-150 48 L150 -48', pathLength: 1 }, reader);
  const readerY = 440;

  const caption = createSwapText(root, 580, 560, { class: 'sa-caption', 'text-anchor': 'middle' });
  const renderGPU = createGPU(root);
  const renderBank = createBank(root);

  const update = (time: number) => {
    // 문장: "문장을"에서 나타나고, 차례 읽기 동안 읽은 단어만 밝다. 긴 문장 이야기에서 앞부분부터 흐려진다.
    const sentence = appear(time, at.sentence, .5);
    const readCount = at.reads.filter((read) => time >= read).length;
    const sequential = time < at.remove;
    const fading = appear(time, at.memory, 1.2) * (1 - appear(time, at.remove, .6));
    const scoreFocus = scoreFocusAt(time);
    chips.forEach((group, i) => {
      const read = !sequential || i < readCount;
      const memory = 1 - fading * .8 * ((words.length - 1 - i) / (words.length - 1));
      const exampleRead = time >= at.example && time < at.who && time >= at.readExample[i];
      setAttributes(group, { opacity: (sentence * (read ? memory : .35)).toFixed(3) });
      group.classList.toggle('reading', sequential && time >= at.reads[0] && i === readCount - 1);
      group.classList.toggle('spoken', exampleRead);
      group.classList.toggle('focus', (time >= at.who && time < at.scores && i === tired) || scoreFocus === i);
      group.classList.toggle('answer', time >= at.human && time < at.scores && i === animal);
      group.classList.toggle('active', time >= at.atOnce);
    });
    setAttributes(check, {
      transform: `translate(${centers[animal] + widths[animal] / 2 - 4} ${rowY - 30})`,
      opacity: (appear(time, at.human, .3) * (1 - appear(time, at.scores, .3))).toFixed(3),
    });

    // 읽는 칸: 이름이 먼저 나오고, 문장이 나오면 지금 읽는 단어 밑으로 옮겨 다닌다.
    const index = Math.max(readCount - 1, 0);
    const previous = Math.max(index - 1, 0);
    const moving = readCount > 0 ? ease(progress(time, at.reads[index], .35)) : 1;
    const wordX = lerp(centers[previous], centers[index], moving);
    const readerX = clamp(wordX, 180, 940);
    const readerShown = appear(time, at.rnn, .4) * (1 - appear(time, at.remove + .4, .6));
    setAttributes(reader, { transform: `translate(${readerX.toFixed(1)} ${readerY})`, opacity: readerShown.toFixed(3) });
    const tipY = rowY + 36;
    const baseY = readerY - 44;
    const angle = Math.atan2(tipY - baseY, wordX - readerX);
    const head = (turn: number) => `${(wordX - 12 * Math.cos(angle + turn)).toFixed(1)} ${(tipY - 12 * Math.sin(angle + turn)).toFixed(1)}`;
    setAttributes(readerArrow, {
      d: `M${readerX.toFixed(1)} ${baseY} L${wordX.toFixed(1)} ${tipY} M${head(-.5)} L${wordX.toFixed(1)} ${tipY} L${head(.5)}`,
      opacity: (time >= at.reads[0] ? readerShown : 0).toFixed(3),
    });
    setAttributes(rnnSpan, { 'fill-opacity': appear(time, at.rnn, .4).toFixed(3) });
    setAttributes(lstmSpan, { 'fill-opacity': appear(time, at.lstm, .4).toFixed(3) });
    setAttributes(strike, { 'stroke-dashoffset': (1 - ease(progress(time, at.remove, .4))).toFixed(3) });

    // 셀프 어텐션: 모든 단어 쌍을 잇는 호가 한꺼번에 그려진다.
    const drawn = ease(progress(time, at.allWords, .8));
    const arcWeights = arcWeightsAt(time);
    const meeting = time >= at.meeting ? Math.sin(Math.PI * progress(time, at.meeting, 1.6)) : 0;
    arcPaths.forEach((path, i) => {
      const w = arcWeights[i];
      setAttributes(path, {
        'stroke-dashoffset': (1 - drawn).toFixed(3),
        'stroke-width': (1.5 + w * 14 + meeting * 2).toFixed(2),
        opacity: (drawn * Math.min(.12 + w * 1.1 + meeting * .3, 1)).toFixed(3),
      });
    });
    // "모두가 동시에 서로를 둘러보며": 모든 단어에서 같은 순간 물결이 퍼진다.
    const ripple = progress(time, at.meeting, 1.2);
    ripples.forEach((circle) => {
      setAttributes(circle, { r: (40 + ripple * 70).toFixed(1), opacity: (ripple > 0 && ripple < 1 ? (1 - ripple) * .7 : 0).toFixed(3) });
    });

    questionTargets.forEach(({ group, at: time0 }) => {
      setAttributes(group, { opacity: (appear(time, time0, .35) * (1 - appear(time, at.strong, .5))).toFixed(3) });
    });

    // 점수: 지금 보는 단어가 다른 단어들을 얼마나 보는지 막대로.
    const barsShown = appear(time, at.scores, .3) * (1 - appear(time, at.atOnce, .4));
    setAttributes(bars, { opacity: barsShown.toFixed(3) });
    const focus = Math.max(scoreFocus, 0);
    const blend = ease(progress(time, at.scores + focus * scoreStep, .25));
    const before = Math.max(focus - 1, 0);
    barRects.forEach((rect, j) => {
      const value = lerp(weights[before][j], weights[focus][j], focus === 0 ? 1 : blend);
      const height = 4 + value * 110;
      setAttributes(rect, { y: (barBase - height).toFixed(1), height: height.toFixed(1) });
    });

    caption.update(time, captionAt);
    renderGPU(time);
    renderBank(time);
  };

  return {
    element,
    update,
    title: '셀프 어텐션',
    start,
    end,
    chapters: [
      { time: start, title: '한 단어씩 차례로' },
      { time: at.bank, title: '창구가 하나뿐인 은행' },
      { time: at.gpu, title: '줄서기를 싫어하는 GPU' },
      { time: at.memory - .9, title: '흐려지는 앞부분' },
      { time: at.question, title: '순서를 빼고 어텐션만' },
      { time: at.selfAttention, title: '모든 단어가 동시에' },
      { time: at.example, title: '피곤한 건 누구?' },
      { time: at.scores, title: '단어마다 연결 점수' },
      { time: at.atOnce, title: '한꺼번에 계산' },
    ],
  };
};
