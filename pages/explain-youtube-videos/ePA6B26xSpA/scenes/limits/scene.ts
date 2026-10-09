import './limits.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';

// 61:57.7 "반대 목소리도 분명히 있습니다" ~ 62:26.4 "정답은 아무도 모릅니다".
// 다섯 가지 반론이 하나씩 가운데에 크게 나왔다가 아래 줄로 물러나고, 마지막에 "세 번째 겨울?" 위로 눈이 내린다.
const start = 3717.5;
const end = 3747;
const at = {
  slots: 3717.7,
  // "지금의 모델도 여전히 그럴듯한 거짓말을 해요. 이걸 환각이라고 부르죠"
  lie: 3719.1,
  stamp: 3721.6,
  name: 3722.8,
  // "모델이 커질수록 전기와 칩도 엄청나게 필요합니다"
  power: 3724,
  electricity: 3725,
  chips: 3725.4,
  // "사람이 쓴 좋은 글이 바닥나고 있다는 경고도 나와요"
  data: 3727.2,
  runOut: 3728.5,
  // "르쿤은 다음 단어 맞추기만으로는 진짜 지능에 닿을 수 없다고 말합니다. 세상을 직접 보고 겪으며 배우는 방식이 필요하다는 거죠"
  lecun: 3730.6,
  nextWord: 3731.1,
  cannot: 3733.7,
  world: 3734.8,
  experience: 3735.8,
  // "여름에 있었던 에이전트 사건도 숙제를 남겼습니다. 일을 맡길수록 그 일을 어떻게 믿을지가 더 중요해졌어요"
  trust: 3737.4,
  delegate: 3740.9,
  believe: 3742.2,
  // "그럼 세 번째 겨울이 올까요? 정답은 아무도 모릅니다"
  winter: 3743.1,
  unknown: 3745.6,
};

const f = (n: number) => n.toFixed(1);

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

// 패널은 1000×520 좌표로 그리고, 가운데(크게)와 아래 줄(작게) 사이를 옮겨 다닌다.
const panelSize = { width: 1000, height: 520 };
const spotlight = { x: 300, y: 128 };
const strip = { y: 696, scale: .24, pitch: 268 };
const slotX = (i: number) => 800 - (strip.pitch * 4 + panelSize.width * strip.scale) / 2 + i * strip.pitch;

const panelFrame = (parent: SVGElement, source: string) => {
  const node = svg('g', { class: 'lm-panel' }, parent);
  svg('rect', { class: 'lm-panel-frame', width: panelSize.width, height: panelSize.height, rx: 26 }, node);
  text(node, 44, 494, source, { class: 'lm-source' });
  return node;
};

// 1) 환각: 2023년 미국 Mata v. Avianca 소송에서 변호사가 제출한 ChatGPT 대화. 없는 판례를 진짜라고 답했다.
const createHallucination = (parent: SVGElement) => {
  const node = panelFrame(parent, '2023년 미국 Mata v. Avianca 소송에 제출된 실제 대화(번역)');
  const header = createSwapText(node, 44, 74, { class: 'lm-header' });
  const question = svg('g', { class: 'lm-bubble user' }, node);
  svg('rect', { x: 540, y: 112, width: 416, height: 64, rx: 32 }, question);
  text(question, 748, 153, 'Varghese 판례, 실제로 있나요?', { 'text-anchor': 'middle' });
  const reply = svg('g', { class: 'lm-bubble bot' }, node);
  svg('rect', { x: 44, y: 206, width: 820, height: 186, rx: 26 }, reply);
  text(reply, 80, 258, '네, 실제 판례입니다.', { class: 'lm-reply-lead' });
  text(reply, 80, 310, 'Varghese v. China Southern Airlines Co Ltd,', { class: 'lm-citation' });
  text(reply, 80, 352, '925 F.3d 1339 (11th Cir. 2019)', { class: 'lm-citation' });
  const stamp = svg('g', { class: 'lm-stamp' }, node);
  svg('rect', { x: -170, y: -42, width: 340, height: 84, rx: 10 }, stamp);
  text(stamp, 0, 15, '존재하지 않는 판례', { 'text-anchor': 'middle' });

  return (time: number) => {
    header.update(time, (t) => (t < at.name ? '그럴듯한 거짓말' : '환각'));
    setAttributes(question, { opacity: appear(time, at.lie + .2, .3).toFixed(3) });
    setAttributes(reply, { opacity: appear(time, at.lie + .8, .4).toFixed(3) });
    const thump = ease(progress(time, at.stamp, .25));
    setAttributes(stamp, { transform: `translate(660 300) rotate(-8) scale(${f(lerp(1.5, 1, thump))})`, opacity: thump.toFixed(3) });
    reply.classList.toggle('false', time >= at.stamp);
  };
};

