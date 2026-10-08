import './chatgpt-pieces.scss';
import { appear, clamp, createDiagram, ease, lerp, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 52:09 "사실 기술만 보면 완전히 새로운 건 아니었습니다" ~ 52:24 "보통 사람 손에 쥐어진 겁니다".
const start = 3129;
const end = 3144.5;
const at = {
  notNew: 3129.3,
  pieces: [3131.7, 3132.5, 3133.1, 3134.3],
  stacked: 3136.4,
  changed: 3138.4,
  anyone: 3139,
  window: 3140,
  lab: 3141.2,
  hands: 3142.8,
};

// 조각마다 처음 나온 해: 트랜스포머(2017), 사전 학습(GPT-1, 2018), 스케일링(스케일링 법칙·GPT-3, 2020), 사람 피드백(InstructGPT, 2022).
const pieces = [
  { name: '트랜스포머', year: '2017', tone: 'blue' },
  { name: '사전 학습', year: '2018', tone: 'green' },
  { name: '스케일링', year: '2020', tone: 'orange' },
  { name: '사람 피드백', year: '2022', tone: 'purple' },
];
const block = { width: 360, height: 92, x: 380 };
const restY = (i: number) => 700 - i * (block.height + 10);
const chat = { x: 900, y: 250, width: 560, height: 420 };

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const person = (parent: Element, x: number, y: number, size: number) => {
  const group = svg('g', { class: 'cp-person' }, parent);
  svg('circle', { cx: x, cy: y - size * .32, r: size * .2 }, group);
  svg('path', { d: `M${x - size * .3} ${y + size * .42} Q${x} ${y - size * .18} ${x + size * .3} ${y + size * .42} Z` }, group);
  return group;
};

export const createChatGptPiecesScene = (): Scene => {
  const { element, root } = createDiagram('chatgpt-pieces', 'ChatGPT를 이룬 조각들');

  const heading = text(root, 800, 150, '새 기술이 아니라, 몇 년간 쌓인 조각들', { class: 'cp-heading' });

  // 연구실: 조각들이 쌓이는 곳.
  const lab = svg('g', { class: 'cp-lab' }, root);
  svg('rect', { x: block.x - 50, y: restY(3) - 70, width: block.width + 100, height: 700 - restY(3) + block.height + 110, rx: 24 }, lab);
  text(lab, block.x + block.width / 2, restY(3) - 30, '연구실', { class: 'cp-lab-label' });

  const blocks = pieces.map(({ name, year, tone }) => {
    const group = svg('g', { class: `cp-block ${tone}` }, root);
    svg('rect', { x: 0, y: 0, width: block.width, height: block.height, rx: 16 }, group);
    text(group, 28, 58, name, { class: 'cp-block-name' });
    text(group, block.width - 28, 58, year, { class: 'cp-block-year' });
    return group;
  });

  // 대화창 하나.
  const chatWindow = svg('g', {}, root);
  const link = svg('path', { class: 'cp-link', d: `M${block.x + block.width + 60} 520 C820 520 820 460 ${chat.x - 14} 460` }, chatWindow);
  svg('rect', { x: chat.x, y: chat.y, width: chat.width, height: chat.height, rx: 26, class: 'cp-chat' }, chatWindow);
  text(chatWindow, chat.x + chat.width / 2, chat.y + 60, 'ChatGPT', { class: 'cp-chat-title' });
  text(chatWindow, chat.x + chat.width / 2, chat.y + 96, '2022년 11월 30일 · 무료', { class: 'cp-chat-sub' });
  const input = svg('g', {}, chatWindow);
  svg('rect', { x: chat.x + 36, y: chat.y + chat.height - 108, width: chat.width - 72, height: 68, rx: 34, class: 'cp-input' }, input);
  text(input, chat.x + 70, chat.y + chat.height - 64, '무엇이든 물어보세요', { class: 'cp-placeholder' });
  svg('circle', { cx: chat.x + chat.width - 74, cy: chat.y + chat.height - 74, r: 22, class: 'cp-send' }, input);
  svg('path', { d: `M${chat.x + chat.width - 74} ${chat.y + chat.height - 64} V${chat.y + chat.height - 84} M${chat.x + chat.width - 82} ${chat.y + chat.height - 76} L${chat.x + chat.width - 74} ${chat.y + chat.height - 84} L${chat.x + chat.width - 66} ${chat.y + chat.height - 76}`, class: 'cp-send-arrow' }, input);
  // 대화창 안의 요청들(사람들이 실제로 했던 부탁의 종류).
  const asks = ['시 써 줘', '이 코드 고쳐 줘', '이메일을 공손하게 바꿔 줘'].map((ask, i) => {
    const group = svg('g', {}, chatWindow);
    const width = ask.length * 26 + 48;
    svg('rect', { x: chat.x + chat.width - 40 - width, y: chat.y + 128 + i * 64, width, height: 48, rx: 24, class: 'cp-bubble' }, group);
    text(group, chat.x + chat.width - 40 - width / 2, chat.y + 160 + i * 64, ask, { class: 'cp-bubble-text' });
    return group;
  });
  const anyone = text(root, chat.x + chat.width / 2, chat.y + chat.height + 60, '누구나 쓸 수 있는 대화창 하나', { class: 'cp-anyone' });

  // 보통 사람들의 손에.
  const crowd = svg('g', {}, root);
  const people = Array.from({ length: 15 }, (_, i) => ({
    node: person(crowd, chat.x - 10 + i * 41, 812 + (i % 2) * 40, 44),
    at: at.hands + random(i * 3 + 1) * 1.1,
  }));

  const update = (time: number) => {
    setAttributes(heading, { opacity: appear(time, at.notNew, .5).toFixed(3) });
    setAttributes(lab, { opacity: (appear(time, at.pieces[0] - .3, .5) * lerp(1, .35, appear(time, at.lab, .6))).toFixed(3) });

    // 조각이 위에서 떨어져 차곡차곡 쌓인다(살짝 튀고 멈춘다).
    blocks.forEach((group, i) => {
      const fall = clamp((time - at.pieces[i]) / .55);
      const y = fall < 1 ? lerp(-140, restY(i), fall * fall) : restY(i) - Math.abs(Math.sin((time - at.pieces[i] - .55) * 14)) * 16 * Math.exp(-(time - at.pieces[i] - .55) * 7);
      setAttributes(group, { transform: `translate(${block.x} ${y.toFixed(1)})`, opacity: time >= at.pieces[i] ? 1 : 0 });
      group.classList.toggle('settled', time >= at.stacked);
    });

    const windowIn = appear(time, at.changed, .5);
    setAttributes(chatWindow, { opacity: windowIn.toFixed(3), transform: `translate(${lerp(40, 0, windowIn).toFixed(1)} 0)` });
    setAttributes(link, { 'stroke-dashoffset': (-(time * 30) % 32).toFixed(1) });
    input.classList.toggle('lit', time >= at.window);
    asks.forEach((group, i) => setAttributes(group, { opacity: appear(time, at.window + .3 + i * .35, .3).toFixed(3) }));
    setAttributes(anyone, { opacity: appear(time, at.anyone, .4).toFixed(3) });

    people.forEach(({ node, at: shownAt }) => {
      const shown = appear(time, shownAt, .35);
      setAttributes(node, { opacity: shown.toFixed(3), transform: `translate(0 ${lerp(16, 0, ease(shown)).toFixed(1)})` });
    });
  };

  return {
    element,
    update,
    title: 'ChatGPT를 이룬 조각들',
    start,
    end,
    chapters: [
      { time: at.pieces[0], title: '트랜스포머 · 사전 학습 · 스케일링 · 사람 피드백' },
      { time: at.changed, title: '누구나 쓰는 대화창' },
      { time: at.lab, title: '연구실에서 보통 사람 손으로' },
    ],
  };
};
