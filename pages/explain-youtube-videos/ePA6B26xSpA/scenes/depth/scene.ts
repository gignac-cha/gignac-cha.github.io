import type { Scene } from '../../../shared/scenes';
import { createDepth } from './depth';

// 28:55 "신경망을 깊게 쌓으면 더 똑똑해질 줄" ~ 29:42 "깊이가 곧 실력이라는 믿음".
export const createDepthScene = (): Scene => {
  const timeline = {
    alexnet: 1735.133,
    alexnetLabel: 1741.6,
    deeper: 1746,
    edges: 1749.2,
    parts: 1751,
    whole: 1753.6,
    abstract: 1757.4,
    compare: 1759.833,
    vgg: 1763.3,
    vggDeeper: 1766.3,
    vggKernels: 1768,
    googlenet: 1772.3,
    winner: 1774.2,
    homage: 1776.7,
    belief: 1778.9,
  };
  return {
    ...createDepth(timeline),
    title: '깊이와 계층 특징',
    start: 1735.133,
    end: 1782.033,
    chapters: [
      { time: timeline.alexnet, title: '알렉스넷 8층' },
      { time: timeline.edges, title: '선 · 모서리' },
      { time: timeline.parts, title: '부품' },
      { time: timeline.whole, title: '전체 모양' },
      { time: timeline.vgg, title: 'VGG 16~19층' },
      { time: timeline.googlenet, title: '구글넷 22층' },
      { time: timeline.belief, title: '깊이 = 실력?' },
    ],
  };
};