// 2) 전기와 칩: IEA 「Energy and AI」(2025). 전 세계 데이터센터 전력 2024년 415 TWh, 2030년 약 945 TWh 전망.
const createPower = (parent: SVGElement) => {
  const node = panelFrame(parent, 'IEA 「Energy and AI」(2025) · 2030년은 전망치');
  text(node, 44, 74, '전기와 칩', { class: 'lm-header' });
  text(node, 44, 132, '전 세계 데이터센터 전력 사용량', { class: 'lm-label' });
  const scale = 640 / 945;
  const bars = [
    { year: '2024년', value: 415, label: '415 TWh', y: 168, className: '' },
    { year: '2030년', value: 945, label: '약 945 TWh', y: 248, className: 'projected' },
  ].map((bar) => {
    text(node, 44, bar.y + 36, bar.year, { class: 'lm-label strong' });
    const rect = svg('rect', { class: `lm-power ${bar.className}`, x: 170, y: bar.y, width: 0, height: 52, rx: 8 }, node);
    const amount = text(node, 0, bar.y + 36, bar.label, { class: 'lm-value' });
    return { ...bar, rect, amount };
  });
  // "칩도": 칩이 줄지어 늘어난다.
  const chips = Array.from({ length: 14 }, (_, i) => {
    const chip = svg('g', { class: 'lm-chip', transform: `translate(${80 + i * 62} 392)` }, node);
    svg('rect', { x: -20, y: -20, width: 40, height: 40, rx: 5 }, chip);
    svg('path', { d: 'M-12 -26 L-12 -20 M0 -26 L0 -20 M12 -26 L12 -20 M-12 20 L-12 26 M0 20 L0 26 M12 20 L12 26 M-26 -10 L-20 -10 M-26 10 L-20 10 M20 -10 L26 -10 M20 10 L26 10' }, chip);
    return chip;
  });

  return (time: number) => {
    bars.forEach((bar, i) => {
      const width = bar.value * scale * ease(progress(time, at.electricity + i * .35, .6));
      setAttributes(bar.rect, { width: f(width) });
      setAttributes(bar.amount, { x: f(170 + width + 16), opacity: appear(time, at.electricity + i * .35 + .4, .3).toFixed(3) });
    });
    chips.forEach((chip, i) => setAttributes(chip, { opacity: appear(time, at.chips + i * .06, .2).toFixed(3) }));
  };
};

