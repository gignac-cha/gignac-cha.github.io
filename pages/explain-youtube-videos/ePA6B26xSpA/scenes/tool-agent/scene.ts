import './tool-agent.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';

// 57:03.7 "4월에는 o3가 나왔습니다" ~ 57:22.9 "이 기능들을 합친 ChatGPT 에이전트가 나왔어요".
const start = 3423.5;
const end = 3444.4;
const at = {
  o3: 3424.4,
  think: 3426.1,
  search: 3427,
  tool: 3427.8,
  answer: 3428.9,
  // "이 무렵 인공지능은 대답하는 기계에서 일하는 기계로"
  shift: 3429.6,
  answering: 3430.8,
  working: 3432.2,
  // "브라우저를 직접 조작하는 에이전트" (2025년 1월 Operator)
  browser: 3433.6,
  browse: 3434.4,
  // "코드를 맡기면 알아서 고쳐서 돌려주는 Codex" (2025년 5월)
  code: 3436.2,
  handOff: 3436.9,
  bug: 3437.3,
  fix: 3437.8,
  giveBack: 3438.1,
  codex: 3438.6,
  // "7월에는 이 기능들을 합친 ChatGPT 에이전트" (2025년 7월)
  merge: 3439.5,
  combine: 3441.6,
  agent: 3442,
};

const f = (n: number) => n.toFixed(1);

const arrow = (parent: SVGElement, x1: number, y1: number, x2: number, y2: number, className = 'ta-arrow') => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 13;
  const left = [x2 - head * Math.cos(angle - .5), y2 - head * Math.sin(angle - .5)];
  const right = [x2 - head * Math.cos(angle + .5), y2 - head * Math.sin(angle + .5)];
  return svg('path', { class: className, d: `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} M${f(left[0])} ${f(left[1])} L${f(x2)} ${f(y2)} L${f(right[0])} ${f(right[1])}` }, parent);
};

// 도구 아이콘: (0, 0) 가운데, 약 56px.
const icons = {
  search: (parent: SVGElement) => {
    const group = svg('g', { class: 'ta-icon' }, parent);
    svg('circle', { cx: -6, cy: -6, r: 15 }, group);
    svg('path', { d: 'M5 5 L19 19' }, group);
    return group;
  },
  browser: (parent: SVGElement) => {
    const group = svg('g', { class: 'ta-icon' }, parent);
    svg('rect', { x: -26, y: -20, width: 52, height: 40, rx: 6 }, group);
    svg('path', { d: 'M-26 -9 L26 -9' }, group);
    svg('path', { class: 'ta-icon-cursor', d: 'M-2 -2 L-2 16 L3 11 L7 19 L10 17 L6 9 L12 9 Z' }, group);
    return group;
  },
  terminal: (parent: SVGElement) => {
    const group = svg('g', { class: 'ta-icon' }, parent);
    svg('rect', { x: -26, y: -20, width: 52, height: 40, rx: 6 }, group);
    svg('path', { d: 'M-15 -7 L-6 1 L-15 9 M-2 10 L12 10' }, group);
    return group;
  },
};

// 1) o3: 생각하는 줄기가 이어지다 검색과 코드 실행으로 내려갔다가 결과를 들고 돌아와 다시 생각을 잇는다.
// 줄기의 머리는 정한 시각에 각 지점을 지나므로 재생 위치만으로 위치가 정해진다.
const waypoints = [
  { x: 200, y: 360, time: 3426 },
  { x: 440, y: 360, time: 3426.6 },
  { x: 500, y: 530, time: at.search },
  { x: 620, y: 530, time: 3427.3 },
  { x: 680, y: 360, time: 3427.5 },
  { x: 880, y: 360, time: 3427.62 },
  { x: 940, y: 530, time: at.tool },
  { x: 1060, y: 530, time: 3428.12 },
  { x: 1120, y: 360, time: 3428.32 },
  { x: 1366, y: 360, time: at.answer },
];

