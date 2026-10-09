import './alexnet-tricks.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 20:52.8 "알렉스넷에는 작지만 중요한 요령이 세 가지" ~ 21:27.6 "여기서 세 바퀴가 처음으로".
const start = 1252.833;
const end = 1287.567;
const intro = 1254.7; // "세 가지"
const relu = { start: 1255.933, draw: 1256.2, negative: 1258.3, positive: 1259.6, signal: 1262.8 };
const dropout = { start: 1265.267, steps: 1268.4, stepLength: .9, even: 1277.7 };
const augment = { start: 1279.033, flip: 1282, crop: 1282.4, both: 1282.8, more: [1285, 1285.6, 1286.3] };

const tricks = [
  { name: 'relu', label: 'ReLU', at: relu.start },
  { name: 'dropout', label: '드롭아웃', at: dropout.start },
  { name: 'augment', label: '데이터 증강', at: augment.start },
];

// 시점마다 같은 값이 나오는 의사 난수. 탐색해도 쉬는 뉴런이 똑같이 고정된다.
const random = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 패널이 자기 구간에서만 보이도록: 들어올 때 서서히 나타나고, 다음 패널이 오면 사라진다.
const panelOpacity = (time: number, from: number, to: number) => appear(time, from, .4) * (1 - appear(time, to, .4));

const createTabs = (root: SVGElement) =>
  tricks.map(({ name, label }, index) => {
    const group = svg('g', { class: `alexnet-tab alexnet-tab-${name}`, transform: `translate(${560 + index * 240} 150)` }, root);
    svg('rect', { x: -105, y: -32, width: 210, height: 64, rx: 32 }, group);
    text(group, 0, 11, label);
    return group;
  });

const createRelu = (root: SVGElement) => {
  const panel = svg('g', { class: 'alexnet-panel' }, root);
  const origin = { x: 520, y: 640 };
  const unit = 240;
  svg('path', { class: 'alexnet-axis', d: `M${origin.x - 300} ${origin.y} H${origin.x + 300} M${origin.x} ${origin.y + 80} V${origin.y - 340}` }, panel);
  text(panel, origin.x + 316, origin.y + 10, '입력', { class: 'alexnet-axis-label' });
  text(panel, origin.x, origin.y - 360, '출력', { class: 'alexnet-axis-label', 'text-anchor': 'middle' });
  const negative = svg('path', { class: 'alexnet-relu-negative', d: `M${origin.x - unit} ${origin.y} H${origin.x}`, pathLength: 1 }, panel);
  const positive = svg('path', { class: 'alexnet-relu-positive', d: `M${origin.x} ${origin.y} L${origin.x + unit} ${origin.y - unit}`, pathLength: 1 }, panel);
  const negativeLabel = text(panel, origin.x - unit, origin.y + 64, '음수 → 0', { class: 'alexnet-relu-negative-label' });
  const positiveLabel = text(panel, origin.x + 150, origin.y - 40, '양수 → 그대로', { class: 'alexnet-relu-positive-label' });
  const guide = svg('path', { class: 'alexnet-relu-guide' }, panel);
  const dot = svg('circle', { class: 'alexnet-relu-dot', r: 14 }, panel);

  // 같은 신호가 여섯 층을 지나며 얼마나 남는지: 이전 방식은 흐려지고 ReLU는 그대로 전해진다.
  const signal = svg('g', { class: 'alexnet-signal' }, panel);
  const rows = [
    { label: '이전 방식', y: 440, strength: (i: number) => .5 ** i, left: '3%' },
    { label: 'ReLU', y: 650, strength: () => 1, left: '100%' },
  ].map(({ label, y, strength, left }) => {
    text(signal, 940, y - 64, label, { class: 'alexnet-signal-label' });
    svg('path', { class: 'alexnet-signal-wire', d: `M940 ${y} H1420` }, signal);
    const nodes = Array.from({ length: 6 }, (_, i) => svg('circle', { class: 'alexnet-signal-node', cx: 940 + i * 96, cy: y, r: 26 }, signal));
    const remaining = text(signal, 1470, y + 10, left, { class: 'alexnet-signal-left' });
    return { nodes, strength, remaining };
  });

  return (time: number) => {
    const draw = progress(time, relu.draw, .8);
    setAttributes(negative, { 'stroke-dashoffset': (1 - draw).toFixed(3) });
    setAttributes(positive, { 'stroke-dashoffset': (1 - draw).toFixed(3) });
    negative.classList.toggle('active', time >= relu.negative);
    positive.classList.toggle('active', time >= relu.positive);
    setAttributes(negativeLabel, { opacity: appear(time, relu.negative).toFixed(3) });
    setAttributes(positiveLabel, { opacity: appear(time, relu.positive).toFixed(3) });

    // 입력을 왼쪽 끝에서 오른쪽 끝까지 훑으며 출력이 어떻게 되는지 보여준다.
    const input = lerp(-1, 1, progress(time, relu.negative, 3));
    const x = origin.x + input * unit;
    const y = origin.y - Math.max(input, 0) * unit;
    const sweeping = appear(time, relu.negative, .3) * (1 - appear(time, relu.signal - .5, .4));
    setAttributes(dot, { cx: x.toFixed(1), cy: y.toFixed(1), opacity: sweeping.toFixed(3) });
    setAttributes(guide, { d: `M${x.toFixed(1)} ${origin.y} V${y.toFixed(1)}`, opacity: sweeping.toFixed(3) });

    setAttributes(signal, { opacity: appear(time, relu.signal - .3, .4).toFixed(3) });
    const reach = progress(time, relu.signal, 1.8) * 6;
    for (const { nodes, strength, remaining } of rows) {
      nodes.forEach((node, i) => {
        const lit = Math.min(Math.max(reach - i, 0), 1);
        setAttributes(node, { 'fill-opacity': (.06 + lit * strength(i) * .94).toFixed(3) });
      });
      setAttributes(remaining, { opacity: Math.min(Math.max(reach - 5, 0), 1).toFixed(3) });
    }
  };
};

