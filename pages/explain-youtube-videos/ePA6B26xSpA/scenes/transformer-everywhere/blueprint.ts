import './blueprint.scss';
import { svg, text } from '../../../shared/diagram.ts';

// 논문 "Attention Is All You Need" 그림 1의 트랜스포머 설계도. 왼쪽이 인코더, 오른쪽이 디코더다.
// 각 탑은 자기 바닥 가운데를 원점으로 그리고(위쪽이 음수), 놓을 자리와 크기는 transform 으로 정한다.

interface Box {
  label: string;
  y: number;
  height: number;
  kind: 'attention' | 'norm' | 'feed' | 'plain';
}

const halfWidth = 120;
const boxWidth = 240;

const encoderBoxes: Box[] = [
  { label: 'Multi-Head Attention', y: -240, height: 56, kind: 'attention' },
  { label: 'Add & Norm', y: -290, height: 36, kind: 'norm' },
  { label: 'Feed Forward', y: -380, height: 56, kind: 'feed' },
  { label: 'Add & Norm', y: -430, height: 36, kind: 'norm' },
];
const decoderBoxes: Box[] = [
  { label: 'Masked Multi-Head Attention', y: -240, height: 56, kind: 'attention' },
  { label: 'Add & Norm', y: -290, height: 36, kind: 'norm' },
  { label: 'Multi-Head Attention', y: -380, height: 56, kind: 'attention' },
  { label: 'Add & Norm', y: -430, height: 36, kind: 'norm' },
  { label: 'Feed Forward', y: -520, height: 56, kind: 'feed' },
  { label: 'Add & Norm', y: -570, height: 36, kind: 'norm' },
];

// 탑마다 N× 블록의 위·아래와 맨 위 출구 높이(탑 좌표).
export const towerShape = {
  encoder: { blockTop: -460, blockBottom: -150, top: -520 },
  decoder: { blockTop: -600, blockBottom: -150, top: -800 },
  // 디코더 가운데 Multi-Head Attention 이 인코더 출력을 받는 높이.
  crossY: -352,
};

const box = (parent: SVGElement, { label, y, height, kind }: Box) => {
  const group = svg('g', { class: `blueprint-box ${kind}` }, parent);
  svg('rect', { x: -boxWidth / 2 + 20, y, width: boxWidth - 40, height, rx: 8 }, group);
  text(group, 0, y + height / 2 + 6, label, { class: 'blueprint-box-label' });
  return group;
};

const arrowUp = (parent: SVGElement, x: number, from: number, to: number) =>
  svg('path', { class: 'blueprint-wire', d: `M${x} ${from} L${x} ${to + 4} M${x - 6} ${to + 12} L${x} ${to + 2} L${x + 6} ${to + 12}` }, parent);

const embedding = (parent: SVGElement, label: string, caption: string) => {
  text(parent, 0, 0, caption, { class: 'blueprint-caption' });
  arrowUp(parent, 0, -24, -46);
  box(parent, { label, y: -90, height: 44, kind: 'plain' });
  arrowUp(parent, 0, -92, -106);
  // 위치 정보(Positional Encoding)를 더하는 ⊕.
  const plus = svg('g', { class: 'blueprint-plus', transform: 'translate(0 -120)' }, parent);
  svg('circle', { r: 13 }, plus);
  svg('path', { d: 'M-8 0 L8 0 M0 -8 L0 8' }, plus);
  const wave = svg('g', { class: 'blueprint-wave', transform: 'translate(-64 -120)' }, parent);
  svg('circle', { r: 18 }, wave);
  svg('path', { d: 'M-12 0 C-8 -12 -4 -12 0 0 C4 12 8 12 12 0' }, wave);
  svg('path', { class: 'blueprint-wire', d: 'M-46 -120 L-14 -120' }, parent);
  arrowUp(parent, 0, -133, -150);
};

