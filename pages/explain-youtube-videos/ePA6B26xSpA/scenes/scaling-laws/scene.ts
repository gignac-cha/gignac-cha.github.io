import './scaling-laws.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';
import { createLogChart, lossOfCompute, lossOfData, lossOfLearning, lossOfParameters } from './chart';

export { createGpt3ScaleScene } from './gpt3';

// 43:14.5 "모델 크기와 데이터양 그리고 연산량이" ~ 43:45.2 "…눈에 보이기 시작했으니까요".
// 그 앞의 논문·저자 소개(43:00.8~)는 역사 이야기라 장면으로 만들지 않는다.
// 그래프의 선은 모두 논문의 실제 맞춤식으로 그린다(chart.ts). 측정 점은 옮기지 않았다.
const start = 2594.5;
const end = 2625.2;
const at = {
  panels: 2594.7,
  size: 2595.2,
  data: 2595.8,
  compute: 2596.8,
  smooth: 2598.8,
  predict: 2600.9,
  law: 2603.4,
  sample: 2605.4,
  same: 2606.1,
  more: 2607.6,
  farm: 2609.6,
  field: 2612.7,
  water: 2613.8,
  fertilizer: 2614.2,
  table: 2617.6,
  gamble: 2619.4,
  engineering: 2619.9,
  invest: 2621.4,
  sweep: 2621.7,
  readout: 2622.5,
};

// 세 가지를 늘릴 때: 왼쪽부터 내레이션 순서(모델 크기, 데이터양, 연산량).
const panels = [
  {
    key: 'size', at: at.size, left: 150, x: [5, 11] as [number, number], measured: 9,
    ticks: [[5, '10만'], [7, '1,000만'], [9, '10억']] as [number, string][],
    label: '모델 크기 (매개변수)', law: ['L ∝ N', '−0.076'], f: (e: number) => lossOfParameters(10 ** e),
  },
  {
    key: 'data', at: at.data, left: 640, x: [7, 12] as [number, number], measured: 10.3,
    ticks: [[7, '1,000만'], [9, '10억'], [11, '1,000억']] as [number, string][],
    label: '데이터양 (토큰)', law: ['L ∝ D', '−0.095'], f: (e: number) => lossOfData(10 ** e),
  },
  {
    key: 'compute', at: at.compute, left: 1130, x: [-9, 3] as [number, number], measured: 1,
    ticks: [[-8, '10⁻⁸'], [-4, '10⁻⁴'], [0, '1']] as [number, string][],
    label: '연산량 (PF-일)', law: ['L ∝ C', '−0.050'], f: (e: number) => lossOfCompute(10 ** e),
  },
];

const sizes = [
  { exponent: 6, label: '100만' },
  { exponent: 7, label: '1,000만' },
  { exponent: 8, label: '1억' },
  { exponent: 9, label: '10억' },
];

const formula = (parent: SVGElement, x: number, y: number, [base, power]: string[]) => {
  const element = text(parent, x, y, base, { class: 'sl-law', 'text-anchor': 'end' });
  const sup = svg('tspan', { dy: -14, 'font-size': 18 }, element);
  sup.textContent = power;
  // 위첨자를 붙인 뒤 오른쪽 끝을 맞추려고 전체를 한 덩어리로 둔다.
  return element;
};

