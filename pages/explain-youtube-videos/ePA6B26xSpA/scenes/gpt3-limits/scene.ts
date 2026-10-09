import './gpt3-limits.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 49:59 "GPT-3는 똑똑했지만 이상한 구석이" ~ 50:19 "해로운 말을 아무렇지 않게 내뱉기도 했습니다".
const start = 2999.2;
const end = 3019.6;
const at = {
  ask: 3002.7,
  askEnd: 3003.5,
  instead: 3003.6,
  lines: [3004.2, 3004.8, 3005.4],
  learned: 3006.7,
  nextWord: 3007.2,
  nextWordEnd: 3008.8,
  assistant: 3010.8,
  far: 3011.3,
  machine: 3013.2,
  endless: 3012.9,
  wrong: 3015.8,
  harmful: 3017.2,
};

// OpenAI 가 InstructGPT 를 소개하며(2022년 1월) 공개한 실제 예시를 한국어로 옮겼다.
// 원문: "Explain the moon landing to a 6 year old in a few sentences." → GPT-3 는 비슷한 질문 네 줄을 이어 썼다.
const prompt = '6살 아이에게 달 착륙을 몇 문장으로 설명해 줘.';
const continuation = [
  '6살 아이에게 중력 이론을 설명해 줘.',
  '6살 아이에게 상대성 이론을 몇 문장으로 설명해 줘.',
  '6살 아이에게 빅뱅 이론을 설명해 줘.',
  '6살 아이에게 진화를 설명해 줘.',
];

// 글자 폭 어림값(한글 30, 그 밖 17).
const measure = (value: string) => [...value].reduce((sum, char) => sum + (/[가-힣]/.test(char) ? 30 : 17), 0);

const panel = { x: 110, y: 196, width: 960, height: 560 };
const lineY = (i: number) => panel.y + 84 + i * 62;

