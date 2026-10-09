import './rnn.scss';
import { appear, clamp, createDiagram, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 12:23 "그림이 아니라, 시간을 따라 흐르는 정보" ~ 13:02 "처음 단어는 거의 기억하지 못했습니다".
const start = 743.767;
const end = 782.333;

// 1단계: 순서가 뜻을 바꾼다.
const orderAt = 746.6;
const sentenceA = [{ word: '나는', at: 749.3 }, { word: '밥을', at: 750.2 }, { word: '먹었다', at: 750.5 }];
const sentenceB = [{ word: '밥이', at: 751.4 }, { word: '나를', at: 751.6 }, { word: '먹었다', at: 751.9 }];
const differentAt = 752.4;
const sequencesAt = [753.6, 754.2, 754.7];
const introOut = 756.4;
// 2단계: 한 단어씩 읽으며 메모를 넘긴다.
const rnnAt = 757.6;
const readAt = 760.5;
const readStep = .9;
const summaryAt = 765.4;
const vanishingAt = 773.7;
const blurAt = 776;
const forgetAt = 779.1;

const words = ['나는', '어제', '친구와', '함께', '오래된', '시장', '골목을', '천천히', '걸으며', '이야기를', '나눴다'];
const decay = .7;
const stepX = 130;
const firstX = 150;
const cellY = 520;
const memoY = 420;
const wordY = 712;
const hue = (index: number) => `hsl(${205 + index * 13} 85% 66%)`;
const xOf = (index: number) => firstX + index * stepX;

// read 개 단어를 읽었을 때 각 단어가 메모에 남은 몫. 오래될수록 decay 배로 줄어든다.
const weights = (read: number) => words.map((_, index) => (index < read ? decay ** Math.max(read - index - 1, 0) : 0));

export const createRnnScene = (): Scene => {
  const { element, root } = createDiagram('rnn', '순환 신경망(RNN)');

  // 1단계
  const intro = svg('g', {}, root);
  const axis = svg('g', {}, intro);
  svg('line', { class: 'rnn-axis', x1: 420, x2: 1200, y1: 600, y2: 600 }, axis);
  svg('path', { class: 'rnn-axis', d: 'M1186 590 L1200 600 L1186 610' }, axis);
  text(axis, 1220, 610, '순서', { class: 'rnn-note' });
  const chipRow = (items: Array<{ word: string; at: number }>, y: number) =>
    items.map(({ word, at }, index) => {
      const group = svg('g', { transform: `translate(${520 + index * 220} ${y})` }, intro);
      svg('rect', { class: 'rnn-chip', x: -90, y: -34, width: 180, height: 68, rx: 34 }, group);
      text(group, 0, 11, word, { class: 'rnn-chip-text' });
      return { group, at };
    });
  const rowA = chipRow(sentenceA, 330);
  const rowB = chipRow(sentenceB, 470);
  const different = text(intro, 800, 220, '같은 낱말, 다른 순서 → 전혀 다른 뜻', { class: 'rnn-caption' });
  const sequences = [
    { label: '음성', path: 'M0 40 C15 0 30 80 45 40 S75 0 90 40 S120 80 135 40 S165 10 180 40' },
    { label: '주가', path: 'M0 70 L30 55 L60 62 L90 30 L120 42 L150 15 L180 22' },
    { label: '음악', path: 'M10 60 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M70 35 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M130 50 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M175 20 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0' },
  ].map(({ label, path }, index) => {
    const group = svg('g', { transform: `translate(${330 + index * 390} 680)` }, intro);
    svg('path', { class: 'rnn-sequence', d: path }, group);
    text(group, 90, 130, label, { class: 'rnn-note rnn-center' });
    return group;
  });

  // 2단계
  const network = svg('g', {}, root);
  const summary = text(network, 800, 250, '메모 = 지금까지 읽은 내용의 요약', { class: 'rnn-caption' });
  const arrows = words.slice(1).map((_, index) =>
    svg('path', { class: 'rnn-pass', d: `M${xOf(index) + 40} ${cellY} L${xOf(index + 1) - 44} ${cellY} M${xOf(index + 1) - 54} ${cellY - 8} L${xOf(index + 1) - 44} ${cellY} L${xOf(index + 1) - 54} ${cellY + 8}` }, network),
  );
  const cells = words.map((_, index) => svg('rect', { class: 'rnn-cell', x: xOf(index) - 36, y: cellY - 36, width: 72, height: 72, rx: 16 }, network));
  const feeds = words.map((_, index) => svg('line', { class: 'rnn-feed', x1: xOf(index), x2: xOf(index), y1: wordY - 34, y2: cellY + 40 }, network));
  const chips = words.map((word, index) => {
    const group = svg('g', { transform: `translate(${xOf(index)} ${wordY})` }, network);
    const box = svg('rect', { class: 'rnn-word', x: -61, y: -28, width: 122, height: 56, rx: 14, stroke: hue(index) }, group);
    const label = text(group, 0, 10, word, { class: 'rnn-word-text' });
    return { group, box, label };
  });
  const forgetMark = text(network, xOf(0), wordY + 78, '?', { class: 'rnn-forget' });

  const memo = svg('g', {}, network);
  svg('rect', { class: 'rnn-memo-frame', x: -58, y: -22, width: 116, height: 44, rx: 10 }, memo);
  const memoSegments = words.map((_, index) => svg('rect', { y: -16, height: 32, fill: hue(index) }, memo));
  const memoLink = svg('line', { class: 'rnn-feed', y1: memoY + 22, y2: cellY - 38 }, network);

  const gradient = svg('g', {}, network);
  words.slice(1).forEach((_, index) => {
    const strength = decay ** (words.length - 2 - index);
    svg('line', {
      class: 'rnn-gradient', x1: xOf(index + 1), x2: xOf(index), y1: 618, y2: 618,
      'stroke-width': (2 + 8 * strength).toFixed(1), opacity: (.15 + .85 * strength).toFixed(3),
    }, gradient);
  });
  text(gradient, xOf(words.length - 1) + 40, 600, '기울기 소실', { class: 'rnn-note rnn-end' });

  const breakdown = svg('g', {}, network);
  const finalWeights = weights(words.length);
  const total = finalWeights.reduce((sum, value) => sum + value, 0);
  let offset = 300;
  finalWeights.forEach((value, index) => {
    const width = (1000 * value) / total;
    svg('rect', { x: offset.toFixed(1), y: 214, width: Math.max(width - 2, 1).toFixed(1), height: 56, rx: 4, fill: hue(index) }, breakdown);
    if (width > 90) {
      text(breakdown, offset + width / 2, 312, words[index], { class: 'rnn-note rnn-center' });
    }
    offset += width;
  });
  text(breakdown, 290, 254, '메모', { class: 'rnn-note rnn-end' });
  const forgetNote = svg('g', {}, breakdown);
  svg('path', { class: 'rnn-pointer', d: 'M302 276 L302 366 L330 366' }, forgetNote);
  text(forgetNote, 340, 376, '나는 — 거의 남지 않음', { class: 'rnn-note rnn-warn' });

  const update = (time: number) => {
    // 1단계
    setAttributes(intro, { opacity: (appear(time, orderAt, .4) * (1 - appear(time, introOut, .5))).toFixed(3) });
    setAttributes(axis, { opacity: appear(time, orderAt, .5).toFixed(3) });
    for (const { group, at } of [...rowA, ...rowB]) {
      setAttributes(group, { opacity: appear(time, at, .3).toFixed(3) });
    }
    setAttributes(different, { opacity: appear(time, differentAt, .4).toFixed(3) });
    sequences.forEach((group, index) => setAttributes(group, { opacity: appear(time, sequencesAt[index], .4).toFixed(3) }));

    // 2단계
    setAttributes(network, { opacity: appear(time, rnnAt, .6).toFixed(3) });
    const read = clamp((time - readAt) / readStep, 0, words.length);
    const current = Math.min(Math.floor(read), words.length - 1);
    const reading = time >= readAt && read < words.length;
    chips.forEach(({ box, label }, index) => {
      box.classList.toggle('rnn-read', index < read);
      box.classList.toggle('rnn-current', reading && index === current);
      label.classList.toggle('rnn-faded', time >= forgetAt && index === 0);
    });
    cells.forEach((cell, index) => cell.classList.toggle('rnn-active', reading && index === current));
    feeds.forEach((feed, index) => setAttributes(feed, { opacity: reading && index === current ? 1 : 0 }));
    arrows.forEach((arrow, index) => arrow.classList.toggle('rnn-passed', index + 1 <= read - 1));

    // 메모는 지금 읽는 칸 위에 머물다가 다음 칸으로 넘어간다.
    const memoX = firstX + clamp(read - 1, 0, words.length - 1) * stepX;
    setAttributes(memo, { transform: `translate(${memoX.toFixed(1)} ${memoY})`, opacity: appear(time, readAt + .3, .3).toFixed(3) });
    setAttributes(memoLink, { x1: memoX.toFixed(1), x2: memoX.toFixed(1), opacity: (appear(time, readAt + .3, .3) * (read < words.length ? 1 : 0)).toFixed(3) });
    const memoWeights = weights(read);
    const memoTotal = memoWeights.reduce((sum, value) => sum + value, 0) || 1;
    let x = -52;
    memoSegments.forEach((segment, index) => {
      const width = (104 * memoWeights[index]) / memoTotal;
      setAttributes(segment, { x: x.toFixed(2), width: Math.max(width, 0).toFixed(2), opacity: memoWeights[index] > 0 ? 1 : 0 });
      x += width;
    });

    setAttributes(summary, { opacity: (appear(time, summaryAt, .4) * (1 - appear(time, vanishingAt, .4))).toFixed(3) });
    setAttributes(gradient, { opacity: appear(time, vanishingAt, .6).toFixed(3) });
    setAttributes(breakdown, { opacity: appear(time, blurAt, .5).toFixed(3) });
    setAttributes(forgetNote, { opacity: appear(time, forgetAt, .4).toFixed(3) });
    setAttributes(forgetMark, { opacity: appear(time, forgetAt, .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: '순환 신경망(RNN)',
    start,
    end,
    chapters: [
      { time: orderAt, title: '순서가 있는 정보' },
      { time: rnnAt, title: '순환 신경망' },
      { time: readAt, title: '한 단어씩 읽기' },
      { time: summaryAt, title: '메모 넘기기' },
      { time: vanishingAt, title: '기울기 소실' },
      { time: blurAt, title: '앞쪽이 흐려짐' },
      { time: forgetAt, title: '처음 단어를 잊음' },
    ],
  };
};
