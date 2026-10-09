import './few-shot.scss';
import { appear, createDiagram, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';

// 44:02.0 "논문 제목은 '언어 모델은 퓨샷 학습자'였습니다" ~ 44:31.8 "…말로 부탁하기만 하면 됐어요".
// GPT-3 논문(OpenAI, 2020년 5월)이 보인 방식: 가중치는 그대로 두고, 프롬프트에 예시 몇 개(퓨샷)나 설명만(제로샷) 넣는다.
const start = 2642.0;
const end = 2671.8;
const at = {
  paper: 2642.0,
  define: 2644.9,
  apple: 2648.0,
  banana: 2649.1,
  examples: 2650.1,
  grape: 2651.9,
  stop: 2652.5,
  answer: 2653.2,
  frozen: 2655.4,
  zero: 2657.2,
  instruction: 2657.8,
  employee: 2659.9,
  samples: 2660.6,
  twoSheets: 2661.4,
  rest: 2663.4,
  bert: 2665.6,
  bertModels: 2666.6,
  tuned: 2667.9,
  now: 2669.6,
  ask: 2670.6,
};

const column = { word: 230, arrow: 440, answer: 492 };
const rows = { instruction: 300, example: [375, 445], query: 525, extra: [602, 668, 734] };
const extras = [
  { word: '수박', answer: 'watermelon', at: 2663.8 },
  { word: '딸기', answer: 'strawberry', at: 2664.3 },
  { word: '복숭아', answer: 'peach', at: 2664.8 },
];

const typed = (time: number, at: number, word: string, duration = .3) => word.slice(0, Math.round(word.length * progress(time, at, duration)));

const setText = (element: SVGTextElement, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

const pair = (parent: SVGElement, y: number, word: string, answer: string, size: 'main' | 'extra' = 'main') => {
  const group = svg('g', { class: `fs-pair ${size}` }, parent);
  // 예시 줄만 '샘플 서류'로 테두리를 보인다(update에서).
  const sheet = svg('rect', { class: 'fs-sheet', x: column.word - 26, y: y - 46, width: 450, height: 64, rx: 10, opacity: 0 }, group);
  text(group, column.word, y, word, { class: 'fs-word' });
  text(group, column.arrow, y, '→', { class: 'fs-arrow' });
  const answerText = text(group, column.answer, y, answer, { class: 'fs-answer' });
  return { group, sheet, answerText };
};

const modelBox = (parent: SVGElement, x: number, y: number, width: number, height: number, name: string, note?: string) => {
  const group = svg('g', { class: 'fs-model' }, parent);
  svg('rect', { x: x - width / 2, y: y - height / 2, width, height, rx: 20 }, group);
  text(group, x, y + (note ? 2 : 14), name, { class: 'fs-model-name' });
  if (note) {
    text(group, x, y + 40, note, { class: 'fs-model-note' });
  }
  return group;
};

export const createFewShotScene = (): Scene => {
  const { element, root } = createDiagram('fs', '퓨샷 학습');

  const paper = svg('g', { class: 'fs-paper' }, root);
  svg('rect', { class: 'fs-card', x: 360, y: 300, width: 880, height: 200, rx: 22 }, paper);
  text(paper, 800, 384, 'Language Models are Few-Shot Learners', { class: 'fs-paper-title' });
  text(paper, 800, 440, '언어 모델은 퓨샷 학습자다 · OpenAI · 2020년 5월', { class: 'fs-paper-meta' });

  const prompt = svg('g', {}, root);
  const define = text(prompt, 800, 150, '퓨샷 = 예시 몇 개만 보고 요령 익히기', { class: 'fs-define' });
  svg('rect', { class: 'fs-card', x: 160, y: 190, width: 740, height: 600, rx: 22 }, prompt);
  const mode = createSwapText(prompt, 200, 244, { class: 'fs-mode' });
  const instruction = text(prompt, column.word, rows.instruction, '영어로 번역하세요:', { class: 'fs-instruction' });
  const examples = [pair(prompt, rows.example[0], '사과', 'apple'), pair(prompt, rows.example[1], '바나나', 'banana')];
  const sampleTag = svg('g', { class: 'fs-sample-tag' }, prompt);
  // 두 예시 줄의 오른쪽, 두 줄 사이 높이에 붙인다(테두리와 겹치지 않게).
  svg('rect', { x: 690, y: 374, width: 170, height: 44, rx: 22 }, sampleTag);
  text(sampleTag, 775, 404, '샘플 2장', {});
  const query = pair(prompt, rows.query, '포도', '');
  const cursor = svg('rect', { class: 'fs-cursor', x: column.answer, y: rows.query - 34, width: 4, height: 40 }, prompt);
  const extraPairs = extras.map((extra, i) => ({ ...extra, ...pair(prompt, rows.extra[i], extra.word, '', 'extra') }));

  const model = modelBox(prompt, 1260, 430, 340, 190, 'GPT-3', '매개변수 1,750억');
  const sendArrow = svg('path', { class: 'fs-flow', d: 'M906 500 C980 500, 1000 440, 1084 436', pathLength: 1 }, prompt);
  const returnArrow = svg('path', { class: 'fs-flow answer', d: 'M1180 528 C1120 600, 980 560, 906 530', pathLength: 1 }, prompt);
  const lock = svg('g', { class: 'fs-lock', transform: 'translate(1420 344)' }, prompt);
  svg('circle', { r: 30 }, lock);
  svg('rect', { x: -12, y: -4, width: 24, height: 18, rx: 3 }, lock);
  svg('path', { d: 'M-7 -4 v-6 a7 7 0 0 1 14 0 v6' }, lock);
  const frozenLabel = text(prompt, 1240, 300, '미세 조정 없이 · 가중치 그대로', { class: 'fs-frozen' });

  // BERT 시절: 일마다 따로 다듬은 모델 / GPT-3: 모델 하나에 말로 부탁.
  const compare = svg('g', {}, root);
  const bert = svg('g', {}, compare);
  text(bert, 440, 210, 'BERT 시절', { class: 'fs-compare-title' });
  const tasks = ['감정 분류', '질문 답변', '문장 관계'].map((task, i) => {
    const group = svg('g', {}, bert);
    modelBox(group, 400, 340 + i * 140, 360, 100, 'BERT');
    text(group, 400, 340 + i * 140 - 64, task, { class: 'fs-task' });
    const badge = svg('g', { class: 'fs-tuned', transform: `translate(640 ${340 + i * 140})` }, group);
    svg('rect', { x: -6, y: -22, width: 128, height: 44, rx: 22 }, badge);
    text(badge, 58, 8, '미세 조정', {});
    return { group, badge };
  });
  const bertNote = text(bert, 440, 760, '일마다 모델을 따로 다듬기', { class: 'fs-compare-note' });
  const gpt = svg('g', {}, compare);
  text(gpt, 1170, 210, '이제는', { class: 'fs-compare-title' });
  modelBox(gpt, 1170, 590, 360, 150, 'GPT-3', '모델 하나');
  const asks = ['영어로 번역해 줘', '이 글을 세 줄로 요약해 줘', '이 질문에 답해 줘'].map((ask, i) => {
    const bubble = svg('g', { class: 'fs-ask', transform: `translate(1170 ${290 + i * 70})` }, gpt);
    svg('rect', { x: -200, y: -26, width: 400, height: 52, rx: 26 }, bubble);
    text(bubble, 0, 9, ask, {});
    return bubble;
  });
  const gptNote = text(gpt, 1170, 760, '말로 부탁하기만', { class: 'fs-compare-note good' });

  const update = (time: number) => {
    setAttributes(paper, { opacity: (appear(time, at.paper, .4) * (1 - appear(time, at.define, .4))).toFixed(3) });
    setAttributes(prompt, { opacity: (appear(time, at.define + .2, .4) * (1 - appear(time, at.bert, .4))).toFixed(3) });
    setAttributes(define, { opacity: appear(time, at.define + .4, .4).toFixed(3) });

    const zero = time >= at.zero && time < at.samples;
    mode.update(time, (t) => (t >= at.zero && t < at.samples ? '제로샷 · 설명만' : '퓨샷 · 예시 2개'));
    mode.toggleClass('zero', zero);
    const examplesFaded = appear(time, at.zero, .4) * (1 - appear(time, at.samples, .4));
    setAttributes(instruction, { opacity: (appear(time, at.instruction, .4) * (1 - appear(time, at.samples, .4))).toFixed(3) });
    examples.forEach(({ group, sheet }, i) => {
      const shown = appear(time, i ? at.banana : at.apple, .35);
      setAttributes(group, { opacity: (shown * (1 - .85 * examplesFaded)).toFixed(3) });
      setAttributes(sheet, { opacity: appear(time, at.twoSheets + i * .15, .3).toFixed(3) });
    });
    setAttributes(sampleTag, { opacity: appear(time, at.twoSheets + .2, .3).toFixed(3) });

    setAttributes(query.group, { opacity: appear(time, at.grape, .35).toFixed(3) });
    setText(query.answerText, typed(time, at.answer, 'grape'));
    query.group.classList.toggle('answered', time >= at.answer);
    const waiting = time >= at.stop && time < at.answer;
    setAttributes(cursor, { opacity: waiting ? (Math.sin((time - at.stop) * Math.PI * 4) > -.2 ? 1 : 0) : 0 });
    extraPairs.forEach(({ group, answerText, answer, at: when }) => {
      setAttributes(group, { opacity: appear(time, when - .3, .25).toFixed(3) });
      setText(answerText, typed(time, when, answer, .25));
    });

    setAttributes(model, { opacity: appear(time, at.grape, .4).toFixed(3) });
    setAttributes(sendArrow, { 'stroke-dashoffset': (1 - progress(time, at.stop, .35)).toFixed(3) });
    setAttributes(returnArrow, { 'stroke-dashoffset': (1 - progress(time, at.answer - .2, .3)).toFixed(3) });
    setAttributes(lock, { opacity: appear(time, at.frozen, .35).toFixed(3) });
    setAttributes(frozenLabel, { opacity: appear(time, at.frozen + .2, .35).toFixed(3) });

    setAttributes(compare, { opacity: appear(time, at.bert, .4).toFixed(3) });
    setAttributes(bert, { opacity: (1 - .55 * appear(time, at.now, .5)).toFixed(3) });
    tasks.forEach(({ group, badge }, i) => {
      setAttributes(group, { opacity: appear(time, at.bertModels + i * .4, .35).toFixed(3) });
      setAttributes(badge, { opacity: appear(time, at.tuned + i * .12, .3).toFixed(3) });
    });
    setAttributes(bertNote, { opacity: appear(time, at.tuned + .3, .4).toFixed(3) });
    setAttributes(gpt, { opacity: appear(time, at.now, .4).toFixed(3) });
    asks.forEach((bubble, i) => setAttributes(bubble, { opacity: appear(time, at.ask + i * .25, .3).toFixed(3) }));
    setAttributes(gptNote, { opacity: appear(time, at.ask + .6, .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: '퓨샷 학습',
    start,
    end,
    chapters: [
      { time: start, title: '언어 모델은 퓨샷 학습자' },
      { time: at.apple, title: '예시 두어 줄' },
      { time: at.answer, title: '알아서 grape' },
      { time: at.zero, title: '설명만 줘도(제로샷)' },
      { time: at.employee, title: '샘플 서류 두 장' },
      { time: at.bert, title: '일마다 다듬기 vs 말로 부탁' },
    ],
  };
};
