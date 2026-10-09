import './perceptron.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 3:46 "이름은 퍼셉트론" ~ 4:11 "스스로 조정했습니다" (Mark 1 기계 이야기 전까지).
// 영상은 3:52 "처음엔 각 입력에 아무렇게나 무게를"에서야 입력과 무게를 꺼내므로 도식도 그때 채운다.
const start = 225.967;
const end = 251.967;

const namedAt = 226.3; // 이름은 퍼셉트론
const inputsAt = 232.2; // 각 입력에
const randomAt = 232.8; // 아무렇게나 무게를
const pointsAt = 233.3;
const lineAt = 233.8; // 줍니다
const correctAt = 235; // 정답을 맞히면 그대로
const wrongAt = 236.4; // 틀리면 틀린 방향으로
const loopAt = 236.4;
const fixAt = 237.8; // 무게를 조금씩 고칩니다
const ballAt = 239.5; // 운동장에서 공을 던지는 아이
const backAt = 248.4; // 퍼셉트론도 이렇게
const repeatAt = 249.4; // 수많은 예제를 보며 스스로 조정

// 정답 경계의 법선 각도와 학습 경로(도). 처음엔 아무렇게나 → 한 번 고침 → 여러 번 고쳐 정답에 닿는다.
const target = 120;
const initial = 195;
const corrected = 165;
const steps: Array<[number, number]> = [
  [repeatAt, 150],
  [repeatAt + .45, 138],
  [repeatAt + .9, 128],
  [repeatAt + 1.35, target],
];

const plane = { x: 1160, y: 470, scale: 290, left: 830, top: 140, size: 660 };

// 두 무리의 예제 (x, y, 정답). 위쪽 왼편이 파랑(+1), 아래 오른편이 주황(-1).
const points: Array<[number, number, number]> = [
  [-.7, .5, 1], [-.3, .75, 1], [.2, .8, 1], [-.8, -.1, 1], [-.45, .15, 1], [.45, .65, 1], [-.85, .2, 1],
  [.7, -.4, -1], [.3, -.75, -1], [-.2, -.7, -1], [.8, .1, -1], [.45, -.1, -1], [-.5, -.85, -1], [.15, -.35, -1],
];
const correctExample = 0;
const wrongExample = 9;

// 공이 떨어지는 순간(launch + 1초)을 "너무 멀리", "짧으면", "반복하다", "과녁에"에 맞춘다.
const throws = [
  { launch: 241.3, land: 1490, power: .95, label: '너무 멀리 → 힘을 뺀다' },
  { launch: 242.9, land: 1110, power: .5, label: '너무 짧게 → 힘을 더 준다' },
  { launch: 245, land: 1360, power: .8, label: '조금 멀리' },
  { launch: 246.6, land: 1270, power: .7, label: '명중' },
];
const throwDuration = 1;
const throwerX = 960;
const ground = 700;
const goal = 1270;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

const screen = (x: number, y: number) => ({ x: plane.x + x * plane.scale, y: plane.y - y * plane.scale });

// 지금 경계선의 법선 각도.
const angleAt = (time: number) => {
  let angle = lerp(initial, corrected, ease(progress(time, fixAt, 1.2)));
  for (const [at, value] of steps) {
    if (time >= at) {
      const previous = angle;
      angle = lerp(previous, value, ease(progress(time, at, .3)));
    }
  }
  return angle;
};

const classify = (angle: number, [x, y]: [number, number, number]) =>
  Math.cos(radians(angle)) * x + Math.sin(radians(angle)) * y >= 0 ? 1 : -1;

const format = (value: number) => `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`;

