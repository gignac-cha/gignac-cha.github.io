import './bert.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 40:44.8 "제이콥이 이끈 팀이 버트를 내놓았거든요" ~ 41:25.2 "일단 버트부터 써 보라는 말이 돌았죠".
// 점수는 BERT 논문 초록 그대로: GLUE 80.5(+7.7), MultiNLI 86.7(+4.6), SQuAD v1.1 F1 93.2(+1.5), SQuAD v2.0 F1 83.1(+5.1).
// 11개 과제에서 최고 기록. 이름은 Bidirectional Encoder Representations from Transformers.
const start = 2444.8;
const end = 2485.4;
const at = {
  acronym: 2446.9,
  nextWord: 2453.6,
  notThat: 2454.1,
  blank: 2454.4,
  sentence: 2455.6,
  cover: 2456.9,
  guess: 2457.5,
  test: 2458.7,
  context: 2462.2,
  before: 2463.2,
  after: 2463.5,
  both: 2465.9,
  reveal: 2466.5,
  gpt: 2467.4,
  leftToRight: 2468,
  bert: 2470.2,
  whole: 2471,
  results: 2473.7,
  rows: [2475.8, 2476.4, 2476.9, 2477.2],
  record: 2480.2,
  advice: 2482.9,
};
const parts = { card: [start, at.nextWord - .3], masked: [at.nextWord - .1, at.gpt - .2], compare: [at.gpt, at.results - .2], results: [at.results, end + 1] };

// 영어 시험식 빈칸 문제(예문). 가린 단어는 원래 문장 속 단어이고, 앞뒤 문맥을 다 봐야 풀린다.
const tokens = ['I', 'went', 'to', 'the', 'bakery', 'to', 'buy', 'some', 'bread.'];
const masked = 4;
const tokenWidth = (word: string) => (word.length * 25 + 18);
const tokenGap = 16;
const layout = (words: string[], centerX: number, widthOf = tokenWidth, maskedWidth = 190) => {
  const widths = words.map((word, i) => (i === masked ? maskedWidth : widthOf(word)));
  const total = widths.reduce((sum, width) => sum + width, 0) + tokenGap * (words.length - 1);
  return widths.map((width, i) => centerX - total / 2 + widths.slice(0, i).reduce((sum, w) => sum + w, 0) + tokenGap * i + width / 2);
};
const sentenceX = layout(tokens, 800);
const sentenceY = 470;

const records = [
  { label: '언어 이해 종합', bench: 'GLUE', previous: 72.8, bert: 80.5 },
  { label: '추론', bench: 'MultiNLI', previous: 82.1, bert: 86.7 },
  { label: '질문 답변', bench: 'SQuAD v1.1 F1', previous: 91.7, bert: 93.2 },
  { label: '질문 답변', bench: 'SQuAD v2.0 F1', previous: 78, bert: 83.1 },
];
const board = { x: 520, width: 760, y: 300, step: 100 };

const shown = (time: number, [from, to]: number[]) => appear(time, from, .4) * (1 - appear(time, to, .4));

const createCard = (root: SVGElement) => {
  const group = svg('g', {}, root);
  text(group, 800, 380, 'BERT', { class: 'bert-name', 'text-anchor': 'middle' });
  text(group, 800, 440, '구글 · 2018년 10월', { class: 'bert-sub', 'text-anchor': 'middle' });
  const acronym = text(group, 800, 540, '', { class: 'bert-acronym', 'text-anchor': 'middle' });
  ['Bidirectional', ' Encoder', ' Representations from', ' Transformers'].forEach((part, i) => {
    const span = svg('tspan', { class: i === 0 ? 'key' : '' }, acronym);
    span.textContent = part;
  });
  text(group, 800, 590, '트랜스포머의 읽는 쪽(인코더)을 키운 모델', { class: 'bert-sub', 'text-anchor': 'middle' });
  const rest = group.lastElementChild as SVGTextElement;
  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.card).toFixed(3) });
    setAttributes(acronym, { opacity: appear(time, at.acronym, .5).toFixed(3) });
    setAttributes(rest, { opacity: appear(time, at.acronym + .6, .5).toFixed(3) });
  };
};

