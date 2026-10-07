import type { GanTimeline } from './gan';

// 26:34 "생성적 적대 신경망" ~ 27:40 "해마다 더 크고 더 선명해졌어요".
// SVG 판(gan.ts)과 Three.js 판(three.ts)이 같은 시점을 쓴다.
export const ganStart = 1594.6;
export const ganEnd = 1660.9;

export const ganTimeline: GanTimeline = {
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
  ],
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