export const createScalingLawsScene = (): Scene => {
  const { element, root } = createDiagram('sl', '스케일링 법칙');

  // 세 가지 그래프
  const trio = svg('g', {}, root);
  const heading = svg('g', { class: 'sl-heading' }, trio);
  text(heading, 800, 172, '스케일링 법칙', { class: 'sl-heading-title' });
  text(heading, 800, 212, '세 가지를 늘리면 오차가 정해진 비율로 줄어든다', { class: 'sl-heading-sub' });
  const charts = panels.map((panel) => {
    const panelGroup = svg('g', {}, trio);
    const chart = createLogChart(panelGroup, {
      box: { left: panel.left, top: 280, width: 360, height: 300 },
      x: panel.x, y: [1.4, 8], xTicks: panel.ticks, yTicks: [2, 4, 8], xLabel: panel.label, yLabel: '오차',
    });
    const solid = chart.curve(panel.f, panel.x[0], panel.measured, 'measured');
    const dashed = chart.curve(panel.f, panel.measured, panel.x[1], 'predicted');
    const law = formula(panelGroup, panel.left + 360, 300, panel.law);
    const middle = (panel.measured + panel.x[1]) / 2;
    const predictLabel = text(panelGroup, chart.toX(middle) + 4, chart.toY(panel.f(middle)) - 26, '예측', { class: 'sl-predict-label', 'text-anchor': 'middle' });
    return { panel, panelGroup, solid, dashed, law, predictLabel };
  });

  // 큰 모델일수록 같은 글에서 더 많이 배운다: 논문 그림 2 왼쪽처럼 학습하며 읽은 글의 양에 따른 오차(학습 곡선).
  // 가로축은 논문 학습 범위(25만 단계 ≈ 1,300억 토큰) 안, 맞춤식이 들어맞는 워밍업 이후 구간만 쓴다.
  const sample = svg('g', {}, root);
  const sampleChart = createLogChart(sample, {
    box: { left: 330, top: 210, width: 800, height: 430 },
    x: [9, 11], y: [2.2, 6], xTicks: [[9, '10억'], [10, '100억'], [11, '1,000억']], yTicks: [3, 4, 5],
    xLabel: '학습하며 읽은 글의 양 (토큰)', yLabel: '오차',
  });
  const guideX = sampleChart.toX(10);
  const guide = svg('line', { class: 'sl-guide', x1: guideX, y1: 200, x2: guideX, y2: 640 }, sample);
  const guideLabel = text(sample, guideX, 192, '같은 양의 글', { class: 'sl-guide-label', 'text-anchor': 'middle' });
  const learning = sizes.map((size, i) => {
    const curve = sampleChart.curve((e) => lossOfLearning(10 ** size.exponent, 10 ** e), 9, 11, `size-${i}`);
    const endY = sampleChart.toY(lossOfLearning(10 ** size.exponent, 1e11));
    const label = text(sample, 1146, endY + 9, size.label, { class: `sl-size-label size-${i}` });
    const dot = svg('circle', { class: `sl-dot size-${i}`, cx: guideX, cy: sampleChart.toY(lossOfLearning(10 ** size.exponent, 1e10)), r: 9 }, sample);
    return { curve, label, dot };
  });
  const sizeHeader = text(sample, 1146, 196, '모델 크기', { class: 'sl-size-header' });
  const sampleNote = text(sample, 730, 140, '큰 모델일수록 같은 글에서 더 많이 배운다', { class: 'sl-note', 'text-anchor': 'middle' });
  text(sample, 730, 760, '논문 그림 2(학습 곡선)의 맞춤식 L(N, S)로 그림 · 모델 크기는 임베딩 제외 매개변수', { class: 'sl-source', 'text-anchor': 'middle' });

  // 농사 비유: 밭(모델 크기), 물(데이터), 비료(연산) → 미리 알 수 있는 표.
  const farm = svg('g', { class: 'sl-farm' }, root);
  const field = svg('g', {}, farm);
  const soil = svg('rect', { class: 'sl-soil', x: 160, y: 350, width: 240, height: 190, rx: 10 }, field);
  const crops = Array.from({ length: 4 * 12 }, (_, i) => {
    const column = i % 12;
    const row = Math.floor(i / 12);
    return { column, element: svg('path', { class: 'sl-crop', d: `M${190 + column * 40} ${410 + row * 40} l0 -22 m0 8 l-9 -8 m9 8 l9 -8` }, field) };
  });
  const fieldLabel = text(farm, 400, 650, '밭 = 모델 크기', { class: 'sl-farm-label', 'text-anchor': 'middle' });
  const doubled = svg('g', { class: 'sl-farm-double' }, farm);
  const doubledLine = svg('path', { d: '' }, doubled);
  text(doubled, 400, 600, '×2', { 'text-anchor': 'middle' });
  const water = svg('g', { class: 'sl-water' }, farm);
  svg('path', { class: 'sl-cloud', d: 'M250 250 a28 28 0 0 1 50 -16 a34 34 0 0 1 62 6 a24 24 0 0 1 8 46 h-112 a22 22 0 0 1 -8 -36 z' }, water);
  const drops = Array.from({ length: 6 }, () => svg('path', { class: 'sl-drop', d: 'M0 -9 C5 -1 7 3 0 9 C-7 3 -5 -1 0 -9 Z' }, water));
  text(water, 400, 268, '물 = 데이터', { class: 'sl-farm-label' });
  const fertilizer = svg('g', { class: 'sl-fertilizer' }, farm);
  svg('path', { class: 'sl-bag', d: 'M664 430 h76 l10 120 h-96 z' }, fertilizer);
  svg('path', { class: 'sl-bag-tie', d: 'M660 430 h84' }, fertilizer);
  text(fertilizer, 702, 650, '비료 = 연산', { class: 'sl-farm-label', 'text-anchor': 'middle' });

  const table = svg('g', { class: 'sl-table' }, root);
  text(table, 1160, 252, '미리 알 수 있는 표', { class: 'sl-table-title', 'text-anchor': 'middle' });
  svg('rect', { class: 'sl-table-frame', x: 860, y: 280, width: 600, height: 290, rx: 16 }, table);
  text(table, 900, 330, '두 배로 늘리면', { class: 'sl-table-head' });
  text(table, 1420, 330, '오차', { class: 'sl-table-head', 'text-anchor': 'end' });
  // 1 − 2^(−지수): 나머지 두 가지가 발목을 잡지 않을 때 줄어드는 비율.
  const rows = [
    ['모델 크기 ×2', '−5.1%'],
    ['데이터양 ×2', '−6.4%'],
    ['연산량 ×2', '−3.4%'],
  ].map(([name, change], i) => {
    const row = svg('g', {}, table);
    svg('line', { class: 'sl-table-rule', x1: 880, y1: 352 + i * 68, x2: 1440, y2: 352 + i * 68 }, row);
    text(row, 900, 398 + i * 68, name, { class: 'sl-table-cell' });
    text(row, 1420, 398 + i * 68, change, { class: 'sl-table-value', 'text-anchor': 'end' });
    return row;
  });
  text(table, 1160, 610, '법칙의 지수로 계산 · 나머지 둘이 넉넉할 때', { class: 'sl-table-note', 'text-anchor': 'middle' });

  const shift = svg('g', { class: 'sl-shift' }, root);
  text(shift, 790, 742, '연구가', { class: 'sl-shift-prefix', 'text-anchor': 'end' });
  const shiftWord = createSwapText(shift, 812, 748, { class: 'sl-shift-word' });

  // 얼마를 쏟으면 얼마나 좋아질지: 연산량 그래프에서 읽어 낸다.
  const invest = svg('g', {}, root);
  const investChart = createLogChart(invest, {
    box: { left: 330, top: 210, width: 800, height: 430 },
    x: [-9, 1], y: [2.2, 8], xTicks: [[-8, '10⁻⁸'], [-6, '10⁻⁶'], [-4, '10⁻⁴'], [-2, '10⁻²'], [0, '1']], yTicks: [3, 4, 6],
    xLabel: '투입: 연산량 (PF-일)', yLabel: '결과: 오차',
  });
  const investLine = investChart.curve((e) => lossOfCompute(10 ** e), -9, 1, 'measured');
  const cursor = svg('g', { class: 'sl-cursor' }, invest);
  const cursorV = svg('line', {}, cursor);
  const cursorH = svg('line', {}, cursor);
  const cursorDot = svg('circle', { r: 11 }, cursor);
  const readout = svg('g', { class: 'sl-readout' }, invest);
  svg('rect', { x: 1150, y: 300, width: 330, height: 120, rx: 16 }, readout);
  text(readout, 1315, 350, '연산 ×10', { class: 'sl-readout-in', 'text-anchor': 'middle' });
  text(readout, 1315, 396, '→ 오차 −11%', { class: 'sl-readout-out', 'text-anchor': 'middle' });

  const update = (time: number) => {
    const trioShown = 1 - appear(time, at.sample - .2, .4);
    setAttributes(trio, { opacity: trioShown.toFixed(3) });
    setAttributes(heading, { opacity: appear(time, at.law, .5).toFixed(3) });
    charts.forEach(({ panel, panelGroup, solid, dashed, law, predictLabel }, i) => {
      setAttributes(panelGroup, { opacity: appear(time, panel.at, .4).toFixed(3) });
      solid.draw(ease(progress(time, at.smooth + i * .15, 1)));
      dashed.draw(ease(progress(time, at.predict + i * .15, .8)));
      setAttributes(predictLabel, { opacity: appear(time, at.predict + .6 + i * .15, .4).toFixed(3) });
      setAttributes(law, { opacity: appear(time, at.law + .3, .4).toFixed(3) });
    });

    const sampleShown = appear(time, at.sample, .4) * (1 - appear(time, at.farm, .4));
    setAttributes(sample, { opacity: sampleShown.toFixed(3) });
    learning.forEach(({ curve, label, dot }, i) => {
      curve.draw(ease(progress(time, at.sample + .1 + i * .15, .8)));
      setAttributes(label, { opacity: appear(time, at.sample + .7 + i * .15, .3).toFixed(3) });
      setAttributes(dot, { opacity: appear(time, at.more + i * .12, .3).toFixed(3) });
    });
    setAttributes(sizeHeader, { opacity: appear(time, at.sample + .7, .3).toFixed(3) });
    setAttributes(guide, { opacity: appear(time, at.same, .4).toFixed(3) });
    setAttributes(guideLabel, { opacity: appear(time, at.same, .4).toFixed(3) });
    setAttributes(sampleNote, { opacity: appear(time, at.more + .4, .4).toFixed(3) });

    const farmShown = appear(time, at.farm, .4) * (1 - appear(time, at.invest, .4));
    setAttributes(farm, { opacity: farmShown.toFixed(3) });
    const grow = ease(progress(time, at.field, .7));
    setAttributes(soil, { width: lerp(240, 480, grow).toFixed(1) });
    // 넓어지는 밭이 닿은 자리에만 싹이 난다.
    const soilRight = 160 + lerp(240, 480, grow);
    crops.forEach(({ column, element: crop }) => setAttributes(crop, { opacity: clamp((soilRight - (190 + column * 40 + 14)) / 20).toFixed(3) }));
    setAttributes(fieldLabel, { opacity: appear(time, at.field, .4).toFixed(3) });
    setAttributes(doubled, { opacity: appear(time, at.field, .3).toFixed(3) });
    const fieldRight = lerp(400, 640, grow);
    setAttributes(doubledLine, { d: `M170 566 H${(fieldRight - 10).toFixed(1)} M170 556 v20 M${(fieldRight - 10).toFixed(1)} 556 v20` });
    setAttributes(water, { opacity: appear(time, at.water, .4).toFixed(3) });
    drops.forEach((drop, i) => {
      const fall = ((time - at.water) * 1.4 + i / drops.length) % 1;
      const x = 270 + i * 22;
      setAttributes(drop, { transform: `translate(${x} ${(300 + fall * 60).toFixed(1)})`, opacity: (time < at.water ? 0 : 1 - fall).toFixed(3) });
    });
    setAttributes(fertilizer, { opacity: appear(time, at.fertilizer, .4).toFixed(3) });

    const tableShown = appear(time, at.table, .4) * (1 - appear(time, at.invest, .4));
    setAttributes(table, { opacity: tableShown.toFixed(3) });
    rows.forEach((row, i) => setAttributes(row, { opacity: appear(time, at.table + .2 + i * .2, .3).toFixed(3) }));
    setAttributes(shift, { opacity: (appear(time, at.gamble, .3) * (1 - appear(time, at.invest, .4))).toFixed(3) });
    shiftWord.update(time, (t) => (t < at.gamble ? '' : t < at.engineering ? '도박에서' : '공학으로'));
    shiftWord.toggleClass('engineering', time >= at.engineering);

    setAttributes(invest, { opacity: appear(time, at.invest, .4).toFixed(3) });
    investLine.draw(appear(time, at.invest, .5));
    const sweep = lerp(-7, -1, ease(progress(time, at.sweep, 2.2)));
    const cx = investChart.toX(sweep);
    const cy = investChart.toY(lossOfCompute(10 ** sweep));
    setAttributes(cursorV, { x1: cx, y1: 640, x2: cx, y2: cy });
    setAttributes(cursorH, { x1: 330, y1: cy, x2: cx, y2: cy });
    setAttributes(cursorDot, { cx, cy });
    setAttributes(cursor, { opacity: appear(time, at.sweep, .3).toFixed(3) });
    setAttributes(readout, { opacity: appear(time, at.readout, .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: '스케일링 법칙',
    start,
    end,
    chapters: [
      { time: start, title: '크기·데이터·연산' },
      { time: at.predict, title: '미리 계산할 수 있을 만큼' },
      { time: at.sample, title: '같은 글에서 더 많이' },
      { time: at.farm, title: '농사로 비유하면' },
      { time: at.gamble, title: '도박에서 공학으로' },
    ],
  };
};
