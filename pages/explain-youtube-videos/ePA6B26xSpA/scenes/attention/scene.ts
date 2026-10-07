import './attention.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 24:47.9 "같은 해 몬트리올의 요슈아 벤지오 연구실에서" ~ 25:15.8 "이 작은 아이디어가 몇 년 뒤 모든 걸 바꾸게 됩니다".
const start = 1487.933;
const end = 1515.833;
const summaryOnly = { dim: 1495.6 };
const look = 1496.6;
// 번역할 단어마다: 원문의 어느 단어에 눈길이 가는지(focus)와 단어가 나오는 시점(emit).
const targets = [
  { word: 'Tu', focus: 1499.3, emit: 1500.7, weights: [.1, .1, .8] },
  { word: 'me', focus: 1502.4, emit: 1503, weights: [.8, .12, .08] },
  { word: 'manques', focus: 1503.6, emit: 1504.3, weights: [.1, .82, .08] },
];
const matrix = { show: 1506.2 };
const chart = { show: 1509.833, summary: 1509.9, attention: 1510.9, highlight: 1513.2 };

const sources = ['I', 'miss', 'you'];
const columnX = [260, 480, 700];
const sourceY = 260;
const targetY = 640;
const uniform = [1 / 3, 1 / 3, 1 / 3];

const chip = (parent: SVGElement, x: number, y: number, label: string, className: string) => {
  const group = svg('g', { class: `att-chip ${className}`, transform: `translate(${x} ${y})` }, parent);
  const width = Math.max(120, label.length * 20 + 60);
  svg('rect', { x: -width / 2, y: -32, width, height: 64, rx: 32 }, group);
  text(group, 0, 11, label);
  return group;
};

// focus 시점마다 이전 눈길에서 새 눈길로 0.5초 동안 옮겨 간다.
const weightsAt = (time: number) => {
  let current = uniform;
  let index = -1;
  for (const [i, target] of targets.entries()) {
    if (time < target.focus) {
      break;
    }
    const t = ease(progress(time, target.focus, .5));
    current = current.map((w, j) => lerp(w, target.weights[j], t));
    index = i;
  }
  return { weights: current, index };
};

const createChart = (parent: SVGElement) => {
  const group = svg('g', { class: 'att-chart' }, parent);
  const box = { left: 1090, right: 1500, top: 300, bottom: 640 };
  svg('path', { class: 'att-axis', d: `M${box.left} ${box.top - 20} V${box.bottom} H${box.right + 10}` }, group);
  text(group, box.left, box.top - 40, '번역 품질', { class: 'att-axis-label' });
  text(group, box.right + 10, box.bottom + 46, '문장 길이 →', { class: 'att-axis-label', 'text-anchor': 'end' });
  const curve = (f: (x: number) => number) => {
    const points = Array.from({ length: 41 }, (_, i) => {
      const x = i / 40;
      return `${i ? 'L' : 'M'}${(box.left + x * (box.right - box.left)).toFixed(1)} ${(box.bottom - f(x) * (box.bottom - box.top)).toFixed(1)}`;
    });
    return points.join(' ');
  };
  // 요약만 보는 방식은 문장이 길어질수록 무너지고, 어텐션은 길어져도 거의 그대로다.
  const summary = svg('path', { class: 'att-curve summary', d: curve((x) => .78 - .55 / (1 + Math.exp(-(x - .55) * 9))), pathLength: 1 }, group);
  const attention = svg('path', { class: 'att-curve attention', d: curve((x) => .86 - .06 * x), pathLength: 1 }, group);
  const summaryLabel = text(group, box.right - 4, 604, '요약만', { class: 'att-legend summary', 'text-anchor': 'end' });
  const attentionLabel = text(group, box.right - 4, 334, '어텐션', { class: 'att-legend attention', 'text-anchor': 'end' });
  return (time: number) => {
    setAttributes(group, { opacity: appear(time, chart.show, .5).toFixed(3) });
    setAttributes(summary, { 'stroke-dashoffset': (1 - ease(progress(time, chart.summary, .9))).toFixed(3) });
    setAttributes(attention, { 'stroke-dashoffset': (1 - ease(progress(time, chart.attention, .9))).toFixed(3) });
    setAttributes(summaryLabel, { opacity: appear(time, chart.summary + .7).toFixed(3) });
    setAttributes(attentionLabel, { opacity: appear(time, chart.attention + .7).toFixed(3) });
    attention.classList.toggle('highlight', time >= chart.highlight);
  };
};

