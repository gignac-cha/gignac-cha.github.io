import './imagenet-error-rate.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 19:30 "천 가지 종류로 나뉜 사진" ~ 20:04 "컴퓨터 비전의 분명한 전환점".
const start = 1170.367;
const end = 1204.433;
const at = {
  rules: 1170.6,
  guesses: 1173.6,
  // "다섯 번 안에 정답을 말하면" 에 맞춰 한 번씩 말해 본다. 네 번째가 정답.
  attempts: [1174, 1174.35, 1174.7, 1175.05],
  correct: 1175.4,
  chart: 1176.7,
  lastYear: 1178.5,
  // "네 장 중 한 장은": 무작위로 칠한 빨간 칸을 한쪽으로 모아 1/4 임을 보여 준다.
  quarter: 1180,
  sort: 1180,
  slowly: 1182.7,
  second: 1186.7,
  first: 1189.8,
  gap: 1192,
  turning: 1201.2,
};

// 내레이션에 나온 수치만 쓴다.
const bars = [
  { team: '전년 우승팀', note: '', value: 25, label: '25%+', at: at.lastYear },
  { team: '2등 팀', note: '', value: 26, label: '26%대', at: at.second },
  { team: '1등 팀', note: 'AlexNet', value: 15.3, label: '15.3%', at: at.first },
];

const chart = { left: 790, right: 1430, baseline: 740, top: 200, max: 30 };
const barWidth = 150;
const barX = (index: number) => chart.left + 130 + index * 210;
const valueY = (value: number) => chart.baseline - (value / chart.max) * (chart.baseline - chart.top);

const waffle = { x: 150, y: 300, pitch: 44, size: 38 };
const guesses = ['여우', '강아지', '호랑이', '고양이', '토끼'];
const answer = 3;

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