const createDropout = (root: SVGElement) => {
  const panel = svg('g', { class: 'alexnet-panel' }, root);
  const layers = [4, 6, 6, 3].map((size, layer) =>
    Array.from({ length: size }, (_, i) => ({ layer, i, x: 360 + layer * 290, y: 540 + (i - (size - 1) / 2) * 92 })),
  );
  const edges = layers.slice(1).flatMap((layer, index) =>
    layer.flatMap((to) => layers[index].map((from) => ({ from, to, line: svg('line', { class: 'alexnet-edge', x1: from.x, y1: from.y, x2: to.x, y2: to.y }, panel) }))),
  );
  const nodes = layers.flat().map((node) => ({
    ...node,
    ring: node.layer === 1 || node.layer === 2 ? svg('circle', { class: 'alexnet-ring', cx: node.x, cy: node.y, r: 38, pathLength: 1 }, panel) : undefined,
    circle: svg('circle', { class: 'alexnet-node', cx: node.x, cy: node.y, r: 26 }, panel),
    // 쉬는 모습(점선 회색)을 위에 겹쳐 두고 투명도로 섞는다.
    rest: svg('circle', { class: 'alexnet-node off', cx: node.x, cy: node.y, r: 26, opacity: 0 }, panel),
  }));
  const counter = text(panel, 795, 860, '', { class: 'alexnet-counter', 'text-anchor': 'middle' });
  const ringLabel = text(panel, 795, 236, '바깥 고리 · 쓰인 횟수', { class: 'alexnet-ring-label' });

  // 은닉층 뉴런은 학습 회차마다 40% 확률로 쉰다. 한 층에서 쉬는 뉴런은 많아야 셋.
  const resting = (step: number, layer: number, i: number) => {
    if (step < 0 || (layer !== 1 && layer !== 2)) {
      return false;
    }
    const draws = Array.from({ length: 6 }, (_, j) => random(step * 31 + layer * 7 + j));
    const lower = draws.filter((draw) => draw < draws[i]).length;
    return draws[i] < .4 && lower < 3;
  };

  // 회차가 바뀔 때 이전 회차 상태에서 새 상태로 이만큼 동안 섞는다(뚝뚝 끊기지 않게).
  const blend = .35;
  const offIn = (step: number, layer: number, i: number) => (resting(step, layer, i) ? 1 : 0);
  const usageIn = (step: number, layer: number, i: number) => {
    if (step < 0) {
      return 0;
    }
    let used = 0;
    for (let k = 0; k <= step; k++) {
      used += resting(k, layer, i) ? 0 : 1;
    }
    return used / (step + 1);
  };

  return (time: number) => {
    const step = time < dropout.steps ? -1 : Math.floor((time - dropout.steps) / dropout.stepLength);
    const mix = step < 0 ? 0 : ease(progress(time, dropout.steps + step * dropout.stepLength, blend));
    const off = new Map(
      nodes.map(({ layer, i }) => [`${layer}-${i}`, step < 0 ? 0 : lerp(step > 0 ? offIn(step - 1, layer, i) : 0, offIn(step, layer, i), mix)]),
    );
    for (const node of nodes) {
      const value = off.get(`${node.layer}-${node.i}`)!;
      setAttributes(node.circle, { opacity: (1 - value).toFixed(3) });
      setAttributes(node.rest, { opacity: value.toFixed(3) });
      if (node.ring) {
        const usage = lerp(usageIn(step - 1, node.layer, node.i), usageIn(step, node.layer, node.i), mix);
        setAttributes(node.ring, { 'stroke-dasharray': `${usage.toFixed(3)} 1`, opacity: appear(time, dropout.steps, .4).toFixed(3) });
      }
    }
    for (const { from, to, line } of edges) {
      const value = Math.max(off.get(`${from.layer}-${from.i}`)!, off.get(`${to.layer}-${to.i}`)!);
      setAttributes(line, { opacity: lerp(.8, .08, value).toFixed(3) });
    }
    counter.textContent = step < 0 ? '' : `학습 ${step + 1}회째`;
    setAttributes(ringLabel, { opacity: appear(time, dropout.even - 2.3).toFixed(3) });
    ringLabel.classList.toggle('even', time >= dropout.even);
  };
};

