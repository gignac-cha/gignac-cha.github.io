import './transformer-everywhere.scss';
import { appear, createDiagram, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createDecoder, createEncoder, createPaper, crossPath } from './blueprint.ts';

// 38:32.4 "그런데 몇 년 사이에 이 구조는 모든 곳으로 퍼져 나갑니다" ~ 38:48.8 "ChatGPT의 T도 바로 이 트랜스포머의 머리글자예요".
const start = 2312.4;
const end = 2329.4;
const at = {
  spread: 2315,
  blueprint: 2316.8,
  llm: 2323.2,
  chatgpt: 2326.5,
  t: 2327.1,
  transformer: 2327.8,
  initial: 2328.6,
};

// 트랜스포머 위에 세워진 실제 모델(분야 · 모델 · 발표 연도). 말하는 순서대로 하나씩.
const cards = [
  { field: '번역', model: 'Transformer · 2017', at: 2318.9, side: -1, row: 0 },
  { field: '요약', model: 'PEGASUS · 2019', at: 2319.2, side: -1, row: 1 },
  { field: '검색', model: 'BERT, 구글 검색 · 2019', at: 2319.6, side: -1, row: 2 },
  { field: '그림', model: 'ViT · 2020', at: 2320.8, side: 1, row: 0 },
  { field: '소리', model: 'Whisper · 2022', at: 2321.2, side: 1, row: 1 },
  { field: '단백질', model: 'AlphaFold 2 · 2021', at: 2321.6, side: 1, row: 2 },
];
const models = ['GPT', 'Gemini', 'Claude', 'Llama', 'DeepSeek'];

const paper = { x: 470, y: 250, width: 660, height: 620 };
const tower = { encoderX: 640, decoderX: 960, baseY: 850, scale: .7 };
const card = { width: 320, height: 104, leftX: 80, rightX: 1200, rows: [330, 490, 650] };

