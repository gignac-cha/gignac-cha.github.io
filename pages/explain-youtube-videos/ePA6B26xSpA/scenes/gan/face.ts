import { svg } from '../../../shared/diagram';

// 사진 대신 쓰는 단순한 얼굴 그림. 200×240 상자 안에 그린다.
export const FACE_WIDTH = 200;
export const FACE_HEIGHT = 240;

export interface Face {
  // 눈 사이 거리의 절반
  spread: number;
  eye: number;
  // 입꼬리 곡률. 클수록 활짝 웃는다.
  mouth: number;
  style: 0 | 1 | 2;
  skin: string;
  shade: string;
  hair: string;
  shirt: string;
  backdrop: string;
}

export const faces: Face[] = [
  { spread: 22, eye: 1, mouth: 8, style: 0, skin: '#d8b89a', shade: '#b8957a', hair: '#3b2f2a', shirt: '#4a6fa5', backdrop: '#2a2d36' },
  { spread: 24, eye: .9, mouth: 4, style: 1, skin: '#e6c9ab', shade: '#c4a284', hair: '#6b4a32', shirt: '#8a5a7c', backdrop: '#2b3330' },
  { spread: 20, eye: 1.1, mouth: 11, style: 2, skin: '#c49a7c', shade: '#a27c63', hair: '#1f1d22', shirt: '#3d7a62', backdrop: '#33302a' },
  { spread: 23, eye: 1, mouth: 2, style: 1, skin: '#a87c5f', shade: '#8a634b', hair: '#191719', shirt: '#b0703c', backdrop: '#2c2a35' },
  { spread: 21, eye: 1.2, mouth: 9, style: 0, skin: '#f0d5bc', shade: '#cfb196', hair: '#a8743e', shirt: '#5b5f6e', backdrop: '#32353a' },
  { spread: 25, eye: .85, mouth: 6, style: 2, skin: '#d2a98a', shade: '#b08a6c', hair: '#4a3a33', shirt: '#7a3f46', backdrop: '#2a3236' },
];