const photoWidth = 300;
const photoHeight = 200;

// 데이터 증강에 쓸 그림 한 장: 해가 왼쪽 위에 있고 꼬리가 오른쪽으로 말린 고양이. 뒤집으면 차이가 바로 보인다.
const definePhoto = (root: SVGElement) => {
  const defs = svg('defs', {}, root);
  const symbol = svg('symbol', { id: 'alexnet-photo', viewBox: `0 0 ${photoWidth} ${photoHeight}` }, defs);
  svg('rect', { width: photoWidth, height: photoHeight, fill: '#22324f' }, symbol);
  svg('circle', { cx: 55, cy: 45, r: 22, fill: '#ffd75b' }, symbol);
  svg('rect', { y: 160, width: photoWidth, height: 40, fill: '#2f5d46' }, symbol);
  svg('path', { d: 'M222 150 C250 140 252 108 238 92', fill: 'none', stroke: '#f0a35e', 'stroke-width': 12, 'stroke-linecap': 'round' }, symbol);
  svg('ellipse', { cx: 180, cy: 140, rx: 50, ry: 32, fill: '#f0a35e' }, symbol);
  svg('polygon', { points: '118,86 120,56 140,76', fill: '#f0a35e' }, symbol);
  svg('polygon', { points: '142,74 160,56 164,86', fill: '#f0a35e' }, symbol);
  svg('circle', { cx: 141, cy: 102, r: 30, fill: '#f0a35e' }, symbol);
  svg('circle', { cx: 131, cy: 98, r: 4, fill: '#1d1d1d' }, symbol);
  svg('circle', { cx: 151, cy: 98, r: 4, fill: '#1d1d1d' }, symbol);
  svg('polygon', { points: '137,108 145,108 141,113', fill: '#c85c6b' }, symbol);
  for (const [width, height] of [[400, 267], [260, 173]]) {
    const clip = svg('clipPath', { id: `alexnet-clip-${width}` }, defs);
    svg('rect', { width, height, rx: 14 }, clip);
  }
};

