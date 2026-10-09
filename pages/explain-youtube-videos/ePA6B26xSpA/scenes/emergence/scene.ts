import './emergence.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';

// 44:54.1 "여기서 흥미로운 논쟁이 하나 생겨납니다" ~ 45:20.4 "…크게 만들면 무언가 확실히 달라진다는 것이었죠".
// 그래프는 측정값이 아니라 반론(Schaeffer 외, 2023)의 원리를 보여 주는 개념도다.
// 글자 하나를 맞힐 확률 p가 모델 크기에 따라 서서히 오르면, 답 전체(여러 글자)를 다 맞힐 확률 p^k는 갑자기 솟는 것처럼 보인다.
const start = 2694.1;
const end = 2720.4;
const at = {
  axes: 2694.4,
  hidden: 2697.4,
  sudden: 2698.8,
  water: 2700.9,
  zero: 2701.8,
  freeze: 2702.0,
  ice: 2702.3,
  emergence: 2703.6,
  rebuttal: 2706.2,
  method: 2706.8,
  actually: 2709.9,
  gradual: 2710.4,
  debate: 2712.6,
  fact: 2714.9,
  bigger: 2717.0,
  differs: 2718.2,
};

const box = { left: 170, top: 210, width: 680, height: 420 };
const toX = (u: number) => box.left + u * box.width;
const toY = (v: number) => box.top + box.height - v * box.height;
// 글자 하나를 맞힐 확률(서서히)과 답 전체를 맞힐 확률(그 10제곱).
const partial = (u: number) => .3 + .69 * u;
const exact = (u: number) => partial(u) ** 10;
const curvePath = (f: (u: number) => number, until: number) => {
  if (until <= 0) {
    return '';
  }
  const count = Math.max(Math.ceil(until * 80), 1);
  return Array.from({ length: count + 1 }, (_, i) => {
    const u = (until * i) / count;
    return `${i ? 'L' : 'M'}${toX(u).toFixed(1)} ${toY(f(u)).toFixed(1)}`;
  }).join(' ');
};

// 물의 온도: 4°C에서 0°C로 내려가 잠시 머물다(얼기 시작) 영하로.
const temperature = (time: number) => {
  if (time < at.ice) {
    return lerp(4, 0, ease(progress(time, at.water, at.zero - at.water)));
  }
  return lerp(0, -3, ease(progress(time, at.ice, 1.2)));
};