const headAt = (time: number) => {
  if (time <= waypoints[0].time) {
    return { index: 0, point: waypoints[0] };
  }
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    if (time < b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return { index: i - 1, point: { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) } };
    }
  }
  return { index: waypoints.length - 1, point: waypoints[waypoints.length - 1] };
};

const createTrace = (root: SVGElement) => {
  // 화면 가운데에 오도록 조금 내린다.
  const group = svg('g', { transform: 'translate(0 50)' }, root);
  const heading = text(group, 800, 200, 'o3 · 생각하는 도중에 검색하고, 도구를 직접 쓴다', { class: 'ta-heading', 'text-anchor': 'middle' });
  const points = waypoints.map(({ x, y }) => `${x},${y}`).join(' ');
  const ghost = svg('polyline', { class: 'ta-trace-ghost', points }, group);
  // 줄기는 '생각' 칸 뒤로 지나간다.
  const trace = svg('polyline', { class: 'ta-trace' }, group);

  const card = (x: number, label: string, icon: (parent: SVGElement) => SVGElement, rows: number[]) => {
    const node = svg('g', { class: 'ta-card' }, group);
    svg('rect', { x: x - 120, y: 530, width: 240, height: 150, rx: 18 }, node);
    const mark = icon(node);
    setAttributes(mark, { transform: `translate(${x - 78} 572) scale(.75)` });
    text(node, x - 44, 581, label, { class: 'ta-card-label' });
    // 결과 줄. 코드 실행의 마지막 줄은 실행 결과(초록).
    const bars = rows.map((width, i) => ({
      width,
      bar: svg('rect', { class: i === rows.length - 1 && label === '코드 실행' ? 'ta-bar result' : 'ta-bar', x: x - 96, y: 610 + i * 22, height: 10, rx: 5, width: 0 }, node),
    }));
    return { node, bars };
  };
  const search = card(560, '웹 검색', icons.search, [170, 130, 150]);
  const tool = card(1000, '코드 실행', icons.terminal, [120, 160, 90]);

  const thoughts = [
    { x: 320, time: at.think },
    { x: 780, time: 3427.55 },
    { x: 1250, time: 3428.4 },
  ].map(({ x, time }) => {
    const node = svg('g', { class: 'ta-thought' }, group);
    svg('rect', { x: x - 52, y: 340, width: 104, height: 40, rx: 20 }, node);
    text(node, x, 368, '생각', { 'text-anchor': 'middle' });
    return { node, time };
  });
  const head = svg('circle', { class: 'ta-head', r: 11 }, group);
  const answer = svg('g', { class: 'ta-answer' }, group);
  svg('circle', { cx: 1400, cy: 360, r: 34 }, answer);
  text(answer, 1400, 371, '답', { 'text-anchor': 'middle' });

  return (time: number) => {
    setAttributes(group, { opacity: (appear(time, start, .4) * (1 - appear(time, at.shift, .5))).toFixed(3) });
    setAttributes(heading, { opacity: appear(time, at.o3).toFixed(3) });
    setAttributes(ghost, { opacity: (.5 * appear(time, at.o3)).toFixed(3) });

    const { index, point } = headAt(time);
    const drawn = [...waypoints.slice(0, index + 1), point].map(({ x, y }) => `${f(x)},${f(y)}`).join(' ');
    setAttributes(trace, { points: time > waypoints[0].time ? drawn : '' });
    const moving = time > waypoints[0].time && time < at.answer + .2;
    setAttributes(head, { cx: f(point.x), cy: f(point.y), opacity: moving ? 1 : 0 });

    for (const { node, time: shown } of thoughts) {
      setAttributes(node, { opacity: appear(time, shown, .3).toFixed(3) });
    }
    for (const [view, from, leave] of [[search, at.search, 3427.3], [tool, at.tool, 3428.12]] as const) {
      setAttributes(view.node, { opacity: (.35 + .65 * appear(time, from - .25, .3)).toFixed(3) });
      view.node.classList.toggle('active', time >= from && time < leave + .15);
      view.bars.forEach(({ bar, width }, i) => setAttributes(bar, { width: f(width * ease(progress(time, from + .05 + i * .08, .22))) }));
    }
    setAttributes(answer, { opacity: appear(time, at.answer, .3).toFixed(3) });
  };
};

