import './context-window.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 59:42.2 "한 번에 100만 토큰이 넘는 글을 읽고 다룰 수 있는 모델입니다" ~ 59:52.4 (AGI 이야기까지).
const start = 3581.8;
const end = 3592.4;
const at = {
  sentence: 3582.2,
  split: 3582.9,
  script: 3584.8,
  copies: 3585.6,
  chart: 3587.6,
};

// 내레이션 문장을 OpenAI 토크나이저 o200k_base(GPT-4o 이후 모델이 쓰는 것)로 실제로 쪼갠 결과(tiktoken).
// 앞의 공백은 토큰에 붙어 있다. '룰'은 한 글자가 바이트 단위 토큰 두 개로 나뉜다.
const tokens = ['한', ' 번', '에', ' ', '100', '만', ' 토', '큰', '이', ' 넘', '는', ' 글', '을', ' 읽', '고', ' 다', '룰', '룰', ' 수', ' 있는', ' 모델', '입니다', '.'];
const halves = [16, 17];
const rowBreak = 15;

// 이 영상의 자동 자막 전체(1시간 3분)를 같은 토크나이저로 센 값: 21,878 토큰. 100만 ÷ 21,878 ≈ 45.7편.
const scriptTokens = 21878;
const copies = 1_000_000 / scriptTokens;

// OpenAI 모델이 한 번에 읽을 수 있는 토큰 수(컨텍스트 창). GPT-6 아스트라는 내레이션의 "100만 토큰이 넘는".
const models = [
  { name: 'GPT-3', year: '2020', value: 2048, label: '2,048' },
  { name: 'GPT-3.5', year: '2022', value: 4096, label: '4,096' },
  { name: 'GPT-4', year: '2023', value: 32768, label: '32,768' },
  { name: 'GPT-4 Turbo', year: '2023', value: 128000, label: '128,000' },
  { name: 'GPT-4.1', year: '2025', value: 1047576, label: '1,047,576' },
  { name: 'GPT-6 아스트라', year: '2026', value: 1100000, label: '100만+' },
];

const f = (n: number) => n.toFixed(1);

// 글자 폭 어림값(40px 글꼴): 한글 40, 숫자 24, 마침표 12, 공백 표시 20.
const glyph = (c: string) => (/[0-9]/.test(c) ? 24 : c === '.' ? 12 : c === ' ' ? 20 : 40);
const chipWidth = (token: string, index: number) => (halves.includes(index) ? 38 : [...token].reduce((sum, c) => sum + glyph(c), 0) + 26);
const gap = 10;

const layoutRow = (indices: number[], y: number) => {
  const widths = indices.map((i) => chipWidth(tokens[i], i) + (halves.includes(i) ? (i === halves[0] ? -gap + 2 : 0) : 0));
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (indices.length - 1);
  let x = 800 - total / 2;
  return indices.map((i, k) => {
    const width = chipWidth(tokens[i], i);
    const center = x + width / 2;
    x += widths[k] + gap;
    return { index: i, x: center, y, width };
  });
};
const spaced = [
  ...layoutRow(Array.from({ length: rowBreak }, (_, i) => i), 232),
  ...layoutRow(Array.from({ length: tokens.length - rowBreak }, (_, i) => rowBreak + i), 318),
];

// 한 줄로 이어 쓴 문장에서 각 토큰이 있던 자리(나뉘기 전).
const packed = (() => {
  const widths = tokens.map((token, i) => (halves.includes(i) ? 20 : [...token].reduce((sum, c) => sum + (c === ' ' ? 12 : glyph(c)), 0)));
  const total = widths.reduce((sum, w) => sum + w, 0);
  let x = 800 - total / 2;
  return widths.map((width) => {
    const center = x + width / 2;
    x += width;
    return center;
  });
})();

const palette = ['blue', 'purple', 'orange', 'green'];