const createMatrix = (parent: SVGElement) => {
  const group = svg('g', { class: 'att-matrix' }, parent);
  const origin = { x: 1210, y: 330 };
  const size = 96;
  sources.forEach((word, j) => text(group, origin.x + j * size + size / 2, origin.y - 22, word, { class: 'att-matrix-label', 'text-anchor': 'middle' }));
  const rows = targets.map((target, i) => {
    const row = svg('g', {}, group);
    text(row, origin.x - 20, origin.y + i * size + size / 2 + 10, target.word, { class: 'att-matrix-label', 'text-anchor': 'end' });
    target.weights.forEach((weight, j) => {
      svg('rect', { class: 'att-cell', x: origin.x + j * size + 3, y: origin.y + i * size + 3, width: size - 6, height: size - 6, rx: 10, 'fill-opacity': (.08 + weight * .92).toFixed(2) }, row);
    });
    return row;
  });
  return (time: number) => {
    setAttributes(group, { opacity: (appear(time, matrix.show, .4) * (1 - appear(time, chart.show, .4))).toFixed(3) });
    rows.forEach((row, i) => setAttributes(row, { opacity: appear(time, matrix.show + i * .3, .4).toFixed(3) }));
  };
};

export const createAttentionScene = (): Scene => {
  const { element, root } = createDiagram('att', '어텐션');
  text(root, 90, sourceY + 10, '원문', { class: 'att-row-label' });
  text(root, 90, targetY + 10, '번역', { class: 'att-row-label' });

  // 예전 방식: 원문 전체가 요약 하나로 모였다가 번역으로 나간다.
  const summary = svg('g', { class: 'att-summary' }, root);
  for (const x of columnX) {
    svg('line', { x1: x, y1: sourceY + 32, x2: 480, y2: 450 }, summary);
  }
  svg('line', { x1: 480, y1: 450, x2: 480, y2: targetY - 32 }, summary);
  svg('circle', { class: 'att-summary-ring', cx: 480, cy: 450, r: 46 }, summary);
  text(summary, 480, 460, '요약', { class: 'att-summary-label' });

  // 어텐션: 지금 옮길 단어 자리에서 원문의 모든 단어로 선을 잇고, 관련 있는 쪽을 굵게.
  const links = columnX.map(() => svg('line', { class: 'att-link' }, root));
  const pointer = svg('path', { class: 'att-pointer', d: 'M0 0 L-14 -22 L14 -22 Z' }, root);

  const sourceChips = sources.map((word, j) => chip(root, columnX[j], sourceY, word, 'source'));
  const slots = targets.map((target, i) => ({
    empty: chip(root, columnX[i], targetY, '?', 'slot'),
    word: chip(root, columnX[i], targetY, target.word, 'output'),
  }));

  const renderMatrix = createMatrix(root);
  const renderChart = createChart(root);

  const update = (time: number) => {
    setAttributes(summary, { opacity: (1 - .85 * appear(time, summaryOnly.dim, .6)).toFixed(3) });

    const { weights, index } = weightsAt(time);
    // 아직 첫 단어에 눈길을 주기 전이면 첫 자리에서 원문을 고르게 본다.
    const slot = Math.max(index, 0);
    const looking = appear(time, look, .5) * (1 - appear(time, matrix.show - .2, .5) * .4);
    columnX.forEach((x, j) => {
      setAttributes(links[j], {
        x1: x, y1: sourceY + 32, x2: columnX[slot], y2: targetY - 32,
        'stroke-width': (2 + weights[j] * 16).toFixed(1),
        opacity: (looking * (.25 + weights[j] * .75)).toFixed(3),
      });
      sourceChips[j].classList.toggle('focus', index >= 0 && weights[j] > .5);
    });

    const focusX = columnX.reduce((sum, x, j) => sum + x * weights[j], 0);
    const pointed = index >= 0 ? appear(time, targets[0].focus, .4) : 0;
    setAttributes(pointer, { transform: `translate(${focusX.toFixed(1)} ${sourceY - 42})`, opacity: pointed.toFixed(3) });

    slots.forEach(({ empty, word }, i) => {
      const emitted = appear(time, targets[i].emit, .35);
      setAttributes(word, { opacity: emitted.toFixed(3) });
      setAttributes(empty, { opacity: (1 - emitted).toFixed(3) });
      empty.classList.toggle('current', slot === i && time >= look);
    });

    renderMatrix(time);
    renderChart(time);
  };

  return {
    element,
    update,
    title: '어텐션',
    start,
    end,
    chapters: [
      { time: start, title: '요약 하나에 기대던 번역' },
      { time: look, title: '원문을 다시 보기' },
      { time: targets[0].focus, title: '관련된 단어에 눈길' },
      { time: matrix.show, title: '어디를 볼지 정하는 능력' },
      { time: chart.show, title: '긴 문장에서도' },
    ],
  };
};