const createMasked = (root: SVGElement) => {
  const group = svg('g', {}, root);
  // "다음 단어가 아니라": GPT 식 문제는 지운다.
  const nextWord = svg('g', { class: 'bert-next' }, group);
  text(nextWord, 800, 236, 'I went to the  ___ →   다음 단어 맞히기', { class: 'bert-next-text', 'text-anchor': 'middle' });
  const strike = svg('path', { class: 'bert-strike', d: 'M520 226 L1080 226', pathLength: 1 }, nextWord);

  const test = svg('g', { class: 'bert-test' }, group);
  svg('rect', { x: 150, y: 300, width: 1300, height: 290, rx: 20 }, test);
  text(test, 190, 356, 'Q. 빈칸에 들어갈 알맞은 말은?', { class: 'bert-test-title' });
  const heading = text(group, 800, 236, '빈칸 맞히기', { class: 'bert-heading', 'text-anchor': 'middle' });

  const words = tokens.map((word, i) => text(group, sentenceX[i], sentenceY, word, { class: `bert-token${i === masked ? ' hidden-word' : ''}`, 'text-anchor': 'middle' }));
  const mask = svg('g', { class: 'bert-mask' }, group);
  svg('rect', { x: sentenceX[masked] - 95, y: sentenceY - 46, width: 190, height: 64, rx: 12 }, mask);
  const maskLabel = text(mask, sentenceX[masked], sentenceY - 2, '[MASK]', { class: 'bert-mask-label', 'text-anchor': 'middle' });
  const question = text(mask, sentenceX[masked], sentenceY - 2, '?', { class: 'bert-mask-question', 'text-anchor': 'middle' });

  // 앞 문맥과 뒤 문맥에서 빈칸으로 모이는 화살표.
  const arrow = (from: number, to: number, label: string) => {
    const arc = svg('g', { class: 'bert-context' }, group);
    const x1 = (sentenceX[from] + sentenceX[to]) / 2;
    const x2 = sentenceX[masked] + (from < masked ? -40 : 40);
    // 화살표는 괄호에서 빈칸 쪽 끝에서 출발해, 괄호 가운데 아래의 글자를 지나지 않는다.
    const x0 = from < masked ? sentenceX[to] + 30 : sentenceX[from] - 30;
    svg('path', { class: 'bert-bracket', d: `M${sentenceX[from] - 30} ${sentenceY + 34} L${sentenceX[from] - 30} ${sentenceY + 50} L${sentenceX[to] + 30} ${sentenceY + 50} L${sentenceX[to] + 30} ${sentenceY + 34}` }, arc);
    svg('path', { class: 'bert-arrow', d: `M${x0} ${sentenceY + 50} Q${(x0 + x2) / 2} ${sentenceY + 100} ${x2} ${sentenceY + 40}`, pathLength: 1 }, arc);
    text(arc, x1, sentenceY + 96, label, { class: 'bert-context-label', 'text-anchor': 'middle' });
    return arc;
  };
  const before = arrow(0, 3, '앞 문맥');
  const after = arrow(5, 8, '뒤 문맥');
  const both = text(group, 800, 690, '양방향으로 읽는다 · Bidirectional', { class: 'bert-both', 'text-anchor': 'middle' });

  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.masked).toFixed(3) });
    setAttributes(nextWord, { opacity: (appear(time, at.nextWord, .3) * (1 - appear(time, at.blank, .4))).toFixed(3) });
    setAttributes(strike, { 'stroke-dashoffset': (1 - ease(progress(time, at.notThat, .3))).toFixed(3) });
    setAttributes(heading, { opacity: appear(time, at.blank + .2, .4).toFixed(3) });
    setAttributes(test, { opacity: appear(time, at.test, .5).toFixed(3) });

    // 문장 전체가 나온 뒤 "가려" 에서 가운데 단어 위로 가림막이 덮인다.
    const sentence = appear(time, at.sentence, .5);
    words.forEach((word, i) => setAttributes(word, { opacity: (i === masked ? sentence * (1 - appear(time, at.cover, .3)) : sentence).toFixed(3) }));
    const cover = appear(time, at.cover, .4);
    const revealed = appear(time, at.reveal, .4);
    setAttributes(mask, { opacity: (cover * (1 - revealed)).toFixed(3), transform: `translate(0 ${((1 - cover) * -30).toFixed(1)})` });
    setAttributes(maskLabel, { opacity: (1 - appear(time, at.guess, .3)).toFixed(3) });
    setAttributes(question, { opacity: appear(time, at.guess, .3).toFixed(3) });
    // 풀이: 앞뒤를 다 보고 나면 원래 단어가 초록으로 돌아온다.
    if (time >= at.reveal) {
      setAttributes(words[masked], { opacity: revealed.toFixed(3) });
    }
    words[masked].classList.toggle('answer', time >= at.reveal);

    for (const [arc, arcAt] of [[before, at.before], [after, at.after]] as const) {
      setAttributes(arc, { opacity: appear(time, arcAt, .3).toFixed(3) });
      setAttributes(arc.querySelector('.bert-arrow')!, { 'stroke-dashoffset': (1 - ease(progress(time, arcAt, .5))).toFixed(3) });
    }
    setAttributes(both, { opacity: appear(time, at.both, .4).toFixed(3) });
  };
};

