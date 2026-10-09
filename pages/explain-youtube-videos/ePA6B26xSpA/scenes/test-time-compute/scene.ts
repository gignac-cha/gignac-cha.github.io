import './test-time-compute.scss';
import { appear, between, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';

// 56:10 "이게 왜 중요할까요?" ~ 56:30 "연산이 쓰이는 자리가 하나 더 늘어난 거죠".
// 성능 눈금에는 숫자를 달지 않는다. 두 손잡이 모두 성능을 꾸준히 올린다는 것은 o1 발표문(2024.9)의 그래프 설명 그대로다.
const start = 3370.0;
const end = 3390.167;
const at = {
  // "지금까지 똑똑하게 만드는 방법은 하나였습니다"
  heading: 3371.3,
  first: 3372.6,
  // "학습할 때 더 큰 모델, 더 많은 데이터, 더 많은 연산을 쓰는 거였죠"
  train: 3374.0,
  chips: [3374.7, 3375.5, 3376.5],
  trainDone: 3377.7,
  // "새로운 손잡이를 하나 더 보여 줬어요"
  second: 3378.8,
  // "대답할 때 연산을 더 쓰면 더 똑똑해진다는 겁니다"
  answer: 3380.8,
  turn: 3381.3,
  smarter: 3382.5,
  // "시험 볼 때 암산하던 학생에게 연습장을 준 셈이에요"
  exam: 3383.8,
  mental: 3384.4,
  notebook: 3385.6,
  // "연산이 쓰이는 자리가 하나 더 늘어난 거죠"
  compute: 3388.0,
  place: 3388.4,
  more: 3389.1,
};

const knobs = [
  { x: 300, label: '학습할 때', sub: '학습에 쓰는 연산', at: at.first },
  { x: 690, label: '대답할 때', sub: '대답에 쓰는 연산', at: at.second },
];
const knob = { y: 400, radius: 98 };
const angle = { min: -130, max: 130 };
const meter = { x: 900, top: 250, height: 380, width: 46 };
const trainChips = ['더 큰 모델', '더 많은 데이터', '더 많은 연산'];

// 연습장 풀이(37 × 48 = 1,776).
const notebookLines = ['37 × 50 = 1,850', '37 × 2 = 74', '1,850 − 74 = 1,776'];

const polar = (x: number, y: number, radius: number, degrees: number) => {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: x + radius * Math.cos(radians), y: y + radius * Math.sin(radians) };
};

const gpu = (parent: Element, x: number, y: number) => {
  const group = svg('g', {}, parent);
  const body = svg('g', {}, group);
  for (let i = -2; i <= 2; i++) {
    svg('line', { x1: i * 12, y1: -38, x2: i * 12, y2: -28, class: 'ttc-pin' }, body);
    svg('line', { x1: i * 12, y1: 28, x2: i * 12, y2: 38, class: 'ttc-pin' }, body);
    svg('line', { x1: -38, y1: i * 12, x2: -28, y2: i * 12, class: 'ttc-pin' }, body);
    svg('line', { x1: 28, y1: i * 12, x2: 38, y2: i * 12, class: 'ttc-pin' }, body);
  }
  svg('rect', { x: -30, y: -30, width: 60, height: 60, rx: 8, class: 'ttc-chip' }, body);
  text(body, 0, 7, 'GPU', { class: 'ttc-chip-text' });
  setAttributes(group, { transform: `translate(${x} ${y})` });
  return group;
};

