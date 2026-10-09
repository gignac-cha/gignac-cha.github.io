import './reasoning-model.scss';
import { appear, between, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { answer, chainOfThought, gpt4oAnswer, question, thoughtSeconds } from './cipher.ts';

// 55:41 "하지만 이 모든 모델에는 공통된 약점이" ~ 56:10 "성적이 크게 뛰었습니다".
// 대화와 풀이 과정은 OpenAI 가 o1 을 발표하며 공개한 실제 예시(cipher.ts), 성적은 같은 발표문의 수치다.
const start = 3341.367;
const end = 3370.0;
const at = {
  // "공통된 약점이 하나 있었습니다. 생각할 시간 없이 곧바로 대답을 내놓는다는 점"
  ask: 3342.1,
  instant: 3345.0,
  weakness: 3347.3,
  // "2024년 9월 오픈AI가 o1이라는 모델을 공개합니다"
  o1: 3350.4,
  name: 3352.3,
  // "이 모델은 대답하기 전에 먼저 생각을 했어요"
  send: 3354.3,
  think: 3355.5,
  // "화면에는 생각 중이라는 표시가 뜨고 몇 초, 길게는 몇십 초가 흘렀죠"
  indicator: 3357.2,
  long: 3359.9,
  // "그 사이 모델은 속으로 풀이 과정을 길게 써 내려갑니다"
  open: 3361.0,
  lines: 3363.2,
  // "틀린 길로 가면 스스로 돌아와서 다른 방법을 시도했어요"
  wrong: 3364.1,
  attempts: [3364.4, 3364.9, 3365.9],
  back: 3365.2,
  success: 3366.4,
  // "어려운 수학과 코딩 문제에서 성적이 크게 뛰었습니다"
  math: 3367.6,
  coding: 3368.0,
  jump: 3368.8,
};

const panels = [
  { x: 60, name: 'GPT-4o', date: '' },
  { x: 830, name: 'o1-preview', date: '2024년 9월' },
];
const panel = { y: 100, width: 710, height: 528 };

// GPT-4o 의 실제 대답 중 화면에 보일 줄(긴 줄은 나눔).
const instantLines = [
  gpt4oAnswer[0],
  '1. Example given:',
  '• Input: oyfjdnisdr rtqwainr acxz mynzbhhx',
  '• Output: Think step by step',
  'By examining the words:',
  '• The pattern involves selecting specific letters or transforming them.',
  '⋯',
  'However, to make a meaningful decoding, I would need more context',
  'about the transformations or letter shifting that might be involved.',
  'Could you provide any additional decoding rules or transformations',
  'used in this cipher?',
];

// 풀이 과정 상자. 실제 풀이 641줄을 빠르게 훑어 내려가다, 평균을 떠올리기 직전에서 멈춘다.
const cot = { x: panels[1].x + 24, y: panel.y + 222, width: panel.width - 48, height: 252, line: 19 };
const visible = Math.ceil(cot.height / cot.line) + 1;
const scrollTo = 136;

// 풀이 과정에서 실제로 시도한 방법 셋(cipher.ts 의 해당 줄).
const attempts = [
  { title: '한 글자씩 건너 읽기', work: 'o f d i d  →  Think ?', ok: false },
  { title: '두 글자를 더하기', work: 'o + y = 15 + 25 = 40  ≠  T(20)', ok: false },
  { title: '두 글자의 평균', work: '(15 + 25) / 2 = 20  →  T', ok: true },
];

// 발표문 수치: AIME 2024 평균 정답률(12% → 74%), Codeforces 백분위(11 → 89).
const scores = [
  { heading: '수학 경시대회(AIME 2024) 정답률', x: 60, unit: '%', values: [12, 74], at: at.math },
  { heading: '코딩 대회(Codeforces) 백분위', x: 830, unit: '', values: [11, 89], at: at.coding },
];
const bar = { label: 150, width: 470, rows: [726, 776] };

export const createReasoningModelScene = (): Scene => {
  const { element, root } = createDiagram('reasoning-model', '추론 모델(o1)');

  const panelViews = panels.map(({ x, name, date }) => {
    const group = svg('g', { opacity: 0 }, root);
    svg('rect', { x, y: panel.y, width: panel.width, height: panel.height, rx: 20, class: 'reasoning-model-panel' }, group);
    const nameView = text(group, x + 28, panel.y + 44, name, { class: 'reasoning-model-name' });
    const dateView = text(group, x + panel.width - 28, panel.y + 44, date, { class: 'reasoning-model-date' });
    const bubble = svg('g', { opacity: 0 }, group);
    svg('rect', { x: x + 96, y: panel.y + 66, width: panel.width - 120, height: 92, rx: 18, class: 'reasoning-model-bubble' }, bubble);
    question.forEach((line, i) => text(bubble, x + 118, panel.y + 96 + i * 25, line, { class: 'reasoning-model-mono' }));
    return { group, nameView, dateView, bubble };
  });

  // 왼쪽: GPT-4o 는 곧바로 대답한다.
  const left = panels[0].x;
  const instantBadge = svg('g', { opacity: 0 }, root);
  svg('rect', { x: left + 150, y: panel.y + 24, width: 170, height: 30, rx: 15, class: 'reasoning-model-badge' }, instantBadge);
  text(instantBadge, left + 235, panel.y + 45, '생각 없이 곧바로', { class: 'reasoning-model-badge-text' });
  const instantViews = instantLines.map((line, i) => text(root, left + 28, panel.y + 202 + i * 26, line, { class: 'reasoning-model-answer', opacity: 0 }));
  const weakness = svg('g', { opacity: 0 }, root);
  text(weakness, left + 28, panel.y + panel.height - 30, '✕  풀지 못하고 규칙을 되묻는다', { class: 'reasoning-model-fail' });

  // 오른쪽: o1 은 먼저 생각한다.
  const right = panels[1].x;
  const status = text(root, right + 28, panel.y + 198, '', { class: 'reasoning-model-status', opacity: 0 });
  const longNote = text(root, right + panel.width - 28, panel.y + 198, '어려운 문제는 몇십 초까지', { class: 'reasoning-model-long', opacity: 0 });
  const clip = svg('clipPath', { id: 'reasoning-model-cot-clip' }, root);
  const clipRect = svg('rect', { x: cot.x, y: cot.y, width: cot.width, height: 0, rx: 12 }, clip);
  const cotGroup = svg('g', { 'clip-path': 'url(#reasoning-model-cot-clip)' }, root);
  svg('rect', { x: cot.x, y: cot.y, width: cot.width, height: cot.height, rx: 12, class: 'reasoning-model-cot' }, cotGroup);
  const cotLines = Array.from({ length: visible }, () => text(cotGroup, cot.x + 18, 0, '', { class: 'reasoning-model-cot-text' }));
  const fadeTop = svg('rect', { x: cot.x, y: cot.y, width: cot.width, height: 40, class: 'reasoning-model-cot-fade-top' }, cotGroup);
  const fadeBottom = svg('rect', { x: cot.x, y: cot.y + cot.height - 40, width: cot.width, height: 40, class: 'reasoning-model-cot-fade-bottom' }, cotGroup);
  const lineCount = text(root, cot.x + cot.width - 14, cot.y + cot.height - 14, `풀이 과정 ${chainOfThought.length}줄`, { class: 'reasoning-model-count', opacity: 0 });
  // 그라데이션(위아래 가장자리를 흐리게): 상자 끝에서 진하고 안쪽으로 갈수록 투명하다.
  const defs = svg('defs', {}, root);
  [['reasoning-model-fade-top', 1, 0], ['reasoning-model-fade-bottom', 0, 1]].forEach(([id, from, to]) => {
    const gradient = svg('linearGradient', { id: String(id), x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#121318', 'stop-opacity': Number(from) }, gradient);
    svg('stop', { offset: 1, 'stop-color': '#121318', 'stop-opacity': Number(to) }, gradient);
  });
  setAttributes(fadeTop, { fill: 'url(#reasoning-model-fade-top)' });
  setAttributes(fadeBottom, { fill: 'url(#reasoning-model-fade-bottom)' });

  // 틀린 길 → 되돌아가 → 다른 방법.
  const attemptGroup = svg('g', { opacity: 0 }, root);
  svg('rect', { x: cot.x, y: cot.y, width: cot.width, height: cot.height, rx: 12, class: 'reasoning-model-attempts' }, attemptGroup);
  const attemptViews = attempts.map(({ title, work, ok }, i) => {
    const y = cot.y + 56 + i * 76;
    const group = svg('g', { opacity: 0 }, attemptGroup);
    text(group, cot.x + 24, y - 14, `${i + 1}. ${title}`, { class: 'reasoning-model-attempt-title' });
    text(group, cot.x + 24, y + 16, work, { class: 'reasoning-model-mono reasoning-model-attempt-work' });
    const mark = text(group, cot.x + cot.width - 30, y + 4, ok ? '✓' : '✕', { class: ok ? 'reasoning-model-mark ok' : 'reasoning-model-mark no', opacity: 0 });
    return { group, mark };
  });
  const backArrow = svg('g', { opacity: 0 }, attemptGroup);
  svg('path', { d: `M${cot.x + cot.width - 70} ${cot.y + 132} C ${cot.x + cot.width - 120} ${cot.y + 150}, ${cot.x + cot.width - 120} ${cot.y + 70}, ${cot.x + cot.width - 74} ${cot.y + 54}`, class: 'reasoning-model-back' }, backArrow);
  text(backArrow, cot.x + cot.width - 128, cot.y + 108, '되돌아감', { class: 'reasoning-model-back-text' });
  const final = svg('g', { opacity: 0 }, root);
  text(final, right + 28, panel.y + panel.height - 30, `✓  ${answer}`, { class: 'reasoning-model-success' });

  // 성적.
  const scoreGroup = svg('g', { opacity: 0 }, root);
  const scoreViews = scores.map(({ heading, x, unit, values }) => {
    text(scoreGroup, x, 688, heading, { class: 'reasoning-model-score-heading' });
    return values.map((value, i) => {
      const y = bar.rows[i];
      text(scoreGroup, x + bar.label - 18, y + 8, i === 0 ? 'GPT-4o' : 'o1', { class: 'reasoning-model-score-label' });
      svg('rect', { x: x + bar.label, y: y - 17, width: bar.width, height: 34, rx: 6, class: 'reasoning-model-score-track' }, scoreGroup);
      const fill = svg('rect', { x: x + bar.label, y: y - 17, height: 34, rx: 6, class: i === 0 ? 'reasoning-model-score-old' : 'reasoning-model-score-new' }, scoreGroup);
      const label = text(scoreGroup, x + bar.label, y + 9, `${value}${unit}`, { class: 'reasoning-model-score-value', opacity: 0 });
      return { fill, label, value };
    });
  });
  text(scoreGroup, 1540, 884, '출처: OpenAI, Learning to Reason with LLMs(2024.9)', { class: 'reasoning-model-source' });

  const update = (time: number) => {
    // 패널
    panelViews.forEach(({ group, bubble, dateView, nameView }, i) => {
      const shown = i === 0 ? appear(time, start, .4) : appear(time, at.o1, .5);
      setAttributes(group, { opacity: shown.toFixed(3) });
      setAttributes(bubble, { opacity: appear(time, i === 0 ? at.ask : at.send, .3).toFixed(3) });
      if (i === 1) {
        setAttributes(dateView, { opacity: appear(time, at.o1, .4).toFixed(3) });
        setAttributes(nameView, { opacity: appear(time, at.name, .4).toFixed(3) });
      }
    });

    // 왼쪽: 곧바로 쏟아지는 대답, 그리고 실패.
    setAttributes(instantBadge, { opacity: appear(time, at.instant, .3).toFixed(3) });
    instantViews.forEach((line, i) => setAttributes(line, { opacity: appear(time, at.instant + i * .2, .15).toFixed(3) }));
    setAttributes(weakness, { opacity: appear(time, at.weakness, .4).toFixed(3) });

    // 오른쪽: 생각 중 → N초 동안 생각함.
    const thinking = time - at.think;
    const done = thinking >= thoughtSeconds;
    status.textContent = time < at.think ? '' : done ? `${thoughtSeconds}초 동안 생각함` : `생각 중 · ${Math.max(1, Math.ceil(thinking))}초`;
    status.classList.toggle('active', !done);
    status.classList.toggle('glow', between(time, at.indicator, at.indicator + .8));
    const breathe = done ? 1 : .7 + .3 * Math.cos(thinking * Math.PI * 1.6);
    setAttributes(status, { opacity: (appear(time, at.think, .3) * breathe).toFixed(3) });
    setAttributes(longNote, { opacity: (appear(time, at.long, .3) * (1 - appear(time, at.open, .3))).toFixed(3) });

    // 속으로 써 내려간 풀이: 상자가 열리고 줄이 흘러 올라간다.
    const opened = appear(time, at.open, .5);
    setAttributes(clipRect, { height: (cot.height * opened).toFixed(1) });
    const scroll = ease(progress(time, at.open + .2, at.wrong - at.open - .2)) * scrollTo;
    const first = Math.floor(scroll);
    const offset = (scroll - first) * cot.line;
    cotLines.forEach((line, k) => {
      const index = first + k;
      const content = chainOfThought[index] ?? '';
      if (line.textContent !== content) {
        line.textContent = content;
      }
      setAttributes(line, { y: (cot.y + 26 + k * cot.line - offset).toFixed(1) });
    });
    setAttributes(lineCount, { opacity: (appear(time, at.lines, .3) * (1 - appear(time, at.wrong, .3))).toFixed(3) });

    // 시도 세 가지.
    setAttributes(attemptGroup, { opacity: appear(time, at.wrong, .3).toFixed(3) });
    // 틀린 방법은 다른 방법을 시도할 때 흐려진다.
    const retry = appear(time, at.attempts[2], .3);
    attemptViews.forEach(({ group, mark }, i) => {
      setAttributes(group, { opacity: (appear(time, at.attempts[i], .25) * (i < 2 ? lerp(1, .45, retry) : 1)).toFixed(3) });
      setAttributes(mark, { opacity: appear(time, i === 2 ? at.success : at.attempts[i] + .3, .2).toFixed(3) });
    });
    setAttributes(backArrow, { opacity: (appear(time, at.back, .3) * lerp(1, .45, retry)).toFixed(3) });
    setAttributes(final, { opacity: appear(time, at.success + .3, .4).toFixed(3) });

    // 성적이 크게 뛴다.
    setAttributes(scoreGroup, { opacity: appear(time, at.math - .2, .4).toFixed(3) });
    scoreViews.forEach((rows, s) => {
      rows.forEach(({ fill, label, value }, i) => {
        const grow = i === 0 ? appear(time, scores[s].at, .4) : appear(time, at.jump + s * .15, .7);
        const width = (value / 100) * bar.width * grow;
        setAttributes(fill, { width: width.toFixed(1) });
        setAttributes(label, { x: (scores[s].x + bar.label + width + 12).toFixed(1), opacity: clamp(grow * 2 - 1).toFixed(3) });
      });
    });
  };

  return {
    element,
    update,
    title: '추론 모델(o1)',
    start,
    end,
    chapters: [
      { time: start, title: '곧바로 대답하는 약점' },
      { time: at.o1, title: 'o1 공개' },
      { time: at.think, title: '대답 전에 생각 중' },
      { time: at.open, title: '속으로 쓰는 풀이 과정' },
      { time: at.wrong, title: '틀린 길에서 돌아와 다른 방법' },
      { time: at.math, title: '수학·코딩 성적이 크게 뜀' },
    ],
  };
};
