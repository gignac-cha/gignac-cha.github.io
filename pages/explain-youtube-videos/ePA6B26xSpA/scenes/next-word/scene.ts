import './next-word.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 39:54.2 "그는 아주 단순한 과제 하나에 주목합니다" ~ 40:40.3 "의대생이 기초 의학을 다 배운 뒤 전공을 고르는 셈이죠".
// GPT-1 논문(2018): BooksCorpus(7,000권이 넘는 미출간 책)로 다음 단어 맞히기를 사전 학습하고,
// 자연어 추론·질문 답변·문장 유사도·분류 과제에 맞춰 미세 조정했다. 12층 트랜스포머 디코더, 매개변수 1억 1,700만 개.
const start = 2394.2;
const end = 2441;
const at = {
  task: 2396.8,
  story: [2399.2, 2399.6, 2399.9, 2400.1],
  slot: 2400.4,
  hunch: 2400.7,
  grammar: 2403.9,
  world: 2405.4,
  books: 2408.4,
  corpus: 2408.9,
  page: 2410.7,
  predict: 2411.1,
  answer: 2413.2,
  labels: 2416.3,
  noLabels: 2417.1,
  huge: 2418.2,
  allText: 2420.5,
  textbook: 2421.3,
  gpt: 2423.4,
  pre: 2425.9,
  generative: 2426.6,
  transformer: 2427.2,
  stages: 2428.6,
  two: 2429.3,
  pretrain: 2431,
  broad: 2431.2,
  then: 2434.1,
  tasks: 2434.6,
  slight: 2435.7,
  student: 2437.6,
  basics: 2438.2,
  major: 2439.5,
};
// 장면 안의 구간: 과제 → 책 → 교과서 → GPT-1 → 두 단계.
const parts = { task: [at.task, at.books - .4], books: [at.books - .2, at.huge + .6], textbook: [at.huge + .8, at.gpt - .2], gpt: [at.gpt, at.stages - .2], stages: [at.stages, end + 1] };

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

// 책 속 실제 문장: 현진건 「운수 좋은 날」(1924) 첫 문장.
const bookLines = [
  ['새침하게', '흐린', '품이', '눈이', '올', '듯하더니'],
  ['눈은', '아니', '오고', '얼다가', '만', '비가'],
  ['추적추적', '내리는', '날이었다.'],
];
const context = 3;
const stepTime = .6;

const shown = (time: number, [from, to]: number[]) => appear(time, from, .4) * (1 - appear(time, to, .4));

const docIcon = (parent: SVGElement, x: number, y: number, kind: number, size = 1) => {
  const group = svg('g', { class: `next-word-doc kind-${kind % 5}`, transform: `translate(${x} ${y}) scale(${size})` }, parent);
  svg('rect', { x: -26, y: -34, width: 52, height: 68, rx: 6 }, group);
  for (let i = 0; i < 4; i++) {
    svg('rect', { class: 'next-word-doc-line', x: -16, y: -20 + i * 13, width: i === 3 ? 18 : 32, height: 4, rx: 2 }, group);
  }
  return group;
};

const createTask = (root: SVGElement) => {
  const group = svg('g', {}, root);
  text(group, 800, 250, '다음 단어 맞히기', { class: 'next-word-heading', 'text-anchor': 'middle' });
  const words = [['옛날', 440], ['옛적', 590], ['어느', 740], ['마을에', 920]].map(([word, x]) => text(group, x as number, 462, word as string, { class: 'next-word-story', 'text-anchor': 'middle' }));
  const slot = svg('g', { class: 'next-word-slot' }, group);
  svg('rect', { x: 1040, y: 400, width: 180, height: 84, rx: 14 }, slot);
  const glow = svg('rect', { class: 'next-word-slot-glow', x: 1034, y: 394, width: 192, height: 96, rx: 18 }, slot);
  text(slot, 1130, 462, '?', { class: 'next-word-slot-mark', 'text-anchor': 'middle' });
  const caret = svg('rect', { class: 'next-word-caret', x: 1186, y: 414, width: 4, height: 56 }, slot);
  const hints = [
    { label: '문법', x: 960, at: at.grammar },
    { label: '세상 돌아가는 이치', x: 1300, at: at.world },
  ].map(({ label, x, at: hintAt }) => {
    const hint = svg('g', { class: 'next-word-hint' }, group);
    svg('path', { d: `M${x} 600 L1130 488` }, hint);
    const width = label.length * 26 + 48;
    svg('rect', { x: x - width / 2, y: 600, width, height: 56, rx: 28 }, hint);
    text(hint, x, 638, label, { 'text-anchor': 'middle' });
    return { hint, at: hintAt };
  });
  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.task).toFixed(3) });
    words.forEach((word, i) => setAttributes(word, { opacity: appear(time, at.story[i], .3).toFixed(3) }));
    setAttributes(slot, { opacity: appear(time, at.slot, .3).toFixed(3) });
    // "감이 오잖아요": 빈칸이 한 번 숨 쉬듯 빛난다.
    setAttributes(glow, { opacity: Math.sin(Math.PI * progress(time, at.hunch, 1.3)).toFixed(3) });
    setAttributes(caret, { opacity: Math.floor((time - at.slot) * 2) % 2 === 0 ? '1' : '0' });
    hints.forEach(({ hint, at: hintAt }) => setAttributes(hint, { opacity: appear(time, hintAt, .4).toFixed(3) }));
  };
};