export const createTestTimeComputeScene = (): Scene => {
  const { element, root } = createDiagram('test-time-compute', '대답할 때 쓰는 연산');

  const heading = createSwapText(root, 90, 170, { class: 'ttc-heading' });

  // 손잡이 둘.
  const knobViews = knobs.map(({ x, label, sub }) => {
    const group = svg('g', { opacity: 0 }, root);
    text(group, x, knob.y - knob.radius - 42, label, { class: 'ttc-knob-label' });
    for (let i = 0; i <= 10; i++) {
      const degrees = lerp(angle.min, angle.max, i / 10);
      const from = polar(x, knob.y, knob.radius + 12, degrees);
      const to = polar(x, knob.y, knob.radius + (i % 5 === 0 ? 30 : 22), degrees);
      svg('line', { x1: from.x.toFixed(1), y1: from.y.toFixed(1), x2: to.x.toFixed(1), y2: to.y.toFixed(1), class: 'ttc-tick' }, group);
    }
    const ring = svg('circle', { cx: x, cy: knob.y, r: knob.radius, class: 'ttc-knob' }, group);
    const pointer = svg('line', { x1: x, y1: knob.y, class: 'ttc-pointer' }, group);
    svg('circle', { cx: x, cy: knob.y, r: 16, class: 'ttc-cap' }, group);
    text(group, x, knob.y + knob.radius + 58, sub, { class: 'ttc-knob-sub' });
    return { group, ring, pointer };
  });
  const newTag = svg('g', { opacity: 0 }, root);
  svg('rect', { x: knobs[1].x + 62, y: knob.y - knob.radius - 118, width: 110, height: 34, rx: 17, class: 'ttc-new' }, newTag);
  text(newTag, knobs[1].x + 117, knob.y - knob.radius - 95, '새 손잡이', { class: 'ttc-new-text' });

  const chipViews = trainChips.map((label, i) => {
    const group = svg('g', { opacity: 0 }, root);
    const y = knob.y + knob.radius + 84 + i * 46;
    svg('rect', { x: knobs[0].x - 95, y, width: 190, height: 38, rx: 19, class: 'ttc-train-chip' }, group);
    text(group, knobs[0].x, y + 26, label, { class: 'ttc-train-chip-text' });
    return group;
  });
  const thinkChip = svg('g', { opacity: 0 }, root);
  svg('rect', { x: knobs[1].x - 95, y: knob.y + knob.radius + 84, width: 190, height: 38, rx: 19, class: 'ttc-think-chip' }, thinkChip);
  text(thinkChip, knobs[1].x, knob.y + knob.radius + 110, '더 오래 생각하기', { class: 'ttc-train-chip-text' });

  // 성능 눈금.
  const meterGroup = svg('g', { opacity: 0 }, root);
  text(meterGroup, meter.x + meter.width / 2, meter.top - 22, '성능', { class: 'ttc-meter-label' });
  svg('rect', { x: meter.x, y: meter.top, width: meter.width, height: meter.height, rx: 10, class: 'ttc-meter' }, meterGroup);
  const meterTrain = svg('rect', { x: meter.x, width: meter.width, rx: 10, class: 'ttc-meter-train' }, meterGroup);
  const meterThink = svg('rect', { x: meter.x, width: meter.width, class: 'ttc-meter-think' }, meterGroup);
  const note = text(root, 90, 884, 'o1 발표(OpenAI, 2024.9): 학습 연산을 늘려도, 대답할 때 연산을 늘려도 AIME 정답률이 꾸준히 올랐다', { class: 'ttc-note', opacity: 0 });

  // 시험 문제: 암산 → 연습장.
  const examGroup = svg('g', { opacity: 0 }, root);
  svg('rect', { x: 1060, y: 214, width: 470, height: 116, rx: 16, class: 'ttc-exam' }, examGroup);
  text(examGroup, 1086, 248, '시험 문제', { class: 'ttc-exam-label' });
  text(examGroup, 1295, 306, '37 × 48 = ?', { class: 'ttc-exam-problem' });
  const mental = svg('g', { opacity: 0 }, root);
  svg('rect', { x: 1060, y: 360, width: 150, height: 96, rx: 48, class: 'ttc-bubble' }, mental);
  text(mental, 1135, 400, '암산', { class: 'ttc-bubble-label' });
  text(mental, 1135, 436, '1,7??', { class: 'ttc-bubble-guess' });
  const notebook = svg('g', { opacity: 0 }, root);
  svg('rect', { x: 1230, y: 360, width: 300, height: 262, rx: 6, class: 'ttc-paper' }, notebook);
  for (let i = 0; i < 6; i++) {
    svg('line', { x1: 1244, y1: 410 + i * 38, x2: 1516, y2: 410 + i * 38, class: 'ttc-rule' }, notebook);
  }
  text(notebook, 1250, 394, '연습장', { class: 'ttc-paper-title' });
  const notebookViews = notebookLines.map((line, i) => text(notebook, 1252, 440 + i * 38, line, { class: 'ttc-hand', opacity: 0 }));
  const solved = text(notebook, 1252, 598, '답: 1,776 ✓', { class: 'ttc-hand ttc-solved', opacity: 0 });

  // 연산이 쓰이는 자리: 학습할 때 + 대답할 때.
  const placeY = 776;
  const trainGpu = gpu(root, knobs[0].x, placeY);
  const answerGpu = gpu(root, knobs[0].x, placeY);
  const placeLabels = knobs.map(({ x }, i) => text(root, x, placeY + 70, i === 0 ? '원래 자리' : '새 자리', { class: i === 0 ? 'ttc-place' : 'ttc-place ttc-place-new', opacity: 0 }));

  const update = (time: number) => {
    heading.update(time, (t) => (t < at.heading ? '' : t < at.second ? '지금까지 똑똑하게 만드는 손잡이: 하나' : '이제 손잡이가 둘'));

    // 손잡이를 돌리면 성능이 오른다.
    const trainTurn = ease(progress(time, at.train, at.trainDone - at.train));
    const thinkTurn = ease(progress(time, at.turn, at.smarter - at.turn + .3));
    knobViews.forEach(({ group, ring, pointer }, i) => {
      setAttributes(group, { opacity: appear(time, knobs[i].at, .5).toFixed(3) });
      const turn = i === 0 ? trainTurn : thinkTurn;
      const tip = polar(knobs[i].x, knob.y, knob.radius - 18, lerp(angle.min + 20, angle.max - 30, turn));
      setAttributes(pointer, { x2: tip.x.toFixed(1), y2: tip.y.toFixed(1) });
      const turning = i === 0 ? between(time, at.train, at.trainDone) : between(time, at.turn, at.smarter + .3);
      ring.classList.toggle('turning', turning);
      ring.classList.toggle('fresh', i === 1 && between(time, at.second, at.answer));
    });
    setAttributes(newTag, { opacity: appear(time, at.second, .4).toFixed(3) });
    chipViews.forEach((chip, i) => setAttributes(chip, { opacity: appear(time, at.chips[i], .3).toFixed(3) }));
    setAttributes(thinkChip, { opacity: appear(time, at.turn, .3).toFixed(3) });

    setAttributes(meterGroup, { opacity: appear(time, at.first, .5).toFixed(3) });
    const base = .16;
    const trainLevel = base + .38 * trainTurn;
    const thinkLevel = .32 * thinkTurn;
    const trainHeight = meter.height * trainLevel;
    const thinkHeight = meter.height * thinkLevel;
    const bottom = meter.top + meter.height;
    setAttributes(meterTrain, { y: (bottom - trainHeight).toFixed(1), height: trainHeight.toFixed(1) });
    setAttributes(meterThink, { y: (bottom - trainHeight - thinkHeight).toFixed(1), height: thinkHeight.toFixed(1) });
    setAttributes(note, { opacity: appear(time, at.smarter, .4).toFixed(3) });

    // 암산하던 학생에게 연습장을.
    setAttributes(examGroup, { opacity: appear(time, at.exam, .4).toFixed(3) });
    setAttributes(mental, { opacity: (appear(time, at.mental, .3) * lerp(1, .35, appear(time, at.notebook, .4))).toFixed(3) });
    const slide = appear(time, at.notebook, .45);
    setAttributes(notebook, { opacity: slide.toFixed(3), transform: `translate(0 ${lerp(40, 0, slide).toFixed(1)})` });
    notebookViews.forEach((line, i) => setAttributes(line, { opacity: appear(time, at.notebook + .3 + i * .3, .2).toFixed(3) }));
    setAttributes(solved, { opacity: appear(time, at.notebook + 1.25, .25).toFixed(3) });

    // 연산(GPU)이 대답할 때 자리로도 간다.
    setAttributes(trainGpu, { opacity: appear(time, at.compute, .3).toFixed(3) });
    const move = appear(time, at.place, .7);
    setAttributes(answerGpu, {
      opacity: appear(time, at.place, .2).toFixed(3),
      transform: `translate(${lerp(knobs[0].x, knobs[1].x, move).toFixed(1)} ${placeY})`,
      class: time >= at.more ? 'ttc-gpu-new' : '',
    });
    setAttributes(placeLabels[0], { opacity: appear(time, at.compute, .3).toFixed(3) });
    setAttributes(placeLabels[1], { opacity: appear(time, at.more, .3).toFixed(3) });
  };

  return {
    element,
    update,
    title: '대답할 때 쓰는 연산',
    start,
    end,
    chapters: [
      { time: at.heading, title: '지금까지: 학습할 때 키우기' },
      { time: at.second, title: '새 손잡이: 대답할 때 연산' },
      { time: at.exam, title: '암산 대신 연습장' },
      { time: at.compute, title: '연산이 쓰이는 자리가 하나 더' },
    ],
  };
};
