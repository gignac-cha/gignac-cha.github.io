import './lstm.scss';
import { appear, between, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 13:21 "이름은 장단기 기억, LSTM" ~ 14:09 "훨씬 긴 맥락을 붙잡게 됐습니다".
const start = 801.467;
const end = 849.833;

// 1단계: 기억 전용 통로(무빙워크)
const beltAt = 805.7;
const luggageAt = 809.6;
const beltLabelAt = 812.9;
const compareAt = 815.9;
const compareOut = 818.6;
// 2단계: 통로 곳곳의 문
const gatesAt = 819.3;
const gateLabelsAt = 821.6;
const writeAt = 823.8;
const readAt = 826.4;
const forgetAt = 829.8;
const unitOut = 833.067;
// 3단계: 철수는 … 그는
const sentenceAt = 833.3;
const words = [
  { word: '철수는', at: 835.0 },
  { word: '어제', at: 835.3 },
  { word: '서울에', at: 835.6 },
  { word: '갔는데', at: 835.9 },
  { word: '거기서', at: 836.3 },
  { word: '그는', at: 836.8 },
  { word: '친구를', at: 837.2 },
  { word: '만났다', at: 837.5 },
];
const whoAt = 838.4;
const liftAt = 842.1;
const rideAt = 843.1;
const dropAt = 844.8;
const answerAt = 845.6;
const contextAt = 848.0;

const beltY = 300;
const beltLeft = 140;
const beltRight = 1460;
const unitY = 660;
const gateY = 470;
const wordY = 740;
const wordX = (index: number) => 205 + index * 170;
const he = 5;

const chip = (parent: Element, label: string, className: string) => {
  const group = svg('g', { class: `lstm-chip ${className}` }, parent);
  svg('rect', { x: -78, y: -26, width: 156, height: 52, rx: 14 }, group);
  text(group, 0, 10, label, {});
  return group;
};

const valve = (parent: Element, x: number, y: number, className: string) => {
  const group = svg('g', { class: `lstm-valve ${className}`, transform: `translate(${x} ${y})` }, parent);
  svg('rect', { x: -34, y: -20, width: 68, height: 40, rx: 12 }, group);
  return group;
};

const place = (element: Element, x: number, y: number, opacity: number) =>
  setAttributes(element, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: opacity.toFixed(3) });