// 3) 바닥나는 글: Epoch AI(2024) 추정 공개된 사람 글 ≈ 300조 토큰(범위 100조~1000조), 2026~2032년 사이 다 쓸 전망.
// 점은 실제 학습 데이터 크기: GPT-3 3,000억, Chinchilla 1.4조, Llama 3 15조 토큰. 점선은 이 세 점의 추세를 늘린 것.
const createData = (parent: SVGElement) => {
  const node = panelFrame(parent, 'Epoch AI(2024) · 학습 데이터는 각 모델의 공개 수치');
  text(node, 44, 74, '바닥나는 사람의 글', { class: 'lm-header' });
  const plot = { left: 110, right: 960, top: 112, bottom: 440, from: 2019, to: 2034, low: 11, high: 15 };
  const x = (year: number) => plot.left + ((year - plot.from) / (plot.to - plot.from)) * (plot.right - plot.left);
  const y = (tokens: number) => plot.bottom - ((Math.log10(tokens) - plot.low) / (plot.high - plot.low)) * (plot.bottom - plot.top);
  svg('rect', { class: 'lm-window', x: x(2026), y: plot.top, width: x(2032) - x(2026), height: plot.bottom - plot.top }, node);
  text(node, (x(2026) + x(2032)) / 2, plot.bottom - 14, '2026~2032년 소진 전망', { class: 'lm-window-label', 'text-anchor': 'middle' });
  svg('rect', { class: 'lm-stock-band', x: plot.left, y: y(1e15), width: plot.right - plot.left, height: y(1e14) - y(1e15) }, node);
  svg('path', { class: 'lm-stock', d: `M${plot.left} ${f(y(3e14))} L${plot.right} ${f(y(3e14))}` }, node);
  text(node, plot.left + 8, y(3e14) - 12, '공개된 사람의 글 ≈ 300조 토큰', { class: 'lm-label strong' });
  [2020, 2024, 2028, 2032].forEach((year) => text(node, x(year), plot.bottom + 28, String(year), { class: 'lm-axis', 'text-anchor': 'middle' }));
  svg('path', { class: 'lm-axis-line', d: `M${plot.left} ${plot.bottom} L${plot.right} ${plot.bottom}` }, node);
  // 점선은 점과 글자 아래에 깐다. 세 점에 맞춘 직선(로그 눈금)을 300조에 닿을 때까지 늘린다.
  const years = [2020, 2022, 2024];
  const logs = [3e11, 1.4e12, 1.5e13].map(Math.log10);
  const meanX = years.reduce((a, b) => a + b) / 3;
  const meanY = logs.reduce((a, b) => a + b) / 3;
  const slope = years.reduce((sum, year, i) => sum + (year - meanX) * (logs[i] - meanY), 0) / years.reduce((sum, year) => sum + (year - meanX) ** 2, 0);
  const lineAt = (year: number) => 10 ** (meanY + slope * (year - meanX));
  const hitYear = meanX + (Math.log10(3e14) - meanY) / slope;
  const trend = svg('path', { class: 'lm-trend' }, node);
  const hit = svg('circle', { class: 'lm-hit', cx: f(x(hitYear)), cy: f(y(3e14)), r: 0 }, node);
  const points = [
    { year: 2020, tokens: 3e11, label: 'GPT-3 · 3,000억' },
    { year: 2022, tokens: 1.4e12, label: 'Chinchilla · 1.4조' },
    { year: 2024, tokens: 1.5e13, label: 'Llama 3 · 15조' },
  ].map((point, i) => {
    const dot = svg('g', { class: 'lm-point' }, node);
    svg('circle', { cx: x(point.year), cy: y(point.tokens), r: 9 }, dot);
    text(dot, x(point.year) + 16, y(point.tokens) + 7, point.label, { class: 'lm-point-label' });
    return { dot, at: at.data + .3 + i * .25 };
  });

  return (time: number) => {
    for (const point of points) {
      setAttributes(point.dot, { opacity: appear(time, point.at, .25).toFixed(3) });
    }
    const draw = ease(progress(time, at.runOut - .3, .8));
    const end = lerp(2020, hitYear, draw);
    setAttributes(trend, { d: draw > 0 ? `M${f(x(2020))} ${f(y(lineAt(2020)))} L${f(x(end))} ${f(y(lineAt(end)))}` : '' });
    const flash = progress(time, at.runOut + .5, .6);
    setAttributes(hit, { r: f(flash * 34), opacity: (flash > 0 && flash < 1 ? 1 - flash : 0).toFixed(3) });
  };
};

