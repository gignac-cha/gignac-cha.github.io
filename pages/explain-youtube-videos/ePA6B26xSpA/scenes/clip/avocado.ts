import { svg } from '../../../shared/diagram.ts';

// "아보카도 모양 안락의자" 설명용 그림(실제 DALL·E 결과물이 아니라 직접 그린 그림). 200×200 상자 안에 그린다.
export interface Chair {
  width: number;
  tilt: number;
  pit: number;
  skin: string;
  flesh: string;
  arms: boolean;
}

export const chairs: Chair[] = [
  { width: 1, tilt: 0, pit: 30, skin: '#2f6b2a', flesh: '#c9e27a', arms: true },
  { width: 1.18, tilt: -6, pit: 36, skin: '#3d7d2c', flesh: '#d9eb8c', arms: false },
  { width: .92, tilt: 7, pit: 26, skin: '#285a24', flesh: '#b8d86a', arms: true },
  { width: 1.08, tilt: 0, pit: 40, skin: '#4a8a33', flesh: '#e3f0a0', arms: false },
];

export const drawChair = (parent: Element, chair: Chair) => {
  const group = svg('g', { transform: `rotate(${chair.tilt} 100 110)` }, parent);
  const w = (x: number) => 100 + (x - 100) * chair.width;
  const shape = (inset: number) => {
    const top = 22 + inset;
    const bottom = 176 - inset * .6;
    return `M100 ${top} C${w(140 - inset)} ${top} ${w(150 - inset)} ${70 + inset} ${w(162 - inset)} 112 C${w(176 - inset)} 160 ${w(150 - inset)} ${bottom} 100 ${bottom} C${w(50 + inset)} ${bottom} ${w(24 + inset)} 160 ${w(38 + inset)} 112 C${w(50 + inset)} ${70 + inset} ${w(60 + inset)} ${top} 100 ${top} Z`;
  };
  // 다리 → 껍질(등받이) → 과육(앉는 자리) → 씨(방석) → 팔걸이.
  svg('rect', { x: 64, y: 170, width: 10, height: 20, rx: 3, fill: '#6b4a2b' }, group);
  svg('rect', { x: 126, y: 170, width: 10, height: 20, rx: 3, fill: '#6b4a2b' }, group);
  svg('path', { d: shape(0), fill: chair.skin }, group);
  svg('path', { d: shape(12), fill: chair.flesh }, group);
  svg('ellipse', { cx: 100, cy: 128, rx: chair.pit * 1.15, ry: chair.pit * .78, fill: '#8a5a32' }, group);
  svg('ellipse', { cx: 100 - chair.pit * .25, cy: 128 - chair.pit * .3, rx: chair.pit * .35, ry: chair.pit * .18, fill: '#b07a48' }, group);
  if (chair.arms) {
    svg('rect', { x: w(34), y: 118, width: 22, height: 48, rx: 11, fill: chair.skin }, group);
    svg('rect', { x: w(166) - 22, y: 118, width: 22, height: 48, rx: 11, fill: chair.skin }, group);
  }
  return group;
};
