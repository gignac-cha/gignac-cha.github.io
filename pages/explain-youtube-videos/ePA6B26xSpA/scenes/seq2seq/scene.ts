import './seq2seq.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 24:00.7 "번역은 오랫동안 규칙과 통계로" ~ 24:47.9 "통째로 외워서 옮기라는 셈이니까요".
const start = 1440.667;
const end = 1487.933;
const old = { split: 1444, pair: 1444.7, awkward: 1448 };
const model = { show: 1453.433, read: [1464, 1464.35, 1464.7], hold: 1465.9, pass: 1467.2, speak: [1471.2, 1471.9, 1472.6], lstm: 1474.8 };
const long = { show: 1481.4, read: 1481.9, readLength: 2.6, overflow: 1483.2, garble: 1485.4 };

const encoderX = [230, 400, 570];
const decoderX = [1030, 1200, 1370];
const cellY = 500;
const capsule = { x: 800, y: 500 };
const longWords = ['The', 'old', 'man', 'who', 'lives', 'by', 'the', 'river', 'told', 'me', 'a', 'story', 'about', 'the', 'war'];
const longOutput = [
  { word: 'Le', garbled: false },
  { word: 'vieil', garbled: false },
  { word: 'homme', garbled: false },
  { word: '…', garbled: true },
  { word: 'guerre', garbled: true },
  { word: '?', garbled: true },
];

const arrow = (parent: SVGElement, x1: number, y1: number, x2: number, y2: number, className = 's2s-arrow') => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 14;
  const f = (n: number) => n.toFixed(1);
  const left = [x2 - head * Math.cos(angle - .5), y2 - head * Math.sin(angle - .5)];
  const right = [x2 - head * Math.cos(angle + .5), y2 - head * Math.sin(angle + .5)];
  return svg('path', { class: className, d: `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} M${f(left[0])} ${f(left[1])} L${f(x2)} ${f(y2)} L${f(right[0])} ${f(right[1])}` }, parent);
};

const chip = (parent: SVGElement, x: number, y: number, label: string, className = '') => {
  const group = svg('g', { class: `s2s-chip ${className}`, transform: `translate(${x} ${y})` }, parent);
  const width = Math.max(110, label.length * 20 + 56);
  svg('rect', { x: -width / 2, y: -32, width, height: 64, rx: 32 }, group);
  text(group, 0, 11, label);
  return group;
};

const createOldTranslation = (root: SVGElement) => {
  const group = svg('g', { transform: 'translate(0 40)' }, root);
  text(group, 800, 210, '규칙과 통계 · 조각끼리 짝 맞추기', { class: 's2s-caption', 'text-anchor': 'middle' });
  const pieces = [
    { en: 'I', fr: 'Je', from: 640, to: 540 },
    { en: 'miss', fr: 'manque', from: 800, to: 800 },
    { en: 'you', fr: 'toi', from: 960, to: 1060 },
  ].map((piece) => ({
    ...piece,
    link: svg('line', { class: 's2s-pair-link' }, group),
    english: chip(group, piece.from, 330, piece.en),
    french: chip(group, piece.to, 520, piece.fr, 'muted'),
  }));
  const result = svg('g', {}, group);
  text(result, 800, 720, 'Je manque toi', { class: 's2s-awkward', 'text-anchor': 'middle' });
  svg('path', { class: 's2s-squiggle', d: Array.from({ length: 16 }, (_, i) => `${i === 0 ? 'M' : 'L'}${686 + i * 15} ${i % 2 ? 744 : 752}`).join(' ') }, result);
  text(result, 950, 720, '번역투', { class: 's2s-awkward-label' });

  return (time: number) => {
    setAttributes(group, { opacity: (appear(time, start, .4) * (1 - appear(time, model.show, .5))).toFixed(3) });
    const split = ease(progress(time, old.split, .6));
    for (const piece of pieces) {
      const x = lerp(piece.from, piece.to, split);
      setAttributes(piece.english, { transform: `translate(${x.toFixed(1)} 330)` });
      setAttributes(piece.french, { opacity: appear(time, old.pair).toFixed(3) });
      setAttributes(piece.link, { x1: x.toFixed(1), y1: 362, x2: piece.to, y2: 488, opacity: appear(time, old.pair).toFixed(3) });
    }
    setAttributes(result, { opacity: appear(time, old.awkward).toFixed(3) });
  };
};