const createCard = (parent: SVGElement, width: number, height: number, viewBox: string, flipped: boolean) => {
  const card = svg('g', { class: 'alexnet-card' }, parent);
  const clipped = svg('g', { 'clip-path': `url(#alexnet-clip-${width})` }, card);
  const frame = svg('svg', { width, height, viewBox, preserveAspectRatio: 'xMidYMid slice' }, clipped);
  svg('use', { href: '#alexnet-photo', width: photoWidth, height: photoHeight, transform: flipped ? `translate(${photoWidth} 0) scale(-1 1)` : '' }, frame);
  svg('rect', { class: 'alexnet-card-border', width, height, rx: 14 }, card);
  return card;
};

const createAugment = (root: SVGElement) => {
  const panel = svg('g', { class: 'alexnet-panel' }, root);
  definePhoto(root);
  const original = createCard(panel, 400, 267, `0 0 ${photoWidth} ${photoHeight}`, false);
  setAttributes(original, { transform: 'translate(150 318)' });
  text(panel, 350, 290, '원본', { class: 'alexnet-card-label', 'text-anchor': 'middle' });
  const arrow = svg('path', { class: 'alexnet-arrow', d: 'M584 452 H664 M644 432 L664 452 L644 472' }, panel);

  const variants = [
    { label: '뒤집기', viewBox: '0 0 300 200', flipped: true, at: augment.flip },
    { label: '자르기', viewBox: '95 55 165 110', flipped: false, at: augment.crop },
    { label: '뒤집고 자르기', viewBox: '40 40 180 120', flipped: true, at: augment.both },
    { label: '자르기', viewBox: '0 0 195 130', flipped: false, at: augment.more[0] },
    { label: '뒤집고 자르기', viewBox: '60 70 210 140', flipped: true, at: augment.more[1] },
    { label: '자르기', viewBox: '120 80 180 120', flipped: false, at: augment.more[2] },
  ].map(({ label, viewBox, flipped, at }, index) => {
    const x = 700 + (index % 3) * 290;
    const y = 250 + Math.floor(index / 3) * 300;
    const group = svg('g', {}, panel);
    const card = createCard(group, 260, 173, viewBox, flipped);
    setAttributes(card, { transform: `translate(${x} ${y})` });
    text(group, x + 130, y + 216, label, { class: 'alexnet-card-label', 'text-anchor': 'middle' });
    return { group, at };
  });

  return (time: number) => {
    setAttributes(arrow, { opacity: appear(time, augment.flip - .2).toFixed(3) });
    for (const { group, at } of variants) {
      const shown = appear(time, at, .45);
      setAttributes(group, { opacity: shown.toFixed(3), transform: `translate(0 ${((1 - shown) * 24).toFixed(1)})` });
    }
  };
};

export const createAlexNetTricksScene = (): Scene => {
  const { element, root } = createDiagram('alexnet', '알렉스넷의 세 요령');
  const tabs = createTabs(root);
  const panels = [createRelu(root), createDropout(root), createAugment(root)];
  const groups = [...root.querySelectorAll<SVGGElement>(':scope > .alexnet-panel')];

  const update = (time: number) => {
    tabs.forEach((tab, index) => {
      const shown = appear(time, intro + index * .2, .4);
      setAttributes(tab, { opacity: shown.toFixed(3) });
      const next = tricks[index + 1]?.at ?? end;
      tab.classList.toggle('active', tricks[index].at <= time && time < next);
      tab.classList.toggle('done', time >= next);
    });
    panels.forEach((render, index) => {
      const next = tricks[index + 1]?.at ?? end + 1;
      setAttributes(groups[index], { opacity: panelOpacity(time, tricks[index].at, next).toFixed(3) });
      render(time);
    });
  };

  return {
    element,
    update,
    title: '알렉스넷의 세 요령',
    start,
    end,
    chapters: [
      { time: relu.start, title: 'ReLU' },
      { time: relu.signal, title: '깊은 층까지 전해지는 신호' },
      { time: dropout.start, title: '드롭아웃' },
      { time: dropout.even, title: '골고루 배우기' },
      { time: augment.start, title: '데이터 증강' },
    ],
  };
};