const createBooks = (root: SVGElement) => {
  const group = svg('g', {}, root);
  // 책장: 6칸에 책등이 빼곡히 꽂힌다.
  const shelf = svg('g', { class: 'next-word-shelf' }, group);
  const spines: { node: SVGElement; order: number }[] = [];
  for (let row = 0; row < 6; row++) {
    const y = 300 + row * 82;
    svg('rect', { class: 'next-word-board', x: 110, y: y + 2, width: 500, height: 6, rx: 3 }, shelf);
    let x = 116;
    let i = 0;
    while (x < 600) {
      const width = 12 + Math.floor(random(row * 97 + i) * 12);
      const height = 52 + Math.floor(random(row * 31 + i * 7) * 22);
      if (x + width > 604) {
        break;
      }
      const node = svg('rect', { class: `next-word-spine color-${Math.floor(random(row * 13 + i * 3) * 6)}`, x, y: y - height, width: width - 2, height, rx: 2 }, shelf);
      spines.push({ node, order: row * 40 + i });
      x += width;
      i++;
    }
  }
  text(group, 110, 196, 'BooksCorpus', { class: 'next-word-corpus' });
  text(group, 110, 820, '미출간 책 7,000여 권 · GPT-1이 읽은 책', { class: 'next-word-note' });

  // 책 한 쪽: 앞 단어만 보고 다음 단어를 맞히면, 책에 적힌 단어가 곧 정답이다.
  const page = svg('g', { class: 'next-word-page' }, group);
  svg('rect', { class: 'next-word-page-sheet', x: 700, y: 236, width: 800, height: 330, rx: 12 }, page);
  const tokens: { node: SVGTextElement; box: SVGRectElement; index: number }[] = [];
  let index = 0;
  bookLines.forEach((line, row) => {
    let x = 750;
    const y = 330 + row * 84;
    for (const word of line) {
      const width = word.length * 36;
      const box = svg('rect', { class: 'next-word-target', x: x - 10, y: y - 46, width: width + 20, height: 62, rx: 10 }, page);
      const node = text(page, x, y, word, { class: 'next-word-token' });
      tokens.push({ node, box, index });
      index++;
      x += width + 30;
    }
  });
  const guess = text(page, 0, 0, '?', { class: 'next-word-guess', 'text-anchor': 'middle' });
  text(group, 700, 606, '현진건 「운수 좋은 날」(1924) 첫 문장', { class: 'next-word-note' });
  const answer = text(group, 700, 676, '정답은 이미 책 속에 · 책에 적힌 다음 단어', { class: 'next-word-answer' });

  const sheet = svg('g', { class: 'next-word-labels' }, group);
  svg('rect', { class: 'next-word-labels-card', x: 1200, y: 640, width: 300, height: 190, rx: 14 }, sheet);
  text(sheet, 1230, 690, '사람이 붙인 정답표', { class: 'next-word-labels-title' });
  for (let i = 0; i < 3; i++) {
    svg('rect', { class: 'next-word-doc-line', x: 1230, y: 714 + i * 30, width: 160 - i * 30, height: 10, rx: 5 }, sheet);
    svg('rect', { class: 'next-word-labels-tag', x: 1410, y: 708 + i * 30, width: 60, height: 22, rx: 6 }, sheet);
  }
  const cross = svg('path', { class: 'next-word-cross', d: 'M1196 636 L1504 834 M1504 636 L1196 834', pathLength: 1 }, sheet);

  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.books).toFixed(3) });
    // 책장이 왼쪽 위부터 빠르게 채워진다.
    const filled = ease(progress(time, at.books, 1.2)) * spines.length;
    spines.forEach(({ node }, i) => setAttributes(node, { opacity: clamp(filled - i).toFixed(3) }));

    setAttributes(page, { opacity: appear(time, at.page, .4).toFixed(3) });
    // 지금 맞힐 단어: context 개를 보여 준 뒤 0.6초마다 한 단어씩.
    const step = time < at.predict ? -1 : Math.floor((time - at.predict) / stepTime);
    const target = Math.min(context + Math.max(step, 0), tokens.length);
    const local = time < at.predict ? 0 : (time - at.predict) % stepTime;
    const revealed = step >= 0 && target < tokens.length ? ease(clamp((local - .28) / .2)) : 0;
    tokens.forEach(({ node, box, index: i }) => {
      const known = i < target || (i === target && revealed > .5);
      setAttributes(node, { 'fill-opacity': (i < target ? 1 : i === target ? revealed : 0).toFixed(3) });
      node.classList.toggle('target', i === target);
      setAttributes(box, { opacity: (i === target && step >= 0 ? 1 : 0).toFixed(3) });
      box.classList.toggle('right', known);
    });
    const current = tokens[Math.min(target, tokens.length - 1)];
    setAttributes(guess, {
      x: (Number(current.box.getAttribute('x')) + Number(current.box.getAttribute('width')) / 2).toFixed(1),
      y: (Number(current.box.getAttribute('y')) + 48).toFixed(1),
      opacity: (step >= 0 && target < tokens.length ? 1 - revealed : 0).toFixed(3),
    });
    setAttributes(answer, { opacity: appear(time, at.answer, .4).toFixed(3) });
    setAttributes(sheet, { opacity: appear(time, at.labels, .4).toFixed(3) });
    setAttributes(cross, { 'stroke-dashoffset': (1 - ease(progress(time, at.noLabels, .4))).toFixed(3) });
  };
};