const createModel = (root: SVGElement) => {
  // 아래쪽 여백이 남지 않도록 전체를 조금 내려 화면 가운데에 둔다.
  const group = svg('g', { transform: 'translate(0 60)' }, root);
  text(group, 400, 236, '인코더', { class: 's2s-heading', 'text-anchor': 'middle' });
  text(group, 400, 276, '끝까지 듣기', { class: 's2s-caption', 'text-anchor': 'middle' });
  text(group, 1200, 236, '디코더', { class: 's2s-heading', 'text-anchor': 'middle' });
  text(group, 1200, 276, '한 단어씩 말하기', { class: 's2s-caption', 'text-anchor': 'middle' });

  const wires = svg('g', {}, group);
  [[encoderX[0], encoderX[1]], [encoderX[1], encoderX[2]], [decoderX[0], decoderX[1]], [decoderX[1], decoderX[2]]].forEach(([a, b]) => arrow(wires, a + 60, cellY, b - 62, cellY));
  arrow(wires, encoderX[2] + 60, cellY, capsule.x - 88, cellY);
  arrow(wires, capsule.x + 84, cellY, decoderX[0] - 62, cellY);

  const cell = (x: number) => {
    const node = svg('g', { class: 's2s-cell', transform: `translate(${x} ${cellY})` }, group);
    svg('rect', { x: -55, y: -55, width: 110, height: 110, rx: 22 }, node);
    const label = text(node, 0, 10, 'LSTM', { class: 's2s-cell-label' });
    return { node, label };
  };
  const encoder = encoderX.map(cell);
  const decoder = decoderX.map(cell);

  const shortInputs = svg('g', {}, group);
  const inputs = ['I', 'miss', 'you'].map((word, i) => {
    arrow(shortInputs, encoderX[i], 618, encoderX[i], 562);
    return chip(shortInputs, encoderX[i], 650, word);
  });
  const shortOutputs = svg('g', {}, group);
  const outputs = ['Tu', 'me', 'manques'].map((word, i) => {
    const output = svg('g', {}, shortOutputs);
    arrow(output, decoderX[i], 443, decoderX[i], 392);
    chip(output, decoderX[i], 360, word, 'output');
    return output;
  });

  const summary = svg('g', { class: 's2s-capsule', transform: `translate(${capsule.x} ${capsule.y})` }, group);
  const ring = svg('circle', { class: 's2s-capsule-ring', r: 80 }, summary);
  const bars = [-44, -22, 0, 22, 44].map((x) => svg('rect', { class: 's2s-capsule-bar', x: x - 7, width: 14, rx: 7 }, summary));
  text(group, capsule.x, capsule.y + 128, '요약', { class: 's2s-heading', 'text-anchor': 'middle' });
  const packet = svg('circle', { class: 's2s-packet', r: 12 }, group);

  const longInputs = svg('g', { class: 's2s-long' }, group);
  const lines = [longWords.slice(0, 8), longWords.slice(8)];
  const longSpans: SVGTSpanElement[] = [];
  lines.forEach((words, row) => {
    const line = text(longInputs, 400, 660 + row * 50, '', { class: 's2s-long-line', 'text-anchor': 'middle' });
    words.forEach((word, i) => {
      const span = svg('tspan', {}, line);
      span.textContent = (i ? ' ' : '') + word;
      longSpans.push(span);
    });
  });
  const longOut = text(group, 1200, 372, '', { class: 's2s-long-line output', 'text-anchor': 'middle' });
  const outSpans = longOutput.map(({ word, garbled }, i) => {
    const span = svg('tspan', { class: garbled ? 'garbled' : '' }, longOut);
    span.textContent = (i ? ' ' : '') + word;
    return span;
  });

  return (time: number) => {
    setAttributes(group, { opacity: appear(time, model.show, .5).toFixed(3) });
    const isLong = time >= long.show;
    const longShown = appear(time, long.show, .5);
    setAttributes(shortInputs, { opacity: (1 - longShown).toFixed(3) });
    setAttributes(shortOutputs, { opacity: (1 - longShown).toFixed(3) });
    setAttributes(longInputs, { opacity: longShown.toFixed(3) });
    setAttributes(longOut, { opacity: longShown.toFixed(3) });

    inputs.forEach((input, i) => input.classList.toggle('active', !isLong && time >= model.read[i]));
    // 긴 문장에서도 인코더는 같은 세 칸이 차례로 돌며 읽는다.
    const longIndex = Math.floor(progress(time, long.read, long.readLength) * longWords.length);
    encoder.forEach(({ node }, i) => {
      const reading = isLong ? time >= long.read && longIndex < longWords.length && longIndex % 3 === i : time >= model.read[i];
      node.classList.toggle('active', reading || (!isLong && time >= model.read[i]));
    });
    outputs.forEach((output, i) => setAttributes(output, { opacity: appear(time, model.speak[i], .35).toFixed(3) }));
    decoder.forEach(({ node }, i) => node.classList.toggle('active', isLong ? time >= long.garble : time >= model.speak[i]));
    for (const { label } of [...encoder, ...decoder]) {
      setAttributes(label, { opacity: appear(time, model.lstm).toFixed(3) });
    }

    // 요약 한 개에 담기: 짧은 문장은 막대가 알맞게 차고, 긴 문장은 넘쳐서 고리가 빨갛게 된다.
    const filled = ease(progress(time, model.hold, .6));
    const strain = appear(time, long.overflow, .6);
    bars.forEach((bar, i) => {
      const height = (40 + ((i * 37) % 50)) * filled * (1 + strain * .6);
      setAttributes(bar, { y: (-height / 2).toFixed(1), height: height.toFixed(1) });
    });
    ring.classList.toggle('strained', time >= long.overflow);

    const travel = progress(time, model.pass, 1.4);
    const passing = travel > 0 && travel < 1;
    setAttributes(packet, {
      cx: lerp(capsule.x + 84, decoderX[0] - 62, ease(travel)).toFixed(1),
      cy: cellY,
      opacity: passing ? '1' : '0',
    });

    longSpans.forEach((span, i) => {
      // 읽은 지 오래된 단어부터 요약에서 흐려진다.
      const age = longIndex - i;
      const read = time >= long.read && i <= longIndex;
      span.classList.toggle('read', read);
      span.classList.toggle('faded', read && age > 5 && time >= long.overflow);
    });
    outSpans.forEach((span, i) => setAttributes(span, { 'fill-opacity': appear(time, long.garble + i * .3, .3).toFixed(3) }));
  };
};

export const createSeq2SeqScene = (): Scene => {
  const { element, root } = createDiagram('s2s', '시퀀스 투 시퀀스(Seq2Seq)');
  const renders = [createOldTranslation(root), createModel(root)];
  return {
    element,
    update: (time: number) => renders.forEach((render) => render(time)),
    title: '시퀀스 투 시퀀스(Seq2Seq)',
    start,
    end,
    chapters: [
      { time: start, title: '조각끼리 짝 맞추기' },
      { time: model.show, title: '인코더와 디코더' },
      { time: model.read[0], title: '끝까지 듣고 요약' },
      { time: model.speak[0], title: '한 단어씩 말하기' },
      { time: long.show, title: '긴 문장의 한계' },
    ],
  };
};
