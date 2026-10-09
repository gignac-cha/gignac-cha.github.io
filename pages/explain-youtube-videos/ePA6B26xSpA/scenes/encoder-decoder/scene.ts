import './encoder-decoder.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createDecoder, createEncoder, createPaper, crossPath, towerShape } from '../transformer-everywhere/blueprint.ts';

// 39:09.4 "그런데 말이죠. 트랜스포머에는 두 개의 반쪽이" ~ 39:36.2 "이 뼈대의 무엇을 어떻게 가르칠 것인가?".
// 층 수는 실제 모델 그대로: 원래 트랜스포머 6층, BERT(Large) 인코더 24층, GPT-1 디코더 12층.
const start = 2349.2;
const end = 2376.8;
const at = {
  halves: 2351.8,
  read: 2353,
  write: 2355,
  words: [2355.5, 2355.95, 2356.4],
  year: 2357.8,
  split: 2359.4,
  google: 2360.8,
  bertGrow: 2361.5,
  bert: 2362,
  openai: 2363.1,
  gptGrow: 2364.2,
  gpt: 2364.7,
  root: 2366.2,
  branches: 2366.9,
  paths: 2367.8,
  sturdy: 2370.6,
  question: 2373.2,
  what: 2375,
  how: 2375.4,
};

const scale = .7;
const baseY = 790;
const together = { encoderX: 620, decoderX: 980 };
const apart = { encoderX: 400, decoderX: 1200 };
const layers = { original: 6, bert: 24, gpt: 12 };
const slabStep = 21;

// 층을 얇은 판으로 쌓은 탑(탑 좌표, 블록 아래 -150 부터 위로).
const createStack = (parent: SVGElement, count: number, className: string) => {
  const group = svg('g', { class: `encoder-decoder-stack ${className}` }, parent);
  const slabs = Array.from({ length: count }, (_, i) =>
    svg('rect', { x: -110, y: towerShape.encoder.blockBottom - (i + 1) * slabStep + 3, width: 220, height: slabStep - 5, rx: 5 }, group));
  const outline = svg('rect', { class: 'encoder-decoder-stack-glow', x: -124, width: 248, rx: 12 }, group);
  return {
    group,
    update: (shown: number, glow: number) => {
      slabs.forEach((slab, i) => setAttributes(slab, { opacity: clamp(shown - i).toFixed(3) }));
      const top = towerShape.encoder.blockBottom - shown * slabStep - 8;
      setAttributes(outline, { y: top.toFixed(1), height: (towerShape.encoder.blockBottom + 8 - top).toFixed(1), opacity: glow.toFixed(3) });
    },
  };
};

const chip = (parent: SVGElement, x: number, y: number, label: string, className = '') => {
  const group = svg('g', { class: `encoder-decoder-chip ${className}`, transform: `translate(${x} ${y})` }, parent);
  const width = Math.max(70, label.length * 16 + 36);
  svg('rect', { x: -width / 2, y: -22, width, height: 44, rx: 22 }, group);
  text(group, 0, 8, label);
  return group;
};