export const createGPT3LimitsScene = (): Scene => {
  const { element, root } = createDiagram('gpt3-limits', 'GPT-3의 한계');

  // 글 이어 쓰기 창.
  const editor = svg('g', {}, root);
  svg('rect', { x: panel.x, y: panel.y, width: panel.width, height: panel.height, rx: 22, class: 'g3-panel' }, editor);
  text(editor, panel.x + 32, panel.y + 40, 'GPT-3 · 2020', { class: 'g3-panel-label' });
  const clip = svg('clipPath', { id: 'g3-panel-clip' }, root);
  svg('rect', { x: panel.x, y: panel.y + 52, width: panel.width, height: panel.height - 60, rx: 22 }, clip);
  const scroller = svg('g', { 'clip-path': 'url(#g3-panel-clip)' }, editor);
  const content = svg('g', {}, scroller);
  const promptText = text(content, panel.x + 36, lineY(0), '', { class: 'g3-prompt' });
  const placeholder = text(content, panel.x + 36, lineY(1), '(대답이 올 자리)', { class: 'g3-placeholder' });
  // 이어 쓴 글은 단어마다 따로 둬서, 한 단어씩 나타나게 한다(놀이터 화면처럼 초록 바탕).
  const generated = continuation.map((line, i) => {
    const row = svg('g', {}, content);
    const words = line.split(' ');
    let x = panel.x + 36;
    const nodes = words.map((word, w) => {
      const width = measure(word);
      const group = svg('g', {}, row);
      // 바탕은 다음 단어까지 이어지게(띄어쓰기 포함) 그려 한 줄이 이어진 띠처럼 보인다.
      const bg = svg('rect', { x: x - 6, y: lineY(i + 1) - 32, width: width + (w < words.length - 1 ? 14 : 12), height: 44, class: 'g3-generated-bg' }, group);
      const label = text(group, x, lineY(i + 1), word, { class: 'g3-generated' });
      const box = svg('rect', { x: x - 7, y: lineY(i + 1) - 35, width: width + 14, height: 50, rx: 8, class: 'g3-next-box' }, group);
      const node = { group, bg, label, box, right: x + width, last: w === words.length - 1 };
      x += width + 14;
      return node;
    });
    return { row, nodes };
  });
  // "끝없이": 그 뒤로도 줄이 계속 이어진다(내용 대신 막대로).
  const endless = Array.from({ length: 6 }, (_, i) => svg('rect', { x: panel.x + 36, y: lineY(5 + i) - 22, width: 420 + ((i * 173) % 360), height: 22, rx: 11, class: 'g3-skeleton' }, content));
  const cursor = svg('rect', { width: 3, height: 36, class: 'g3-cursor' }, content);
  const source = text(root, panel.x + panel.width / 2, panel.y + panel.height + 44, 'OpenAI가 공개한 실제 예시(2022) · 한국어로 옮김', { class: 'g3-source' });

  // 배운 것: 다음 단어 맞히기.
  const learned = svg('g', {}, root);
  svg('rect', { x: 1120, y: 196, width: 380, height: 112, rx: 18, class: 'g3-card' }, learned);
  text(learned, 1310, 240, '배운 것', { class: 'g3-card-label' });
  text(learned, 1310, 282, '다음 단어 맞히기', { class: 'g3-card-text' });

  // 기대한 비서 ✕ / 실제로는 말 잇는 기계.
  const assistant = svg('g', {}, root);
  svg('rect', { x: 1120, y: 336, width: 380, height: 112, rx: 18, class: 'g3-card' }, assistant);
  text(assistant, 1310, 380, '기대한 것', { class: 'g3-card-label' });
  text(assistant, 1310, 422, '시키는 일을 하는 비서', { class: 'g3-card-text' });
  const strike = svg('line', { x1: 1160, y1: 414, x2: 1460, y2: 414, class: 'g3-strike' }, assistant);
  const machine = svg('g', {}, root);
  svg('rect', { x: 1120, y: 476, width: 380, height: 112, rx: 18, class: 'g3-card machine' }, machine);
  text(machine, 1310, 520, '실제 모습', { class: 'g3-card-label' });
  text(machine, 1310, 562, '말을 끝없이 잇는 기계', { class: 'g3-card-text' });

  const badges = [
    { label: '✕ 거침없이 틀린 말', at: at.wrong, y: 644 },
    { label: '⚠ 해로운 말', at: at.harmful, y: 724 },
  ].map(({ label, at: shownAt, y }) => {
    const group = svg('g', { class: 'g3-badge' }, root);
    svg('rect', { x: 1120, y: y - 34, width: 380, height: 60, rx: 30 }, group);
    text(group, 1310, y + 6, label);
    return { group, at: shownAt };
  });

  // 어림한 폭 대신 실제로 그려진 글자 폭으로 단어 자리를 다시 잡는다(장면이 그려진 뒤 한 번).
  let laidOut = false;
  const layout = () => {
    if (laidOut || !generated[0].nodes[0].label.getComputedTextLength()) {
      return;
    }
    laidOut = true;
    for (const { nodes } of generated) {
      let x = panel.x + 36;
      for (const node of nodes) {
        const width = node.label.getComputedTextLength();
        setAttributes(node.label, { x: x.toFixed(1) });
        setAttributes(node.bg, { x: (x - 6).toFixed(1), width: (width + (node.last ? 12 : 14)).toFixed(1) });
        setAttributes(node.box, { x: (x - 7).toFixed(1), width: (width + 14).toFixed(1) });
        node.right = x + width;
        x += width + 14;
      }
    }
  };

  const update = (time: number) => {
    layout();
    setAttributes(editor, { opacity: appear(time, start, .5).toFixed(3) });

    // 질문 입력.
    const typed = Math.round(progress(time, at.ask, at.askEnd - at.ask) * prompt.length);
    const shown = prompt.slice(0, typed);
    if (promptText.textContent !== shown) {
      promptText.textContent = shown;
    }
    setAttributes(placeholder, { opacity: (appear(time, at.instead - .3, .3) * (1 - appear(time, at.lines[0], .3)) * .8).toFixed(3) });

    // 이어 쓴 줄: 앞의 세 줄은 빠르게, 마지막 줄은 "다음 단어 맞히기"에 맞춰 한 단어씩 천천히.
    let last = { x: panel.x + 36, y: lineY(0) };
    generated.forEach(({ nodes }, i) => {
      const lineStart = i < 3 ? at.lines[i] : at.nextWord;
      const perWord = i < 3 ? .1 : (at.nextWordEnd - at.nextWord) / nodes.length;
      nodes.forEach(({ group, box, right }, w) => {
        const wordAt = lineStart + w * perWord;
        const shownWord = appear(time, wordAt, .12);
        setAttributes(group, { opacity: shownWord.toFixed(3) });
        const newest = i === 3 && time >= wordAt && time < wordAt + perWord && time < at.nextWordEnd;
        setAttributes(box, { opacity: newest ? 1 : 0 });
        // 커서는 단어가 반쯤 나타났을 때 그 뒤로 옮긴다(아직 안 보이는 단어 뒤에 먼저 가 있지 않게).
        if (shownWord >= .5) {
          last = { x: right + 6, y: lineY(i + 1) };
        }
      });
    });
    if (time < at.lines[0]) {
      const measured = shown ? promptText.getComputedTextLength() : 0;
      const typedWidth = !shown ? 0 : measured > 0 ? measured : measure(shown);
      last = { x: panel.x + 36 + typedWidth + 6, y: lineY(0) };
    }
    const blink = Math.floor(time * 2.4) % 2 === 0;
    setAttributes(cursor, { x: last.x.toFixed(1), y: (last.y - 29).toFixed(1), opacity: time >= at.ask && time < at.endless && blink ? 1 : 0 });

    // "끝없이": 막대 줄이 계속 생기며 창이 위로 밀린다.
    const scroll = ease(progress(time, at.endless, 1.8));
    setAttributes(content, { transform: `translate(0 ${(-scroll * 3 * 62).toFixed(1)})` });
    endless.forEach((bar, i) => setAttributes(bar, { opacity: (appear(time, at.endless + i * .3, .25) * .9).toFixed(3) }));
    setAttributes(source, { opacity: appear(time, at.lines[0] + .4, .5).toFixed(3) });

    setAttributes(learned, { opacity: appear(time, at.learned, .4).toFixed(3) });
    setAttributes(assistant, { opacity: (appear(time, at.assistant, .4) * lerp(1, .55, appear(time, at.far + .3, .4))).toFixed(3) });
    const struck = ease(progress(time, at.far, .4));
    setAttributes(strike, { x2: lerp(1160, 1460, struck).toFixed(1), opacity: struck > 0 ? 1 : 0 });
    setAttributes(machine, { opacity: appear(time, at.machine, .4).toFixed(3) });
    badges.forEach(({ group, at: shownAt }) => {
      const pop = appear(time, shownAt, .35);
      setAttributes(group, { opacity: pop.toFixed(3), transform: `translate(${lerp(30, 0, pop).toFixed(1)} 0)` });
    });
  };

  return {
    element,
    update,
    title: 'GPT-3의 한계',
    start,
    end,
    chapters: [
      { time: at.ask, title: '대답 대신 비슷한 질문' },
      { time: at.learned, title: '다음 단어 맞히기' },
      { time: at.assistant, title: '비서가 아닌 말 잇는 기계' },
      { time: at.wrong, title: '틀린 말 · 해로운 말' },
    ],
  };
};
