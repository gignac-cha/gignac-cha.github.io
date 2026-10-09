import './gpt5-router.scss';
import { appear, createDiagram, ease, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 57:31.8 "8월 7일 GPT-5가 나옵니다" ~ 57:43.4 "모든 ChatGPT 사용자가 쓸 수 있게 열렸고요".
const start = 3451.6;
const end = 3464.2;
const at = {
  gpt5: 3452.7,
  fast: 3454,
  deep: 3455.4,
  unify: 3456.6,
  // "질문을 보고 얼마나 생각할지를 스스로 정했습니다"
  question: 3458.2,
  look: 3458.6,
  hard: 3458.9,
  decide: 3460.3,
  // "모든 ChatGPT 사용자가"
  everyone: 3461.6,
};

// 라우터가 보는 것: OpenAI 의 GPT-5 발표에 나온 네 가지 (대화 종류, 복잡도, 도구 필요, 명시적인 요청 예: "think hard about this").
const factors = ['대화 종류', '복잡도', '도구 필요', '"깊게 생각해 줘"'];

const f = (n: number) => n.toFixed(1);

type Point = { x: number; y: number };
const bezier = (p: Point[], t: number): Point => {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: w.reduce((sum, k, i) => sum + k * p[i].x, 0), y: w.reduce((sum, k, i) => sum + k * p[i].y, 0) };
};
const curve = (p: Point[]) => `M${p[0].x} ${p[0].y} C${p[1].x} ${p[1].y}, ${p[2].x} ${p[2].y}, ${p[3].x} ${p[3].y}`;

const router = { x: 760, y: 470, r: 58 };
const fastCard = { x: 1040, y: 230, width: 400, height: 170 };
const deepCard = { x: 1040, y: 540, width: 400, height: 170 };
const toFast = [{ x: 818, y: 470 }, { x: 930, y: 470 }, { x: 930, y: 315 }, { x: 1040, y: 315 }];
const toDeep = [{ x: 818, y: 470 }, { x: 930, y: 470 }, { x: 930, y: 625 }, { x: 1040, y: 625 }];
const questions = [
  { text: '"고마워"를 영어로?', y: 330, shown: at.question, send: at.look, routed: at.look + .5, path: toFast },
  { text: '이 증명에서 틀린 곳을 찾아 줘', y: 470, shown: at.hard, send: at.hard + .5, routed: at.decide, path: toDeep },
].map((question) => ({ ...question, entry: [{ x: 500, y: question.y }, { x: 610, y: question.y }, { x: 600, y: router.y }, { x: router.x - router.r, y: router.y }] }));

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const lightning = 'M6 -26 L-14 4 L-1 4 L-6 26 L14 -6 L1 -6 Z';