const block = (parent: SVGElement, boxes: Box[], top: number, bottom: number) => {
  const group = svg('g', { class: 'blueprint-block' }, parent);
  svg('rect', { class: 'blueprint-block-frame', x: -halfWidth, y: top, width: halfWidth * 2, height: bottom - top, rx: 16 }, group);
  text(group, -halfWidth - 14, (top + bottom) / 2 + 8, 'N×', { class: 'blueprint-n', 'text-anchor': 'end' });
  const parts = boxes.map((part) => box(group, part));
  // 상자 사이를 잇는 선.
  boxes.forEach((part, i) => {
    const below = i === 0 ? bottom : boxes[i - 1].y;
    arrowUp(group, 0, below, part.y + part.height);
  });
  arrowUp(group, 0, boxes[boxes.length - 1].y, top);
  return { group, parts };
};

export const createEncoder = (parent: SVGElement) => {
  const group = svg('g', { class: 'blueprint-tower encoder' }, parent);
  const base = svg('g', {}, group);
  embedding(base, 'Input Embedding', 'Inputs');
  const { group: detail, parts } = block(group, encoderBoxes, towerShape.encoder.blockTop, towerShape.encoder.blockBottom);
  const exit = arrowUp(group, 0, towerShape.encoder.blockTop, towerShape.encoder.top);
  return { group, base, detail, parts, exit };
};

export const createDecoder = (parent: SVGElement) => {
  const group = svg('g', { class: 'blueprint-tower decoder' }, parent);
  const base = svg('g', {}, group);
  embedding(base, 'Output Embedding', 'Outputs (shifted right)');
  const { group: detail, parts } = block(group, decoderBoxes, towerShape.decoder.blockTop, towerShape.decoder.blockBottom);
  const head = svg('g', {}, group);
  arrowUp(head, 0, towerShape.decoder.blockTop, -640);
  box(head, { label: 'Linear', y: -680, height: 40, kind: 'plain' });
  arrowUp(head, 0, -680, -706);
  box(head, { label: 'Softmax', y: -746, height: 40, kind: 'plain' });
  arrowUp(head, 0, -746, -772);
  text(head, 0, -784, 'Output Probabilities', { class: 'blueprint-caption' });
  return { group, base, detail, parts, head };
};

// 인코더 출력이 디코더 가운데 어텐션으로 들어가는 선(부모 좌표). 두 탑의 자리와 크기를 받는다.
export const crossPath = (encoderX: number, decoderX: number, baseY: number, scale: number) => {
  const outY = baseY + towerShape.encoder.top * scale;
  const inY = baseY + towerShape.crossY * scale;
  const inX = decoderX - halfWidth * scale;
  const midX = (encoderX + halfWidth * scale + inX) / 2;
  return `M${encoderX} ${outY.toFixed(1)} L${encoderX} ${(outY - 20).toFixed(1)} L${midX.toFixed(1)} ${(outY - 20).toFixed(1)} L${midX.toFixed(1)} ${inY.toFixed(1)} L${(inX - 4).toFixed(1)} ${inY.toFixed(1)} M${(inX - 14).toFixed(1)} ${(inY - 7).toFixed(1)} L${(inX - 3).toFixed(1)} ${inY.toFixed(1)} L${(inX - 14).toFixed(1)} ${(inY + 7).toFixed(1)}`;
};

// 설계도 종이(모눈).
export const createPaper = (parent: SVGElement, x: number, y: number, width: number, height: number) => {
  const group = svg('g', { class: 'blueprint-paper' }, parent);
  svg('rect', { class: 'blueprint-paper-sheet', x, y, width, height, rx: 18 }, group);
  for (let gx = x + 30; gx < x + width; gx += 30) {
    svg('line', { class: 'blueprint-paper-line', x1: gx, y1: y + 6, x2: gx, y2: y + height - 6 }, group);
  }
  for (let gy = y + 30; gy < y + height; gy += 30) {
    svg('line', { class: 'blueprint-paper-line', x1: x + 6, y1: gy, x2: x + width - 6, y2: gy }, group);
  }
  return group;
};