export const createEncoderDecoderScene = (): Scene => {
  const { element, root } = createDiagram('encoder-decoder', '인코더와 디코더');

  const paper = createPaper(root, 360, 150, 880, 730);
  const cross = svg('path', { class: 'blueprint-cross' }, root);
  const encoder = createEncoder(root);
  const decoder = createDecoder(root);
  const encoderStack = createStack(encoder.group, layers.bert, 'encoder');
  const decoderStack = createStack(decoder.group, layers.gpt, 'decoder');

  // 반쪽마다 테두리와 이름.
  const frame = (x: number, top: number, className: string) => svg('rect', { class: `encoder-decoder-frame ${className}`, x: x - 100, y: top, width: 200, height: baseY + 26 - top, rx: 18 }, root);
  const encoderFrame = frame(together.encoderX, baseY + towerShape.encoder.top * scale - 20, 'encoder');
  const decoderFrame = frame(together.decoderX, baseY + towerShape.decoder.top * scale - 20, 'decoder');
  const encoderName = text(root, together.encoderX, baseY + towerShape.encoder.top * scale - 70, '인코더 · 읽고 이해하는 쪽', { class: 'encoder-decoder-name encoder', 'text-anchor': 'middle' });
  const decoderName = text(root, together.decoderX, 132, '디코더 · 한 단어씩 써 내려가는 쪽', { class: 'encoder-decoder-name decoder', 'text-anchor': 'middle' });

  // 인코더는 원문 전체를 한꺼번에 받고, 디코더는 한 단어씩 써 낸다.
  const inputs = ['I', 'miss', 'you'].map((word, i) => chip(root, together.encoderX + (i - 1) * 76, 846, word));
  const outputs = ['Tu', 'me', 'manques'].map((word, i) => chip(root, together.decoderX + (i - 1) * 104 + (i === 2 ? 16 : 0), 196, word, 'output'));
  const pulses = [0, 1, 2].map(() => svg('circle', { class: 'encoder-decoder-pulse', r: 7 }, root));

  const year = text(root, 800, 470, '2018', { class: 'encoder-decoder-year', 'text-anchor': 'middle' });
  const companies = [
    { x: apart.encoderX, label: '구글', at: at.google },
    { x: apart.decoderX, label: '오픈AI', at: at.openai },
  ].map(({ x, label, at: shownAt }) => ({ node: text(root, x, 236, label, { class: 'encoder-decoder-company', 'text-anchor': 'middle' }), at: shownAt }));
  const models = [
    { x: apart.encoderX, name: 'BERT', detail: '2018년 10월 · 인코더 24층', at: at.bert, className: 'encoder' },
    { x: apart.decoderX, name: 'GPT', detail: '2018년 6월 · 디코더 12층', at: at.gpt, className: 'decoder' },
  ].map(({ x, name, detail, at: shownAt, className }) => {
    const group = svg('g', { class: `encoder-decoder-model ${className}` }, root);
    text(group, x, 196, name, { class: 'encoder-decoder-model-name', 'text-anchor': 'middle' });
    text(group, x, 846, detail, { class: 'encoder-decoder-model-detail', 'text-anchor': 'middle' });
    return { group, at: shownAt };
  });

  // 같은 뿌리에서 나온 두 갈래, 그리고 서로 다른 길.
  const tree = svg('g', { class: 'encoder-decoder-tree' }, root);
  const branches = [apart.encoderX, apart.decoderX].map((x) =>
    svg('path', { class: 'encoder-decoder-branch', d: `M800 676 C800 600 ${x + (x < 800 ? 260 : -260)} 640 ${x + (x < 800 ? 100 : -100)} 540`, pathLength: 1 }, tree));
  const rootChip = chip(tree, 800, 700, '트랜스포머 2017', 'root');
  const roads = [
    { x: apart.encoderX, label: '읽고 이해하기', dir: -1 },
    { x: apart.decoderX, label: '이어서 써 내기', dir: 1 },
  ].map(({ x, label, dir }) => {
    const group = svg('g', { class: `encoder-decoder-road ${dir < 0 ? 'encoder' : 'decoder'}` }, root);
    svg('path', { class: 'encoder-decoder-road-arrow', d: `M${x + dir * 130} 330 L${x + dir * 210} 250 M${x + dir * 210 - dir * 18} 248 L${x + dir * 210} 250 L${x + dir * 208} 268` }, group);
    text(group, x + dir * 200, 300, label, { class: 'encoder-decoder-road-label', 'text-anchor': dir < 0 ? 'end' : 'start' });
    return group;
  });
  const question = text(root, 800, 760, '이 뼈대에 무엇을, 어떻게 가르칠까?', { class: 'encoder-decoder-question', 'text-anchor': 'middle' });

  const update = (time: number) => {
    setAttributes(paper, { opacity: (appear(time, start, .5) * (1 - .6 * appear(time, at.split, .6))).toFixed(3) });

    // "두 회사가 반쪽을 하나씩 집어듭니다": 두 탑이 양쪽으로 갈라진다.
    const split = ease(progress(time, at.split, .9));
    const encoderX = lerp(together.encoderX, apart.encoderX, split);
    const decoderX = lerp(together.decoderX, apart.decoderX, split);
    setAttributes(encoder.group, { transform: `translate(${encoderX.toFixed(1)} ${baseY}) scale(${scale})`, opacity: appear(time, start, .5).toFixed(3) });
    setAttributes(decoder.group, { transform: `translate(${decoderX.toFixed(1)} ${baseY}) scale(${scale})`, opacity: appear(time, start, .5).toFixed(3) });
    setAttributes(cross, { d: crossPath(together.encoderX, together.decoderX, baseY, scale), opacity: (appear(time, start, .5) * (1 - appear(time, at.split - .3, .4))).toFixed(3) });

    // 반쪽 강조: 읽는 쪽, 쓰는 쪽 차례로.
    const halves = appear(time, at.halves, .4) * (1 - appear(time, at.split - .3, .4));
    setAttributes(encoderFrame, { opacity: (halves * (time < at.write ? 1 : .45)).toFixed(3) });
    setAttributes(decoderFrame, { opacity: (halves * (time < at.read ? 1 : time < at.write ? .45 : 1)).toFixed(3) });
    setAttributes(encoderName, { opacity: (appear(time, at.read, .4) * (1 - appear(time, at.split - .3, .4))).toFixed(3) });
    setAttributes(decoderName, { opacity: (appear(time, at.write, .4) * (1 - appear(time, at.split - .3, .4))).toFixed(3) });

    const tokens = 1 - appear(time, at.split - .3, .4);
    inputs.forEach((input) => setAttributes(input, { opacity: (appear(time, at.read, .4) * tokens).toFixed(3) }));
    outputs.forEach((output, i) => setAttributes(output, { opacity: (appear(time, at.words[i], .3) * tokens).toFixed(3) }));
    // 원문 세 단어가 한꺼번에 인코더를 타고 오른다.
    const climb = progress(time, at.read + .4, 1.4);
    pulses.forEach((pulse, i) => {
      const y = lerp(baseY - 30, baseY + towerShape.encoder.top * scale, ease(climb));
      setAttributes(pulse, { cx: together.encoderX + (i - 1) * 40, cy: y.toFixed(1), opacity: (climb > 0 && climb < 1 ? 1 : 0).toFixed(3) });
    });

    setAttributes(year, { opacity: (appear(time, at.year, .4) * (1 - appear(time, at.root - .4, .4))).toFixed(3) });
    companies.forEach(({ node, at: shownAt }) => setAttributes(node, { opacity: appear(time, shownAt, .4).toFixed(3) }));

    // 키우기: 설계도의 N× 블록이 층판 6장으로 바뀐 뒤, BERT 는 24층, GPT 는 12층까지 쌓인다.
    const encoderSlabs = appear(time, at.google, .4);
    setAttributes(encoder.detail, { opacity: (1 - encoderSlabs).toFixed(3) });
    setAttributes(encoderStack.group, { opacity: encoderSlabs.toFixed(3) });
    const encoderCount = lerp(layers.original, layers.bert, ease(progress(time, at.bertGrow, .9)));
    // "튼튼한 뼈대": 두 탑이 한 번 빛난다.
    const glow = Math.sin(Math.PI * progress(time, at.sturdy, 1.4));
    encoderStack.update(encoderCount, glow);
    setAttributes(encoder.exit, { transform: `translate(0 ${lerp(0, towerShape.encoder.blockBottom - encoderCount * slabStep - towerShape.encoder.blockTop, encoderSlabs).toFixed(1)})` });

    const decoderSlabs = appear(time, at.openai + .3, .4);
    setAttributes(decoder.detail, { opacity: (1 - decoderSlabs).toFixed(3) });
    setAttributes(decoderStack.group, { opacity: decoderSlabs.toFixed(3) });
    const decoderCount = lerp(layers.original, layers.gpt, ease(progress(time, at.gptGrow, .7)));
    decoderStack.update(decoderCount, glow);
    setAttributes(decoder.head, { transform: `translate(0 ${lerp(0, towerShape.decoder.blockBottom - decoderCount * slabStep - towerShape.decoder.blockTop, decoderSlabs).toFixed(1)})` });

    models.forEach(({ group, at: shownAt }) => setAttributes(group, { opacity: appear(time, shownAt, .4).toFixed(3) }));

    setAttributes(tree, { opacity: (appear(time, at.root, .4) * (1 - appear(time, at.question - .3, .4))).toFixed(3) });
    branches.forEach((branch) => setAttributes(branch, { 'stroke-dashoffset': (1 - ease(progress(time, at.branches - .3, .8))).toFixed(3) }));
    setAttributes(rootChip, { opacity: appear(time, at.root, .4).toFixed(3) });
    roads.forEach((road) => setAttributes(road, { opacity: appear(time, at.paths, .5).toFixed(3) }));

    setAttributes(question, { opacity: appear(time, at.what - .3, .5).toFixed(3) });
  };

  return {
    element,
    update,
    title: '인코더와 디코더',
    start,
    end,
    chapters: [
      { time: start, title: '트랜스포머의 두 반쪽' },
      { time: at.read, title: '읽는 쪽과 쓰는 쪽' },
      { time: at.split, title: '반쪽씩 집어 든 두 회사' },
      { time: at.google, title: '키운 인코더, BERT' },
      { time: at.openai, title: '키운 디코더, GPT' },
      { time: at.root, title: '같은 뿌리, 다른 길' },
      { time: at.question, title: '무엇을 어떻게 가르칠까' },
    ],
  };
};
