import type { Scene } from '../../../shared/scenes';
import { createGan } from './gan';
import { createGanWeakness } from './weakness';

// 26:34 "생성적 적대 신경망" ~ 27:40 "해마다 더 크고 더 선명해졌어요".
export const createGanScene = (): Scene => {
  const timeline = {
    name: 1595.8,
    cards: 1598.4,
    generator: 1601.8,
    firstFake: 1605,
    police: 1606.6,
    real: 1608.6,
    verdict: 1611.2,
    feedback: 1612.1,
    rounds: [
      [1614.1, 'forge'],
      [1617.1, 'police'],
      [1619.2, 'forge'],
      [1620.2, 'police'],
      [1621.6, 'forge'],
      [1622.7, 'police'],
      [1625.3, 'forge'],
      [1625.9, 'police'],
      [1626.5, 'forge'],
      [1627.1, 'police'],
    ] as Array<[number, 'forge' | 'police']>,
    indistinguishable: 1628.4,
    faces: 1631,
    gather: 1635.4,
    formed: 1638.5,
    nobody: 1640.8,
    judge: 1643.2,
    brush: 1646.1,
    early: 1649.5,
    yearly: 1657,
  };
  return {
    ...createGan(timeline),
    title: '생성적 적대 신경망(GAN)',
    start: 1594.6,
    end: 1660.9,
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
