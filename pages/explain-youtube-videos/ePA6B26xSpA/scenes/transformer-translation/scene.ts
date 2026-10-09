import './transformer-translation.scss';
import { appear, createDiagram, ease, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 37:56.6 "처음 시험 무대는 번역이었습니다" ~ 38:12.6 "빠르면서 더 잘하는 흔치 않은 조합이었죠".
// 숫자는 논문 "Attention Is All You Need" 표 2 그대로다(WMT 2014, BLEU 와 학습 계산량 FLOPs).
const start = 2276.6;
const end = 2292.6;
const at = {
  german: 2279.4,
  french: 2279.8,
  best: 2281.2,
  cost: 2283,
  shorter: 2285,
  gpus: 2287.2,
  days: 2288.6,
  both: 2290.2,
};

const scores = [
  { label: '영어 → 독일어', previous: 26.36, transformer: 28.4, at: at.german },
  { label: '영어 → 프랑스어', previous: 41.29, transformer: 41.8, at: at.french },
];
// 영어→프랑스어 학습 계산량: 기존 최고(ConvS2S 앙상블)와 트랜스포머(big).
const cost = { previous: 1.2e21, transformer: 2.3e19 };

const bleu = { x: 330, scale: 330 / 45 };
const flops = { x: 860, width: 640 };

const bar = (parent: SVGElement, x: number, y: number, className: string) => svg('rect', { class: `tt-bar ${className}`, x, y: y - 18, height: 36, rx: 8, width: 0 }, parent);

export const createTransformerTranslationScene = (): Scene => {
  const { element, root } = createDiagram('tt', '트랜스포머의 번역 시험');

  // 왼쪽: 번역 시험 점수.
  const left = svg('g', {}, root);
  text(left, 90, 190, '번역 시험 점수', { class: 'tt-heading' });
  text(left, 90, 224, 'WMT 2014 · BLEU', { class: 'tt-note' });
  const groups = scores.map((score, i) => {
    const y = 300 + i * 200;
    const group = svg('g', {}, left);
    text(group, 90, y, score.label, { class: 'tt-group-label' });
    text(group, bleu.x - 16, y + 52, '기존 최고', { class: 'tt-row-label', 'text-anchor': 'end' });
    text(group, bleu.x - 16, y + 104, '트랜스포머', { class: 'tt-row-label transformer', 'text-anchor': 'end' });
    const previous = bar(group, bleu.x, y + 44, 'previous');
    const transformer = bar(group, bleu.x, y + 96, 'transformer');
    const previousValue = text(group, 0, y + 54, String(score.previous), { class: 'tt-value' });
    const transformerValue = text(group, 0, y + 106, String(score.transformer), { class: 'tt-value transformer' });
    const badge = svg('g', { class: 'tt-badge' }, group);
    svg('rect', { x: 0, y: -20, width: 76, height: 40, rx: 20 }, badge);
    text(badge, 38, 8, '최고', {});
    return { score, group, previous, transformer, previousValue, transformerValue, badge, y };
  });

  // 오른쪽: 학습 계산량, GPU 여덟 장, 사흘 반.
  const right = svg('g', {}, root);
  text(right, flops.x, 190, '학습에 든 계산량', { class: 'tt-heading' });
  text(right, flops.x, 224, '영어 → 프랑스어 · FLOPs', { class: 'tt-note' });
  text(right, flops.x, 284, '기존 최고 (ConvS2S 앙상블)', { class: 'tt-row-label left' });
  const previousCost = bar(right, flops.x, 318, 'previous');
  const previousCostValue = text(right, flops.x + flops.width, 284, '1.2 × 10²¹', { class: 'tt-value', 'text-anchor': 'end' });
  text(right, flops.x, 384, '트랜스포머 (가장 큰 모델)', { class: 'tt-row-label left transformer' });
  const transformerCost = bar(right, flops.x, 418, 'transformer');
  const transformerCostValue = text(right, flops.x + 40, 428, '2.3 × 10¹⁹ · 약 1/50', { class: 'tt-value transformer' });

  const gpuGroup = svg('g', {}, right);
  text(gpuGroup, flops.x, 508, 'GPU 8장 (P100)', { class: 'tt-row-label left' });
  const cards = Array.from({ length: 8 }, (_, i) => {
    const card = svg('g', { class: 'tt-gpu', transform: `translate(${flops.x + i * 80} 530)` }, gpuGroup);
    svg('rect', { width: 66, height: 92, rx: 8 }, card);
    for (let k = 0; k < 4; k++) {
      svg('rect', { class: 'tt-gpu-fin', x: 10, y: 14 + k * 18, width: 46, height: 8, rx: 3 }, card);
    }
    return card;
  });
  const timeline = svg('g', {}, right);
  const dayWidth = flops.width / 3.5;
  svg('rect', { class: 'tt-track', x: flops.x, y: 680, width: flops.width, height: 22, rx: 11 }, timeline);
  const fill = svg('rect', { class: 'tt-fill', x: flops.x, y: 680, width: 0, height: 22, rx: 11 }, timeline);
  [0, 1, 2, 3].forEach((day) => text(timeline, flops.x + day * dayWidth, 740, `${day}일`, { class: 'tt-tick', 'text-anchor': day ? 'middle' : 'start' }));
  const daysLabel = text(timeline, flops.x + flops.width, 740, '3.5일', { class: 'tt-tick end', 'text-anchor': 'end' });

  const summary = svg('g', { class: 'tt-summary' }, root);
  text(summary, 410, 846, '더 잘하고', { class: 'tt-summary-text', 'text-anchor': 'middle' });
  text(summary, 1180, 846, '더 빨리 배운다', { class: 'tt-summary-text', 'text-anchor': 'middle' });

  const update = (time: number) => {
    setAttributes(left, { opacity: appear(time, start + .2, .5).toFixed(3) });
    for (const { score, group, previous, transformer, previousValue, transformerValue, badge, y } of groups) {
      setAttributes(group, { opacity: appear(time, score.at, .4).toFixed(3) });
      const grown = ease(progress(time, score.at, .8));
      const previousWidth = score.previous * bleu.scale * grown;
      setAttributes(previous, { width: previousWidth.toFixed(1) });
      setAttributes(previousValue, { x: (bleu.x + previousWidth + 14).toFixed(1), opacity: grown.toFixed(3) });
      // "최고 성적": 트랜스포머 막대가 기존 최고를 넘어선다.
      const beat = ease(progress(time, at.best, .9));
      const transformerWidth = score.transformer * bleu.scale * beat;
      setAttributes(transformer, { width: transformerWidth.toFixed(1) });
      setAttributes(transformerValue, { x: (bleu.x + transformerWidth + 14).toFixed(1), opacity: beat.toFixed(3) });
      setAttributes(badge, { transform: `translate(${(bleu.x + transformerWidth + 90).toFixed(1)} ${y + 96})`, opacity: appear(time, at.best + .8, .3).toFixed(3) });
    }

    setAttributes(right, { opacity: appear(time, at.cost, .4).toFixed(3) });
    const previousGrown = ease(progress(time, at.cost, .8));
    setAttributes(previousCost, { width: (flops.width * previousGrown).toFixed(1) });
    setAttributes(previousCostValue, { opacity: previousGrown.toFixed(3) });
    // "훨씬 짧았습니다": 같은 잣대로 그리면 트랜스포머는 겨우 보일 만큼 짧다.
    const shortGrown = ease(progress(time, at.shorter, .5));
    setAttributes(transformerCost, { width: Math.max(flops.width * (cost.transformer / cost.previous) * shortGrown, 0).toFixed(1) });
    setAttributes(transformerCostValue, { opacity: appear(time, at.shorter + .3, .4).toFixed(3) });

    setAttributes(gpuGroup, { opacity: appear(time, at.gpus, .3).toFixed(3) });
    cards.forEach((card, i) => {
      const shown = appear(time, at.gpus + i * .08, .3);
      card.classList.toggle('on', time >= at.days);
      setAttributes(card, { opacity: shown.toFixed(3), transform: `translate(${flops.x + i * 80} ${(530 + (1 - shown) * 16).toFixed(1)})` });
    });
    setAttributes(timeline, { opacity: appear(time, at.days - .3, .3).toFixed(3) });
    setAttributes(fill, { width: (flops.width * ease(progress(time, at.days, 1))).toFixed(1) });
    setAttributes(daysLabel, { opacity: appear(time, at.days + .7, .3).toFixed(3) });

    setAttributes(summary, { opacity: appear(time, at.both, .5).toFixed(3) });
    element.classList.toggle('both', time >= at.both);
  };

  return {
    element,
    update,
    title: '트랜스포머의 번역 시험',
    start,
    end,
    chapters: [
      { time: start, title: '번역 시험 최고 성적' },
      { time: at.cost, title: '훨씬 적은 학습 계산량' },
      { time: at.gpus, title: 'GPU 8장으로 사흘 반' },
      { time: at.both, title: '빠르면서 더 잘하는' },
    ],
  };
};
