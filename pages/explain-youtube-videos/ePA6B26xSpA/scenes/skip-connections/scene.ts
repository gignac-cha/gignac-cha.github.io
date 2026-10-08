import './skip-connections.scss';
import { appear, createDiagram, ease, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';

// 31:59 "지름길 연결은 이후 거의 모든 거대 신경망에" ~ 32:06 "숨어 있어요".
const start = 1919.0;
const end = 1926.6;

const at = {
  everywhere: 1921.0, // 거의 모든 거대 신경망에 들어갑니다
  transformer: 1923.5, // 뒤에 나올 트랜스포머에도
  gpt: 1924.4, // GPT에도
  hidden: 1925.1, // 이 지름길이 숨어 있어요
};

const captions: Array<[number, string]> = [
  [start, '지름길 연결'],
  [at.everywhere, '거의 모든 거대 신경망에'],
  [at.transformer, '트랜스포머에도'],
  [at.gpt, 'GPT에도'],
  [at.hidden, '층마다 숨어 있는 지름길'],
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

// 트랜스포머 층 하나(Vaswani et al. 2017 그림 1의 인코더 층): 아래에서 위로.
const blocks = [
  { label: '멀티헤드 어텐션', kind: 'sublayer' },
  { label: 'Add & Norm', kind: 'add' },
  { label: '피드포워드', kind: 'sublayer' },
  { label: 'Add & Norm', kind: 'add' },
] as const;
const layer = { x: 470, width: 340, bottom: 760, height: 76, gap: 34 };
const blockY = (i: number) => layer.bottom - (i + 1) * layer.height - i * layer.gap;
// 지름길: 부분 층 아래(입력)에서 Add & Norm 으로.
const skips = [
  { from: layer.bottom + 20, to: blockY(1) + layer.height / 2 },
  { from: blockY(1) - layer.gap / 2, to: blockY(3) + layer.height / 2 },
];

// GPT-3 (Brown et al. 2020): 96층, 층마다 지름길 두 개.
const gpt = { count: 96, x: 1080, width: 220, bottom: 780, height: 520 };

const createSkipConnections = () => {
  const { element, root } = createDiagram('skip-connections', '어디에나 있는 지름길');
  const caption = createSwapText(root, 800, 140, { class: 'skip-caption' });

  // 처음: ResNet 블록의 지름길 모양 하나.
  const motif = svg('g', { opacity: 0 }, root);
  svg('line', { class: 'skip-flow', x1: 540, x2: 1060, y1: 520, y2: 520 }, motif);
  svg('rect', { class: 'skip-motif-box', x: 700, y: 475, width: 200, height: 90, rx: 18 }, motif);
  text(motif, 800, 530, '층', { class: 'skip-motif-text' });
  svg('circle', { class: 'skip-motif-plus', cx: 990, cy: 520, r: 26 }, motif);
  text(motif, 990, 531, '+', { class: 'skip-motif-text' });
  const motifArc = svg('path', { class: 'skip-arc', d: 'M610,520C610,350 990,350 990,494', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, motif);
  text(motif, 800, 360, 'ResNet의 지름길', { class: 'skip-arc-label' });

  // 트랜스포머 층
  const transformer = svg('g', { opacity: 0 }, root);
  text(transformer, layer.x + layer.width / 2, 250, '트랜스포머 층 하나', { class: 'skip-heading' });
  svg('line', { class: 'skip-flow', x1: layer.x + layer.width / 2, x2: layer.x + layer.width / 2, y1: layer.bottom + 40, y2: blockY(3) - 20 }, transformer);
  blocks.forEach((block, i) => {
    svg('rect', { class: `skip-block ${block.kind}`, x: layer.x, y: blockY(i), width: layer.width, height: layer.height, rx: 14 }, transformer);
    text(transformer, layer.x + layer.width / 2, blockY(i) + layer.height / 2 + 10, block.label, { class: 'skip-block-text' });
  });
  text(transformer, layer.x + layer.width + 30, (layer.bottom + blockY(3)) / 2 + 12, '× N', { class: 'skip-repeat' });
  const skipArcs = skips.map(({ from, to }) =>
    svg('path', {
      class: 'skip-arc',
      d: `M${layer.x + layer.width / 2},${from}H${layer.x - 50}V${to}H${layer.x}`,
      pathLength: 1,
      'stroke-dasharray': '1 1',
      'stroke-dashoffset': 1,
    }, transformer),
  );

  // GPT-3
  const gptGroup = svg('g', { opacity: 0 }, root);
  text(gptGroup, gpt.x + gpt.width / 2, 250, 'GPT-3', { class: 'skip-heading' });
  const pitch = gpt.height / gpt.count;
  const gptLayers = Array.from({ length: gpt.count }, (_, i) => {
    const y = gpt.bottom - (i + 1) * pitch;
    const bar = svg('rect', { class: 'skip-gpt-layer', x: gpt.x, y, width: gpt.width, height: pitch - 1.4 }, gptGroup);
    const arc = svg('path', { class: 'skip-gpt-arc', d: `M${gpt.x},${(y + pitch).toFixed(1)}h-${10 + (i % 2) * 6}V${y.toFixed(1)}H${gpt.x}`, opacity: 0 }, gptGroup);
    return { bar, arc };
  });
  const gptCount = text(gptGroup, gpt.x + gpt.width / 2, gpt.bottom + 44, '', { class: 'skip-gpt-count' });

  const update = (time: number) => {
    caption.update(time, captionAt);

    setAttributes(motif, { opacity: (appear(time, start, .4) * (1 - appear(time, at.transformer - .5, .4))).toFixed(3) });
    setAttributes(motifArc, { 'stroke-dashoffset': (1 - ease(progress(time, start + .4, 1))).toFixed(4) });
    motifArc.classList.toggle('glow', time >= at.everywhere);

    setAttributes(transformer, { opacity: appear(time, at.transformer - .2, .4).toFixed(3) });
    skipArcs.forEach((arc, i) => {
      setAttributes(arc, { 'stroke-dashoffset': (1 - ease(progress(time, at.transformer + .2 + i * .3, .6))).toFixed(4) });
      arc.classList.toggle('glow', time >= at.hidden);
    });

    setAttributes(gptGroup, { opacity: appear(time, at.gpt - .1, .3).toFixed(3) });
    const built = progress(time, at.gpt, .6);
    gptLayers.forEach(({ bar, arc }, i) => {
      const shown = built * gpt.count > i;
      setAttributes(bar, { opacity: shown ? 1 : 0 });
      setAttributes(arc, { opacity: (shown ? appear(time, at.hidden + i * .004, .3) : 0).toFixed(3) });
    });
    const count = Math.round(built * gpt.count);
    const content = count > 0 ? `${count}층 · 층마다 지름길 2개` : '';
    if (gptCount.textContent !== content) {
      gptCount.textContent = content;
    }
  };

  return { element, update };
};

export const createSkipConnectionsScene = (): Scene => ({
  ...createSkipConnections(),
  title: '어디에나 있는 지름길',
  start,
  end,
  chapters: [
    { time: start, title: '거대 신경망의 지름길' },
    { time: at.transformer, title: '트랜스포머와 GPT' },
  ],
});