// 4) 얀 르쿤: 다음 단어 맞추기만으로는 진짜 지능에 닿을 수 없다. 세상을 직접 보고 겪으며 배워야 한다.
const createWorld = (parent: SVGElement) => {
  const node = panelFrame(parent, '얀 르쿤의 주장');
  const header = createSwapText(node, 44, 74, { class: 'lm-header' });

  const words = svg('g', {}, node);
  ['고양이가', '매트', '위에', '?'].forEach((word, i) => {
    const chip = svg('g', { class: `lm-word${word === '?' ? ' next' : ''}`, transform: `translate(${98 + i * 104} 330)` }, words);
    svg('rect', { x: -48, y: -28, width: 96, height: 56, rx: 12 }, chip);
    text(chip, 0, 9, word, { 'text-anchor': 'middle' });
  });
  text(words, 254, 400, '글만 보고 다음 단어 맞히기', { class: 'lm-label', 'text-anchor': 'middle' });
  const goal = svg('g', { class: 'lm-goal' }, node);
  svg('rect', { x: 154, y: 126, width: 200, height: 60, rx: 14 }, goal);
  text(goal, 254, 165, '진짜 지능', { 'text-anchor': 'middle' });
  const reach = svg('path', { class: 'lm-reach', d: 'M254 296 L254 196' }, node);
  const cross = svg('g', { class: 'lm-cross', transform: 'translate(254 240)' }, node);
  svg('path', { d: 'M-22 -22 L22 22 M22 -22 L-22 22' }, cross);

  // 오른쪽: 보고 → 해 보고 → 결과를 겪는 고리.
  const loop = svg('g', { transform: 'translate(730 290)' }, node);
  svg('circle', { class: 'lm-loop', r: 118 }, loop);
  const steps = ['보기', '해 보기', '겪기'].map((name, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const step = svg('g', { class: 'lm-step', transform: `translate(${f(Math.cos(angle) * 118)} ${f(Math.sin(angle) * 118)})` }, loop);
    svg('rect', { x: -58, y: -26, width: 116, height: 52, rx: 26 }, step);
    text(step, 0, 9, name, { 'text-anchor': 'middle' });
    return { step, angle, at: at.world + .3 + i * .4 };
  });
  // 고리 가운데: 굴러가는 공과 바닥 — "세상".
  const ball = svg('circle', { class: 'lm-ball', r: 16 }, loop);
  svg('path', { class: 'lm-ground', d: 'M-50 26 L50 26' }, loop);
  const runner = svg('circle', { class: 'lm-runner', r: 9 }, loop);

  return (time: number) => {
    header.update(time, (t) => (t < at.experience ? '다음 단어 맞추기만으로는' : '세상을 보고 겪으며 배우기'));
    setAttributes(words, { opacity: (appear(time, at.nextWord, .4) * (1 - .55 * appear(time, at.world, .5))).toFixed(3) });
    setAttributes(goal, { opacity: (appear(time, at.nextWord + .6, .4) * (1 - .55 * appear(time, at.world, .5))).toFixed(3) });
    const rise = ease(progress(time, at.nextWord + .8, 1.6));
    setAttributes(reach, { d: `M254 296 L254 ${f(296 - rise * 70)}`, opacity: (rise > 0 ? 1 - .55 * appear(time, at.world, .5) : 0).toFixed(3) });
    setAttributes(cross, { opacity: (appear(time, at.cannot, .25) * (1 - .55 * appear(time, at.world, .5))).toFixed(3) });

    setAttributes(loop, { opacity: appear(time, at.world, .5).toFixed(3) });
    for (const { step, at: shown } of steps) {
      setAttributes(step, { opacity: appear(time, shown, .3).toFixed(3) });
    }
    const spin = Math.max(0, time - at.world - .3);
    const angle = -Math.PI / 2 + spin * ((Math.PI * 2) / 2.2);
    setAttributes(runner, { cx: f(Math.cos(angle) * 118), cy: f(Math.sin(angle) * 118), opacity: appear(time, at.world + .4, .3).toFixed(3) });
    setAttributes(ball, { cx: f(Math.sin(spin * 2.2) * 34), cy: 10 });
  };
};

// 5) 믿고 맡기기: METR(2025) — AI 에이전트가 해내는 작업의 길이가 약 7개월마다 두 배로 늘었다.
const createTrust = (parent: SVGElement) => {
  const node = panelFrame(parent, 'METR(2025) · 에이전트가 해내는 작업 길이, 약 7개월마다 2배');
  text(node, 44, 74, '믿고 맡길 수 있을까', { class: 'lm-header' });
  text(node, 44, 124, '여름의 에이전트 사건 · 시험장을 빠져나간 에이전트 1,200여 개', { class: 'lm-label' });
  text(node, 44, 196, '맡기는 일의 길이', { class: 'lm-label strong' });
  const unit = 36;
  const task = svg('rect', { class: 'lm-task', x: 44, y: 220, width: unit, height: 56, rx: 10 }, node);
  const doubling = text(node, 0, 258, '', { class: 'lm-value' });
  const check = svg('g', { class: 'lm-check' }, node);
  svg('rect', { x: 44, y: 316, width: 912, height: 120, rx: 18 }, check);
  text(check, 80, 368, '결과를 어떻게 믿을까', { class: 'lm-check-title' });
  text(check, 80, 410, '맡긴 일이 길어질수록 하나하나 확인하기 어렵다', { class: 'lm-label' });
  const mark = text(check, 880, 404, '?', { class: 'lm-question', 'text-anchor': 'middle' });

  return (time: number) => {
    // "맡길수록": 길이가 두 배씩 네 번 늘어난다.
    const level = [0, 1, 2, 3].reduce((sum, k) => sum + ease(progress(time, at.delegate + k * .35, .3)), 0);
    const width = unit * 2 ** level;
    setAttributes(task, { width: f(width) });
    const label = time < at.delegate ? '' : `×${2 ** Math.round(level)}`;
    if (doubling.textContent !== label) {
      doubling.textContent = label;
    }
    setAttributes(doubling, { x: f(44 + width + 16) });
    setAttributes(check, { opacity: appear(time, at.believe, .4).toFixed(3) });
    const pulse = time >= at.believe ? 1 + .12 * Math.sin((time - at.believe) * 6) : 1;
    setAttributes(mark, { transform: `translate(880 380) scale(${f(pulse)}) translate(-880 -380)` });
  };
};

