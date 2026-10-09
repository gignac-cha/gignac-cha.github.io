import './gpt2.scss';
import { appear, clamp, createDiagram, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';
import { continuation, prompt, promptGloss, continuationGloss } from './unicorn.ts';

// 41:41.6 "같은 해 2월, 오픈AI는 조금 다른 길을 갑니다" ~ 42:09.0 "…가짜 기사를 그럴싸하게 이어썼거든요".
// 매개변수: GPT-1 1억 1,700만 개, GPT-2 15억 4,200만 개. 손잡이 하나를 1,000만 개로 쳐서 12개와 154개로 그린다.
// 읽은 글: GPT-1은 책 7,000여 권(BooksCorpus), GPT-2는 웹 문서 800만 개·40GB(WebText).
const start = 2501.6;
const end = 2529.0;
const at = {
  gpt1: 2503.8,
  gpt2: 2504.8,
  count: 2508.1,
  knob: 2509.3,
  network: 2510.0,
  turn: 2511.0,
  finer: 2512.4,
  many: 2513.8,
  rest: 2515.4,
  books: 2516.1,
  web: 2516.7,
  vast: 2517.5,
  story: 2519.0,
  stream: 2519.8,
  andes: 2521.9,
  unicorn: 2522.8,
  head: 2525.8,
  fake: 2526.5,
};

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const gap = 34;
const bottom = 570;
const grids = {
  gpt1: { x: 150, columns: 4, count: 12 },
  gpt2: { x: 400, columns: 14, count: 154 },
};
const picked = 5 * 14 + 10;

const knob = (parent: SVGElement, x: number, y: number, angle: number, radius = 12) => {
  const group = svg('g', { class: 'g2-knob', transform: `translate(${x} ${y})` }, parent);
  svg('circle', { r: radius }, group);
  const tick = svg('line', { x1: 0, y1: 0, x2: 0, y2: -radius * .78, transform: `rotate(${angle})` }, group);
  return { group, tick };
};

const createGrid = (parent: SVGElement, { x, columns, count }: { x: number; columns: number; count: number }, seed: number) => {
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, i) => {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const cx = x + column * gap;
    const cy = bottom - (rows - 1 - row) * gap;
    return { ...knob(parent, cx, cy, random(seed + i) * 270 - 135), column, row, cx, cy };
  });
};

// 손잡이 수만큼의 계단으로 곡선을 흉내 낸다. 손잡이가 많을수록 곡선에 더 가깝다.
const plot = { left: 1030, right: 1490, top: 270, bottom: 540 };
const target = (x: number) => .5 + .26 * Math.sin(Math.PI * 2 * x * 1.3 + .4) + .12 * Math.sin(Math.PI * 2 * x * 4.6);
const toPlot = (x: number, y: number) => `${(plot.left + x * (plot.right - plot.left)).toFixed(1)} ${(plot.bottom - y * (plot.bottom - plot.top)).toFixed(1)}`;
const curvePath = () => Array.from({ length: 121 }, (_, i) => `${i ? 'L' : 'M'}${toPlot(i / 120, target(i / 120))}`).join(' ');
const stepPath = (steps: number) => {
  const parts: string[] = [];
  for (let s = 0; s < steps; s++) {
    let sum = 0;
    for (let k = 0; k < 20; k++) {
      sum += target((s + (k + .5) / 20) / steps);
    }
    const y = sum / 20;
    parts.push(`${s ? 'L' : 'M'}${toPlot(s / steps, y)} L${toPlot((s + 1) / steps, y)}`);
  }
  return parts.join(' ');
};