export const createImageNetErrorRateScene = (): Scene => {
  const { element, root } = createDiagram('imagenet-error-rate', '이미지넷 대회 오류율');

  // 왼쪽 A: 다섯 번 안에 맞히면 정답.
  const rules = svg('g', { class: 'error-rate-rules', transform: 'translate(380 80)' }, root);
  text(rules, 120, 200, '사진 한 장, 1,000가지 중 하나', { class: 'error-rate-heading' });
  svg('rect', { x: 120, y: 250, width: 240, height: 240, rx: 18, class: 'error-rate-photo' }, rules);
  text(rules, 240, 420, '🐈', { class: 'error-rate-emoji' });
  // 다섯 번의 기회: 빈 칸으로 먼저 보이고, 말해 볼 때마다 채워져 틀리면 ✕, 맞히면 ✓.
  const guessViews = guesses.map((guess, i) => {
    const group = svg('g', {}, rules);
    const chip = svg('rect', { x: 400, y: 250 + i * 50, width: 240, height: 42, rx: 21, class: 'error-rate-guess empty' }, group);
    text(group, 420, 281 + i * 50, String(i + 1), { class: 'error-rate-guess-rank' });
    const word = text(group, 460, 281 + i * 50, guess, { class: 'error-rate-guess-text', opacity: 0 });
    const mark = text(group, 612, 281 + i * 50, i === answer ? '✓' : '✕', { class: `error-rate-guess-mark ${i === answer ? 'hit' : 'miss'}`, opacity: 0 });
    return { group, chip, word, mark };
  });
  const verdict = svg('g', {}, rules);
  text(verdict, 120, 560, '4번째에 맞힘 · 다섯 번 안이라 정답', { class: 'error-rate-heading error-rate-good' });

  // 왼쪽 B: 사진 100장 중 틀린 사진.
  const sample = svg('g', { class: 'error-rate-sample' }, root);
  const teamLabels = bars.map(({ team, note }) => text(sample, 150, 250, note ? `${team} · ${note}` : team, { class: 'error-rate-heading' }));
  const order = Array.from({ length: 100 }, (_, i) => i).sort((a, b) => random(a * 7 + 3) - random(b * 7 + 3));
  const rank = new Map(order.map((cell, i) => [cell, i]));
  // 정렬 후 자리 순서: 왼쪽 위 5×5 를 먼저, 나머지는 줄 순서대로. 이후 팀의 틀린 수도 이 순서로 채운다.
  const slots = [
    ...Array.from({ length: 25 }, (_, i) => Math.floor(i / 5) * 10 + (i % 5)),
    ...Array.from({ length: 100 }, (_, i) => i).filter((i) => i % 10 >= 5 || Math.floor(i / 10) >= 5),
  ];
  const red = Array.from({ length: 100 }, (_, i) => i).filter((i) => rank.get(i)! < 25);
  const rest = Array.from({ length: 100 }, (_, i) => i).filter((i) => rank.get(i)! >= 25);
  const slotRank = new Map([...red, ...rest].map((cell, i) => [cell, i]));
  const home = (index: number) => ({ x: waffle.x + (index % 10) * waffle.pitch, y: waffle.y + Math.floor(index / 10) * waffle.pitch });
  const cells = Array.from({ length: 100 }, (_, i) => {
    const from = home(i);
    const to = home(slots[slotRank.get(i)!]);
    const element = svg('rect', { x: from.x, y: from.y, width: waffle.size, height: waffle.size, rx: 6 }, sample);
    return { element, from, to, delay: (rank.get(i)! % 25) * .012 };
  });
  // 정렬이 끝나면 1/4 영역을 감싼다.
  const quadrant = svg('g', { opacity: 0 }, sample);
  const quadrantSize = waffle.pitch * 5 - (waffle.pitch - waffle.size);
  svg('rect', { x: waffle.x - 8, y: waffle.y - 8, width: quadrantSize + 16, height: quadrantSize + 16, rx: 12, class: 'error-rate-quadrant' }, quadrant);
  text(quadrant, waffle.x + quadrantSize / 2, waffle.y + quadrantSize / 2 + 16, '1/4', { class: 'error-rate-quadrant-text' });
  const quarter = text(sample, 150, 800, '네 장 중 한 장은 틀렸다', { class: 'error-rate-heading error-rate-bad' });
  const legend = svg('g', {}, sample);
  svg('rect', { x: 150, y: 770, width: 26, height: 26, rx: 5, class: 'error-rate-wrong' }, legend);
  text(legend, 188, 793, '틀린 사진', { class: 'error-rate-small' });
  svg('rect', { x: 330, y: 770, width: 26, height: 26, rx: 5, class: 'error-rate-right' }, legend);
  text(legend, 368, 793, '맞힌 사진', { class: 'error-rate-small' });

  // 오른쪽: 오류율 막대.
  const plot = svg('g', { class: 'error-rate-plot' }, root);
  [0, 10, 20, 30].forEach((tick) => {
    const y = valueY(tick);
    svg('line', { x1: chart.left, y1: y, x2: chart.right, y2: y, class: tick === 0 ? 'error-rate-baseline' : 'error-rate-grid' }, plot);
    text(plot, chart.left - 16, y + 10, `${tick}%`, { class: 'error-rate-tick' });
  });
  text(plot, chart.left - 60, chart.top - 40, '오류율', { class: 'error-rate-small' });
  const barViews = bars.map(({ team, note, label }, index) => {
    const x = barX(index);
    const bar = svg('path', { class: index === 2 ? 'error-rate-bar alexnet' : 'error-rate-bar' }, plot);
    const value = text(plot, x, 0, label, { class: index === 2 ? 'error-rate-value alexnet' : 'error-rate-value' });
    const name = text(plot, x, chart.baseline + 44, team, { class: 'error-rate-team' });
    const sub = note ? text(plot, x, chart.baseline + 84, note, { class: 'error-rate-note' }) : undefined;
    return { bar, value, name, sub, x };
  });
  const slowly = text(plot, barX(0) + barWidth / 2 + 16, valueY(25) + 36, '↓ 해마다 아주 조금씩', { class: 'error-rate-small' });

  // 2등과 1등의 차이를 1등 막대 오른쪽에 표시한다.
  const gap = svg('g', { class: 'error-rate-gap' }, plot);
  const gapTop = valueY(26);
  const gapBottom = valueY(15.3);
  const gapX = barX(2) + barWidth / 2 + 28;
  svg('line', { x1: barX(1) + barWidth / 2, y1: gapTop, x2: gapX + 10, y2: gapTop, class: 'error-rate-dash' }, gap);
  svg('line', { x1: barX(2) + barWidth / 2, y1: gapBottom, x2: gapX + 10, y2: gapBottom, class: 'error-rate-dash' }, gap);
  svg('path', { d: `M${gapX} ${gapTop + 8} V${gapBottom - 6} M${gapX - 12} ${gapBottom - 20} L${gapX} ${gapBottom - 6} L${gapX + 12} ${gapBottom - 20}`, class: 'error-rate-arrow' }, gap);
  text(gap, gapX + 22, (gapTop + gapBottom) / 2 - 4, '10%p', { class: 'error-rate-gap-text' });
  text(gap, gapX + 22, (gapTop + gapBottom) / 2 + 34, '넘게', { class: 'error-rate-gap-text' });

  const turning = svg('g', { class: 'error-rate-turning' }, plot);
  const turningX = (barX(1) + barX(2)) / 2;
  svg('line', { x1: turningX, y1: chart.top - 10, x2: turningX, y2: chart.baseline + 100, class: 'error-rate-turning-line' }, turning);
  text(turning, turningX, chart.top - 24, '전환점', { class: 'error-rate-turning-text' });

  const update = (time: number) => {
    // A
    const sampleIn = appear(time, at.chart, .6);
    setAttributes(rules, { opacity: (appear(time, at.rules) * (1 - sampleIn)).toFixed(3) });
    guessViews.forEach(({ group, chip, word, mark }, i) => {
      setAttributes(group, { opacity: appear(time, at.guesses + i * .08, .3).toFixed(3) });
      const said = at.attempts[i];
      const tried = said !== undefined && time >= said;
      const judged = said !== undefined && time >= (i === answer ? at.correct : said + .15);
      setAttributes(word, { opacity: said === undefined ? 0 : appear(time, said, .2).toFixed(3) });
      setAttributes(mark, { opacity: said === undefined ? 0 : appear(time, i === answer ? at.correct : said + .15, .2).toFixed(3) });
      const state = !tried ? 'empty' : !judged ? 'trying' : i === answer ? 'hit' : 'miss';
      setAttributes(chip, { class: `error-rate-guess ${state}` });
    });
    setAttributes(verdict, { opacity: appear(time, at.correct, .4).toFixed(3) });

    // B: 지금 이야기하는 팀의 사진 100장.
    setAttributes(sample, { opacity: sampleIn.toFixed(3) });
    const current = time >= at.first ? 2 : time >= at.second ? 1 : 0;
    teamLabels.forEach((label, i) => setAttributes(label, { opacity: i === current ? 1 : 0 }));
    const counts = [25, 26, 15];
    let wrong = time < at.lastYear ? 0 : lerp(0, counts[0], appear(time, at.lastYear, .8));
    if (time >= at.second) {
      wrong = lerp(counts[0], counts[1], appear(time, at.second, .4));
    }
    if (time >= at.first) {
      wrong = lerp(counts[1], counts[2], appear(time, at.first, .8));
    }
    const wrongCount = Math.round(wrong);
    // 정렬 전에는 무작위 자리의 빨간 칸, 정렬 후에는 모인 순서대로 센다.
    const sorted = time >= at.sort;
    cells.forEach(({ element, from, to, delay }, i) => {
      const moved = ease(progress(time, at.sort + delay, .8));
      setAttributes(element, {
        x: lerp(from.x, to.x, moved).toFixed(1),
        y: lerp(from.y, to.y, moved).toFixed(1),
        class: (sorted ? slotRank.get(i)! : rank.get(i)!) < wrongCount ? 'error-rate-wrong' : 'error-rate-right',
      });
    });
    setAttributes(quadrant, { opacity: (appear(time, at.sort + 1.2, .4) * (1 - appear(time, at.second, .3))).toFixed(3) });
    setAttributes(quarter, { opacity: (appear(time, at.quarter, .4) * (1 - appear(time, at.second, .3))).toFixed(3) });
    setAttributes(legend, { opacity: appear(time, at.second, .4).toFixed(3) });

    // 막대
    setAttributes(plot, { opacity: sampleIn.toFixed(3) });
    barViews.forEach(({ bar, value, name, sub, x }, index) => {
      const grow = appear(time, bars[index].at, .8);
      const height = (bars[index].value / chart.max) * (chart.baseline - chart.top) * grow;
      const left = x - barWidth / 2;
      const top = chart.baseline - height;
      const radius = Math.min(4, height);
      setAttributes(bar, {
        d: `M${left} ${chart.baseline} V${(top + radius).toFixed(1)} Q${left} ${top.toFixed(1)} ${left + radius} ${top.toFixed(1)} H${left + barWidth - radius} Q${left + barWidth} ${top.toFixed(1)} ${left + barWidth} ${(top + radius).toFixed(1)} V${chart.baseline} Z`,
        opacity: grow > 0 ? 1 : 0,
      });
      setAttributes(value, { y: (top - 18).toFixed(1), opacity: appear(time, bars[index].at + .6, .3).toFixed(3) });
      const shown = time >= bars[index].at - .3 ? 1 : .35;
      setAttributes(name, { opacity: shown });
      if (sub) {
        setAttributes(sub, { opacity: shown });
      }
    });
    setAttributes(slowly, { opacity: (appear(time, at.slowly) * (1 - appear(time, at.second, .4))).toFixed(3) });
    setAttributes(gap, { opacity: appear(time, at.gap, .5).toFixed(3) });
    setAttributes(turning, { opacity: appear(time, at.turning, .6).toFixed(3) });
  };

  return {
    element,
    update,
    title: '이미지넷 대회 오류율',
    start,
    end,
    chapters: [
      { time: at.rules, title: '1,000가지 사물 맞히기' },
      { time: at.guesses, title: '다섯 번 안에 정답' },
      { time: at.chart, title: '전년 우승팀 25%+' },
      { time: at.second, title: '2등 팀 26%대' },
      { time: at.first, title: '1등 팀 15.3%' },
      { time: at.gap, title: '10%p 넘는 차이' },
      { time: at.turning, title: '전환점' },
    ],
  };
};