export const createTransformerEverywhereScene = (): Scene => {
  const { element, root } = createDiagram('te', '트랜스포머의 확산');

  const links = cards.map(({ side, row }) => {
    const y = card.rows[row] + card.height / 2;
    const from = side < 0 ? paper.x : paper.x + paper.width;
    const to = side < 0 ? card.leftX + card.width : card.rightX;
    return svg('path', { class: 'te-link', d: `M${from} ${y} L${to} ${y}` }, root);
  });

  const sheet = svg('g', {}, root);
  createPaper(sheet, paper.x, paper.y, paper.width, paper.height);
  const ripple = svg('rect', { class: 'te-ripple', rx: 24 }, root);
  const drawing = svg('g', {}, sheet);
  const encoder = createEncoder(drawing);
  const decoder = createDecoder(drawing);
  setAttributes(encoder.group, { transform: `translate(${tower.encoderX} ${tower.baseY}) scale(${tower.scale})` });
  setAttributes(decoder.group, { transform: `translate(${tower.decoderX} ${tower.baseY}) scale(${tower.scale})` });
  svg('path', { class: 'bp-cross', d: crossPath(tower.encoderX, tower.decoderX, tower.baseY, tower.scale) }, drawing);
  const label = text(root, 800, 228, '만능 설계도 · Attention Is All You Need (2017)', { class: 'te-label', 'text-anchor': 'middle' });

  const cardGroups = cards.map(({ field, model, side, row }) => {
    const x = side < 0 ? card.leftX : card.rightX;
    const y = card.rows[row];
    const group = svg('g', { class: 'te-card' }, root);
    svg('rect', { x, y, width: card.width, height: card.height, rx: 16 }, group);
    text(group, x + 28, y + 46, field, { class: 'te-card-field' });
    text(group, x + 28, y + 80, model, { class: 'te-card-model' });
    return group;
  });

  // 오늘날의 거대 언어 모델들이 설계도 위에 선다.
  const modelChips = models.map((name, i) => {
    const x = 800 + (i - (models.length - 1) / 2) * 170;
    const group = svg('g', { class: 'te-model' }, root);
    svg('rect', { x: x - 74, y: 136, width: 148, height: 52, rx: 26 }, group);
    text(group, x, 170, name, { 'text-anchor': 'middle' });
    return group;
  });

  // ChatGPT 의 T = Transformer. 같은 글자를 겹쳐 두고 강조할 글자만 노랗게 덧칠해 서서히 켠다.
  const spelled = (y: number, parts: string[], highlight: number, className: string) => {
    const make = (overlay: boolean) => {
      const line = text(root, 800, y, '', { class: `${className}${overlay ? ' highlight' : ''}`, 'text-anchor': 'middle' });
      parts.forEach((part, i) => {
        const span = svg('tspan', overlay && i !== highlight ? { 'fill-opacity': 0 } : {}, line);
        span.textContent = part;
      });
      return line;
    };
    return { base: make(false), overlay: make(true) };
  };
  const name = spelled(178, ['Chat', 'G', 'P', 'T'], 3, 'te-chatgpt');
  const expansion = spelled(228, ['Generative ', 'Pre-trained ', 'Transformer'], 2, 'te-expansion');

  const update = (time: number) => {
    setAttributes(sheet, { opacity: appear(time, start, .6).toFixed(3) });
    // "모든 곳으로 퍼져 나갑니다": 설계도에서 바깥으로 물결이 번진다.
    const wave = progress(time, at.spread - .4, 1.4);
    const grow = wave * 120;
    setAttributes(ripple, {
      x: (paper.x - grow).toFixed(1), y: (paper.y - grow * .6).toFixed(1),
      width: (paper.width + grow * 2).toFixed(1), height: (paper.height + grow * 1.2).toFixed(1),
      opacity: (wave > 0 && wave < 1 ? (1 - wave) * .8 : 0).toFixed(3),
    });
    setAttributes(label, { opacity: (appear(time, at.blueprint, .5) * (1 - appear(time, at.chatgpt, .3))).toFixed(3) });

    // 거대 언어 모델 이야기에서 한 번, "머리글자"에서 한 번 더 물러난다.
    const later = (1 - .7 * appear(time, at.llm, .5)) * (1 - .8 * appear(time, at.initial, .5));
    cards.forEach(({ at: shownAt }, i) => {
      const shown = appear(time, shownAt, .4);
      setAttributes(cardGroups[i], { opacity: (shown * later).toFixed(3), transform: `translate(${((1 - shown) * cards[i].side * 30).toFixed(1)} 0)` });
      setAttributes(links[i], { opacity: (shown * later).toFixed(3), 'stroke-dashoffset': (-(time - shownAt) * 40).toFixed(1) });
    });

    modelChips.forEach((chip, i) => {
      const shown = appear(time, at.llm + i * .15, .4);
      setAttributes(chip, { opacity: (shown * (1 - appear(time, at.chatgpt - .2, .3))).toFixed(3), transform: `translate(0 ${((1 - shown) * -20).toFixed(1)})` });
    });

    setAttributes(name.base, { opacity: appear(time, at.chatgpt, .4).toFixed(3) });
    setAttributes(name.overlay, { opacity: appear(time, at.t, .3).toFixed(3) });
    setAttributes(expansion.base, { opacity: appear(time, at.transformer - .3, .4).toFixed(3) });
    setAttributes(expansion.overlay, { opacity: appear(time, at.transformer, .3).toFixed(3) });
  };

  return {
    element,
    update,
    title: '트랜스포머의 확산',
    start,
    end,
    chapters: [
      { time: start, title: '모든 곳으로 퍼진 구조' },
      { time: at.blueprint, title: '만능 설계도' },
      { time: cards[0].at, title: '번역에서 단백질까지' },
      { time: at.llm, title: '거대 언어 모델의 뼈대' },
      { time: at.chatgpt, title: 'ChatGPT의 T' },
    ],
  };
};