export const createLstmScene = (): Scene => {
  const { element, root } = createDiagram('lstm', '장단기 기억(LSTM)');
  const defs = svg('defs', {}, root);
  const clip = svg('clipPath', { id: 'lstm-belt-clip' }, defs);
  svg('rect', { x: beltLeft, y: beltY - 36, width: beltRight - beltLeft, height: 72, rx: 36 }, clip);

  // 통로
  const belt = svg('g', {}, root);
  svg('rect', { class: 'lstm-belt', x: beltLeft, y: beltY - 36, width: beltRight - beltLeft, height: 72, rx: 36 }, belt);
  const stripeClip = svg('g', { 'clip-path': 'url(#lstm-belt-clip)' }, belt);
  const stripes = svg('g', {}, stripeClip);
  for (let x = beltLeft - 80; x < beltRight + 80; x += 40) {
    svg('line', { class: 'lstm-stripe', x1: x, y1: beltY + 36, x2: x + 24, y2: beltY - 36 }, stripes);
  }
  const beltLabel = text(belt, beltLeft + 10, beltY - 60, '기억 전용 통로', { class: 'lstm-heading' });
  const luggage = chip(root, '기억', 'lstm-memory');

  // RNN 메모와 비교
  const compare = svg('g', {}, root);
  svg('line', { class: 'lstm-rnn-line', x1: beltLeft, x2: beltRight, y1: 470, y2: 470 }, compare);
  text(compare, beltLeft + 10, 430, 'RNN의 메모', { class: 'lstm-note' });
  const fadingMemo = chip(compare, '기억', 'lstm-memory');
  const rider = chip(root, '기억', 'lstm-memory');

  // 한 칸과 세 개의 문
  const unit = svg('g', {}, root);
  svg('rect', { class: 'lstm-unit', x: 610, y: unitY - 56, width: 380, height: 112, rx: 22 }, unit);
  text(unit, 800, unitY + 12, 'LSTM 한 칸', { class: 'lstm-unit-text' });
  const gates = [
    { x: 690, label: '넣기', className: 'lstm-write' },
    { x: 800, label: '꺼내기', className: 'lstm-read' },
    { x: 910, label: '지우기', className: 'lstm-forget' },
  ].map(({ x, label, className }) => {
    svg('line', { class: 'lstm-connector', x1: x, x2: x, y1: beltY + 36, y2: unitY - 56 }, unit);
    const gate = valve(unit, x, gateY, className);
    const caption = text(unit, x, unitY + 100, label, { class: 'lstm-gate-label' });
    return { gate, caption };
  });
  const incoming = chip(root, '새 정보', 'lstm-memory');
  const outgoing = chip(root, '지금 쓸 기억', 'lstm-memory');
  const stale = chip(root, '오래된 기억', 'lstm-memory');
  const cross = svg('path', { class: 'lstm-cross', d: 'M-30 -30 L30 30 M30 -30 L-30 30' }, root);

  // 문장 예시
  const sentence = svg('g', {}, root);
  const wordViews = words.map(({ word }, index) => {
    const x = wordX(index);
    svg('line', { class: 'lstm-connector', x1: x, x2: x, y1: beltY + 36, y2: wordY - 30 }, sentence);
    const gate = valve(sentence, x, 520, index === 0 ? 'lstm-write' : index === he ? 'lstm-read' : '');
    const group = svg('g', { transform: `translate(${x} ${wordY})` }, sentence);
    const box = svg('rect', { class: 'lstm-word', x: -74, y: -30, width: 148, height: 60, rx: 14 }, group);
    text(group, 0, 11, word, { class: 'lstm-word-text' });
    return { group, box, gate };
  });
  const question = text(sentence, wordX(he), wordY - 54, '누구?', { class: 'lstm-question' });
  const memory = chip(root, '철수', 'lstm-memory lstm-memory-strong');
  const answer = text(sentence, wordX(he), wordY - 54, '그 = 철수', { class: 'lstm-answer' });
  const bracket = svg('g', {}, sentence);
  svg('path', { class: 'lstm-bracket', d: `M${wordX(0) - 60} 800 L${wordX(0) - 60} 820 L${wordX(he) + 60} 820 L${wordX(he) + 60} 800` }, bracket);
  text(bracket, (wordX(0) + wordX(he)) / 2, 866, '긴 맥락', { class: 'lstm-heading lstm-center' });

  const update = (time: number) => {
    setAttributes(belt, { opacity: appear(time, beltAt, .5).toFixed(3) });
    setAttributes(stripes, { transform: `translate(${((time * 60) % 40).toFixed(2)} 0)` });
    setAttributes(beltLabel, { opacity: appear(time, beltLabelAt, .4).toFixed(3) });

    // 짐은 힘들이지 않고 멀리까지 간다.
    const carry = progress(time, luggageAt, 2.6);
    place(luggage, lerp(beltLeft + 90, beltRight - 90, carry), beltY, appear(time, luggageAt, .3) * (1 - appear(time, luggageAt + 2.6, .3)));

    // 통로 위 기억은 또렷하게, RNN 메모는 흐려지며 간다.
    setAttributes(compare, { opacity: (appear(time, compareAt - .3, .3) * (1 - appear(time, compareOut, .3))).toFixed(3) });
    const travel = progress(time, compareAt, 2.1);
    const riding = between(time, compareAt - .3, compareOut + .3);
    place(rider, lerp(beltLeft + 90, beltRight - 90, travel), beltY, riding ? appear(time, compareAt - .3, .3) * (1 - appear(time, compareOut, .3)) : 0);
    place(fadingMemo, lerp(beltLeft + 90, beltRight - 90, travel), 470, 1 - travel * .9);

    // 문
    setAttributes(unit, { opacity: (appear(time, gatesAt, .5) * (1 - appear(time, unitOut, .4))).toFixed(3) });
    gates.forEach(({ caption }) => setAttributes(caption, { opacity: appear(time, gateLabelsAt, .4).toFixed(3) }));
    gates[0].gate.classList.toggle('lstm-open', between(time, writeAt, readAt));
    gates[1].gate.classList.toggle('lstm-open', between(time, readAt, forgetAt));
    gates[2].gate.classList.toggle('lstm-open', between(time, forgetAt, unitOut));

    // 넣기: 아래에서 문을 지나 통로 위로, 그리고 흘러간다.
    const rise = ease(progress(time, writeAt, 1));
    const flowAway = ease(progress(time, writeAt + 1.2, 1.2));
    place(incoming, lerp(690, 1300, flowAway), lerp(unitY, beltY, rise), between(time, writeAt - .2, readAt) ? appear(time, writeAt, .3) * (1 - appear(time, readAt - .4, .3)) : 0);
    // 꺼내기: 통로를 타고 온 기억을 문을 열어 아래로 꺼낸다.
    const arrive = ease(progress(time, readAt, .8));
    const take = ease(progress(time, readAt + 1, .9));
    place(outgoing, lerp(300, 800, arrive), lerp(beltY, unitY, take), between(time, readAt, forgetAt) ? appear(time, readAt, .3) * (1 - appear(time, forgetAt - .4, .3)) : 0);
    // 지우기: 통로 위 오래된 기억을 지운다.
    const erase = appear(time, forgetAt + .6, .8);
    place(stale, 910, beltY, between(time, forgetAt - .2, unitOut) ? appear(time, forgetAt, .3) * (1 - erase) : 0);
    place(cross, 910, beltY, between(time, forgetAt + .3, unitOut) ? appear(time, forgetAt + .3, .2) * (1 - appear(time, forgetAt + 1.6, .4)) : 0);

    // 문장 예시
    setAttributes(sentence, { opacity: appear(time, sentenceAt, .5).toFixed(3) });
    wordViews.forEach(({ group, box, gate }, index) => {
      setAttributes(group, { opacity: appear(time, words[index].at, .3).toFixed(3) });
      box.classList.toggle('lstm-word-key', (index === 0 && time >= liftAt) || (index === he && time >= whoAt));
      gate.classList.toggle('lstm-open', (index === 0 && between(time, liftAt, rideAt + .2)) || (index === he && between(time, dropAt, contextAt)));
    });
    setAttributes(question, { opacity: (appear(time, whoAt, .3) * (1 - appear(time, answerAt, .3))).toFixed(3) });
    const lift = ease(progress(time, liftAt, 1));
    const ride = ease(progress(time, rideAt, 1.1));
    const drop = ease(progress(time, dropAt, .8));
    const memoryY = time < dropAt ? lerp(wordY, beltY, lift) : lerp(beltY, wordY - 160, drop);
    place(memory, lerp(wordX(0), wordX(he), ride), memoryY, time >= liftAt ? appear(time, liftAt, .3) : 0);
    setAttributes(answer, { opacity: appear(time, answerAt, .4).toFixed(3) });
    setAttributes(bracket, { opacity: appear(time, contextAt, .5).toFixed(3) });
  };

  return {
    element,
    update,
    title: '장단기 기억(LSTM)',
    start,
    end,
    chapters: [
      { time: beltAt, title: '기억 전용 통로' },
      { time: luggageAt, title: '무빙워크' },
      { time: compareAt, title: '흐려지지 않는 기억' },
      { time: gatesAt, title: '게이트' },
      { time: writeAt, title: '넣기' },
      { time: readAt, title: '꺼내기' },
      { time: forgetAt, title: '지우기' },
      { time: sentenceAt, title: '철수는 … 그는' },
      { time: liftAt, title: '철수를 통로에' },
      { time: dropAt, title: '문을 열어 꺼냄' },
    ],
  };
};
