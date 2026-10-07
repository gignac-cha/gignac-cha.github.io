import './depth.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';

export interface DepthTimeline {
  alexnet: number;
  alexnetLabel: number;
  deeper: number;
  edges: number;
  parts: number;
  whole: number;
  abstract: number;
  compare: number;
  vgg: number;
  vggDeeper: number;
  vggKernels: number;
  googlenet: number;
  winner: number;
  homage: number;
  belief: number;
}

const baseline = 720;
const BLUE = '#5b9dff';
const PURPLE = '#b18cff';
const GREEN = '#4fd18b';
const GRAY = '#55565e';

const hex = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
const mix = (from: string, to: string, t: number) => {
  const a = hex(from);
  const b = hex(to);
  return `#${a.map((value, i) => Math.round(lerp(value, b[i], t)).toString(16).padStart(2, '0')).join('')}`;
};

// 아래층은 파랑(선), 가운데는 보라(부품), 위층은 초록(전체 모양).
const levelColor = (t: number) => (t < .5 ? mix(BLUE, PURPLE, t * 2) : mix(PURPLE, GREEN, (t - .5) * 2));

const SLAB = 'M-110 9 L70 9 L110 -9 L-70 -9 Z';

const createTower = (parent: Element, count: number, name: string, layers: string) => {
  const group = svg('g', {}, parent);
  const slabs = Array.from({ length: count }, () => svg('path', { d: SLAB, 'stroke-width': 2 }, group));
  const label = svg('g', {}, group);
  const title = text(label, 0, 790, name, { class: 'depth-tower-name' });
  text(label, 0, 834, layers, { class: 'depth-tower-layers' });
  return { group, slabs, label, title };
};

