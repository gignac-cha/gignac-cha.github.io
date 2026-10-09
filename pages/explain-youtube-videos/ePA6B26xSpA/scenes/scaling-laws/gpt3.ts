import './scaling-laws.scss';
import { appear, createDiagram, ease, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createLogChart, lossOfParameters } from './chart.ts';

// 43:45.2 "그리고 넉 달 뒤, 그 표를 믿고 지은 모델이 공개됩니다" ~ 44:02.0 "…큰돈을 투자한 참이었거든요".
// 스케일링 법칙 논문이 잰 범위(매개변수 10만~10억)의 선을 그대로 늘리면 GPT-3(1,750억)가 놓일 자리가 나온다.
// GPT-2는 15억(15억 4,200만), GPT-3는 1,750억: 100배 넘게(약 113~117배).
const start = 2625.2;
const end = 2642.0;
const at = {
  table: 2625.2,
  trust: 2626.6,
  gpt3: 2628.7,
  count: 2631.4,
  gpt2: 2633.2,
  ratio: 2634.1,
  computer: 2635.8,
};

const gpt2 = Math.log10(1.5e9);
const gpt3 = Math.log10(1.75e11);

export const createGPT3ScaleScene = (): Scene => {
  const { element, root } = createDiagram('scaling-laws', 'GPT-3의 규모');
  const chart = createLogChart(root, {
    box: { left: 250, top: 210, width: 1000, height: 440 },
    x: [5, 12], y: [1, 6], xTicks: [[5, '10만'], [7, '1,000만'], [9, '10억'], [11, '1,000억']], yTicks: [2, 3, 4],
    xLabel: '모델 크기 (매개변수)', yLabel: '오차',
  });
  const lossAt = (e: number) => lossOfParameters(10 ** e);

  const band = svg('g', { class: 'scaling-laws-band' }, root);
  svg('rect', { x: chart.toX(5), y: 200, width: chart.toX(9) - chart.toX(5), height: 450 }, band);
  text(band, (chart.toX(5) + chart.toX(9)) / 2, 236, '2020년 1월 논문이 잰 범위', { class: 'scaling-laws-band-label', 'text-anchor': 'middle' });
  const measured = chart.curve(lossAt, 5, 9, 'measured');
  const predicted = chart.curve(lossAt, 9, 12, 'predicted');

  const marker = (exponent: number, className: string) => {
    const group = svg('g', { class: `scaling-laws-marker ${className}`, transform: `translate(${chart.toX(exponent).toFixed(1)} ${chart.toY(lossAt(exponent)).toFixed(1)})` }, root);
    svg('circle', { class: 'scaling-laws-marker-ring', r: 24 }, group);
    svg('circle', { r: 13 }, group);
    return group;
  };
  const gpt2Marker = marker(gpt2, 'gpt2');
  const gpt2Label = svg('g', {}, root);
  text(gpt2Label, chart.toX(gpt2), chart.toY(lossAt(gpt2)) + 64, 'GPT-2', { class: 'scaling-laws-marker-name', 'text-anchor': 'middle' });
  text(gpt2Label, chart.toX(gpt2), chart.toY(lossAt(gpt2)) + 98, '15억', { class: 'scaling-laws-marker-count', 'text-anchor': 'middle' });

  const gpt3Marker = marker(gpt3, 'gpt3');
  const gpt3X = chart.toX(gpt3);
  const gpt3Y = chart.toY(lossAt(gpt3));
  const gpt3Name = svg('g', {}, root);
  text(gpt3Name, gpt3X + 34, gpt3Y - 24, 'GPT-3', { class: 'scaling-laws-marker-name big' });
  text(gpt3Name, gpt3X + 36, gpt3Y - 70, '2020년 5월', { class: 'scaling-laws-marker-date' });
  // 점 오른쪽 아래로 이어지는 예측 점선과 겹치지 않게 점의 왼쪽 아래에 둔다.
  const gpt3Count = text(root, gpt3X + 36, gpt3Y + 76, '1,750억', { class: 'scaling-laws-marker-count big', 'text-anchor': 'end' });

  const ratio = svg('g', { class: 'scaling-laws-ratio' }, root);
  const ratioArc = svg('path', { d: `M${chart.toX(gpt2)} ${chart.toY(lossAt(gpt2)) - 34} C${chart.toX(gpt2) + 60} ${chart.toY(lossAt(gpt2)) - 190}, ${gpt3X - 120} ${gpt3Y - 190}, ${gpt3X - 26} ${gpt3Y - 30}`, pathLength: 1 }, ratio);
  const ratioText = text(ratio, (chart.toX(gpt2) + gpt3X) / 2 - 10, Math.min(chart.toY(lossAt(gpt2)), gpt3Y) - 150, '100배 넘게', { class: 'scaling-laws-ratio-text', 'text-anchor': 'middle' });

  const computer = svg('g', { class: 'scaling-laws-computer' }, root);
  const chips = Array.from({ length: 40 }, (_, i) => svg('rect', { x: 1300 + (i % 8) * 24, y: 712 + Math.floor(i / 8) * 18, width: 18, height: 12, rx: 2 }, computer));
  text(computer, 1280, 744, '학습: 마이크로소프트 슈퍼컴퓨터', { class: 'scaling-laws-computer-label', 'text-anchor': 'end' });
  text(computer, 1280, 782, 'GPU 1만 개', { class: 'scaling-laws-computer-subtitle', 'text-anchor': 'end' });

  const update = (time: number) => {
    setAttributes(band, { opacity: (appear(time, at.table, .4) * .9).toFixed(3) });
    measured.draw(ease(progress(time, at.table, .7)));
    predicted.draw(ease(progress(time, at.trust, 1.1)));

    const gpt3Shown = appear(time, at.gpt3, .35);
    setAttributes(gpt3Marker, { opacity: gpt3Shown.toFixed(3), transform: `translate(${gpt3X.toFixed(1)} ${gpt3Y.toFixed(1)}) scale(${(.4 + .6 * gpt3Shown).toFixed(3)})` });
    setAttributes(gpt3Name, { opacity: gpt3Shown.toFixed(3) });
    setAttributes(gpt3Count, { opacity: appear(time, at.count, .4).toFixed(3) });
    gpt3Marker.classList.toggle('pulse', time >= at.count && time < at.count + 1);

    setAttributes(gpt2Marker, { opacity: appear(time, at.gpt2, .35).toFixed(3) });
    setAttributes(gpt2Label, { opacity: appear(time, at.gpt2, .35).toFixed(3) });
    setAttributes(ratioArc, { 'stroke-dashoffset': (1 - ease(progress(time, at.ratio, .6))).toFixed(3) });
    setAttributes(ratioText, { opacity: appear(time, at.ratio + .4, .4).toFixed(3) });

    setAttributes(computer, { opacity: appear(time, at.computer, .5).toFixed(3) });
    chips.forEach((chip, i) => setAttributes(chip, { opacity: appear(time, at.computer + i * .015, .2).toFixed(3) }));
  };

  return {
    element,
    update,
    title: 'GPT-3의 규모',
    start,
    end,
    chapters: [
      { time: start, title: '표를 믿고 지은 모델' },
      { time: at.gpt3, title: 'GPT-3, 매개변수 1,750억' },
      { time: at.gpt2, title: 'GPT-2보다 100배 넘게' },
      { time: at.computer, title: '마이크로소프트 슈퍼컴퓨터' },
    ],
  };
};
