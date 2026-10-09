import type { DepthTimeline } from './depth.ts';

// 28:55 "신경망을 깊게 쌓으면 더 똑똑해질 줄" ~ 29:42 "깊이가 곧 실력이라는 믿음".
// SVG 판(depth.ts)과 Three.js 판(three.ts)이 같은 시점을 쓴다.
export const depthStart = 1735.133;
export const depthEnd = 1782.033;

export const depthTimeline: DepthTimeline = {
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
