import './clip.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';
import { chairs, drawChair } from './avocado.ts';

// 47:53 "오픈AI는 이 모델에 클립이라는 이름을" ~ 48:26 "사진인지 그림인지 헷갈릴 정도였습니다".
const start = 2873.8;
const end = 2906.5;
const at = {
  name: 2874.2,
  data: 2876,
  pairs: 2876.8,
  match: 2879.5,
  hits: 2881,
  map: 2882.8,
  place: 2883.1,
  dogPhoto: 2885.4,
  dogWord: 2886.2,
  close: 2887.1,
  shrink: 2888.6,
  dalle: 2890,
  prompt: 2891.9,
  promptEnd: 2893.3,
  results: [2895.5, 2895.9, 2896.2, 2896.6],
  dalle2: 2899.3,
  clip: 2900.5,
  understand: 2901.3,
  diffusion: 2902.2,
  photo: 2903.8,
};

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

// 짝 맞히기와 지도에 쓰는 네 쌍. 지도 좌표(1000×650)에서 비슷한 것끼리 가깝다.
const pairs = [
  { emoji: '🐶', word: '강아지', photo: [230, 210], at: [330, 170] },
  { emoji: '🐈', word: '고양이', photo: [300, 380], at: [200, 420] },
  { emoji: '🍎', word: '사과', photo: [690, 190], at: [800, 150] },
  { emoji: '🚗', word: '자동차', photo: [760, 470], at: [860, 520] },
].map(({ emoji, word, photo, at: wordAt }) => ({ emoji, word, photo: { x: photo[0], y: photo[1] }, wordAt: { x: wordAt[0], y: wordAt[1] } }));

// 인터넷에서 모은 사진·설명 글 쌍(흘러가는 띠).
const stream = [
  ['🐶', '잔디 위의 강아지'], ['🌅', '해 질 녘 바다'], ['🍕', '피자 한 조각'], ['🐈', '창가에서 조는 고양이'],
  ['🚲', '자전거 타는 아이'], ['🏔️', '눈 덮인 산'], ['🍎', '바구니 속 사과'], ['🚗', '빨간 스포츠카'],
];

const matrix = { photoX: 500, captionY: 236, x: 600, y: 286, cell: { width: 150, height: 112 }, gap: 12 };
const columnX = (j: number) => matrix.x + j * (matrix.cell.width + matrix.gap) + matrix.cell.width / 2;
const rowY = (i: number) => matrix.y + i * (matrix.cell.height + matrix.gap) + matrix.cell.height / 2;

const map = { x: 300, y: 150, width: 1000, height: 650 };
const small = { x: 70, y: 236, scale: .5 };
const promptPoint = { x: 560, y: 300 };
const canvas = { x: 1100, y: 206, size: 420, grid: 20 };

const arrow = (parent: Element, x1: number, y1: number, x2: number, y2: number) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 14;
  const f = (n: number) => n.toFixed(1);
  const left = [x2 - head * Math.cos(angle - .5), y2 - head * Math.sin(angle - .5)];
  const right = [x2 - head * Math.cos(angle + .5), y2 - head * Math.sin(angle + .5)];
  return svg('path', { class: 'clip-arrow', d: `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} M${f(left[0])} ${f(left[1])} L${f(x2)} ${f(y2)} L${f(right[0])} ${f(right[1])}` }, parent);
};

const photoTile = (parent: Element, emoji: string, size: number) => {
  const group = svg('g', {}, parent);
  svg('rect', { x: -size / 2, y: -size / 2, width: size, height: size, rx: 14, class: 'clip-photo' }, group);
  text(group, 0, size * .2, emoji, { class: 'clip-emoji', 'font-size': size * .56 });
  return group;
};

const wordChip = (parent: Element, word: string) => {
  const group = svg('g', { class: 'clip-word' }, parent);
  const width = word.length * 30 + 52;
  svg('rect', { x: -width / 2, y: -28, width, height: 56, rx: 28 }, group);
  text(group, 0, 10, `“${word}”`);
  return group;
};