// 2) 대답하는 기계 → 일하는 기계: 질문 하나에 답 하나에서, 스스로 계획·행동·확인을 되풀이하는 고리로.
// 처음엔 대답하는 기계만 가운데에 두고, "일하는 기계"에서 왼쪽으로 비켜서며 오른쪽에 일하는 기계를 세워 나란히 비교한다.
const createShift = (root: SVGElement) => {
  const group = svg('g', {}, root);

  const answering = svg('g', {}, group);
  const answeringLabel = createSwapText(answering, 800, 290, { class: 'ta-big', 'text-anchor': 'middle' });
  const once = svg('g', {}, answering);
  const bubble = (x: number, content: string, className: string) => {
    const node = svg('g', { class: `ta-bubble ${className}` }, once);
    svg('rect', { x: x - 110, y: 490, width: 220, height: 84, rx: 26 }, node);
    text(node, x, 543, content, { 'text-anchor': 'middle' });
    return node;
  };
  const question = bubble(620, '질문', 'question');
  arrow(once, 745, 532, 852, 532);
  const reply = bubble(980, '답', 'reply');

  const divider = svg('path', { class: 'ta-divider', d: 'M800 250 L800 720' }, group);

  const working = svg('g', {}, group);
  const workingLabel = createSwapText(working, 1200, 290, { class: 'ta-big', 'text-anchor': 'middle' });
  const loop = svg('g', { transform: 'translate(1200 560)' }, working);
  const radius = 150;
  svg('circle', { class: 'ta-loop-ring', r: radius }, loop);
  const steps = ['계획', '행동', '확인'].map((name, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const node = svg('g', { class: 'ta-loop-step', transform: `translate(${f(Math.cos(angle) * radius)} ${f(Math.sin(angle) * radius)})` }, loop);
    svg('rect', { x: -66, y: -30, width: 132, height: 60, rx: 30 }, node);
    text(node, 0, 11, name, { 'text-anchor': 'middle' });
    return { node, angle };
  });
  const runner = svg('circle', { class: 'ta-head', r: 10 }, loop);

  return (time: number) => {
    setAttributes(group, { opacity: (appear(time, at.shift + .3, .5) * (1 - appear(time, at.browser, .5))).toFixed(3) });
    answeringLabel.update(time, (t) => (t < at.answering ? '' : '대답하는 기계'));
    workingLabel.update(time, (t) => (t < at.working ? '' : '일하는 기계'));

    // 대답하는 기계는 왼쪽 절반으로 비켜서고 살짝 물러난다.
    const split = ease(progress(time, at.working - .1, .7));
    setAttributes(answering, { transform: `translate(${f(-400 * split)} 0)`, opacity: lerp(1, .8, split).toFixed(3) });
    setAttributes(divider, { opacity: (.6 * split).toFixed(3) });

    setAttributes(once, { opacity: appear(time, at.answering + .2, .4).toFixed(3) });
    setAttributes(question, { transform: `translate(${f((1 - appear(time, at.answering + .2, .4)) * -30)} 0)` });
    setAttributes(reply, { opacity: appear(time, at.answering + .6, .3).toFixed(3) });

    const looping = appear(time, at.working + .1, .5);
    setAttributes(working, { transform: `translate(${f((1 - looping) * 40)} 0)` });
    setAttributes(loop, { opacity: looping.toFixed(3), transform: `translate(1200 ${f(560 + (1 - looping) * 30)})` });
    // 고리를 도는 점: 한 바퀴 2.4초. 지나는 단계가 밝아진다.
    const angle = -Math.PI / 2 + Math.max(0, time - at.working - .3) * ((Math.PI * 2) / 2.4);
    setAttributes(runner, { cx: f(Math.cos(angle) * radius), cy: f(Math.sin(angle) * radius) });
    for (const step of steps) {
      const gap = Math.abs(Math.atan2(Math.sin(angle - step.angle), Math.cos(angle - step.angle)));
      step.node.classList.toggle('active', time > at.working + .3 && gap < .45);
    }
  };
};