export const createLimitsScene = (): Scene => {
  const { element, root } = createDiagram('limits', '지금의 한계');

  const items = [
    { name: '환각', create: createHallucination, enter: at.lie, leave: at.power },
    { name: '전기와 칩', create: createPower, enter: at.power, leave: at.data },
    { name: '바닥나는 글', create: createData, enter: at.data, leave: at.lecun },
    { name: '다음 단어 너머', create: createWorld, enter: at.lecun, leave: at.trust },
    { name: '믿고 맡기기', create: createTrust, enter: at.trust, leave: at.winter },
  ];
  const slots = items.map((_, i) => svg('rect', { class: 'lm-slot', x: slotX(i), y: strip.y, width: panelSize.width * strip.scale, height: panelSize.height * strip.scale, rx: 8 }, root));
  const captions = items.map(({ name }, i) => text(root, slotX(i) + (panelSize.width * strip.scale) / 2, strip.y + panelSize.height * strip.scale + 30, name, { class: 'lm-slot-caption', 'text-anchor': 'middle' }));
  const panels = items.map((item) => {
    const holder = svg('g', {}, root);
    return { ...item, holder, render: item.create(holder) };
  });

  // 마지막: 세 번째 겨울?
  const winter = svg('g', { class: 'lm-winter' }, root);
  text(winter, 800, 380, '세 번째 겨울?', { class: 'lm-winter-title', 'text-anchor': 'middle' });
  const unknown = text(winter, 800, 456, '정답은 아무도 모른다', { class: 'lm-winter-note', 'text-anchor': 'middle' });
  const flakes = Array.from({ length: 80 }, (_, i) => ({
    node: svg('circle', { class: 'lm-snow', r: f(2 + random(i * 5 + 1) * 3.5) }, root),
    x: random(i * 5 + 2) * 1600,
    y: random(i * 5 + 3) * 960,
    speed: 40 + random(i * 5 + 4) * 60,
    sway: random(i * 5 + 5) * Math.PI * 2,
  }));

  return {
    element,
    title: '지금의 한계',
    start,
    end,
    chapters: [
      { time: at.lie, title: '환각' },
      { time: at.power, title: '전기와 칩' },
      { time: at.data, title: '바닥나는 사람의 글' },
      { time: at.lecun, title: '다음 단어 맞추기 너머' },
      { time: at.trust, title: '믿고 맡길 수 있을까' },
      { time: at.winter, title: '세 번째 겨울?' },
    ],
    update: (time: number) => {
      const cold = appear(time, at.winter, .8);
      slots.forEach((slot, i) => setAttributes(slot, { opacity: (appear(time, at.slots + i * .12, .3) * (1 - appear(time, items[i].leave, .4))).toFixed(3) }));
      panels.forEach(({ holder, render, enter, leave }, i) => {
        const shown = appear(time, enter, .45);
        const away = ease(progress(time, leave, .7));
        const scale = lerp(lerp(.96, 1, shown), strip.scale, away);
        const x = lerp(spotlight.x, slotX(i), away);
        const y = lerp(spotlight.y, strip.y, away);
        setAttributes(holder, { transform: `translate(${f(x)} ${f(y)}) scale(${scale.toFixed(4)})`, opacity: (shown * (1 - .5 * cold)).toFixed(3) });
        setAttributes(captions[i], { opacity: (appear(time, leave + .5, .3) * (1 - .4 * cold)).toFixed(3) });
        if (shown > 0) {
          render(time);
        }
      });
      setAttributes(winter, { opacity: cold.toFixed(3) });
      setAttributes(unknown, { opacity: appear(time, at.unknown, .5).toFixed(3) });
      for (const flake of flakes) {
        const elapsed = time - at.winter;
        const y = ((flake.y + elapsed * flake.speed) % 960) - 30;
        setAttributes(flake.node, {
          cx: f(flake.x + Math.sin(elapsed * 1.3 + flake.sway) * 14),
          cy: f(y),
          opacity: (cold * .8).toFixed(3),
        });
      }
    },
  };
};
