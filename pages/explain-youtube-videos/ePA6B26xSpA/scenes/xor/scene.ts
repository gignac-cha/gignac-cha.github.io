import './xor.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';

// 4:56 "대표적인 게 배타적 논리합" ~ 5:20 "아무도 몰랐다는 거죠".
const start = 296.5;
const end = 320.1;

const onlyOneAt = 300.4; // 둘 중 하나만 켜졌을 때만 켜지는 스위치
const bothAt = 303.2; // 둘 다 켜지거나 둘 다 꺼지면 꺼져야
const paperAt = 305.5; // 종이 위에 점을 찍어 보면
const attemptAt = 306.4; // 이 답은 직선 하나로 가를 수 없습니다
const oneLineAt = 309.3; // 퍼셉트론은 딱 직선 한 줄만
const layersAt = 313; // 층을 여러 겹 쌓으면 풀 수 있다
const unknownAt = 316.9; // 여러 겹을 어떻게 학습시킬지 아무도 몰랐다

// 스위치 상태가 바뀌는 시각과 (A, B).
const cases: Array<[number, number, number]> = [
  [start, 0, 0],
  [onlyOneAt, 1, 0],
  [301.5, 0, 1],
  [bothAt, 1, 1],
  [304, 0, 0],
];

// 평면 위 네 점. 각 경우를 보여 줄 때 하나씩 찍힌다.
const points = [
  { x: 1, y: 0, at: 300.6 },
  { x: 0, y: 1, at: 301.7 },
  { x: 1, y: 1, at: 303.4 },
  { x: 0, y: 0, at: 304.2 },
].map((point) => ({ ...point, on: point.x !== point.y }));

const plane = { left: 870, top: 150, size: 600 };
const toScreen = (x: number, y: number) => ({
  x: plane.left + (x + .5) * (plane.size / 2),
  y: plane.top + plane.size - (y + .5) * (plane.size / 2),
});

const radians = (degrees: number) => (degrees * Math.PI) / 180;