export const createGpt5RouterScene = (): Scene => {
  const { element, root } = createDiagram('gpt5-router', 'GPT-5 라우터');

  // 하나의 시스템(GPT-5): 처음엔 점선, "하나로 묶은"에서 실선으로 닫힌다.
  const frame = svg('rect', { class: 'gr-frame', x: 600, y: 160, width: 900, height: 600, rx: 30 }, root);
  const name = text(root, 640, 222, 'GPT-5', { class: 'gr-name' });

  const card = ({ x, y, width, height }: typeof fastCard, title: string, note: string, className: string) => {
    const node = svg('g', { class: `gr-card ${className}` }, root);
    svg('rect', { class: 'gr-card-box', x, y, width, height, rx: 22 }, node);
    const icon = svg('g', { class: 'gr-icon', transform: `translate(${x + 56} ${y + 62})` }, node);
    text(node, x + 100, y + 72, title, { class: 'gr-card-title' });
    text(node, x + 100, y + 108, note, { class: 'gr-card-note' });
    svg('rect', { class: 'gr-meter-track', x: x + 32, y: y + height - 38, width: width - 64, height: 10, rx: 5 }, node);
    const meter = svg('rect', { class: 'gr-meter', x: x + 32, y: y + height - 38, width: 0, height: 10, rx: 5 }, node);
    return { node, icon, meter, width: width - 64 };
  };
  const fast = card(fastCard, '빠르게 답하는 모델', '대부분의 질문에 바로', 'fast');
  svg('path', { d: lightning }, fast.icon);
  const deep = card(deepCard, '깊게 생각하는 모델', '어려운 문제는 오래 생각', 'deep');
  [-16, 0, 16].forEach((x) => svg('circle', { cx: x, cy: 0, r: 6 }, deep.icon));
  const deepLabel = text(root, deepCard.x + deepCard.width / 2, deepCard.y + deepCard.height + 34, '', { class: 'gr-thinking', 'text-anchor': 'middle' });

  const wires = svg('g', { class: 'gr-wires' }, root);
  const fastWire = svg('path', { d: curve(toFast) }, wires);
  const deepWire = svg('path', { d: curve(toDeep) }, wires);
  const hub = svg('g', { class: 'gr-router' }, root);
  svg('circle', { cx: router.x, cy: router.y, r: router.r }, hub);
  text(hub, router.x, router.y + 9, '라우터', { 'text-anchor': 'middle' });
  const factorViews = factors.map((factor, i) => {
    const node = svg('g', { class: 'gr-factor' }, root);
    svg('rect', { x: router.x - 100, y: 562 + i * 46, width: 200, height: 38, rx: 19 }, node);
    text(node, router.x, 588 + i * 46, factor, { 'text-anchor': 'middle' });
    return node;
  });
  const decideCaption = text(root, 1050, 830, '질문을 보고, 얼마나 생각할지 스스로 정한다', { class: 'gr-caption', 'text-anchor': 'middle' });

  const questionViews = questions.map((question) => {
    const node = svg('g', { class: 'gr-question' }, root);
    const width = question.text.length * 22 + 50;
    svg('rect', { x: 490 - width, y: question.y - 32, width, height: 64, rx: 32 }, node);
    text(node, 490 - width / 2, question.y + 9, question.text, { 'text-anchor': 'middle' });
    const dot = svg('circle', { class: 'gr-dot', r: 10 }, root);
    return { ...question, node, dot };
  });

  // 모든 사용자: 왼쪽에서 질문이 쏟아져 들어와 라우터에서 갈라진다. 대부분은 빠른 모델로.
  const crowd = svg('g', {}, root);
  const crowdLabel = text(root, 280, 690, '모든 ChatGPT 사용자', { class: 'gr-crowd-label', 'text-anchor': 'middle' });
  const crowdDots = Array.from({ length: 30 }, (_, i) => ({
    dot: svg('circle', { class: 'gr-dot small', r: 6 }, crowd),
    born: at.everyone + i * .085,
    y: 250 + random(i * 3 + 1) * 420,
    deep: random(i * 3 + 2) < .28,
  }));

  return {
    element,
    title: 'GPT-5 라우터',
    start,
    end,
    chapters: [
      { time: at.gpt5, title: '빠른 모델과 생각하는 모델' },
      { time: at.unify, title: '하나로 묶은 시스템' },
      { time: at.question, title: '얼마나 생각할지 정하기' },
      { time: at.everyone, title: '모든 사용자에게' },
    ],
    update: (time: number) => {
      const unified = time >= at.unify;
      frame.classList.toggle('unified', unified);
      setAttributes(frame, { opacity: appear(time, at.gpt5, .5).toFixed(3) });
      setAttributes(name, { opacity: appear(time, at.gpt5, .5).toFixed(3) });
      setAttributes(fast.node, { opacity: appear(time, at.fast, .4).toFixed(3), transform: `translate(${f((1 - appear(time, at.fast, .4)) * 30)} 0)` });
      setAttributes(deep.node, { opacity: appear(time, at.deep, .4).toFixed(3), transform: `translate(${f((1 - appear(time, at.deep, .4)) * 30)} 0)` });
      setAttributes(hub, { opacity: appear(time, at.unify, .4).toFixed(3) });
      setAttributes(wires, { opacity: appear(time, at.unify + .2, .4).toFixed(3) });
      factorViews.forEach((node, i) => setAttributes(node, { opacity: appear(time, at.look + .3 + i * .15, .3).toFixed(3) }));
      setAttributes(decideCaption, { opacity: appear(time, at.decide, .4).toFixed(3) });

      // 질문 하나하나: 말풍선이 나타나고, 점이 라우터로 갔다가, 정해진 모델로 간다.
      let fastBusy = false;
      let deepBusy = false;
      let hubBusy = false;
      for (const view of questionViews) {
        const shown = appear(time, view.shown, .35);
        const sent = time >= view.send;
        const crowding = 1 - .6 * appear(time, at.everyone, .5);
        setAttributes(view.node, { opacity: (shown * (sent ? .55 : 1) * crowding).toFixed(3) });
        const toHub = progress(time, view.send, .45);
        const toModel = progress(time, view.routed, .5);
        let point: Point | undefined;
        if (toHub > 0 && toHub < 1) {
          point = bezier(view.entry, ease(toHub));
        } else if (toHub >= 1 && toModel <= 0) {
          point = { x: router.x, y: router.y };
          hubBusy = true;
        } else if (toModel > 0 && toModel < 1) {
          point = bezier(view.path, ease(toModel));
        }
        setAttributes(view.dot, point ? { cx: f(point.x), cy: f(point.y), opacity: 1 } : { opacity: 0 });
        if (view.path === toFast && toModel > 0) {
          fastBusy ||= time < view.routed + 1;
        }
        if (view.path === toDeep && toModel > 0) {
          deepBusy = true;
        }
      }
      // 빠른 모델은 곧바로, 생각하는 모델은 오래 생각한 뒤 답한다.
      const fastAnswer = questions[0].routed + .5;
      const deepAnswer = questions[1].routed + .5;
      setAttributes(fast.meter, { width: f(fast.width * .1 * ease(progress(time, fastAnswer, .25))) });
      setAttributes(deep.meter, { width: f(deep.width * ease(progress(time, deepAnswer, end - deepAnswer - .6))) });
      const thinking = time >= deepAnswer;
      const label = !thinking ? '' : time < end - .6 ? `생각 중${'.'.repeat(1 + (Math.floor((time - deepAnswer) * 3) % 3))}` : '답';
      if (deepLabel.textContent !== label) {
        deepLabel.textContent = label;
      }
      fast.node.classList.toggle('active', fastBusy);
      deep.node.classList.toggle('active', deepBusy);
      hub.classList.toggle('active', hubBusy);
      factorViews[1].classList.toggle('active', time >= questions[1].send + .45 && time < at.decide + .3);
      fastWire.classList.toggle('active', fastBusy);
      deepWire.classList.toggle('active', deepBusy && time < deepAnswer + .3);

      setAttributes(crowdLabel, { opacity: appear(time, at.everyone + .3, .4).toFixed(3) });
      for (const { dot, born, y, deep: goesDeep } of crowdDots) {
        const age = time - born;
        if (age < 0 || age > 1.7) {
          setAttributes(dot, { opacity: 0 });
          continue;
        }
        const entry = [{ x: 40, y }, { x: 420, y }, { x: 560, y: router.y }, { x: router.x - router.r, y: router.y }];
        const point = age < .85 ? bezier(entry, age / .85) : bezier(goesDeep ? toDeep : toFast, (age - .85) / .85);
        setAttributes(dot, { cx: f(point.x), cy: f(point.y), opacity: f(Math.min(1, age / .15, (1.7 - age) / .15) * .9) });
      }
    },
  };
};