export const createEmergenceScene = (): Scene => {
  const { element, root } = createDiagram('em', '창발 논쟁');

  const chart = svg('g', { class: 'em-chart' }, root);
  svg('line', { class: 'em-grid', x1: box.left, y1: toY(1), x2: box.left + box.width, y2: toY(1) }, chart);
  svg('path', { class: 'em-axis', d: `M${box.left} ${box.top - 20} V${box.top + box.height} H${box.left + box.width + 20}` }, chart);
  text(chart, box.left - 14, toY(0) + 8, '0', { class: 'em-tick', 'text-anchor': 'end' });
  text(chart, box.left - 14, toY(1) + 8, '100%', { class: 'em-tick', 'text-anchor': 'end' });
  text(chart, box.left, box.top - 34, '정답률', { class: 'em-axis-label' });
  text(chart, box.left + box.width, box.top + box.height + 48, '모델 크기 →', { class: 'em-axis-label', 'text-anchor': 'end' });
  const exactCurve = svg('path', { class: 'em-curve exact' }, chart);
  const partialCurve = svg('path', { class: 'em-curve partial' }, chart);
  const exactLabel = text(chart, toX(.62), toY(.08) - 18, '정답 전체만 세면', { class: 'em-curve-label exact', 'text-anchor': 'end' });
  const partialLabel = text(chart, toX(.5) - 10, toY(partial(.5)) - 26, '맞힌 글자만큼 세면', { class: 'em-curve-label partial', 'text-anchor': 'end' });

  const emergence = svg('g', { class: 'em-emergence' }, chart);
  // 두 곡선 사이(초록 선 아래, 주황 선 위)에 두고 솟는 지점을 가리킨다.
  svg('path', { d: `M${toX(.67)} ${toY(.3)} C${toX(.75)} ${toY(.3)}, ${toX(.8)} ${toY(.3)}, ${toX(.845)} ${toY(.3)}`, class: 'em-pointer' }, emergence);
  text(emergence, toX(.655), toY(.3) + 4, '창발', { class: 'em-emergence-text', 'text-anchor': 'end' });
  text(emergence, toX(.655), toY(.3) + 36, 'emergence', { class: 'em-emergence-sub', 'text-anchor': 'end' });

  // 물이 0°C에서 한순간에 얼음이 된다.
  const water = svg('g', { class: 'em-water' }, root);
  const tube = { x: 1010, top: 270, bottom: 570 };
  const tempToY = (t: number) => lerp(tube.bottom - 30, tube.top + 20, (t + 5) / 15);
  svg('rect', { class: 'em-tube', x: tube.x - 14, y: tube.top, width: 28, height: tube.bottom - tube.top, rx: 14 }, water);
  svg('circle', { class: 'em-bulb', cx: tube.x, cy: tube.bottom + 18, r: 26 }, water);
  const mercury = svg('rect', { class: 'em-mercury', x: tube.x - 7, width: 14, rx: 7 }, water);
  svg('line', { class: 'em-zero-tick', x1: tube.x - 26, y1: tempToY(0), x2: tube.x + 26, y2: tempToY(0) }, water);
  text(water, tube.x - 34, tempToY(0) + 8, '0°C', { class: 'em-zero-label', 'text-anchor': 'end' });
  const readout = text(water, 1290, 262, '', { class: 'em-readout', 'text-anchor': 'middle' });
  const cube = svg('rect', { class: 'em-cube', x: 1140, y: 300, width: 300, height: 260, rx: 18 }, water);
  const crystal = svg('g', { class: 'em-crystal' }, water);
  for (let i = 0; i < 4; i++) {
    const cx = 1200 + (i % 2) * 180 + (i > 1 ? 40 : 0);
    const cy = 360 + Math.floor(i / 2) * 130;
    for (let k = 0; k < 3; k++) {
      const angle = (k * Math.PI) / 3;
      svg('line', { x1: cx - Math.cos(angle) * 46, y1: cy - Math.sin(angle) * 46, x2: cx + Math.cos(angle) * 46, y2: cy + Math.sin(angle) * 46 }, crystal);
    }
  }
  const state = createSwapText(water, 1290, 612, { class: 'em-state' });

  // 재는 방식: 같은 답을 두 가지로 채점한다.
  const scoring = svg('g', { class: 'em-scoring' }, root);
  text(scoring, 1230, 250, '재는 방식의 차이', { class: 'em-scoring-title' });
  text(scoring, 990, 316, '123 + 456 = ?', { class: 'em-problem' });
  text(scoring, 990, 370, '정답 579 · 모델의 답', { class: 'em-problem-sub' });
  const digits = ['5', '7', '8'].map((digit, i) => text(scoring, 1300 + i * 32, 370, digit, { class: `em-digit ${i < 2 ? 'right' : 'wrong'}` }));
  const cardExact = svg('g', { class: 'em-card exact' }, scoring);
  svg('rect', { x: 970, y: 410, width: 520, height: 104, rx: 16 }, cardExact);
  text(cardExact, 1000, 456, '답 전체가 맞아야 1점', { class: 'em-card-rule' });
  text(cardExact, 1000, 492, '한 자리라도 틀리면 0점', { class: 'em-card-note' });
  text(cardExact, 1460, 478, '0점', { class: 'em-card-score', 'text-anchor': 'end' });
  const cardPartial = svg('g', { class: 'em-card partial' }, scoring);
  svg('rect', { x: 970, y: 534, width: 520, height: 104, rx: 16 }, cardPartial);
  text(cardPartial, 1000, 580, '맞힌 자리만큼 부분 점수', { class: 'em-card-rule' });
  text(cardPartial, 1000, 616, '세 자리 중 두 자리', { class: 'em-card-note' });
  text(cardPartial, 1460, 602, '⅔점', { class: 'em-card-score', 'text-anchor': 'end' });

  const debate = text(root, 800, 160, '창발일까, 재는 방식이 만든 착시일까? · 아직 논쟁 중', { class: 'em-debate', 'text-anchor': 'middle' });

  const fact = svg('g', { class: 'em-fact' }, root);
  const factBand = svg('rect', { class: 'em-fact-band', x: toX(.8), y: box.top - 10, width: toX(1) - toX(.8) + 10, height: box.height + 10 }, fact);
  const factArrow = svg('path', { class: 'em-fact-arrow', d: `M${toX(.45)} ${box.top + box.height + 92} H${toX(1) + 20}`, pathLength: 1 }, fact);
  const factHead = svg('path', { class: 'em-fact-head', d: `M${toX(1) + 32} ${box.top + box.height + 92} l-20 -12 v24 z` }, fact);
  const factBigger = text(fact, toX(.45), box.top + box.height + 80, '크게 만들면', { class: 'em-fact-text' });
  const factLine = createSwapText(root, 800, 160, { class: 'em-fact-line', 'text-anchor': 'middle' });

  const update = (time: number) => {
    setAttributes(chart, { opacity: appear(time, at.axes, .5).toFixed(3) });
    const exactUntil = time < at.sudden ? .62 * ease(progress(time, at.hidden, 1.2)) : lerp(.62, 1, ease(progress(time, at.sudden, .5)));
    setAttributes(exactCurve, { d: curvePath(exact, exactUntil) });
    setAttributes(exactLabel, { opacity: appear(time, at.hidden + .6, .4).toFixed(3) });
    setAttributes(partialCurve, { d: curvePath(partial, ease(progress(time, at.gradual, 1.3))) });
    setAttributes(partialLabel, { opacity: appear(time, at.gradual + .9, .4).toFixed(3) });
    setAttributes(emergence, { opacity: (appear(time, at.emergence, .4) * (1 - .6 * appear(time, at.gradual, .6))).toFixed(3) });

    const waterShown = appear(time, at.water, .4) * (1 - appear(time, at.rebuttal - .3, .4));
    setAttributes(water, { opacity: waterShown.toFixed(3) });
    const t = temperature(time);
    setAttributes(mercury, { y: tempToY(t).toFixed(1), height: (tube.bottom + 10 - tempToY(t)).toFixed(1) });
    const shown = Math.round(t);
    const label = `${shown < 0 ? '−' : ''}${Math.abs(shown)}°C`;
    if (readout.textContent !== label) {
      readout.textContent = label;
    }
    const frozen = clamp((time - at.freeze) / .15);
    setAttributes(crystal, { opacity: frozen.toFixed(3) });
    cube.classList.toggle('ice', time >= at.freeze);
    state.update(time, (now) => (now < at.water ? '' : now < at.freeze ? '물' : '얼음'));

    const scoringShown = appear(time, at.method, .4) * (1 - .55 * appear(time, at.debate, .5));
    setAttributes(scoring, { opacity: scoringShown.toFixed(3) });
    digits.forEach((digit, i) => setAttributes(digit, { opacity: appear(time, at.method + .2 + i * .1, .25).toFixed(3) }));
    setAttributes(cardExact, { opacity: appear(time, at.method + .5, .35).toFixed(3) });
    setAttributes(cardPartial, { opacity: appear(time, at.actually, .35).toFixed(3) });

    setAttributes(debate, { opacity: (appear(time, at.debate, .5) * (1 - appear(time, at.fact, .35))).toFixed(3) });

    setAttributes(fact, { opacity: appear(time, at.fact, .4).toFixed(3) });
    setAttributes(factBand, { opacity: appear(time, at.differs, .5).toFixed(3) });
    setAttributes(factArrow, { 'stroke-dashoffset': (1 - ease(progress(time, at.bigger, .6))).toFixed(3) });
    setAttributes(factHead, { opacity: appear(time, at.bigger + .5, .2).toFixed(3) });
    setAttributes(factBigger, { opacity: appear(time, at.bigger, .4).toFixed(3) });
    factLine.update(time, (now) => (now < at.fact + .4 ? '' : now < at.differs ? '그래도 분명한 사실 하나' : '크게 만들면 무언가 확실히 달라진다'));
  };

  return {
    element,
    update,
    title: '창발 논쟁',
    start,
    end,
    chapters: [
      { time: start, title: '갑자기 나타나는 능력?' },
      { time: at.water, title: '0°C에서 얼음이 되듯' },
      { time: at.rebuttal, title: '재는 방식 탓이라는 반론' },
      { time: at.debate, title: '아직 끝나지 않은 논쟁' },
      { time: at.fact, title: '크게 만들면 달라진다' },
    ],
  };
};
