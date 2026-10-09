import './deep-belief-net.scss';
import { appear, clamp, createDiagram, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { withThree } from '../../../shared/three-scene.ts';
import { at, end, start } from './timing.ts';

const centerX = 1100;
const layers = [
  { y: 790, count: 8, name: '입력' },
  { y: 645, count: 6, name: '1층' },
  { y: 505, count: 5, name: '2층' },
  { y: 365, count: 4, name: '3층' },
  { y: 230, count: 3, name: '4층' },
];
const spacing = 100;

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const nodeX = (layer: number, i: number) => centerX + (i - (layers[layer].count - 1) / 2) * spacing;

// naiveTower: false 면 왼쪽 탑을 그리지 않는다(Three.js 판이 그 자리에 3D 탑을 얹는다). 글자는 그대로 둔다.
export const createDeepBeliefNetSvg = ({ naiveTower = true } = {}): Scene => {
  const { element, root } = createDiagram('deep-belief-net', '심층 신뢰망');

  // 왼쪽: 한꺼번에 올린 10층은 무너진다.
  const naive = svg('g', { class: 'dbn-naive', display: naiveTower ? 'inline' : 'none' }, root);
  const naiveFloors = Array.from({ length: 10 }, (_, i) =>
    svg('rect', { x: 190, y: 742 - i * 44, width: 300, height: 36, rx: 6, class: 'dbn-naive-floor' }, naive),
  );
  const naiveLabel = text(root, 340, 836, '한꺼번에 10층', { class: 'dbn-caption' });

  // 오른쪽: 한 층씩 쌓는 깊은 신경망.
  const links = svg('g', {}, root);
  const slabs = svg('g', {}, root);
  const nodesGroup = svg('g', {}, root);
  const layerViews = layers.map((layer, index) => {
    const width = layer.count * spacing + 24;
    const slab = svg('rect', { x: centerX - width / 2, y: layer.y - 36, width, height: 72, rx: 36, class: 'dbn-slab' }, slabs);
    const name = text(root, centerX - 490, layer.y + 10, layer.name, { class: 'dbn-layer-name' });
    const nodes = Array.from({ length: layer.count }, (_, i) => svg('circle', { cx: nodeX(index, i), cy: layer.y, r: 17, class: 'dbn-node' }, nodesGroup));
    const edges =
      index === 0
        ? []
        : Array.from({ length: layers[index - 1].count * layer.count }, (_, k) => {
            const from = Math.floor(k / layer.count);
            const to = k % layer.count;
            return svg('line', { x1: nodeX(index - 1, from), y1: layers[index - 1].y, x2: nodeX(index, to), y2: layer.y, class: 'dbn-link' }, links);
          });
    return { slab, name, nodes, edges };
  });

  // 특징을 요약하며 위로 올라가는 신호.
  const particles = Array.from({ length: 18 }, (_, i) => ({
    dot: svg('circle', { r: 7, class: 'dbn-particle' }, root),
    route: layers.map((layer, index) => Math.floor(random(i * 7 + index) * layer.count)),
    offset: random(i * 3 + 1) * 1.6,
  }));

  const pulse = svg('rect', { x: centerX - 440, y: 0, width: 880, height: 10, rx: 5, class: 'dbn-pulse' }, root);

  const tag = svg('g', { class: 'dbn-tag', transform: 'translate(1290 110)' }, root);
  svg('path', { d: 'M0 0 H150 L180 30 L150 60 H0 Z', class: 'dbn-tag-body' }, tag);
  svg('circle', { cx: 150, cy: 30, r: 7, class: 'dbn-tag-hole' }, tag);
  text(tag, 70, 41, '정답', { class: 'dbn-tag-text' });
  const strike = svg('line', { x1: -14, y1: 70, x2: 196, y2: -10, class: 'dbn-strike' }, tag);
  const tagCaption = text(root, 1380, 210, '이름표 없이', { class: 'dbn-caption' });

  const trainedLabel = text(root, centerX, 160, '학습된다', { class: 'dbn-trained' });

  const deep = svg('g', { class: 'dbn-deep' }, root);
  svg('path', { d: 'M1555 800 V250 M1531 278 L1555 250 L1579 278', class: 'dbn-depth' }, deep);
  text(deep, 140, 470, '딥러닝', { class: 'dbn-deep-title' });
  text(deep, 140, 530, '층이 깊은', { class: 'dbn-deep-sub' });
  text(deep, 140, 574, '신경망의 학습', { class: 'dbn-deep-sub' });

  const update = (time: number) => {
    // 왼쪽 탑: 한 번에 나타났다가 기울며 무너진다.
    const naiveIn = appear(time, at.allAtOnce, .3);
    const fall = clamp((time - at.collapse) / 1.1);
    const gone = appear(time, at.rename, .8);
    naiveFloors.forEach((floor, i) => {
      const height = i / 9;
      const tilt = -fall * fall * (18 + height * 30);
      const dx = -fall * fall * (30 + height * 150) * (i % 2 ? 1 : .8);
      const dy = fall * fall * height * 300;
      setAttributes(floor, {
        transform: `translate(${dx.toFixed(1)} ${dy.toFixed(1)}) rotate(${tilt.toFixed(1)} 340 ${742 - i * 44})`,
        class: fall > 0 ? 'dbn-naive-floor broken' : 'dbn-naive-floor',
      });
    });
    const ghost = lerp(1, .22, appear(time, at.collapse + 1.3, .6));
    setAttributes(naive, { opacity: (naiveIn * ghost * (1 - gone)).toFixed(3) });
    setAttributes(naiveLabel, { opacity: (naiveIn * ghost * (1 - gone)).toFixed(3) });

    // 오른쪽: 층마다 올라오고 굳는다.
    const outline = appear(time, at.outline, .6);
    const backprop = progress(time, at.backprop, at.backpropEnd - at.backprop);
    const pulseY = lerp(layers[4].y, layers[0].y, backprop);
    const trained = time >= at.trained;
    layerViews.forEach(({ slab, name, nodes, edges }, index) => {
      const [rise, solid] = index === 0 ? [at.outline, at.outline] : at.floors[index - 1];
      const built = index === 0 ? outline : appear(time, rise, .5);
      const settled = index === 0 ? 1 : progress(time, rise, solid - rise);
      const state = trained ? 'trained' : index === 0 ? 'input' : settled >= 1 ? 'solid' : built > 0 ? 'building' : 'empty';
      setAttributes(slab, { class: `dbn-slab ${state}`, opacity: Math.max(outline * .9, built).toFixed(3) });
      setAttributes(name, { opacity: (outline * (built > 0 || index === 0 ? 1 : .35)).toFixed(3) });
      nodes.forEach((node) => setAttributes(node, { opacity: built.toFixed(3), class: `dbn-node ${state}` }));
      const passed = backprop > 0 && backprop < 1 && pulseY < layers[index].y + 10 && pulseY > layers[index].y - 150;
      edges.forEach((edge) => setAttributes(edge, { opacity: (built * .9).toFixed(3), class: passed ? 'dbn-link hot' : trained ? 'dbn-link trained' : 'dbn-link' }));
    });

    // 아래에서 위로: 각 층이 입력을 요약한다.
    const flowing = time >= at.summarize && time < at.backprop;
    particles.forEach(({ dot, route, offset }) => {
      if (!flowing) {
        setAttributes(dot, { opacity: 0 });
        return;
      }
      const phase = (((time - at.summarize + offset) % 1.6) + 1.6) % 1.6 / 1.6;
      const segment = Math.min(Math.floor(phase * 4), 3);
      const local = phase * 4 - segment;
      const x = lerp(nodeX(segment, route[segment]), nodeX(segment + 1, route[segment + 1]), local);
      const y = lerp(layers[segment].y, layers[segment + 1].y, local);
      const reached = time >= at.floors[segment][0];
      setAttributes(dot, { cx: x.toFixed(1), cy: y.toFixed(1), opacity: reached ? (1 - phase * .4).toFixed(3) : 0 });
    });

    setAttributes(pulse, { y: (pulseY - 5).toFixed(1), opacity: backprop > 0 && backprop < 1 ? 1 : 0 });

    const noLabels = appear(time, at.noLabels, .4);
    setAttributes(tag, { opacity: (noLabels * (1 - appear(time, at.backprop, .4))).toFixed(3) });
    setAttributes(strike, { opacity: appear(time, at.noLabels + .5, .3).toFixed(3) });
    setAttributes(tagCaption, { opacity: (noLabels * (1 - appear(time, at.backprop, .4))).toFixed(3) });
    setAttributes(trainedLabel, { opacity: appear(time, at.trained, .5).toFixed(3) });
    setAttributes(deep, { opacity: appear(time, at.deepLearning, .6).toFixed(3) });
  };

  return {
    element,
    update,
    title: '심층 신뢰망',
    start,
    end,
    chapters: [
      { time: 949.2, title: '한 번에 다 가르치지 않는다' },
      { time: at.allAtOnce, title: '한꺼번에 10층' },
      { time: at.floors[0][0], title: '한 층씩 굳히기' },
      { time: at.summarize, title: '특징을 스스로 요약' },
      { time: at.noLabels, title: '정답 이름표 없이' },
      { time: at.backprop, title: '역전파로 마무리' },
      { time: at.deepLearning, title: '딥러닝' },
    ],
  };
};

// Three.js 판으로 보여 준다(shared/three-scene.ts). three.js 를 불러오기 전에는 SVG 판을 보여 준다.
export const createDeepBeliefNetScene = (): Scene =>
  withThree(createDeepBeliefNetSvg(), () => import('./three.ts').then(({ createDeepBeliefNetThree }) => createDeepBeliefNetThree));