// 같은 문장의 같은 빈칸(?)을 두 모델이 맞힐 때 볼 수 있는 단어를 선으로 잇는다.
// GPT 는 왼쪽부터 읽어 오다 빈칸에서 멈추므로 앞 단어만, BERT 는 문장 전체를 한 번에 보므로 앞뒤 단어 전부.
const createCompare = (root: SVGElement) => {
  const group = svg('g', {}, root);
  const cellWidth = (word: string, i: number) => (i === masked ? 96 : word.length * 20 + 14);
  const rowX = layout(tokens, 560, (word) => word.length * 20 + 14, 96);
  const bounds = tokens.map((word, i) => ({ left: rowX[i] - cellWidth(word, i) / 2, right: rowX[i] + cellWidth(word, i) / 2 }));
  const before = tokens.map((_, i) => i).filter((i) => i < masked);
  const after = tokens.map((_, i) => i).filter((i) => i > masked);
  const row = (y: number, name: string, note: string, className: string, seen: number[], verdict: string) => {
    const container = svg('g', { class: `bert-row ${className}` }, group);
    text(container, 110, y - 70, name, { class: 'bert-row-name' });
    text(container, 110 + name.length * 28 + 20, y - 70, note, { class: 'bert-row-note' });
    // 빈칸 아래에서 보이는 단어 아래로 휘어 내려가는 선(멀수록 깊게).
    const links = seen.map((i) => {
      const from = rowX[masked];
      const to = rowX[i];
      const depth = 30 + Math.abs(to - from) * .2;
      return svg('path', { class: 'bert-link', d: `M${from} ${y + 24} C${from} ${y + 24 + depth} ${to} ${y + 24 + depth} ${to} ${y + 24}`, pathLength: 1 }, container);
    });
    const cells = tokens.map((word, i) => {
      const cell = svg('g', { class: `bert-cell${i === masked ? ' blank' : ''}` }, container);
      svg('rect', { x: bounds[i].left, y: y - 30, width: cellWidth(word, i), height: 52, rx: 10 }, cell);
      text(cell, rowX[i], y + (i === masked ? 10 : 6), i === masked ? '?' : word, { 'text-anchor': 'middle' });
      return cell;
    });
    const label = text(container, 1060, y + 8, verdict, { class: 'bert-verdict' });
    return { container, cells, links, label };
  };
  const gpt = row(380, 'GPT', '왼쪽에서 오른쪽으로 읽는 이야기꾼', 'gpt', before, '빈칸 앞 4단어만 보고 맞힌다');
  const bert = row(660, 'BERT', '문장 전체를 한눈에 훑는 독해 선수', 'bert', [...before, ...after], '빈칸 앞뒤 8단어를 다 보고 맞힌다');
  const unseen = text(gpt.container, (bounds[after[0]].left + bounds[after[after.length - 1]].right) / 2, 380 + 66, '아직 읽지 않은 뒤 문맥', { class: 'bert-unseen', 'text-anchor': 'middle' });
  const cursor = svg('path', { class: 'bert-cursor', d: 'M0 -40 L0 34' }, gpt.container);
  // GPT 가 빈칸까지 읽는 시간: "왼쪽에서 오른쪽으로 읽는" 동안 한 단어씩.
  const readFor = 1.1;
  const reachBlank = at.leftToRight + readFor;

  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.compare).toFixed(3) });

    setAttributes(gpt.container, { opacity: appear(time, at.gpt, .4).toFixed(3) });
    const reading = clamp((time - at.leftToRight) / readFor) * before.length;
    gpt.cells.forEach((cell, i) => {
      const lit = i < masked ? clamp(reading - i) : i === masked ? appear(time, reachBlank, .25) : 0;
      setAttributes(cell, { opacity: lerp(.25, 1, lit).toFixed(3) });
    });
    // 커서는 한 단어씩 건너가다 빈칸 앞에서 멈춘다.
    const cursorX = bounds[Math.min(Math.floor(reading), masked)].left - 8;
    setAttributes(cursor, { transform: `translate(${cursorX.toFixed(1)} 380)`, opacity: (appear(time, at.leftToRight, .2) * (1 - appear(time, at.bert, .3))).toFixed(3) });
    // 빈칸에 닿으면 가까운 앞 단어부터 차례로 이어진다.
    gpt.links.forEach((link, k) => {
      const order = before.length - 1 - k;
      setAttributes(link, { 'stroke-dashoffset': (1 - ease(progress(time, reachBlank + .1 + order * .1, .4))).toFixed(3) });
    });
    setAttributes(unseen, { opacity: appear(time, reachBlank + .3, .4).toFixed(3) });
    setAttributes(gpt.label, { opacity: appear(time, reachBlank + .5, .4).toFixed(3) });

    setAttributes(bert.container, { opacity: appear(time, at.bert, .4).toFixed(3) });
    // BERT: "문장 전체를" 에서 모든 단어가 한꺼번에 켜지고, 빈칸이 앞뒤 단어와 동시에 이어진다.
    const whole = appear(time, at.whole, .4);
    bert.cells.forEach((cell) => setAttributes(cell, { opacity: lerp(.25, 1, whole).toFixed(3) }));
    bert.links.forEach((link) => setAttributes(link, { 'stroke-dashoffset': (1 - ease(progress(time, at.whole + .2, .6))).toFixed(3) }));
    setAttributes(bert.label, { opacity: appear(time, at.whole + .6, .4).toFixed(3) });
  };
};