const tile = (parent: Element, x: number, y: number, width: number, draw: string, color: string) => {
  const group = svg('g', { transform: `translate(${x} ${y})` }, parent);
  svg('rect', { class: 'depth-tile', width, height: 120, rx: 14 }, group);
  const art = svg('g', { fill: 'none', stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, group);
  art.innerHTML = draw;
  return group;
};

const rows = [
  {
    level: '첫 층',
    name: '선 · 모서리',
    color: BLUE,
    y: 648,
    slabs: [0, 1, 2],
    tiles: [
      [120, '<path d="M24 60 H96" />'],
      [120, '<path d="M60 24 V96" />'],
      [120, '<path d="M30 90 L90 30" />'],
      [120, '<path d="M34 32 V88 H90" />'],
    ],
  },
  {
    level: '다음 층',
    name: '부품',
    color: PURPLE,
    y: 432,
    slabs: [3, 4, 5],
    tiles: [
      [120, '<path d="M18 60 Q60 26 102 60 Q60 94 18 60 Z" /><circle cx="60" cy="60" r="13" />'],
      [120, '<circle cx="60" cy="60" r="38" /><circle cx="60" cy="60" r="9" /><path d="M60 22 V51 M60 69 V98 M22 60 H51 M69 60 H98" />'],
      [120, '<path d="M24 82 L38 42 H82 L96 82 Z" /><path d="M60 42 V82" />'],
      [120, '<path d="M62 24 Q44 70 54 84 Q62 92 76 84" />'],
    ],
  },
  {
    level: '위층',
    name: '전체 모양',
    color: GREEN,
    y: 252,
    slabs: [6, 7],
    tiles: [
      [120, '<circle cx="60" cy="60" r="40" /><circle cx="46" cy="52" r="4" /><circle cx="74" cy="52" r="4" /><path d="M44 72 Q60 86 76 72" />'],
      [216, '<path d="M18 84 L40 52 H128 L162 70 H198 V92 H18 Z" /><path d="M52 52 L44 70 H86 V52 M98 52 V70 H140 L124 52" /><circle cx="56" cy="94" r="15" /><circle cx="160" cy="94" r="15" />'],
    ],
  },
] as const;

export const createDepth = (timeline: DepthTimeline) => {
  const { element, root } = createDiagram('depth', '층이 깊을수록');

  // 층별로 보는 것
  const hierarchy = svg('g', {}, root);
  const rowGroups = rows.map((row, index) => {
    const group = svg('g', { class: 'depth-row' }, hierarchy);
    const bracket = svg('path', { class: 'depth-bracket', stroke: row.color }, group);
    text(group, 640, row.y - 14, row.level, { class: 'depth-row-level' });
    text(group, 640, row.y + 30, row.name, { class: 'depth-row-name', style: `fill: ${row.color}` });
    let x = 880;
    for (const [width, draw] of row.tiles) {
      tile(group, x, row.y - 60, width, draw, row.color);
      x += width + 24;
    }
    return { group, bracket, at: [timeline.edges, timeline.parts, timeline.whole][index] };
  });
  const abstract = svg('g', { class: 'depth-abstract' }, hierarchy);
  svg('path', { d: 'M1500 708 V200 M1484 222 L1500 200 L1516 222' }, abstract);
  text(abstract, 0, 0, '더 추상적', { transform: 'translate(1546 454) rotate(-90)' });

  const ghosts = svg('g', { class: 'depth-ghosts' }, root);
  svg('path', { d: SLAB, transform: `translate(300 ${baseline - 8 * 72})` }, ghosts);
  text(ghosts, 440, baseline - 8 * 72 + 10, '더 쌓으면?', { class: 'depth-ghost-label' });

  const alexnet = createTower(root, 8, '알렉스넷', '8층');
  const vgg = createTower(root, 19, 'VGG', '16~19층');
  const googlenet = createTower(root, 22, '', '22층');
  googlenet.title.innerHTML = '<tspan>Goog</tspan><tspan class="depth-homage">LeNet</tspan>';
  const homage = googlenet.title.querySelector('.depth-homage')!;

  const kernels = vgg.slabs.map((_, index) => {
    const group = svg('g', { class: 'depth-kernel', transform: `translate(${800 + 124} ${baseline - index * 24 - 9})` }, root);
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        svg('rect', { x: column * 7, y: row * 7, width: 6, height: 6 }, group);
      }
    }
    return group;
  });
  const winner = svg('g', { class: 'depth-winner' }, root);
  svg('rect', { x: 1180 - 90, y: 138, width: 180, height: 52, rx: 26 }, winner);
  text(winner, 1180, 174, '대회 우승', {});

  const belief = svg('g', { class: 'depth-belief' }, root);
  // 세 탑의 꼭대기를 위로 휘어 넘으며 잇는다. 곧게 이으면 VGG 탑을 가로지른다.
  const beliefLine = svg('path', { d: 'M420 470 Q560 160 800 220 Q990 140 1180 150' }, belief);
  svg('path', { d: 'M1160 134 L1182 150 L1160 168' }, belief);
  text(belief, 1214, 162, '깊이 = 실력?', { class: 'depth-belief-label' });
  const beliefLength = 1100;

  const update = (time: number) => {
    const compare = ease(progress(time, timeline.compare, .9));

    // 알렉스넷: 한 층씩 쌓인다. 비교 단계에서는 왼쪽으로 옮겨가며 촘촘해진다.
    const spacing = lerp(72, 24, compare);
    // 처음엔 가운데에 쌓이고, 층별 설명이 시작되면 왼쪽으로 비켜선다.
    const aside = ease(progress(time, timeline.edges - .9, .8));
    const alexX = lerp(lerp(800, 300, aside), 420, compare);
    setAttributes(alexnet.group, { transform: `translate(${alexX.toFixed(1)} 0)` });
    alexnet.slabs.forEach((slab, index) => {
      const shown = appear(time, timeline.alexnet + index * .14, .3);
      const highlight = rows.find((row) => (row.slabs as readonly number[]).includes(index));
      const row = highlight ? rows.indexOf(highlight) : -1;
      const lit = row >= 0 ? appear(time, rowGroups[row].at, .4) * (1 - compare) : 0;
      const color = mix(GRAY, compare > 0 ? levelColor(index / 7) : highlight?.color ?? GRAY, Math.max(lit, compare));
      setAttributes(slab, {
        transform: `translate(0 ${(baseline - index * spacing - (1 - shown) * 30).toFixed(1)})`,
        opacity: shown.toFixed(3),
        stroke: color,
        fill: color,
        'fill-opacity': (.12 + .18 * Math.max(lit, compare)).toFixed(3),
      });
    });
    setAttributes(alexnet.label, { opacity: appear(time, timeline.alexnetLabel, .5).toFixed(3) });
    setAttributes(ghosts, { opacity: (appear(time, timeline.deeper, .4) * (1 - appear(time, timeline.edges - 1.2, .4))).toFixed(3), transform: `translate(${(alexX - 300).toFixed(1)} 0)` });

    // 층별로 보는 것
    setAttributes(hierarchy, { opacity: (1 - compare).toFixed(3) });
    rows.forEach((row, index) => {
      const shown = appear(time, rowGroups[index].at, .5);
      setAttributes(rowGroups[index].group, { opacity: shown.toFixed(3) });
      const top = baseline - Math.max(...row.slabs) * 72;
      const bottom = baseline - Math.min(...row.slabs) * 72;
      const reach = lerp(300 + 130, 610, ease(progress(time, rowGroups[index].at, .5)));
      setAttributes(rowGroups[index].bracket, { d: `M430 ${top} H450 V${bottom} H430 M450 ${row.y} H${reach.toFixed(1)}` });
    });
    setAttributes(abstract, { opacity: appear(time, timeline.abstract, .5).toFixed(3) });

    // VGG와 구글넷: 층이 하나씩 쌓인다
    const build = (tower: ReturnType<typeof createTower>, x: number, count: (time: number) => number, labelAt: number) => {
      setAttributes(tower.group, { transform: `translate(${x} 0)` });
      const built = count(time);
      tower.slabs.forEach((slab, index) => {
        const shown = Math.min(Math.max(built - index, 0), 1);
        const color = levelColor(index / (tower.slabs.length - 1));
        setAttributes(slab, {
          transform: `translate(0 ${(baseline - index * 24 - (1 - shown) * 20).toFixed(1)})`,
          opacity: shown.toFixed(3),
          stroke: color,
          fill: color,
          'fill-opacity': .3,
        });
      });
      setAttributes(tower.label, { opacity: appear(time, labelAt, .5).toFixed(3) });
    };
    build(vgg, 800, (t) => lerp(0, 16, progress(t, timeline.vgg, timeline.vggDeeper - timeline.vgg)) + lerp(0, 3, progress(t, timeline.vggDeeper, .7)), timeline.vgg);
    build(googlenet, 1180, (t) => lerp(0, 22, progress(t, timeline.googlenet, 1.5)), timeline.googlenet);

    kernels.forEach((kernel, index) => setAttributes(kernel, { opacity: appear(time, timeline.vggKernels + index * .07, .25).toFixed(3) }));
    setAttributes(winner, { opacity: (appear(time, timeline.winner, .4) * (1 - appear(time, timeline.homage - .4, .4))).toFixed(3) });
    homage.classList.toggle('on', time >= timeline.homage);

    const drawn = ease(progress(time, timeline.belief, 1));
    setAttributes(belief, { opacity: drawn > 0 ? 1 : 0 });
    setAttributes(beliefLine, { 'stroke-dasharray': beliefLength, 'stroke-dashoffset': ((1 - drawn) * beliefLength).toFixed(1) });
    for (const child of [...belief.children].slice(1)) {
      setAttributes(child, { opacity: progress(time, timeline.belief + .8, .4).toFixed(3) });
    }
  };

  return { element, update };
};
