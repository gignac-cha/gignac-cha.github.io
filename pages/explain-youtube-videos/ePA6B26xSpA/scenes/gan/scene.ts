import type { Scene } from '../../../shared/scenes';
import { withThree } from '../../../shared/three-scene';
import { createGan } from './gan';
import { ganEnd, ganStart, ganTimeline } from './timeline';
import { createGanWeakness } from './weakness';

// 26:34 "생성적 적대 신경망" ~ 27:40 "해마다 더 크고 더 선명해졌어요". 시점은 timeline.ts 에서 Three.js 판과 함께 쓴다.
const createGanBase = (): Scene => {
  const timeline = ganTimeline;
  return {
    ...createGan(timeline),
    title: '생성적 적대 신경망(GAN)',
    start: ganStart,
    end: ganEnd,
    chapters: [
      { time: timeline.cards, title: '위조범과 경찰' },
      { time: timeline.verdict, title: '진짜와 가짜 가려내기' },
      { time: timeline.feedback, title: '들킬 때마다 수법 수정' },
      { time: timeline.indistinguishable, title: '구별할 수 없는 가짜' },
      { time: timeline.faces, title: '잡음에서 얼굴로' },
      { time: timeline.judge, title: '심판에서 붓으로' },
      { time: timeline.early, title: '해마다 선명해진 그림' },
    ],
  };
};

// 28:24 "간에는 기술적인 약점도" ~ 28:36 "만족해 버리는 거죠".
export const createGanWeaknessScene = (): Scene => {
  const timeline = {
    balance: 1705,
    tilt: 1708.2,
    collapse: 1708.6,
    repeat: 1710.9,
    fooled: 1714,
    modeCollapse: 1714.8,
  };
  return {
    ...createGanWeakness(timeline),
    title: 'GAN의 약점',
    start: 1704.7,
    end: 1716.833,
    chapters: [
      { time: timeline.tilt, title: '균형이 무너지면' },
      { time: timeline.repeat, title: '한 가지 그림만 반복' },
    ],
  };
};

// Three.js 판으로 보여 준다(shared/three-scene.ts). three.js 를 불러오기 전에는 SVG 판을 보여 준다.
export const createGanScene = (): Scene =>
  withThree(createGanBase(), () => import('./three').then(({ createGanThree }) => createGanThree));