interface Shape {
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

const hairFront = [
  'M46 100 C42 52 70 36 100 36 C130 36 160 52 154 100 C146 76 126 64 100 64 C76 64 56 76 46 100 Z',
  'M46 104 C42 50 70 34 100 34 C130 34 158 50 154 104 C150 84 132 70 104 70 C88 78 66 80 46 104 Z',
  'M48 96 C48 52 78 40 104 40 C136 40 158 60 152 98 C140 72 112 62 94 70 C78 76 58 78 48 96 Z',
];

const shapes = (face: Face): Shape[] => {
  const left = 100 - face.spread;
  const right = 100 + face.spread;
  return [
    { d: 'M0 0 H200 V240 H0 Z', fill: face.backdrop },
    ...(face.style === 1 ? [{ d: 'M44 112 C36 50 70 32 100 32 C130 32 164 50 156 112 L164 196 L36 196 Z', fill: face.hair }] : []),
    { d: 'M10 240 C20 192 60 180 100 178 C140 180 180 192 190 240 Z', fill: face.shirt },
    { d: 'M84 150 L84 184 Q100 194 116 184 L116 150 Z', fill: face.shade },
    { d: ellipse(100, 106, 52, 64), fill: face.skin },
    { d: hairFront[face.style], fill: face.hair },
    { d: `M${left - 14} 90 Q${left} 84 ${left + 14} 90`, stroke: face.hair, width: 4 },
    { d: `M${right - 14} 90 Q${right} 84 ${right + 14} 90`, stroke: face.hair, width: 4 },
    { d: ellipse(left, 104, 11 * face.eye, 6.5 * face.eye), fill: '#f3efe9' },
    { d: ellipse(right, 104, 11 * face.eye, 6.5 * face.eye), fill: '#f3efe9' },
    { d: ellipse(left, 104, 4.8 * face.eye, 4.8 * face.eye), fill: '#2a2629' },
    { d: ellipse(right, 104, 4.8 * face.eye, 4.8 * face.eye), fill: '#2a2629' },
    { d: 'M100 110 Q93 128 97 132 Q101 134 106 131', stroke: face.shade, width: 3 },
    { d: `M82 148 Q100 ${148 + face.mouth} 118 148`, stroke: '#a85a52', width: 4 },
  ];
};

// 200×240 좌표의 얼굴 그룹. 크기와 위치는 호출한 쪽에서 transform으로 정한다.
export const drawFace = (parent: Element, face: Face) => {
  const group = svg('g', {}, parent);
  for (const shape of shapes(face)) {
    svg('path', {
      d: shape.d,
      fill: shape.fill ?? 'none',
      ...(shape.stroke ? { stroke: shape.stroke, 'stroke-width': shape.width ?? 2, 'stroke-linecap': 'round' } : {}),
    }, group);
  }
  return group;
};

// 얼굴을 width 픽셀 너비의 캔버스로 그린다. Three.js 판은 이 픽셀로 입자 색과 자리를 정한다.
export const faceCanvas = (face: Face, width: number, grayscale: boolean) => {
  const large = document.createElement('canvas');
  large.width = FACE_WIDTH;
  large.height = FACE_HEIGHT;
  const context = large.getContext('2d')!;
  for (const shape of shapes(face)) {
    const path = new Path2D(shape.d);
    if (shape.fill) {
      context.fillStyle = shape.fill;
      context.fill(path);
    }
    if (shape.stroke) {
      context.strokeStyle = shape.stroke;
      context.lineWidth = shape.width ?? 2;
      context.lineCap = 'round';
      context.stroke(path);
    }
  }
  const small = document.createElement('canvas');
  small.width = width;
  small.height = Math.round((width * FACE_HEIGHT) / FACE_WIDTH);
  const target = small.getContext('2d')!;
  target.imageSmoothingQuality = 'high';
  target.drawImage(large, 0, 0, small.width, small.height);
  if (grayscale) {
    const image = target.getImageData(0, 0, small.width, small.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const gray = image.data[i] * .3 + image.data[i + 1] * .59 + image.data[i + 2] * .11;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = gray;
    }
    target.putImageData(image, 0, 0);
  }
  return small;
};

// 얼굴을 width 픽셀 너비의 작은 그림으로 그려 data URL로 돌려준다. 흐릿한 초기 생성 결과를 흉내 낸다.
export const faceImage = (face: Face, width: number, grayscale: boolean) => faceCanvas(face, width, grayscale).toDataURL();

// 결정적인 난수. 같은 seed면 늘 같은 배치가 나온다.
export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Point = [number, number];

const onEllipse = (cx: number, cy: number, rx: number, ry: number, count: number): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry];
  });

const onCubic = (p0: Point, p1: Point, p2: Point, p3: Point, count: number): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const u = 1 - t;
    return [0, 1].map((k) => u ** 3 * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t ** 3 * p3[k]) as Point;
  });

const onQuad = (p0: Point, p1: Point, p2: Point, count: number): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const u = 1 - t;
    return [0, 1].map((k) => u * u * p0[k] + 2 * u * t * p1[k] + t * t * p2[k]) as Point;
  });

// 잡음 점들이 모여들 자리: 얼굴 윤곽, 머리선, 눈, 눈썹, 코, 입, 어깨선.
export const faceOutline = (face: Face): Point[] => {
  const left = 100 - face.spread;
  const right = 100 + face.spread;
  return [
    ...onEllipse(100, 106, 52, 64, 40),
    ...onCubic([46, 100], [42, 52], [70, 36], [100, 36], 10),
    ...onCubic([100, 36], [130, 36], [160, 52], [154, 100], 10),
    ...onEllipse(left, 104, 11 * face.eye, 6.5 * face.eye, 9),
    ...onEllipse(right, 104, 11 * face.eye, 6.5 * face.eye, 9),
    ...onQuad([left - 14, 90], [left, 84], [left + 14, 90], 5),
    ...onQuad([right - 14, 90], [right, 84], [right + 14, 90], 5),
    ...onQuad([100, 110], [93, 128], [97, 132], 5),
    ...onQuad([82, 148], [100, 148 + face.mouth], [118, 148], 9),
    ...onCubic([10, 240], [20, 192], [60, 180], [100, 178], 9),
    ...onCubic([100, 178], [140, 180], [180, 192], [190, 240], 9),
  ];
};