const setText = (element: Element, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

const createPerceptron = () => {
  const { element, root } = createDiagram('perceptron', '퍼셉트론 학습');

  // 왼쪽: 입력 두 개, 무게 두 개, 합.
  const unit = svg('g', { opacity: 0 }, root);
  const body = { x: 620, y: 470, r: 92 };
  // 입력과 무게는 나레이션이 꺼낼 때 붙는다.
  const wiring = svg('g', { opacity: 0 }, unit);
  text(wiring, 200, 210, '입력', { class: 'perceptron-header' });
  text(wiring, 410, 210, '무게', { class: 'perceptron-header' });
  const inputs = [
    { label: 'x₁', y: 340 },
    { label: 'x₂', y: 600 },
  ].map(({ label, y }) => {
    const toY = body.y + (y - body.y) * .35;
    svg('line', { class: 'perceptron-edge', x1: 248, y1: y, x2: body.x - body.r * .9, y2: toY }, wiring);
    svg('circle', { class: 'perceptron-input', cx: 200, cy: y, r: 48 }, wiring);
    text(wiring, 200, y + 14, label, { class: 'perceptron-input-label' });
    const middleY = lerp(y, toY, .45);
    const box = svg('rect', { class: 'perceptron-weight', x: 410 - 70, y: middleY - 32, width: 140, height: 64, rx: 14 }, wiring);
    const value = text(wiring, 410, middleY + 12, '?', { class: 'perceptron-weight-label' });
    return { box, value, bottom: middleY + 32 };
  });
  svg('circle', { class: 'perceptron-body', cx: body.x, cy: body.y, r: body.r }, unit);
  text(unit, body.x, body.y + 20, 'Σ', { class: 'perceptron-sigma' });
  const name = text(unit, body.x, body.y + body.r + 56, '퍼셉트론', { class: 'perceptron-name', opacity: 0 });
  svg('line', { class: 'perceptron-edge', x1: body.x + body.r, y1: body.y, x2: 790, y2: body.y }, unit);
  svg('path', { class: 'perceptron-arrow', d: `M774 ${body.y - 12} L792 ${body.y} L774 ${body.y + 12}` }, unit);
  // 결과를 보고 무게로 되돌아가는 고리: 스스로 배운다.
  const loopEnd = inputs[1].bottom + 8;
  const loop = svg('path', { class: 'perceptron-loop', d: `M${body.x} ${body.y + body.r + 90} C ${body.x} 800, 410 800, 410 ${loopEnd}`, opacity: 0 }, unit);
  const loopArrow = svg('path', { class: 'perceptron-loop', d: `M396 ${loopEnd + 18} L410 ${loopEnd} L424 ${loopEnd + 18}`, opacity: 0 }, unit);
  const loopPulse = svg('circle', { class: 'perceptron-loop-pulse', r: 10, opacity: 0 }, unit);

  // 오른쪽 1: 예제와 경계선이 있는 평면.
  const planeGroup = svg('g', { opacity: 0 }, root);
  const clip = svg('clipPath', { id: 'perceptron-clip' }, planeGroup);
  svg('rect', { x: plane.left, y: plane.top, width: plane.size, height: plane.size, rx: 18 }, clip);
  svg('rect', { class: 'perceptron-plane', x: plane.left, y: plane.top, width: plane.size, height: plane.size, rx: 18 }, planeGroup);
  const regions = svg('g', { 'clip-path': 'url(#perceptron-clip)', opacity: 0 }, planeGroup);
  const positive = svg('polygon', { class: 'perceptron-region-positive' }, regions);
  const negative = svg('polygon', { class: 'perceptron-region-negative' }, regions);
  const line = svg('line', { class: 'perceptron-line' }, regions);
  const dots = points.map(([x, y, label], index) => {
    const position = screen(x, y);
    const ring = svg('circle', { class: 'perceptron-ring', cx: position.x, cy: position.y, r: 28, opacity: 0 }, planeGroup);
    const dot = svg('circle', { class: `perceptron-dot ${label > 0 ? 'positive' : 'negative'}`, cx: position.x, cy: position.y, r: 17, opacity: 0 }, planeGroup);
    return { ring, dot, position, index };
  });
  const mark = text(planeGroup, 0, 0, '', { class: 'perceptron-mark', opacity: 0 });
  const done = text(planeGroup, plane.x, plane.top + plane.size + 64, '모두 맞힘', { class: 'perceptron-done', opacity: 0 });

  // 오른쪽 2: 공 던지기.
  const ballGroup = svg('g', { opacity: 0 }, root);
  svg('line', { class: 'perceptron-ground', x1: 880, y1: ground, x2: 1540, y2: ground }, ballGroup);
  svg('ellipse', { class: 'perceptron-target', cx: goal, cy: ground, rx: 62, ry: 16 }, ballGroup);
  svg('ellipse', { class: 'perceptron-target-center', cx: goal, cy: ground, rx: 22, ry: 6 }, ballGroup);
  svg('circle', { class: 'perceptron-person', cx: throwerX - 30, cy: ground - 118, r: 20 }, ballGroup);
  svg('path', { class: 'perceptron-person-line', d: `M${throwerX - 30} ${ground - 96} V${ground - 44} M${throwerX - 30} ${ground - 44} L${throwerX - 50} ${ground} M${throwerX - 30} ${ground - 44} L${throwerX - 10} ${ground} M${throwerX - 30} ${ground - 80} L${throwerX} ${ground - 104}` }, ballGroup);
  text(ballGroup, 852, 470, '힘', { class: 'perceptron-header' });
  svg('rect', { class: 'perceptron-gauge', x: 836, y: 490, width: 32, height: 120, rx: 8 }, ballGroup);
  const gauge = svg('rect', { class: 'perceptron-gauge-fill', x: 836, y: 610, width: 32, height: 0, rx: 8 }, ballGroup);
  const trail = svg('polyline', { class: 'perceptron-trail' }, ballGroup);
  const ball = svg('circle', { class: 'perceptron-ball', r: 14, opacity: 0 }, ballGroup);
  const landings = throws.map((shot) => {
    const group = svg('g', { opacity: 0 }, ballGroup);
    svg('path', { class: `perceptron-landing ${shot.land === goal ? 'hit' : ''}`, d: `M${shot.land - 10} ${ground - 10} L${shot.land + 10} ${ground + 10} M${shot.land + 10} ${ground - 10} L${shot.land - 10} ${ground + 10}` }, group);
    const label = text(group, Math.min(Math.max(shot.land, 1080), 1360), ground + 62, shot.label, { class: `perceptron-landing-label ${shot.land === goal ? 'hit' : ''}` });
    return { group, label };
  });

  const update = (time: number) => {
    setAttributes(unit, { opacity: appear(time, start + .1, .6).toFixed(3) });
    setAttributes(name, { opacity: appear(time, namedAt, .5).toFixed(3) });
    setAttributes(wiring, { opacity: appear(time, inputsAt, .5).toFixed(3) });
    const loopOpacity = appear(time, loopAt, .6);
    setAttributes(loop, { opacity: loopOpacity.toFixed(3) });
    setAttributes(loopArrow, { opacity: loopOpacity.toFixed(3) });

    const angle = angleAt(time);
    // 무게: 처음엔 빈칸, 232.2부터 아무렇게나 바뀌다가 233.3에 자리 잡는다.
    inputs.forEach(({ box, value }, index) => {
      let content = '?';
      if (time >= lineAt) {
        content = format(index === 0 ? Math.cos(radians(angle)) : Math.sin(radians(angle)));
      } else if (time >= randomAt) {
        const tick = Math.floor(time * 12);
        content = format(Math.sin(tick * 12.9898 + index * 78.233) * .99);
      }
      setText(value, content);
      box.classList.toggle('empty', content === '?');
      box.classList.toggle('changing', (time >= fixAt && time < fixAt + 1.2) || (time >= repeatAt && time < repeatAt + 1.7));
    });

    // 고칠 때 고리를 따라 신호가 무게로 돌아간다.
    const loopEvents = [fixAt - .2, ...steps.map(([at]) => at - .15)];
    let pulse = -1;
    for (const at of loopEvents) {
      if (time >= at && time < at + .45) {
        pulse = (time - at) / .45;
      }
    }
    if (pulse >= 0) {
      const point = loop.getPointAtLength(ease(pulse) * loop.getTotalLength());
      setAttributes(loopPulse, { opacity: 1, cx: point.x.toFixed(1), cy: point.y.toFixed(1) });
    } else {
      setAttributes(loopPulse, { opacity: 0 });
    }

    // 평면과 공 던지기 사이를 오간다.
    const toBall = appear(time, ballAt, .5) * (1 - appear(time, backAt, .5));
    setAttributes(planeGroup, { opacity: (appear(time, pointsAt, .5) * (1 - toBall)).toFixed(3) });
    setAttributes(ballGroup, { opacity: toBall.toFixed(3) });

    dots.forEach(({ dot, index }) => {
      setAttributes(dot, { opacity: appear(time, pointsAt + index * .03, .3).toFixed(3) });
    });

    const showLine = time >= lineAt;
    setAttributes(regions, { opacity: appear(time, lineAt, .4).toFixed(3) });
    if (showLine) {
      const nx = Math.cos(radians(angle));
      const ny = Math.sin(radians(angle));
      // 경계선 방향 d = (−ny, nx). 화면 좌표는 y가 아래로 커진다.
      const far = 3;
      const a = screen(-ny * far, nx * far);
      const b = screen(ny * far, -nx * far);
      const pa = screen(-ny * far + nx * far, nx * far + ny * far);
      const pb = screen(ny * far + nx * far, -nx * far + ny * far);
      const na = screen(-ny * far - nx * far, nx * far - ny * far);
      const nb = screen(ny * far - nx * far, -nx * far - ny * far);
      setAttributes(line, { x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1) });
      setAttributes(positive, { points: [a, b, pb, pa].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') });
      setAttributes(negative, { points: [a, b, nb, na].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') });
    }

    // 틀린 예제에는 빨간 고리.
    dots.forEach(({ ring, index }) => {
      const wrong = showLine && classify(angle, points[index]) !== points[index][2];
      setAttributes(ring, { opacity: wrong ? .9 : 0 });
    });

    // 하나씩 짚어 보기: 맞힌 예제(그대로), 틀린 예제(고침).
    let marked = -1;
    let symbol = '';
    if (time >= correctAt && time < wrongAt) {
      marked = correctExample;
      symbol = '✓ 그대로';
    } else if (time >= wrongAt && time < ballAt) {
      marked = wrongExample;
      symbol = '✕ 조금 고침';
    }
    if (marked >= 0) {
      const { position } = dots[marked];
      // 맞힌 예제는 오른쪽 아래, 틀린 예제는 왼쪽 위에 둬서 이웃한 점과 경계선을 피한다.
      const correct = marked === correctExample;
      setAttributes(mark, {
        opacity: 1,
        x: position.x + (correct ? 24 : -30),
        y: position.y + (correct ? 44 : -30),
        'text-anchor': correct ? 'start' : 'end',
      });
      mark.classList.toggle('wrong', symbol.startsWith('✕'));
      setText(mark, symbol);
    } else {
      setAttributes(mark, { opacity: 0 });
    }
    setAttributes(done, { opacity: appear(time, steps[steps.length - 1][0] + .3, .4).toFixed(3) });

    // 공 던지기: 지금 날아가는 공, 이미 떨어진 자리, 그 공을 던진 힘.
    const current = throws.findLastIndex((shot) => time >= shot.launch);
    throws.forEach((shot, index) => {
      // 지난 시도는 자국만 흐리게 남기고, 설명은 지금 시도만 보여 준다.
      setAttributes(landings[index].group, { opacity: time >= shot.launch + throwDuration ? (index === current ? 1 : .35) : 0 });
      setAttributes(landings[index].label, { opacity: index === current ? 1 : 0 });
    });
    if (current >= 0) {
      const shot = throws[current];
      const u = Math.min((time - shot.launch) / throwDuration, 1);
      const height = (260 * (shot.land - throwerX)) / 560;
      const position = (v: number) => ({ x: lerp(throwerX, shot.land, v), y: ground - 20 - height * 4 * v * (1 - v) + 20 * v });
      const samples = [];
      for (let i = 0; i <= 24; i++) {
        const p = position((u * i) / 24);
        samples.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      const p = position(u);
      setAttributes(trail, { points: samples.join(' '), opacity: u < 1 ? 1 : .5 });
      setAttributes(ball, { opacity: 1, cx: p.x.toFixed(1), cy: p.y.toFixed(1) });
      const level = 120 * shot.power;
      setAttributes(gauge, { y: (610 - level).toFixed(1), height: level.toFixed(1) });
    } else {
      setAttributes(ball, { opacity: 0 });
      setAttributes(trail, { points: '' });
    }
  };

  return { element, update };
};

export const createPerceptronScene = (): Scene => ({
  ...createPerceptron(),
  title: '퍼셉트론 학습',
  start,
  end,
  chapters: [
    { time: namedAt, title: '퍼셉트론' },
    { time: randomAt, title: '아무렇게나 준 무게' },
    { time: correctAt, title: '맞히면 그대로' },
    { time: wrongAt, title: '틀리면 조금 고침' },
    { time: ballAt, title: '공 던지기' },
    { time: repeatAt, title: '반복해서 맞춤' },
  ],
});