const chart = { left: 880, baseline: 790, top: 590, min: 3, max: 6.3, pitch: 104, bar: 64 };
const barHeight = (value: number) => ((Math.log10(value) - chart.min) / (chart.max - chart.min)) * (chart.baseline - chart.top);

export const createContextWindowScene = (): Scene => {
  const { element, root } = createDiagram('context-window', '100만 토큰 컨텍스트 창');

  const sentence = text(root, 800, 246, '한 번에 100만 토큰이 넘는 글을 읽고 다룰 수 있는 모델입니다.', { class: 'cw-sentence', 'text-anchor': 'middle' });
  const chips = spaced.map(({ index, width }) => {
    const node = svg('g', { class: `cw-chip ${palette[index % palette.length]}${halves.includes(index) ? ' half' : ''}` }, root);
    svg('rect', { x: -width / 2, y: -34, width, height: 64, rx: 12 }, node);
    const token = tokens[index];
    if (!halves.includes(index)) {
      const label = text(node, 0, 12, '', { 'text-anchor': 'middle' });
      if (token.startsWith(' ')) {
        svg('tspan', { class: 'cw-space' }, label).textContent = '␣';
      }
      svg('tspan', {}, label).textContent = token.trimStart();
    }
    return { node, index };
  });
  // '룰' 한 글자를 두 토큰에 걸쳐 쓴다.
  const split = svg('g', {}, root);
  const halfX = (spaced[halves[0]].x + spaced[halves[1]].x) / 2;
  text(split, halfX, spaced[halves[0]].y + 12, '룰', { class: 'cw-half-glyph', 'text-anchor': 'middle' });
  const bracket = svg('g', { class: 'cw-bracket' }, root);
  svg('path', { d: `M${halfX - 40} ${spaced[halves[0]].y + 44} L${halfX - 40} ${spaced[halves[0]].y + 54} L${halfX + 40} ${spaced[halves[0]].y + 54} L${halfX + 40} ${spaced[halves[0]].y + 44}` }, bracket);
  text(bracket, halfX, spaced[halves[0]].y + 82, '한 글자 = 토큰 2개', { 'text-anchor': 'middle' });

  const counter = text(root, 800, 440, '', { class: 'cw-counter', 'text-anchor': 'middle' });
  const source = text(root, 800, 478, 'OpenAI 토크나이저(o200k) 기준', { class: 'cw-note', 'text-anchor': 'middle' });

  // 왼쪽 아래: 이 영상 대본 한 편이 2.2만 토큰. 100만 토큰이면 46편 가까이.
  const script = svg('g', {}, root);
  text(script, 420, 560, '이 영상 대본 전체 ≈ 2.2만 토큰', { class: 'cw-heading', 'text-anchor': 'middle' });
  const page = { width: 34, height: 44, pitch: { x: 46, y: 56 }, columns: 12, left: 420 - (12 * 46 - 12) / 2, top: 590 };
  const pages = Array.from({ length: Math.ceil(copies) }, (_, i) => {
    const x = page.left + (i % page.columns) * page.pitch.x;
    const y = page.top + Math.floor(i / page.columns) * page.pitch.y;
    const node = svg('g', { class: `cw-page${i === 0 ? ' first' : ''}` }, script);
    // 마지막 한 편은 일부(0.7편)만 채운다.
    const fill = Math.min(1, copies - i);
    svg('rect', { class: 'cw-page-outline', x, y, width: page.width, height: page.height, rx: 4 }, node);
    svg('rect', { class: 'cw-page-fill', x, y: y + page.height * (1 - fill), width: page.width, height: page.height * fill, rx: 4 }, node);
    [10, 18, 26].forEach((dy) => svg('path', { class: 'cw-page-line', d: `M${x + 7} ${y + dy} L${x + page.width - 7} ${y + dy}` }, node));
    return node;
  });
  const copiesLabel = text(script, 420, 850, '100만 토큰 ≈ 이 영상 대본 약 46편', { class: 'cw-heading accent', 'text-anchor': 'middle' });

  // 오른쪽 아래: 한 번에 읽는 양(컨텍스트 창)이 늘어 온 길. 로그 눈금.
  const growth = svg('g', {}, root);
  text(growth, 1190, 560, '한 번에 읽는 토큰 수', { class: 'cw-heading', 'text-anchor': 'middle' });
  [1e3, 1e4, 1e5, 1e6].forEach((value) => {
    const y = chart.baseline - barHeight(value);
    svg('path', { class: 'cw-grid', d: `M${chart.left - 10} ${f(y)} L${chart.left + chart.pitch * models.length} ${f(y)}` }, growth);
    text(growth, chart.left - 18, y + 6, value === 1e6 ? '100만' : value === 1e5 ? '10만' : value === 1e4 ? '1만' : '1천', { class: 'cw-axis', 'text-anchor': 'end' });
  });
  const bars = models.map((model, i) => {
    const x = chart.left + chart.pitch * i + chart.pitch / 2;
    const node = svg('g', { class: `cw-bar${i === models.length - 1 ? ' latest' : ''}` }, growth);
    const rect = svg('rect', { x: x - chart.bar / 2, width: chart.bar, rx: 6 }, node);
    const value = text(node, x, 0, model.label, { class: 'cw-value', 'text-anchor': 'middle' });
    text(growth, x, chart.baseline + 30, model.name, { class: 'cw-model', 'text-anchor': 'middle' });
    text(growth, x, chart.baseline + 56, model.year, { class: 'cw-axis', 'text-anchor': 'middle' });
    return { node, rect, value, height: barHeight(model.value), at: at.chart + .2 + i * .32 };
  });

  return {
    element,
    title: '100만 토큰 컨텍스트 창',
    start,
    end,
    chapters: [
      { time: at.sentence, title: '토큰으로 쪼개기' },
      { time: at.script, title: '100만 토큰의 크기' },
      { time: at.chart, title: '늘어난 컨텍스트 창' },
    ],
    update: (time: number) => {
      const splitting = ease(progress(time, at.split, .6));
      setAttributes(sentence, { opacity: (appear(time, at.sentence, .3) * (1 - appear(time, at.split, .2))).toFixed(3) });
      chips.forEach(({ node, index }, k) => {
        const target = spaced[k];
        const x = lerp(packed[index], target.x, splitting);
        const y = lerp(246, target.y, splitting);
        setAttributes(node, { transform: `translate(${f(x)} ${f(y)})`, opacity: appear(time, at.split, .2).toFixed(3) });
        node.classList.toggle('boxed', time >= at.split + .1);
      });
      setAttributes(split, { opacity: appear(time, at.split + .4, .3).toFixed(3) });
      setAttributes(bracket, { opacity: appear(time, at.split + .9, .4).toFixed(3) });
      const counted = Math.round(tokens.length * ease(progress(time, at.split, .9)));
      const label = time < at.split ? '' : `토큰 ${counted}개`;
      if (counter.textContent !== label) {
        counter.textContent = label;
      }
      setAttributes(source, { opacity: appear(time, at.split + .6, .4).toFixed(3) });

      setAttributes(script, { opacity: appear(time, at.script, .4).toFixed(3) });
      pages.forEach((node, i) => {
        const shown = i === 0 ? appear(time, at.script + .2, .3) : appear(time, at.copies + (i / pages.length) * 1.5, .15);
        setAttributes(node, { opacity: shown.toFixed(3) });
      });
      setAttributes(copiesLabel, { opacity: appear(time, at.copies + 1.5, .4).toFixed(3) });

      setAttributes(growth, { opacity: appear(time, at.chart, .4).toFixed(3) });
      for (const bar of bars) {
        const height = bar.height * ease(progress(time, bar.at, .5));
        setAttributes(bar.rect, { y: f(chart.baseline - height), height: f(height) });
        setAttributes(bar.value, { y: f(chart.baseline - height - 12), opacity: appear(time, bar.at + .3, .3).toFixed(3) });
      }
    },
  };
};
