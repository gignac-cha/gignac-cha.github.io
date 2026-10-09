import './rlhf.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 51:05 "2022년 초 그 결과물이 인스트럭트GPT였어요" ~ 51:20 "크기만이 전부는 아니라는 게 드러난 순간이었습니다".
const start = 3065.3;
const end = 3081;
const at = {
  name: 3067.1,
  contest: 3069.1,
  small: 3071.5,
  liked: 3073.8,
  big: 3074.9,
  times: 3075.3,
  beat: 3077.2,
  lesson: 3078.1,
};

// InstructGPT 논문(2022): 매개변수 13억 개짜리 InstructGPT 의 답을 1,750억 개짜리 GPT-3 보다 사람들이 더 좋아했다.
// 네모의 넓이를 매개변수 수에 비례하게 그린다(1,750억 ÷ 13억 ≈ 135배).
const params = { small: 1.3, big: 175 };
const baseline = 770;
const bigSide = 520;
const smallSide = bigSide * Math.sqrt(params.small / params.big);
const smallBox = { x: 420 - smallSide / 2, y: baseline - smallSide, size: smallSide };
const bigBox = { x: 870, y: baseline - bigSide, size: bigSide };

export const createInstructGPTScene = (): Scene => {
  const { element, root } = createDiagram('rlhf', '인스트럭트GPT(InstructGPT)');

  text(root, 800, 150, 'InstructGPT · 2022년 1월', { class: 'rlhf-heading' });
  svg('line', { x1: 200, y1: baseline, x2: 1460, y2: baseline, class: 'rlhf-axis' }, root);

  const small = svg('g', {}, root);
  const smallRect = svg('rect', { x: smallBox.x, y: smallBox.y, width: smallBox.size, height: smallBox.size, rx: 4, class: 'instruct-gpt-box small' }, small);
  text(small, 420, smallBox.y - 64, 'InstructGPT', { class: 'instruct-gpt-name' });
  text(small, 420, smallBox.y - 26, '매개변수 13억 개', { class: 'instruct-gpt-params' });
  const pulse = svg('rect', { class: 'instruct-gpt-pulse' }, small);

  const big = svg('g', {}, root);
  const bigRect = svg('rect', { x: bigBox.x, width: bigBox.size, rx: 6, class: 'instruct-gpt-box big' }, big);
  const bigLabel = svg('g', {}, big);
  text(bigLabel, bigBox.x + bigBox.size / 2, baseline - bigSide / 2 - 6, 'GPT-3', { class: 'instruct-gpt-name large' });
  text(bigLabel, bigBox.x + bigBox.size / 2, baseline - bigSide / 2 + 40, '매개변수 1,750억 개', { class: 'instruct-gpt-params' });

  const question = text(root, 640, 300, '사람들은 어느 쪽 답을 더 좋아했을까?', { class: 'instruct-gpt-question' });
  const verdict = svg('g', {}, root);
  svg('rect', { x: 250, y: 470, width: 340, height: 60, rx: 30, class: 'instruct-gpt-verdict' }, verdict);
  text(verdict, 420, 510, '✓ 사람들이 더 좋아함', { class: 'instruct-gpt-verdict-text' });

  const ratio = svg('g', {}, root);
  svg('path', { d: `M${smallBox.x + smallBox.size + 24} ${baseline - 24} Q660 ${baseline - 40} ${bigBox.x - 24} ${baseline - 120}`, class: 'instruct-gpt-ratio-line' }, ratio);
  text(ratio, 660, 640, '약 135배', { class: 'instruct-gpt-ratio' });
  text(ratio, 660, 680, '1,750억 ÷ 13억', { class: 'instruct-gpt-params' });
  const note = text(root, 1460, 812, '네모의 넓이 = 매개변수 수', { class: 'instruct-gpt-note' });
  const lesson = text(root, 800, 860, '크기만이 전부는 아니다', { class: 'instruct-gpt-lesson' });

  const update = (time: number) => {
    const smallIn = appear(time, at.name, .5);
    setAttributes(small, { opacity: smallIn.toFixed(3) });
    // GPT-3 는 바닥에서 위로 자라 올라와 크기 차이를 보여 준다.
    const grow = ease(progress(time, at.contest, 1));
    setAttributes(bigRect, { y: (baseline - bigSide * grow).toFixed(1), height: (bigSide * grow).toFixed(1) });
    setAttributes(big, { opacity: (appear(time, at.contest, .3) * lerp(1, .45, appear(time, at.beat, .5))).toFixed(3) });
    setAttributes(bigLabel, { opacity: appear(time, at.contest + .8, .4).toFixed(3) });
    setAttributes(note, { opacity: appear(time, at.contest + 1, .4).toFixed(3) });
    setAttributes(question, { opacity: (appear(time, at.contest + .4, .4) * (1 - appear(time, at.liked, .3))).toFixed(3) });

    // "훨씬 작은": 작은 네모 둘레가 한 번 퍼져 나간다.
    const ping = progress(time, at.small, .9);
    const grown = smallBox.size + 60 * ping;
    setAttributes(pulse, {
      x: (420 - grown / 2).toFixed(1),
      y: (baseline - smallBox.size / 2 - grown / 2).toFixed(1),
      width: grown.toFixed(1),
      height: grown.toFixed(1),
      opacity: ping > 0 && ping < 1 ? (1 - ping).toFixed(3) : 0,
    });
    smallRect.classList.toggle('winner', time >= at.liked);
    const won = appear(time, at.liked, .4);
    setAttributes(verdict, { opacity: won.toFixed(3), transform: `translate(0 ${lerp(16, 0, won).toFixed(1)})` });
    setAttributes(ratio, { opacity: appear(time, at.times, .4).toFixed(3) });
    setAttributes(lesson, { opacity: appear(time, at.lesson, .5).toFixed(3) });
  };

  return {
    element,
    update,
    title: '인스트럭트GPT(InstructGPT)',
    start,
    end,
    chapters: [
      { time: at.name, title: '사람 피드백으로 다듬은 GPT' },
      { time: at.liked, title: '작은 모델의 답을 더 좋아했다' },
      { time: at.times, title: '약 135배 큰 GPT-3' },
    ],
  };
};