// 3) 일하는 기계의 두 모습: 화면을 보고 직접 클릭·입력하는 브라우저 에이전트와, 코드를 맡으면 고쳐서 돌려주는 Codex.
const panel = (parent: SVGElement, x: number, title: string) => {
  const node = svg('g', { class: 'ta-panel' }, parent);
  svg('rect', { x, y: 180, width: 620, height: 450, rx: 20 }, node);
  svg('path', { class: 'ta-panel-rule', d: `M${x} 226 L${x + 620} 226` }, node);
  [0, 1, 2].forEach((i) => svg('circle', { class: 'ta-panel-dot', cx: x + 26 + i * 20, cy: 203, r: 6 }, node));
  text(node, x + 310, 210, title, { class: 'ta-panel-title', 'text-anchor': 'middle' });
  return node;
};

const createWork = (root: SVGElement) => {
  const group = svg('g', {}, root);

  // 왼쪽: 브라우저. 커서가 칸을 눌러 글자를 넣고 버튼을 누른다.
  const browser = svg('g', {}, group);
  panel(browser, 120, '브라우저');
  svg('rect', { class: 'ta-address', x: 150, y: 246, width: 560, height: 36, rx: 18 }, browser);
  svg('rect', { class: 'ta-bar', x: 172, y: 259, width: 220, height: 10, rx: 5 }, browser);
  const fields = [340, 420].map((y) => {
    svg('rect', { class: 'ta-field', x: 180, y, width: 500, height: 52, rx: 10 }, browser);
    return svg('rect', { class: 'ta-typed', x: 200, y: y + 21, height: 10, rx: 5, width: 0 }, browser);
  });
  const button = svg('g', { class: 'ta-button' }, browser);
  svg('rect', { x: 180, y: 508, width: 170, height: 56, rx: 12 }, button);
  svg('rect', { class: 'ta-button-text', x: 215, y: 531, width: 100, height: 10, rx: 5 }, button);
  const ripple = svg('circle', { class: 'ta-ripple', r: 0 }, browser);
  const cursor = svg('path', { class: 'ta-cursor', d: 'M0 0 L0 30 L8 22 L14 35 L19 33 L13 20 L24 20 Z' }, browser);
  const browserCaption = svg('g', {}, group);
  text(browserCaption, 430, 690, '브라우저를 직접 조작', { class: 'ta-panel-heading', 'text-anchor': 'middle' });
  text(browserCaption, 430, 734, '화면을 보고 → 클릭하고 입력한다', { class: 'ta-caption', 'text-anchor': 'middle' });

  // 커서가 거쳐 가는 자리와 시각.
  const path = [
    { x: 600, y: 600, time: at.browse },
    { x: 330, y: 360, time: at.browse + .45 },
    { x: 330, y: 360, time: at.browse + .9 },
    { x: 330, y: 440, time: at.browse + 1.2 },
    { x: 330, y: 440, time: at.browse + 1.65 },
    { x: 250, y: 530, time: at.browse + 1.95 },
  ];
  const cursorAt = (time: number) => {
    for (let i = 1; i < path.length; i++) {
      if (time < path[i].time) {
        const t = ease(progress(time, path[i - 1].time, path[i].time - path[i - 1].time));
        return { x: lerp(path[i - 1].x, path[i].x, t), y: lerp(path[i - 1].y, path[i].y, t) };
      }
    }
    return time < path[0].time ? path[0] : path[path.length - 1];
  };
  const click = at.browse + 2;

  // 오른쪽: 코드. 할 일을 넘겨받아, 틀린 줄을 찾아 고치고, 테스트를 돌려 통과하면 바뀐 내용을 돌려준다.
  const code = svg('g', {}, group);
  panel(code, 860, '코드 저장소');
  const widths = [300, 420, 360, 250, 380, 330, 440, 280];
  const lines = widths.map((width, i) => svg('rect', { class: 'ta-code', x: 920 + (i % 3 === 1 ? 30 : 0), y: 256 + i * 32, width, height: 12, rx: 6 }, code));
  const bugLine = 4;
  const gutter = text(code, 896, 268 + bugLine * 32, '', { class: 'ta-gutter', 'text-anchor': 'middle' });
  const fixed = svg('rect', { class: 'ta-code fixed', x: 920, y: 256 + bugLine * 32, width: 380, height: 12, rx: 6 }, code);
  const status = createSwapText(code, 1040, 598, { class: 'ta-status', 'text-anchor': 'middle' });
  const task = svg('g', { class: 'ta-task' }, code);
  svg('rect', { x: -150, y: -30, width: 300, height: 60, rx: 14 }, task);
  text(task, 0, 10, '할 일: 테스트 고치기', { 'text-anchor': 'middle' });
  const diff = svg('g', { class: 'ta-diff' }, code);
  svg('rect', { x: -110, y: -26, width: 220, height: 52, rx: 26 }, diff);
  const diffText = text(diff, 0, 9, '', { 'text-anchor': 'middle' });
  svg('tspan', { class: 'minus' }, diffText).textContent = '−1 ';
  svg('tspan', { class: 'plus' }, diffText).textContent = '+1 ';
  svg('tspan', {}, diffText).textContent = '돌려줌';
  const codeCaption = svg('g', {}, group);
  text(codeCaption, 1170, 690, '코드를 맡기면 고쳐서 돌려준다', { class: 'ta-panel-heading', 'text-anchor': 'middle' });
  const codex = text(codeCaption, 1170, 734, 'Codex', { class: 'ta-caption', 'text-anchor': 'middle' });

  return (time: number) => {
    setAttributes(group, { opacity: (1 - appear(time, at.merge, .6)).toFixed(3) });

    const browserShown = appear(time, at.browser, .5);
    setAttributes(browser, { opacity: browserShown.toFixed(3), transform: `translate(0 ${f((1 - browserShown) * 24)})` });
    setAttributes(browserCaption, { opacity: appear(time, at.browser + .3, .4).toFixed(3) });
    const point = cursorAt(time);
    setAttributes(cursor, { transform: `translate(${f(point.x)} ${f(point.y)})`, opacity: appear(time, at.browse - .2, .3).toFixed(3) });
    fields.forEach((typed, i) => setAttributes(typed, { width: f(ease(progress(time, path[1 + i * 2].time, .45)) * (i ? 220 : 300)) }));
    const pressed = progress(time, click, .5);
    button.classList.toggle('pressed', time >= click && time < click + .25);
    setAttributes(ripple, { cx: 250, cy: 530, r: f(pressed * 60), opacity: (pressed > 0 && pressed < 1 ? 1 - pressed : 0).toFixed(3) });

    const codeShown = appear(time, at.code, .5);
    setAttributes(code, { opacity: codeShown.toFixed(3), transform: `translate(0 ${f((1 - codeShown) * 24)})` });
    setAttributes(codeCaption, { opacity: appear(time, at.code + .2, .4).toFixed(3) });
    setAttributes(codex, { opacity: appear(time, at.codex, .4).toFixed(3) });

    // 할 일 카드가 오른쪽 밖에서 날아와 저장소에 들어간다.
    const handing = ease(progress(time, at.handOff - .3, .6));
    setAttributes(task, {
      transform: `translate(${f(lerp(1720, 1170, handing))} ${f(lerp(150, 300, handing))}) scale(${f(lerp(1, .8, ease(progress(time, at.handOff + .3, .3))))})`,
      opacity: (appear(time, at.handOff - .3, .2) * (1 - appear(time, at.bug, .3))).toFixed(3),
    });
    // 틀린 줄이 빨갛게 드러났다가, 고친 줄(초록)로 바뀐다.
    const bug = time >= at.bug;
    lines[bugLine].classList.toggle('bug', bug);
    const fixing = appear(time, at.fix, .3);
    setAttributes(lines[bugLine], { opacity: (1 - fixing).toFixed(3) });
    setAttributes(fixed, { opacity: fixing.toFixed(3) });
    setAttributes(gutter, { opacity: bug ? 1 : 0 });
    if (gutter.textContent !== (time >= at.fix ? '+' : '−')) {
      gutter.textContent = time >= at.fix ? '+' : '−';
    }
    gutter.classList.toggle('plus', time >= at.fix);
    status.update(time, (t) => (t < at.bug ? '' : t < at.fix + .1 ? '✗ 테스트 실패' : '✓ 테스트 통과'));
    status.toggleClass('pass', time >= at.fix + .1);
    const giving = ease(progress(time, at.giveBack, .6));
    setAttributes(diff, {
      transform: `translate(${f(lerp(1200, 1340, giving))} 588)`,
      opacity: appear(time, at.giveBack, .3).toFixed(3),
    });
  };
};