export const createClipScene = (): Scene => {
  const { element, root } = createDiagram('clip', '그림과 글의 지도(CLIP)');
  const defs = svg('defs', {}, root);
  const filter = svg('filter', { id: 'clip-diffusion-blur', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  const blur = svg('feGaussianBlur', { stdDeviation: 12 }, filter);

  // 1) 이름과 재료: 인터넷의 사진·설명 글 4억 쌍.
  const intro = svg('g', {}, root);
  text(intro, 800, 250, 'CLIP', { class: 'clip-name' });
  text(intro, 800, 300, '사진과 글을 함께 배우는 모델 · 2021년 1월', { class: 'clip-caption', 'text-anchor': 'middle' });
  const count = svg('g', {}, intro);
  text(count, 800, 420, '4억 쌍', { class: 'clip-count' });
  text(count, 800, 462, '인터넷에서 모은 사진 + 설명 글', { class: 'clip-caption', 'text-anchor': 'middle' });
  const band = svg('g', {}, intro);
  const cardWidth = 330;
  const cards = Array.from({ length: 12 }, (_, i) => {
    const [emoji, caption] = stream[(i * 3) % stream.length];
    const group = svg('g', { class: 'clip-stream-card' }, band);
    svg('rect', { x: 0, y: 0, width: cardWidth - 20, height: 92, rx: 16 }, group);
    svg('rect', { x: 12, y: 12, width: 68, height: 68, rx: 10, class: 'clip-photo' }, group);
    text(group, 46, 60, emoji, { class: 'clip-emoji', 'font-size': 38 });
    text(group, 96, 55, caption, { class: 'clip-stream-text' });
    return { group, row: i % 2, index: Math.floor(i / 2) };
  });

  // 2) 짝 맞히기 표.
  const table = svg('g', {}, root);
  const cells = pairs.flatMap((_, i) =>
    pairs.map((__, j) => {
      const group = svg('g', { class: 'clip-cell' }, table);
      svg('rect', { x: columnX(j) - matrix.cell.width / 2, y: rowY(i) - matrix.cell.height / 2, width: matrix.cell.width, height: matrix.cell.height, rx: 12 }, group);
      const mark = text(group, columnX(j), rowY(i) + 12, i === j ? '짝' : '', { class: 'clip-cell-mark' });
      return { group, mark, i, j };
    }),
  );
  const tableNote = text(table, 800, 862, '같은 줄의 사진과 글은 가깝게, 나머지는 멀게 · 실제로는 한 번에 32,768쌍씩', { class: 'clip-caption', 'text-anchor': 'middle' });

  // 3) 같은 지도.
  const atlas = svg('g', {}, root);
  svg('rect', { x: 0, y: 0, width: map.width, height: map.height, rx: 28, class: 'clip-map' }, atlas);
  for (let x = 100; x < map.width; x += 100) {
    svg('line', { x1: x, y1: 0, x2: x, y2: map.height, class: 'clip-map-grid' }, atlas);
  }
  for (let y = 100; y < map.height; y += 100) {
    svg('line', { x1: 0, y1: y, x2: map.width, y2: y, class: 'clip-map-grid' }, atlas);
  }
  text(atlas, 32, 52, '같은 지도', { class: 'clip-map-label' });
  // 다른 수많은 쌍: 네모는 사진, 동그라미는 글. 짝끼리 가깝다.
  const crowd = svg('g', { class: 'clip-crowd' }, atlas);
  Array.from({ length: 22 }, (_, k) => {
    const x = 80 + random(k * 7 + 1) * 840;
    const y = 90 + random(k * 7 + 2) * 500;
    const dx = (random(k * 7 + 3) - .5) * 60;
    const dy = (random(k * 7 + 4) - .5) * 50;
    svg('rect', { x: x - 6, y: y - 6, width: 12, height: 12, rx: 3 }, crowd);
    svg('circle', { cx: x + dx, cy: y + dy, r: 6 }, crowd);
  });
  const ring = svg('ellipse', { class: 'clip-ring' }, atlas);
  const closeLabel = text(atlas, 0, 0, '가까운 자리', { class: 'clip-close-label' });
  const promptDot = svg('g', {}, atlas);
  svg('circle', { cx: promptPoint.x, cy: promptPoint.y, r: 14, class: 'clip-prompt-dot' }, promptDot);
  text(promptDot, promptPoint.x + 26, promptPoint.y + 10, '“아보카도 모양 안락의자”', { class: 'clip-prompt-point' });

  // 사진과 글: 표의 자리 → 지도의 자리.
  const items = svg('g', {}, root);
  const nodes = pairs.flatMap((pair, i) => [
    { node: photoTile(items, pair.emoji, 96), from: { x: matrix.photoX, y: rowY(i) }, to: pair.photo, i, kind: 'photo' as const },
    { node: wordChip(items, pair.word), from: { x: columnX(i), y: matrix.captionY }, to: pair.wordAt, i, kind: 'word' as const },
  ]);

  // 4) DALL·E: 글로 그림을 주문한다.
  const dalle = svg('g', {}, root);
  const heading = createSwapText(dalle, 800, 196, { class: 'clip-heading' });
  const year = createSwapText(dalle, 800, 236, { class: 'clip-caption', 'text-anchor': 'middle' });
  const promptCard = svg('g', {}, dalle);
  svg('rect', { x: 570, y: 272, width: 460, height: 104, rx: 20, class: 'clip-prompt' }, promptCard);
  const promptText = text(promptCard, 800, 322, '', { class: 'clip-prompt-text' });
  const promptEnglish = text(promptCard, 800, 356, 'an armchair in the shape of an avocado', { class: 'clip-prompt-english' });
  const promptWords = '아보카도 모양 안락의자';

  const results = svg('g', {}, dalle);
  const resultTiles = chairs.map((chair, k) => {
    const x = 1100 + (k % 2) * 220;
    const y = 200 + Math.floor(k / 2) * 220;
    const group = svg('g', {}, results);
    const inner = svg('g', {}, group);
    svg('rect', { x: 0, y: 0, width: 200, height: 200, rx: 14, class: 'clip-result' }, inner);
    drawChair(inner, chair);
    return { group, inner, x, y };
  });
  const resultNote = text(results, 1310, 668, '설명용 그림 · 실제 결과물 아님', { class: 'clip-note', 'text-anchor': 'middle' });

  // 5) DALL·E 2: CLIP 으로 말을 이해하고, 확산으로 그린다.
  const pipeline = svg('g', {}, dalle);
  const clipBox = svg('g', {}, pipeline);
  arrow(clipBox, 800, 380, 800, 438);
  svg('rect', { x: 640, y: 442, width: 320, height: 76, rx: 18, class: 'clip-box' }, clipBox);
  text(clipBox, 800, 490, 'CLIP · 말을 이해', { class: 'clip-box-text' });
  const link = svg('line', { class: 'clip-link', x1: 640, y1: 480 }, pipeline);
  const packet = svg('circle', { r: 9, class: 'clip-packet' }, pipeline);
  const diffusionBox = svg('g', {}, pipeline);
  arrow(diffusionBox, 800, 522, 800, 580);
  svg('rect', { x: 640, y: 584, width: 320, height: 76, rx: 18, class: 'clip-box diffusion' }, diffusionBox);
  text(diffusionBox, 800, 632, '확산 · 그림 그리기', { class: 'clip-box-text' });
  arrow(diffusionBox, 964, 622, 1092, 622);

  const painting = svg('g', {}, pipeline);
  svg('rect', { x: canvas.x, y: canvas.y, width: canvas.size, height: canvas.size, rx: 16, class: 'clip-result' }, painting);
  const chairLayer = svg('g', { filter: 'url(#clip-diffusion-blur)' }, painting);
  const chairInner = svg('g', { transform: `translate(${canvas.x + 10} ${canvas.y + 10}) scale(${(canvas.size - 20) / 200})` }, chairLayer);
  drawChair(chairInner, chairs[0]);
  const noise = svg('g', {}, painting);
  const pitch = canvas.size / canvas.grid;
  const noiseCells = Array.from({ length: canvas.grid * canvas.grid }, (_, k) =>
    svg('rect', { x: canvas.x + (k % canvas.grid) * pitch, y: canvas.y + Math.floor(k / canvas.grid) * pitch, width: pitch + .5, height: pitch + .5 }, noise),
  );
  const paintingLabel = text(painting, canvas.x + canvas.size / 2, canvas.y + canvas.size + 48, '1024 × 1024 · 사진인지 그림인지 헷갈릴 만큼', { class: 'clip-caption', 'text-anchor': 'middle' });
  const steps = 12;
  const stepDuration = .25;

  const update = (time: number) => {
    // 1) 이름과 재료.
    const introOut = 1 - appear(time, at.match - .2, .5);
    setAttributes(intro, { opacity: (appear(time, start, .4) * introOut).toFixed(3) });
    setAttributes(count, { opacity: appear(time, at.pairs, .4).toFixed(3) });
    const flow = Math.max(0, time - at.data);
    const loop = 6 * cardWidth;
    cards.forEach(({ group, row, index }) => {
      const x = ((index * cardWidth + row * cardWidth * .5 - flow * 150 - (row ? 0 : 40)) % loop + loop) % loop - cardWidth;
      setAttributes(group, { transform: `translate(${x.toFixed(1)} ${560 + row * 112})`, opacity: appear(time, at.data, .5).toFixed(3) });
    });

    // 2) 짝 맞히기 표: 줄과 칸이 차례로 들어오고, "짝인지"에서 대각선만 밝아진다.
    const tableIn = appear(time, at.match, .5) * (1 - appear(time, at.map, .5));
    setAttributes(table, { opacity: tableIn.toFixed(3) });
    setAttributes(tableNote, { opacity: appear(time, at.hits + .5, .4).toFixed(3) });
    cells.forEach(({ group, i, j }) => {
      const hit = appear(time, at.hits + (i === j ? i * .18 : .3), .35);
      group.classList.toggle('pair', i === j && hit > .5);
      setAttributes(group, { opacity: (i === j ? 1 : lerp(1, .32, hit)).toFixed(3) });
    });

    // 3) 지도: 표에서 지도로 날아가고, 그다음 왼쪽으로 작게 물러난다.
    const shrink = ease(progress(time, at.shrink, 1));
    const view = { x: lerp(map.x, small.x, shrink), y: lerp(map.y, small.y, shrink), scale: lerp(1, small.scale, shrink) };
    const toScreen = (p: { x: number; y: number }) => ({ x: view.x + p.x * view.scale, y: view.y + p.y * view.scale });
    setAttributes(atlas, {
      transform: `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.scale.toFixed(4)})`,
      opacity: appear(time, at.map, .6).toFixed(3),
    });
    nodes.forEach(({ node, from, to, i, kind }) => {
      const enter = appear(time, at.match + .1 + i * .12 + (kind === 'word' ? .25 : 0), .35);
      const fly = ease(progress(time, at.place + i * .12 + (kind === 'word' ? .1 : 0), 1));
      const target = toScreen(to);
      const x = lerp(from.x, target.x, fly);
      const y = lerp(from.y, target.y, fly);
      const scale = lerp(1, (kind === 'photo' ? .78 : .86) * view.scale, fly);
      setAttributes(node, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})`, opacity: enter.toFixed(3) });
      // 강아지 사진 → "강아지" 글자가 차례로 빛나고, 둘을 감싸는 고리가 생긴다.
      const lit = i === 0 && time < at.shrink && (kind === 'photo' ? time >= at.dogPhoto : time >= at.dogWord);
      node.classList.toggle('lit', lit);
      node.classList.toggle('dim', time >= at.dogPhoto && time < at.shrink && i !== 0);
    });
    const dog = pairs[0];
    const ringIn = appear(time, at.close, .5) * (1 - appear(time, at.shrink, .4));
    setAttributes(ring, {
      cx: (dog.photo.x + dog.wordAt.x) / 2,
      cy: (dog.photo.y + dog.wordAt.y) / 2,
      rx: (130 * lerp(.6, 1, ringIn)).toFixed(1),
      ry: (88 * lerp(.6, 1, ringIn)).toFixed(1),
      opacity: ringIn.toFixed(3),
    });
    setAttributes(closeLabel, { x: (dog.photo.x + dog.wordAt.x) / 2, y: dog.wordAt.y - 70, opacity: ringIn.toFixed(3) });
    crowd.classList.toggle('dim', time >= at.dogPhoto && time < at.shrink);

    // 4) DALL·E: 이름표가 바뀌고, 글자를 입력하면 의자 그림이 여러 장.
    setAttributes(dalle, { opacity: appear(time, at.shrink + .4, .5).toFixed(3) });
    heading.update(time, (t) => (t < at.dalle ? '' : t < at.dalle2 ? 'DALL·E' : 'DALL·E 2'));
    year.update(time, (t) => (t < at.dalle ? '' : t < at.dalle2 ? '2021년 1월 · 글로 그림을 주문' : '2022년 4월'));
    const typed = Math.round(progress(time, at.prompt, at.promptEnd - at.prompt) * promptWords.length);
    const shown = promptWords.slice(0, typed) + (time >= at.prompt && time < at.promptEnd + .4 && Math.floor(time * 2.5) % 2 === 0 ? '|' : '');
    if (promptText.textContent !== shown) {
      promptText.textContent = shown;
    }
    setAttributes(promptCard, { opacity: appear(time, at.prompt - .4, .4).toFixed(3) });
    setAttributes(promptEnglish, { opacity: appear(time, at.promptEnd, .5).toFixed(3) });

    const resultsOut = 1 - appear(time, at.dalle2, .5);
    setAttributes(results, { opacity: resultsOut.toFixed(3) });
    resultTiles.forEach(({ group, inner, x, y }, k) => {
      const pop = appear(time, at.results[k], .4);
      const scale = lerp(.7, 1, pop);
      setAttributes(group, { transform: `translate(${x} ${y})`, opacity: pop.toFixed(3) });
      setAttributes(inner, { transform: `translate(${(100 - 100 * scale).toFixed(1)} ${(100 - 100 * scale).toFixed(1)}) scale(${scale.toFixed(4)})` });
    });
    setAttributes(resultNote, { opacity: appear(time, at.results[3] + .4, .5).toFixed(3) });

    // 5) DALL·E 2: CLIP 이 글을 지도 위의 자리로 옮기고, 확산이 잡음에서 그림을 꺼낸다.
    setAttributes(clipBox, { opacity: appear(time, at.clip, .4).toFixed(3) });
    const target = toScreen(promptPoint);
    const linkIn = appear(time, at.clip + .3, .4);
    setAttributes(link, { x2: target.x.toFixed(1), y2: target.y.toFixed(1), opacity: (linkIn * .9).toFixed(3) });
    const travel = progress(time, at.clip + .4, .9);
    setAttributes(packet, {
      cx: lerp(640, target.x, ease(travel)).toFixed(1),
      cy: lerp(480, target.y, ease(travel)).toFixed(1),
      opacity: travel > 0 && travel < 1 ? 1 : 0,
    });
    setAttributes(promptDot, { opacity: appear(time, at.clip + 1.2, .4).toFixed(3) });
    setAttributes(diffusionBox, { opacity: appear(time, at.diffusion, .4).toFixed(3) });

    setAttributes(painting, { opacity: appear(time, at.diffusion - .4, .4).toFixed(3) });
    const denoise = clamp((time - at.diffusion) / (steps * stepDuration));
    const step = Math.min(Math.floor(denoise * steps), steps);
    const clean = ease(denoise);
    setAttributes(blur, { stdDeviation: (14 * (1 - clean)).toFixed(2) });
    setAttributes(chairLayer, { opacity: lerp(.15, 1, clean).toFixed(3) });
    setAttributes(noise, { opacity: (1 - clean).toFixed(3) });
    noiseCells.forEach((cell, k) => {
      const shade = Math.round(40 + random(k * 3.1 + step * 17.7) * 150);
      setAttributes(cell, { fill: `rgb(${shade},${shade},${Math.round(shade * .95)})` });
    });
    setAttributes(paintingLabel, { opacity: appear(time, at.photo, .5).toFixed(3) });
  };

  return {
    element,
    update,
    title: '그림과 글의 지도(CLIP)',
    start,
    end,
    chapters: [
      { time: at.name, title: '사진과 설명 글 4억 쌍' },
      { time: at.match, title: '짝 맞히기' },
      { time: at.map, title: '같은 지도' },
      { time: at.dalle, title: '아보카도 안락의자(DALL·E)' },
      { time: at.dalle2, title: 'CLIP + 확산(DALL·E 2)' },
    ],
  };
};