const createTextbook = (root: SVGElement) => {
  const group = svg('g', {}, root);
  text(group, 800, 210, '세상의 모든 글', { class: 'next-word-heading', 'text-anchor': 'middle' });
  const docs = Array.from({ length: 48 }, (_, i) => {
    const column = i % 12;
    const row = Math.floor(i / 12);
    const x = 170 + column * 115 + (row % 2) * 30 + (random(i * 3) - .5) * 30;
    const y = 320 + row * 120 + (random(i * 5) - .5) * 30;
    return { node: docIcon(group, x, y, i), x, y, delay: random(i * 7) * .8 };
  });
  const book = svg('g', { class: 'next-word-textbook' }, group);
  svg('path', { d: 'M800 470 C740 440 640 440 590 460 L590 720 C640 700 740 700 800 730 C860 700 960 700 1010 720 L1010 460 C960 440 860 440 800 470 Z' }, book);
  svg('path', { class: 'next-word-textbook-spine', d: 'M800 470 L800 730' }, book);
  text(group, 800, 820, '= 교과서', { class: 'next-word-textbook-label', 'text-anchor': 'middle' });
  const label = group.lastElementChild as SVGTextElement;
  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.textbook).toFixed(3) });
    // 글이 사방에서 나타났다가 "교과서"에서 한 권의 책으로 모인다.
    const gather = ease(progress(time, at.textbook, 1));
    docs.forEach(({ node, x, y, delay }) => {
      const appeared = appear(time, at.allText - .8 + delay, .4);
      const px = lerp(x, 800, gather);
      const py = lerp(y, 590, gather);
      setAttributes(node, { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(${lerp(1, .3, gather).toFixed(3)})`, opacity: (appeared * (1 - gather * .9)).toFixed(3) });
    });
    setAttributes(book, { opacity: appear(time, at.textbook + .5, .5).toFixed(3) });
    setAttributes(label, { opacity: appear(time, at.textbook + .7, .4).toFixed(3) });
  };
};

const createGPT = (root: SVGElement) => {
  const group = svg('g', {}, root);
  text(group, 800, 300, 'GPT-1', { class: 'next-word-gpt', 'text-anchor': 'middle' });
  text(group, 800, 356, '2018년 6월 · 오픈AI', { class: 'next-word-gpt-sub', 'text-anchor': 'middle' });
  text(group, 800, 400, '트랜스포머 디코더 12층 · 매개변수 1억 1,700만 개', { class: 'next-word-gpt-sub', 'text-anchor': 'middle' });
  // 이름 풀이: 말하는 순서(미리 학습한 → 생성형 → 트랜스포머)대로 글자가 켜진다.
  const letters = [
    { letter: 'G', english: 'Generative', korean: '생성형', x: 520, at: at.generative },
    { letter: 'P', english: 'Pre-trained', korean: '미리 학습한', x: 800, at: at.pre },
    { letter: 'T', english: 'Transformer', korean: '트랜스포머', x: 1080, at: at.transformer },
  ].map(({ letter, english, korean, x, at: letterAt }) => {
    const column = svg('g', { class: 'next-word-letter' }, group);
    const big = text(column, x, 580, letter, { class: 'next-word-letter-big', 'text-anchor': 'middle' });
    const words = svg('g', {}, column);
    text(words, x, 640, english, { class: 'next-word-letter-english', 'text-anchor': 'middle' });
    text(words, x, 690, korean, { class: 'next-word-letter-korean', 'text-anchor': 'middle' });
    return { big, words, at: letterAt };
  });
  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.gpt).toFixed(3) });
    letters.forEach(({ big, words, at: letterAt }) => {
      const on = appear(time, letterAt, .35);
      setAttributes(big, { 'fill-opacity': lerp(.35, 1, on).toFixed(3) });
      setAttributes(words, { opacity: on.toFixed(3), transform: `translate(0 ${((1 - on) * 12).toFixed(1)})` });
    });
  };
};

const createStages = (root: SVGElement) => {
  const group = svg('g', {}, root);
  text(group, 800, 196, '공부를 두 단계로', { class: 'next-word-heading', 'text-anchor': 'middle' });
  const first = svg('g', { class: 'next-word-stage first' }, group);
  svg('rect', { x: 110, y: 240, width: 800, height: 380, rx: 20 }, first);
  text(first, 146, 296, '1단계 · 사전 학습', { class: 'next-word-stage-title' });
  text(first, 146, 334, '방대한 글로 폭넓게 · 다음 단어 맞히기', { class: 'next-word-stage-note' });
  const piles = Array.from({ length: 33 }, (_, i) => docIcon(first, 180 + (i % 11) * 66, 400 + Math.floor(i / 11) * 76, i, .78));

  const arrow = svg('path', { class: 'next-word-arrow', d: 'M920 430 L968 430 M954 418 L970 430 L954 442' }, group);

  const second = svg('g', { class: 'next-word-stage second' }, group);
  svg('rect', { x: 980, y: 240, width: 510, height: 380, rx: 20 }, second);
  text(second, 1016, 296, '2단계 · 미세 조정', { class: 'next-word-stage-title' });
  const secondNote = text(second, 1016, 334, '원하는 일에 맞춰 살짝 다듬기', { class: 'next-word-stage-note' });
  const tasks = ['자연어 추론', '질문 답변', '문장 유사도', '분류'].map((label, i) => {
    const chip = svg('g', { class: 'next-word-task' }, second);
    const x = 1016 + (i % 2) * 230;
    const y = 384 + Math.floor(i / 2) * 84;
    svg('rect', { x, y, width: 210, height: 60, rx: 30 }, chip);
    text(chip, x + 105, y + 39, label, { 'text-anchor': 'middle' });
    return chip;
  });
  text(second, 1016, 590, 'GPT-1 논문의 과제 유형', { class: 'next-word-stage-note small' });

  const analogy = svg('g', { class: 'next-word-analogy' }, group);
  text(analogy, 110, 712, '의대생이라면', { class: 'next-word-analogy-lead' });
  const basics = text(analogy, 510, 712, '기초 의학을 다 배우고', { class: 'next-word-analogy-text', 'text-anchor': 'middle' });
  const major = text(analogy, 1235, 712, '전공을 고른다', { class: 'next-word-analogy-text', 'text-anchor': 'middle' });

  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.stages).toFixed(3) });
    setAttributes(first, { opacity: appear(time, at.two - .2, .4).toFixed(3) });
    const pile = ease(progress(time, at.broad, 1.6)) * piles.length;
    piles.forEach((doc, i) => setAttributes(doc, { opacity: clamp(pile - i).toFixed(3) }));
    setAttributes(arrow, { opacity: appear(time, at.then, .3).toFixed(3) });
    setAttributes(second, { opacity: appear(time, at.then, .4).toFixed(3) });
    tasks.forEach((chip, i) => setAttributes(chip, { opacity: appear(time, at.tasks + i * .2, .3).toFixed(3) }));
    setAttributes(secondNote, { opacity: appear(time, at.slight, .3).toFixed(3) });
    setAttributes(analogy, { opacity: appear(time, at.student, .4).toFixed(3) });
    setAttributes(basics, { opacity: appear(time, at.basics, .4).toFixed(3) });
    setAttributes(major, { opacity: appear(time, at.major, .4).toFixed(3) });
  };
};

export const createNextWordScene = (): Scene => {
  const { element, root } = createDiagram('next-word', '다음 단어 맞히기(GPT-1)');
  const renders = [createTask(root), createBooks(root), createTextbook(root), createGPT(root), createStages(root)];
  return {
    element,
    update: (time: number) => renders.forEach((render) => render(time)),
    title: '다음 단어 맞히기(GPT-1)',
    start,
    end,
    chapters: [
      { time: start, title: '다음 단어 맞히기' },
      { time: at.books, title: '책 7,000여 권' },
      { time: at.answer, title: '정답은 이미 책 속에' },
      { time: at.huge, title: '모든 글이 교과서' },
      { time: at.gpt, title: 'GPT-1' },
      { time: at.stages, title: '사전 학습과 미세 조정' },
    ],
  };
};