const createResults = (root: SVGElement) => {
  const group = svg('g', {}, root);
  text(group, 800, 220, 'BERT가 한꺼번에 갈아치운 기록', { class: 'bert-heading', 'text-anchor': 'middle' });
  const scale = board.width / 100;
  const rows = records.map((record, i) => {
    const y = board.y + i * board.step;
    const row = svg('g', {}, group);
    text(row, board.x - 24, y + 4, record.label, { class: 'bert-record-label', 'text-anchor': 'end' });
    text(row, board.x - 24, y + 34, record.bench, { class: 'bert-record-bench', 'text-anchor': 'end' });
    svg('rect', { class: 'bert-track', x: board.x, y: y - 16, width: board.width, height: 40, rx: 8 }, row);
    const bertBar = svg('rect', { class: 'bert-bar bert', x: board.x, y: y - 16, height: 40, rx: 8, width: 0 }, row);
    const previousBar = svg('rect', { class: 'bert-bar previous', x: board.x, y: y - 16, height: 40, rx: 8, width: 0 }, row);
    const previousValue = text(row, board.x + record.previous * scale - 12, y + 13, `${record.previous.toFixed(1)}`, { class: 'bert-record-value', 'text-anchor': 'end' });
    const bertValue = text(row, board.x + record.bert * scale + 14, y + 13, `${record.bert.toFixed(1)}  +${(record.bert - record.previous).toFixed(1)}`, { class: 'bert-record-value bert' });
    return { row, record, bertBar, previousBar, previousValue, bertValue };
  });
  const legend = svg('g', {}, group);
  svg('rect', { class: 'bert-bar previous', x: board.x, y: 690, width: 24, height: 24, rx: 4 }, legend);
  text(legend, board.x + 36, 710, '이전 최고 기록', { class: 'bert-legend' });
  svg('rect', { class: 'bert-bar bert', x: board.x + 230, y: 690, width: 24, height: 24, rx: 4 }, legend);
  text(legend, board.x + 266, 710, 'BERT', { class: 'bert-legend' });
  const eleven = text(group, 800, 776, '11개 과제에서 최고 기록', { class: 'bert-eleven', 'text-anchor': 'middle' });
  const advice = svg('g', { class: 'bert-advice' }, group);
  svg('rect', { x: 560, y: 806, width: 480, height: 64, rx: 32 }, advice);
  text(advice, 800, 848, '"일단 BERT부터 써 봐"', { 'text-anchor': 'middle' });

  return (time: number) => {
    setAttributes(group, { opacity: shown(time, parts.results).toFixed(3) });
    rows.forEach(({ row, record, bertBar, previousBar, previousValue, bertValue }, i) => {
      const rowShown = appear(time, at.rows[i], .4);
      setAttributes(row, { opacity: rowShown.toFixed(3) });
      setAttributes(previousBar, { width: (record.previous * scale * ease(progress(time, at.rows[i], .7))).toFixed(1) });
      setAttributes(previousValue, { opacity: appear(time, at.rows[i] + .5, .3).toFixed(3) });
      // "한꺼번에 갈아치웁니다": 네 막대가 같은 순간 기존 기록을 넘어선다.
      const beat = ease(progress(time, at.record, .8));
      setAttributes(bertBar, { width: (lerp(record.previous, record.bert, beat) * scale * (beat > 0 ? 1 : 0)).toFixed(1) });
      setAttributes(bertValue, { opacity: appear(time, at.record + .6, .3).toFixed(3) });
    });
    setAttributes(legend, { opacity: appear(time, at.rows[0], .4).toFixed(3) });
    setAttributes(eleven, { opacity: appear(time, at.record + .9, .4).toFixed(3) });
    setAttributes(advice, { opacity: appear(time, at.advice, .4).toFixed(3) });
  };
};

export const createBERTScene = (): Scene => {
  const { element, root } = createDiagram('bert', '빈칸 맞히기(BERT)');
  const renders = [createCard(root), createMasked(root), createCompare(root), createResults(root)];
  return {
    element,
    update: (time: number) => renders.forEach((render) => render(time)),
    title: '빈칸 맞히기(BERT)',
    start,
    end,
    chapters: [
      { time: start, title: '구글의 BERT' },
      { time: at.blank, title: '다음 단어 대신 빈칸' },
      { time: at.context, title: '앞뒤 문맥을 다 보기' },
      { time: at.gpt, title: '이야기꾼과 독해 선수' },
      { time: at.results, title: '한꺼번에 갈아치운 기록' },
    ],
  };
};
