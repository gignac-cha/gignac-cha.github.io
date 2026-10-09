import type { Scene } from '../../../shared/scenes';
import { withThree } from '../../../shared/three-scene';
import { createDepth } from './depth';
import { depthEnd, depthStart, depthTimeline as timeline } from './timeline';

// 28:55 "신경망을 깊게 쌓으면 더 똑똑해질 줄" ~ 29:42 "깊이가 곧 실력이라는 믿음".
const createDepthBase = (): Scene => ({
  ...createDepth(timeline),
  title: '깊이와 계층 특징',
  start: depthStart,
  end: depthEnd,
  chapters: [
    { time: timeline.alexnet, title: '알렉스넷 8층' },
    { time: timeline.edges, title: '선 · 모서리' },
    { time: timeline.parts, title: '부품' },
    { time: timeline.whole, title: '전체 모양' },
    { time: timeline.vgg, title: 'VGG 16~19층' },
    { time: timeline.googlenet, title: '구글넷 22층' },
    { time: timeline.belief, title: '깊이 = 실력?' },
  ],
});

// Three.js 판으로 보여 준다(shared/three-scene.ts). three.js 를 불러오기 전에는 SVG 판을 보여 준다.
export const createDepthScene = (): Scene =>
  withThree(createDepthBase(), () => import('./three').then(({ createDepthThree }) => createDepthThree));