// 4) 검색, 브라우저, 터미널이 한 에이전트 안으로 모인다.
const createMerge = (root: SVGElement) => {
  const group = svg('g', {}, root);
  const ring = svg('circle', { class: 'ta-agent-ring', cx: 800, cy: 430, r: 0 }, group);
  const tools = [
    { name: '검색', icon: icons.search, from: { x: 800, y: 120 }, row: 480, slot: { x: -62, y: 30 } },
    { name: '브라우저 조작', icon: icons.browser, from: { x: 430, y: 410 }, row: 800, slot: { x: 0, y: -60 } },
    { name: '터미널', icon: icons.terminal, from: { x: 1170, y: 410 }, row: 1120, slot: { x: 62, y: 30 } },
  ].map((tool) => {
    const node = svg('g', { class: 'ta-tool' }, group);
    svg('circle', { class: 'ta-tool-disc', r: 52 }, node);
    tool.icon(node);
    const label = text(node, 0, 100, tool.name, { class: 'ta-tool-label', 'text-anchor': 'middle' });
    return { ...tool, node, label };
  });
  const name = text(group, 800, 640, 'ChatGPT 에이전트', { class: 'ta-big', 'text-anchor': 'middle' });
  const caption = text(group, 800, 692, '검색 · 브라우저 · 터미널을 하나로', { class: 'ta-caption', 'text-anchor': 'middle' });

  return (time: number) => {
    setAttributes(group, { opacity: appear(time, at.merge, .4).toFixed(3) });
    const gather = ease(progress(time, at.merge, .8));
    const combine = ease(progress(time, at.combine, .7));
    for (const tool of tools) {
      const row = { x: lerp(tool.from.x, tool.row, gather), y: lerp(tool.from.y, 430, gather) };
      const x = lerp(row.x, 800 + tool.slot.x, combine);
      const y = lerp(row.y, 430 + tool.slot.y, combine);
      setAttributes(tool.node, { transform: `translate(${f(x)} ${f(y)}) scale(${f(lerp(1, .62, combine))})` });
      setAttributes(tool.label, { opacity: (appear(time, at.merge + .5, .4) * (1 - combine)).toFixed(3) });
    }
    setAttributes(ring, { r: f(combine * 140), opacity: combine.toFixed(3) });
    setAttributes(name, { opacity: appear(time, at.agent, .4).toFixed(3) });
    setAttributes(caption, { opacity: appear(time, at.agent + .4, .4).toFixed(3) });
  };
};

export const createToolAgentScene = (): Scene => {
  const { element, root } = createDiagram('tool-agent', '도구를 쓰는 에이전트');
  const renders = [createTrace(root), createShift(root), createWork(root), createMerge(root)];
  return {
    element,
    update: (time: number) => renders.forEach((render) => render(time)),
    title: '도구를 쓰는 에이전트',
    start,
    end,
    chapters: [
      { time: at.o3, title: '생각 중에 검색하고 도구 쓰기' },
      { time: at.shift, title: '대답하는 기계에서 일하는 기계로' },
      { time: at.browser, title: '브라우저를 조작하는 에이전트' },
      { time: at.code, title: '코드를 고쳐 주는 Codex' },
      { time: at.merge, title: 'ChatGPT 에이전트' },
    ],
  };
};