export const createGpt2Scene = (): Scene => {
  const { element, root } = createDiagram('g2', '매개변수와 GPT-2');

  const models = svg('g', {}, root);
  const legend = svg('g', { class: 'g2-legend' }, models);
  knob(legend, 70, 140, -30, 11);
  text(legend, 94, 149, '손잡이 하나 = 매개변수 1,000만 개', { class: 'g2-legend-text' });

  const gpt1 = createGrid(models, grids.gpt1, 1);
  const gpt2 = createGrid(models, grids.gpt2, 100);
  const gpt1Label = svg('g', {}, models);
  text(gpt1Label, 201, 626, 'GPT-1', { class: 'g2-name' });
  text(gpt1Label, 201, 664, '1억 1,700만', { class: 'g2-count' });
  const gpt2Name = text(models, 621, 626, 'GPT-2', { class: 'g2-name' });
  const gpt2Count = text(models, 621, 676, '15억', { class: 'g2-count big' });
  const ratio = svg('g', { class: 'g2-ratio' }, models);
  svg('path', { d: 'M272 470 C300 420, 350 410, 384 430' }, ratio);
  svg('path', { class: 'g2-ratio-head', d: 'M384 430 l-16 -2 l8 -12 z' }, ratio);
  text(ratio, 318, 400, '×13', { class: 'g2-ratio-text' });

  // 읽은 글: 책 → 인터넷
  const books = svg('g', { class: 'g2-books' }, models);
  [0, 1, 2].forEach((i) => svg('rect', { x: 166 + i * 24, y: 712 + (i % 2) * 6, width: 18, height: 58 - (i % 2) * 6, rx: 3 }, books));
  text(books, 201, 812, '책 7,000여 권', { class: 'g2-data' });
  const web = svg('g', { class: 'g2-web' }, models);
  const pages = Array.from({ length: 15 }, (_, i) => {
    const page = svg('g', { transform: `translate(${470 + (i % 5) * 60} ${700 + Math.floor(i / 5) * 26})` }, web);
    svg('rect', { width: 48, height: 22, rx: 4 }, page);
    svg('line', { x1: 0, y1: 7, x2: 48, y2: 7 }, page);
    return page;
  });
  const webLabel = text(web, 621, 812, '웹 문서 800만 개 · 40GB', { class: 'g2-data' });

  // 오른쪽 상세: 손잡이 하나가 신경망 안에서 하는 일, 그리고 손잡이 수와 섬세함.
  const detail = svg('g', { class: 'g2-detail' }, root);
  svg('rect', { class: 'g2-card', x: 980, y: 170, width: 560, height: 470, rx: 22 }, detail);
  const pointer = svg('path', { class: 'g2-pointer', d: '' }, root);

  const neuron = svg('g', { class: 'g2-neuron' }, detail);
  const wire = svg('line', { class: 'g2-wire', x1: 1060, y1: 420, x2: 1460, y2: 420 }, neuron);
  svg('circle', { class: 'g2-cell', cx: 1060, cy: 420, r: 30 }, neuron);
  svg('circle', { class: 'g2-cell', cx: 1460, cy: 420, r: 30 }, neuron);
  const bigKnob = knob(neuron, 1260, 420, -60, 58);
  bigKnob.group.classList.add('big');
  const neuronCaption = text(neuron, 1260, 250, '매개변수 = 연결의 세기를 정하는 손잡이', { class: 'g2-caption' });
  const turnCaption = text(neuron, 1260, 560, '돌리면 연결이 세지거나 약해진다', { class: 'g2-note' });

  const finer = svg('g', { class: 'g2-finer' }, detail);
  svg('path', { class: 'g2-target', d: curvePath() }, finer);
  const coarse = svg('path', { class: 'g2-steps', d: stepPath(6) }, finer);
  const fine = svg('path', { class: 'g2-steps', d: stepPath(40) }, finer);
  const stepsLabel = createSwapText(finer, 1260, 236, { class: 'g2-caption' });
  const finerCaption = text(finer, 1260, 600, '손잡이가 많을수록 더 섬세하게', { class: 'g2-note' });

  // 유니콘 기사: 사람이 쓴 첫머리 + GPT-2가 이어 쓴 글.
  const story = svg('g', { class: 'g2-story' }, root);
  svg('rect', { class: 'g2-card', x: 160, y: 120, width: 1280, height: 720, rx: 22 }, story);
  text(story, 210, 172, 'GPT-2 공개 예시 · 2019년 2월', { class: 'g2-story-meta' });
  const headTag = svg('g', { class: 'g2-tag human' }, story);
  svg('rect', { x: 210, y: 200, width: 200, height: 40, rx: 20 }, headTag);
  text(headTag, 310, 228, '사람이 쓴 첫머리', {});
  const promptLines = prompt.map((segments, i) => {
    const line = text(story, 210, 290 + i * 40, '', { class: 'g2-prompt' });
    return segments.map(([content, mark]) => {
      const span = svg('tspan', { class: mark ? `mark ${mark}` : '' }, line);
      span.textContent = content;
      return span;
    });
  });
  text(story, 210, 414, promptGloss, { class: 'g2-gloss' });
  const fakeTag = svg('g', { class: 'g2-tag machine' }, story);
  svg('rect', { x: 210, y: 452, width: 330, height: 40, rx: 20 }, fakeTag);
  text(fakeTag, 375, 480, 'GPT-2가 이어 쓴 글 (10번 중 하나)', {});
  const fakeStamp = svg('g', { class: 'g2-stamp' }, story);
  svg('rect', { x: 556, y: 452, width: 110, height: 40, rx: 8 }, fakeStamp);
  text(fakeStamp, 611, 480, '가짜 기사', {});
  const streamLines = continuation.map((_, i) => text(story, 210, 540 + i * 38, '', { class: 'g2-continuation' }));
  const streamGloss = text(story, 210, 812, continuationGloss, { class: 'g2-gloss' });

  const total = continuation.reduce((sum, line) => sum + line.length, 0);
  const firstSentence = continuation[0].length;
  const fade = 26;
  const charactersPerSecond = 34;
  let rendered = -1;
  const renderStream = (streamed: number) => {
    let offset = 0;
    continuation.forEach((line, index) => {
      const visible = clamp(streamed - offset, 0, line.length);
      const solid = clamp(streamed - fade - offset, 0, line.length);
      const nodes: Node[] = solid > 0 ? [document.createTextNode(line.slice(0, solid))] : [];
      for (let i = solid; i < visible; i++) {
        const span = svg('tspan', { 'fill-opacity': ((streamed - offset - i) / fade).toFixed(2) });
        span.textContent = line[i];
        nodes.push(span);
      }
      streamLines[index].replaceChildren(...nodes);
      offset += line.length;
    });
  };

  const update = (time: number) => {
    const leaving = 1 - appear(time, at.story - .2, .5);
    setAttributes(models, { opacity: leaving.toFixed(3) });
    setAttributes(legend, { opacity: appear(time, at.count + .4, .4).toFixed(3) });

    gpt1.forEach(({ group }, i) => setAttributes(group, { opacity: appear(time, at.gpt1 + i * .02, .3).toFixed(3) }));
    setAttributes(gpt1Label, { opacity: appear(time, at.gpt1, .4).toFixed(3) });
    gpt2.forEach(({ group, column, row, cx, cy }, i) => {
      const shown = appear(time, at.gpt2 + (column + row) * .035, .35);
      setAttributes(group, { opacity: shown.toFixed(3), transform: `translate(${cx} ${cy}) scale(${(.6 + .4 * shown).toFixed(3)})` });
      group.classList.toggle('picked', i === picked && time >= at.knob && time < at.rest);
    });
    setAttributes(gpt2Name, { opacity: appear(time, at.gpt2, .4).toFixed(3) });
    setAttributes(gpt2Count, { opacity: appear(time, at.count, .4).toFixed(3) });
    setAttributes(ratio, { opacity: appear(time, at.gpt2 + .3, .4).toFixed(3) });

    setAttributes(books, { opacity: appear(time, at.books, .4).toFixed(3) });
    setAttributes(web, { opacity: appear(time, at.web, .4).toFixed(3) });
    pages.forEach((page, i) => setAttributes(page, { opacity: (i < 5 ? 1 : appear(time, at.vast + (i - 5) * .05, .3)).toFixed(3) }));
    setAttributes(webLabel, { opacity: appear(time, at.web + .3, .4).toFixed(3) });

    // 상세 카드: 손잡이 → 섬세함, 글 이야기로 넘어가면 물러난다.
    const detailShown = appear(time, at.knob, .45) * (1 - appear(time, at.rest, .5));
    setAttributes(detail, { opacity: detailShown.toFixed(3) });
    const picks = gpt2[picked];
    setAttributes(pointer, {
      d: `M${picks.cx + 16} ${picks.cy} C${picks.cx + 120} ${picks.cy}, 900 400, 980 405`,
      opacity: (detailShown * (1 - appear(time, at.finer, .3)) * .9).toFixed(3),
    });
    const knobPart = 1 - appear(time, at.finer, .35);
    setAttributes(neuron, { opacity: knobPart.toFixed(3) });
    setAttributes(neuronCaption, { opacity: appear(time, at.network, .4).toFixed(3) });
    setAttributes(turnCaption, { opacity: appear(time, at.turn + .3, .4).toFixed(3) });
    const angle = time < at.turn ? -60 : -60 + 95 * Math.sin((time - at.turn) * 2.3);
    setAttributes(bigKnob.tick, { transform: `rotate(${angle.toFixed(1)})` });
    setAttributes(wire, { 'stroke-width': (3 + 14 * ((angle + 155) / 190)).toFixed(1) });

    setAttributes(finer, { opacity: appear(time, at.finer, .35).toFixed(3) });
    const many = appear(time, at.many, .4);
    setAttributes(coarse, { opacity: (1 - many).toFixed(3) });
    setAttributes(fine, { opacity: many.toFixed(3) });
    stepsLabel.update(time, (t) => (t < at.many ? '손잡이 6개' : '손잡이 40개'));
    setAttributes(finerCaption, { opacity: appear(time, at.many + .2, .4).toFixed(3) });

    setAttributes(story, { opacity: appear(time, at.story, .5).toFixed(3) });
    promptLines.flat().forEach((span) => {
      span.classList.toggle('on', (span.classList.contains('andes') && time >= at.andes) || (span.classList.contains('unicorn') && time >= at.unicorn));
    });
    headTag.classList.toggle('glow', time >= at.head && time < at.head + 1.4);
    setAttributes(fakeStamp, { opacity: appear(time, at.fake, .3).toFixed(3) });
    const streamed = Math.round(clamp((time - at.stream) * charactersPerSecond, 0, total));
    if (streamed !== rendered) {
      renderStream(streamed);
      rendered = streamed;
    }
    setAttributes(streamGloss, { opacity: (streamed >= firstSentence ? 1 : 0).toFixed(3) });
  };

  return {
    element,
    update,
    title: '매개변수와 GPT-2',
    start,
    end,
    chapters: [
      { time: at.gpt1, title: 'GPT-1보다 열 배 넘게' },
      { time: at.knob, title: '매개변수는 조절 손잡이' },
      { time: at.finer, title: '손잡이가 많을수록 섬세하게' },
      { time: at.books, title: '책 대신 인터넷의 글' },
      { time: at.story, title: '유니콘 기사 이어 쓰기' },
    ],
  };
};
