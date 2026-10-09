import './gan.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import { drawFace, FACE_HEIGHT, FACE_WIDTH, faces } from './face.ts';

export interface GanWeaknessTimeline {
  balance: number;
  tilt: number;
  collapse: number;
  repeat: number;
  fooled: number;
  modeCollapse: number;
}

// 학습 곡선: 처음엔 매끄럽게 오르다가 균형이 틀어진 뒤로는 요동치며 무너진다.
const curve = (x: number) => {
  if (x <= .6) {
    return .15 + .55 * (1 - Math.exp(-x * 4.2));
  }
  const after = (x - .6) / .4;
  const peak = .15 + .55 * (1 - Math.exp(-.6 * 4.2));
  return peak - after * .5 + Math.sin(after * 26) * .12 * after;
};

const chart = { left: 980, right: 1480, top: 300, bottom: 640 };

const curvePath = (from: number, to: number) => {
  const points: string[] = [];
  const steps = Math.max(2, Math.round((to - from) * 160));
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    const px = lerp(chart.left, chart.right, x);
    const py = lerp(chart.bottom, chart.top, curve(x));
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return `M${points.join('L')}`;
};

export const createGanWeakness = (timeline: GanWeaknessTimeline) => {
  const { element, root } = createDiagram('gan', 'GAN의 약점');

  // 1. 위조범과 경찰의 균형
  const balance = svg('g', {}, root);
  const pivot = { x: 520, y: 560 };
  svg('path', { class: 'gan-fulcrum', d: `M${pivot.x} ${pivot.y + 6} L${pivot.x - 54} ${pivot.y + 96} H${pivot.x + 54} Z` }, balance);
  const beam = svg('line', { class: 'gan-beam' }, balance);
  const pans = ['위조범', '경찰'].map((label, index) => {
    const group = svg('g', { class: `gan-pan gan-pan-${index === 0 ? 'forge' : 'police'}` }, balance);
    svg('line', { class: 'gan-pan-string', x1: 0, y1: 0, x2: 0, y2: 60 }, group);
    svg('rect', { x: -110, y: 60, width: 220, height: 96, rx: 18 }, group);
    text(group, 0, 120, label, {});
    return group;
  });

  const graph = svg('g', {}, root);
  svg('path', { class: 'gan-axis', d: `M${chart.left} ${chart.top - 20} V${chart.bottom} H${chart.right + 20}` }, graph);
  text(graph, chart.left, chart.top - 44, '학습', { class: 'gan-graph-label' });
  const healthy = svg('path', { class: 'gan-curve' }, graph);
  const broken = svg('path', { class: 'gan-curve broken' }, graph);
  const collapsed = text(graph, chart.right, chart.top - 44, '학습 붕괴', { class: 'gan-collapse-label' });

  // 2. 한 가지 그림만 반복하는 위조범
  const collapse = svg('g', {}, root);
  const width = 150;
  const height = (width * FACE_HEIGHT) / FACE_WIDTH;
  const columns = 6;
  const gap = 30;
  const startX = 800 - ((width + gap) * columns - gap) / 2 + 60;
  const rows = [
    { label: '기대', y: 175, variants: [0, 1, 2, 3, 4, 5] },
    { label: '실제', y: 470, variants: [0, 0, 0, 0, 0, 0] },
  ].map((row, rowIndex) => {
    const group = svg('g', { class: `gan-row gan-row-${rowIndex === 0 ? 'expected' : 'actual'}` }, collapse);
    text(group, startX - 48, row.y + height / 2 + 12, row.label, { class: 'gan-row-label' });
    const cells = row.variants.map((variant, column) => {
      const cell = svg('g', { transform: `translate(${startX + column * (width + gap)} ${row.y})` }, group);
      svg('rect', { class: 'gan-cell-frame', x: -3, y: -3, width: width + 6, height: height + 6, rx: 8 }, cell);
      const face = drawFace(cell, faces[variant]);
      setAttributes(face, { transform: `scale(${width / FACE_WIDTH})` });
      const badge = svg('g', { class: 'gan-badge pass', transform: `translate(${width} 0)` }, cell);
      svg('circle', { r: 22 }, badge);
      text(badge, 0, 10, '✓', { class: 'gan-badge-glyph' });
      return { cell, badge };
    });
    return { group, cells };
  });
  const mode = text(collapse, 800, 800, '모드 붕괴 · 경찰을 속이는 요령 하나만 반복', { class: 'gan-mode-label' });

  const update = (time: number) => {
    const switchOver = appear(time, timeline.repeat - .6, .5);
    setAttributes(balance, { opacity: ((1 - switchOver) * appear(time, timeline.balance, .5)).toFixed(3) });
    setAttributes(graph, { opacity: ((1 - switchOver) * appear(time, timeline.balance + .4, .5)).toFixed(3) });
    setAttributes(collapse, { opacity: switchOver.toFixed(3) });

    // 균형이 조금만 틀어져도 위조범 쪽으로 기운다
    const tilt = ease(progress(time, timeline.tilt, .7));
    const wobble = Math.sin(Math.max(time - timeline.tilt, 0) * 9) * 2.5 * (1 - progress(time, timeline.tilt + .6, 1.4)) * tilt;
    const angle = ((-11 * tilt + wobble) * Math.PI) / 180;
    const ends = [-1, 1].map((side) => ({
      x: pivot.x + Math.cos(angle) * 300 * side,
      y: pivot.y + Math.sin(angle) * 300 * side,
    }));
    setAttributes(beam, { x1: ends[0].x.toFixed(1), y1: ends[0].y.toFixed(1), x2: ends[1].x.toFixed(1), y2: ends[1].y.toFixed(1) });
    pans.forEach((pan, index) => setAttributes(pan, { transform: `translate(${ends[index].x.toFixed(1)} ${ends[index].y.toFixed(1)})` }));

    // 학습 곡선
    const drawn = .6 * ease(progress(time, timeline.balance + .4, timeline.tilt - timeline.balance - .4));
    const fall = .4 * ease(progress(time, timeline.collapse, 1.2));
    setAttributes(healthy, { d: curvePath(0, Math.max(drawn, .001)) });
    setAttributes(broken, { d: curvePath(.6, .6 + Math.max(fall, .001)), opacity: fall > 0 ? 1 : 0 });
    setAttributes(collapsed, { opacity: appear(time, timeline.collapse + .6, .5).toFixed(3) });

    // 기대는 여러 얼굴, 실제로는 같은 얼굴만 하나씩 채워진다
    rows[0].cells.forEach(({ cell, badge }) => {
      setAttributes(cell, { opacity: (.45 * switchOver).toFixed(3) });
      setAttributes(badge, { opacity: 0 });
    });
    rows[1].cells.forEach(({ cell, badge }, index) => {
      setAttributes(cell, { opacity: appear(time, timeline.repeat + index * .26, .35).toFixed(3) });
      setAttributes(badge, { opacity: appear(time, timeline.fooled + index * .12, .3).toFixed(3) });
    });
    setAttributes(mode, { opacity: appear(time, timeline.modeCollapse, .5).toFixed(3) });
  };

  return { element, update };
};