const setText = (element: Element, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

const caseAt = (time: number) => {
  let current = cases[0];
  for (const item of cases) {
    if (item[0] <= time) {
      current = item;
    }
  }
  return current;
};

// 직선 하나: 단위 좌표에서 법선 각도와 중심 (.5, .5)로부터의 거리. 영상 시간만으로 정해진다.
const lineAt = (time: number) => {
  const elapsed = Math.max(time - attemptAt, 0);
  return { angle: 25 + elapsed * 34, offset: .32 * Math.sin(elapsed * 1.25) };
};

const side = (angle: number, offset: number, x: number, y: number) =>
  Math.cos(radians(angle)) * (x - .5) + Math.sin(radians(angle)) * (y - .5) - offset;

const polygon = (points: Array<{ x: number; y: number }>) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

const createXOR = () => {
  const { element, root } = createDiagram('xor', 'XOR 문제');

  // 왼쪽 1: 스위치 두 개와 전등.
  const switches = svg('g', { opacity: 0 }, root);
  const lamp = { x: 590, y: 420, r: 76 };
  const toggles = [
    { name: 'A', y: 300 },
    { name: 'B', y: 540 },
  ].map(({ name, y }) => {
    text(switches, 130, y + 14, name, { class: 'xor-switch-name' });
    svg('path', { class: 'xor-wire', d: `M330 ${y} H420 Q450 ${y} 460 ${lerp(y, lamp.y, .5)} T${lamp.x - lamp.r} ${lamp.y}` }, switches);
    const track = svg('rect', { class: 'xor-switch', x: 180, y: y - 34, width: 150, height: 68, rx: 34 }, switches);
    const knob = svg('circle', { class: 'xor-knob', cx: 214, cy: y, r: 24 }, switches);
    return { track, knob };
  });
  svg('circle', { class: 'xor-lamp-glow', cx: lamp.x, cy: lamp.y, r: lamp.r + 40 }, switches);
  const bulb = svg('circle', { class: 'xor-lamp', cx: lamp.x, cy: lamp.y, r: lamp.r }, switches);
  const lampState = text(switches, lamp.x, lamp.y + lamp.r + 64, '', { class: 'xor-lamp-state' });
  const rule = text(switches, 380, 760, '', { class: 'xor-rule', opacity: 0 });

  // 왼쪽 2: 여러 겹의 신경망.
  const network = svg('g', { opacity: 0 }, root);
  const nodes = {
    a: { x: 150, y: 300, label: 'A' },
    b: { x: 150, y: 540, label: 'B' },
    h1: { x: 440, y: 300, label: '' },
    h2: { x: 440, y: 540, label: '' },
    out: { x: 700, y: 420, label: '' },
  };
  const hiddenEdges = [
    [nodes.a, nodes.h1],
    [nodes.a, nodes.h2],
    [nodes.b, nodes.h1],
    [nodes.b, nodes.h2],
  ].map(([from, to], index) => {
    svg('line', { class: 'xor-edge', x1: from.x, y1: from.y, x2: to.x, y2: to.y }, network);
    // 가운데서 겹치지 않도록 상자 위치를 선 위에서 조금씩 엇갈린다.
    const t = index === 1 || index === 2 ? (index === 1 ? .35 : .65) : .5;
    const box = svg('g', { transform: `translate(${lerp(from.x, to.x, t).toFixed(1)} ${lerp(from.y, to.y, t).toFixed(1)})`, opacity: 0 }, network);
    svg('rect', { class: 'xor-unknown', x: -26, y: -26, width: 52, height: 52, rx: 10 }, box);
    text(box, 0, 11, '?', { class: 'xor-unknown-label' });
    return box;
  });
  for (const hidden of [nodes.h1, nodes.h2]) {
    svg('line', { class: 'xor-edge', x1: hidden.x, y1: hidden.y, x2: nodes.out.x, y2: nodes.out.y }, network);
  }
  for (const node of [nodes.a, nodes.b]) {
    svg('circle', { class: 'xor-input', cx: node.x, cy: node.y, r: 46 }, network);
    text(network, node.x, node.y + 14, node.label, { class: 'xor-node-label' });
  }
  const hidden1 = svg('circle', { class: 'xor-hidden xor-hidden-1', cx: nodes.h1.x, cy: nodes.h1.y, r: 46 }, network);
  const hidden2 = svg('circle', { class: 'xor-hidden xor-hidden-2', cx: nodes.h2.x, cy: nodes.h2.y, r: 46 }, network);
  svg('circle', { class: 'xor-output', cx: nodes.out.x, cy: nodes.out.y, r: 56 }, network);
  text(network, nodes.a.x, 760, '입력', { class: 'xor-layer-label' });
  const hiddenLabel = createSwapText(network, nodes.h1.x, 760, { class: 'xor-layer-label' });
  text(network, nodes.out.x, 760, '출력', { class: 'xor-layer-label' });
  const hiddenFrame = svg('rect', { class: 'xor-hidden-frame', x: nodes.h1.x - 66, y: nodes.h1.y - 80, width: 132, height: nodes.h2.y - nodes.h1.y + 160, rx: 24, opacity: 0 }, network);

  // 오른쪽: 네 점이 찍힌 평면.
  const planeGroup = svg('g', { opacity: 0 }, root);
  const clip = svg('clipPath', { id: 'xor-clip' }, planeGroup);
  svg('rect', { x: plane.left, y: plane.top, width: plane.size, height: plane.size, rx: 18 }, clip);
  svg('rect', { class: 'xor-plane', x: plane.left, y: plane.top, width: plane.size, height: plane.size, rx: 18 }, planeGroup);
  const regions = svg('g', { 'clip-path': 'url(#xor-clip)' }, planeGroup);
  const sideOn = svg('polygon', { class: 'xor-region-on', opacity: 0 }, regions);
  const sideOff = svg('polygon', { class: 'xor-region-off', opacity: 0 }, regions);
  const band = svg('polygon', { class: 'xor-region-on', opacity: 0 }, regions);
  const attempt = svg('line', { class: 'xor-line', opacity: 0 }, regions);
  const layerLines = [
    svg('line', { class: 'xor-line xor-line-1', opacity: 0 }, regions),
    svg('line', { class: 'xor-line xor-line-2', opacity: 0 }, regions),
  ];
  const origin = toScreen(0, 0);
  const axisEnd = toScreen(1.38, 1.38);
  text(planeGroup, axisEnd.x, origin.y + 70, 'A', { class: 'xor-axis' });
  text(planeGroup, origin.x - 70, axisEnd.y + 10, 'B', { class: 'xor-axis' });
  const dots = points.map((point) => {
    const position = toScreen(point.x, point.y);
    const group = svg('g', { opacity: 0 }, planeGroup);
    const ring = svg('circle', { class: 'xor-ring', cx: position.x, cy: position.y, r: 44, opacity: 0 }, group);
    const focus = svg('circle', { class: 'xor-focus', cx: position.x, cy: position.y, r: 44, opacity: 0 }, group);
    svg('circle', { class: `xor-dot ${point.on ? 'on' : 'off'}`, cx: position.x, cy: position.y, r: 26 }, group);
    text(group, position.x, position.y + 76, `${point.x},${point.y}`, { class: 'xor-dot-label' });
    return { point, group, ring, focus };
  });
  const verdict = text(planeGroup, plane.left + plane.size / 2, plane.top + plane.size + 70, '', { class: 'xor-verdict' });

  const update = (time: number) => {
    const toNetwork = appear(time, layersAt, .6);
    setAttributes(switches, { opacity: (appear(time, start + .2, .6) * (1 - toNetwork) * (time >= paperAt ? .55 + .45 * (1 - appear(time, paperAt, .5)) : 1)).toFixed(3) });
    setAttributes(network, { opacity: toNetwork.toFixed(3) });
    setAttributes(planeGroup, { opacity: appear(time, onlyOneAt, .5).toFixed(3) });

    // 스위치와 전등.
    const [, a, b] = caseAt(time);
    toggles.forEach(({ track, knob }, index) => {
      // 경우가 바뀔 때마다 이전 값에서 새 값으로 손잡이를 옮긴다.
      let position = 0;
      for (let i = 1; i < cases.length; i++) {
        position = lerp(position, cases[i][index + 1], ease(progress(time, cases[i][0], .25)));
      }
      setAttributes(knob, { cx: lerp(214, 296, position).toFixed(1) });
      track.classList.toggle('on', [a, b][index] === 1);
    });
    const lit = (a ^ b) === 1;
    bulb.classList.toggle('on', lit);
    switches.classList.toggle('lit', lit);
    setText(lampState, time >= onlyOneAt ? (lit ? '켜짐' : '꺼짐') : '');
    let ruleText = '';
    let ruleOpacity = 0;
    if (time >= onlyOneAt && time < bothAt) {
      ruleText = '하나만 켜지면 → 켜짐';
      ruleOpacity = appear(time, onlyOneAt, .4);
    } else if (time >= bothAt) {
      ruleText = '둘 다 같으면 → 꺼짐';
      ruleOpacity = appear(time, bothAt, .4);
    }
    setText(rule, ruleText);
    setAttributes(rule, { opacity: ruleOpacity.toFixed(3) });

    // 점: 해당 경우를 보여 줄 때 찍히고, 그 순간 흰 테두리로 짚는다.
    for (const { point, group, focus } of dots) {
      setAttributes(group, { opacity: appear(time, point.at, .35).toFixed(3) });
      const focused = time >= point.at && time < point.at + 1.1 && time < paperAt;
      setAttributes(focus, { opacity: focused ? 1 : 0 });
    }

    // 직선 하나로 가르기 시도: 어떻게 그어도 틀린 점이 남는다.
    const trying = time >= attemptAt && time < layersAt;
    const tryOpacity = appear(time, attemptAt, .4) * (1 - appear(time, layersAt, .4));
    const { angle, offset } = lineAt(time);
    const nx = Math.cos(radians(angle));
    const ny = Math.sin(radians(angle));
    const far = 4;
    const center = { x: .5 + nx * offset, y: .5 + ny * offset };
    const p1 = toScreen(center.x - ny * far, center.y + nx * far);
    const p2 = toScreen(center.x + ny * far, center.y - nx * far);
    const q1 = toScreen(center.x - ny * far + nx * far, center.y + nx * far + ny * far);
    const q2 = toScreen(center.x + ny * far + nx * far, center.y - nx * far + ny * far);
    const r1 = toScreen(center.x - ny * far - nx * far, center.y + nx * far - ny * far);
    const r2 = toScreen(center.x + ny * far - nx * far, center.y - nx * far - ny * far);
    setAttributes(attempt, { x1: p1.x.toFixed(1), y1: p1.y.toFixed(1), x2: p2.x.toFixed(1), y2: p2.y.toFixed(1), opacity: tryOpacity.toFixed(3) });

    // 양쪽 중 더 많이 맞히는 쪽을 '켜짐'으로 칠하고, 그래도 틀린 점에 빨간 고리.
    const positiveCorrect = points.filter((p) => (side(angle, offset, p.x, p.y) >= 0) === p.on).length;
    const positiveIsOn = positiveCorrect >= 2;
    const correct = positiveIsOn ? positiveCorrect : 4 - positiveCorrect;
    setAttributes(sideOn, { points: polygon(positiveIsOn ? [p1, p2, q2, q1] : [p1, p2, r2, r1]), opacity: (tryOpacity * .9).toFixed(3) });
    setAttributes(sideOff, { points: polygon(positiveIsOn ? [p1, p2, r2, r1] : [p1, p2, q2, q1]), opacity: (tryOpacity * .9).toFixed(3) });

    // 여러 겹: 직선 두 개가 띠를 만들어 켜짐 두 점만 가둔다.
    const lineOne = appear(time, 313.4, .5);
    const lineTwo = appear(time, 313.8, .5);
    const diagonal = (sum: number) => [toScreen(sum + 2, -2), toScreen(-2, sum + 2)];
    const [l1a, l1b] = diagonal(.5);
    const [l2a, l2b] = diagonal(1.5);
    setAttributes(layerLines[0], { x1: l1a.x.toFixed(1), y1: l1a.y.toFixed(1), x2: l1b.x.toFixed(1), y2: l1b.y.toFixed(1), opacity: lineOne.toFixed(3) });
    setAttributes(layerLines[1], { x1: l2a.x.toFixed(1), y1: l2a.y.toFixed(1), x2: l2b.x.toFixed(1), y2: l2b.y.toFixed(1), opacity: lineTwo.toFixed(3) });
    setAttributes(band, { points: polygon([l1a, l1b, l2b, l2a]), opacity: (lineTwo * .9).toFixed(3) });
    setAttributes(hidden1, { opacity: lerp(.35, 1, lineOne).toFixed(3) });
    setAttributes(hidden2, { opacity: lerp(.35, 1, lineTwo).toFixed(3) });

    for (const { point, ring } of dots) {
      const wrong = trying && (side(angle, offset, point.x, point.y) >= 0) !== (positiveIsOn ? point.on : !point.on);
      setAttributes(ring, { opacity: wrong ? tryOpacity.toFixed(3) : 0 });
    }

    let verdictText = '';
    if (trying && time >= attemptAt + .4) {
      verdictText = `직선 하나 · 틀림 ${4 - correct}개`;
    } else if (time >= 314.2) {
      verdictText = '직선 두 개 · 모두 맞힘';
    }
    setText(verdict, verdictText);
    verdict.classList.toggle('solved', time >= layersAt);

    // 그런데 숨은 층을 어떻게 가르칠지는 아무도 몰랐다.
    const unknown = appear(time, unknownAt, .5);
    hiddenEdges.forEach((box, index) => setAttributes(box, { opacity: appear(time, unknownAt + .3 + index * .15, .3).toFixed(3) }));
    setAttributes(hiddenFrame, { opacity: unknown.toFixed(3) });
    hiddenLabel.update(time, (at) => (at >= unknownAt ? '어떻게 가르치지?' : '숨은 층'));
    hiddenLabel.toggleClass('unknown', time >= unknownAt);
  };

  return { element, update };
};

export const createXORScene = (): Scene => ({
  ...createXOR(),
  title: 'XOR 문제',
  start,
  end,
  chapters: [
    { time: onlyOneAt, title: '하나만 켜지면 켜짐' },
    { time: bothAt, title: '둘 다 같으면 꺼짐' },
    { time: paperAt, title: '점으로 찍어 보기' },
    { time: oneLineAt, title: '직선 한 줄의 한계' },
    { time: layersAt, title: '여러 겹이면 풀림' },
    { time: unknownAt, title: '가르치는 법은 몰랐다' },
  ],
});
