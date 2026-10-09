import { clamp, lerp, progress } from '../../../shared/diagram.ts';
import { faceCanvas, faces, random } from './face.ts';
import { ganTimeline as T } from './timeline.ts';

// "잡음에서 얼굴로": 위조범(생성자)은 학습할 때마다 같은 크기의 그림을 통째로 새로 칠한다.
// 점이 날아와 모이는 게 아니라, 같은 픽셀 칸의 값이 바뀌어 얼룩덜룩한 잡음 → 큰 덩어리 → 눈·코·입 → 얼굴이 된다.
// SVG 판(gan.ts)과 Three.js 판(three.ts)이 같은 출력과 같은 박자를 쓴다.
export const GRID_WIDTH = 32;
export const GRID_HEIGHT = 38;

// 출력을 보여 주는 학습 횟수(대략적인 눈금). 0 은 학습 전.
export const snapshots = ['0', '1', '10', '50', '100', '500', '1,000', '5,000', '10,000', '50,000', '100,000'];
const last = snapshots.length - 1;

// 새 출력으로 바뀌는 데 걸리는 시간.
const REPAINT = .2;

// "얼룩덜룩한 점들이"(gather)부터 "마침내"(formed) 직전까지 고르게 다시 칠한다.
const snapshotAt = (k: number) => T.gather + (k / last) * (T.formed - .4 - T.gather);

// time 에 보이는 출력: 이전 출력 from 에서 새 출력 to 로 blend 만큼 바뀌었다.
export const trainingStep = (time: number) => {
  let to = 0;
  for (let k = 1; k <= last; k++) {
    if (time >= snapshotAt(k)) {
      to = k;
    }
  }
  return { from: Math.max(to - 1, 0), to, blend: to === 0 ? 1 : progress(time, snapshotAt(to), REPAINT) };
};

// cols×rows 격자의 난수를 부드럽게 이어 GRID 크기로 편다(얼룩).
const blotches = (next: () => number, cols: number, rows: number) => {
  const values = Array.from({ length: cols * rows }, next);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const u = (x / (GRID_WIDTH - 1)) * (cols - 1);
    const v = (y / (GRID_HEIGHT - 1)) * (rows - 1);
    const i = Math.min(Math.floor(u), cols - 2);
    const j = Math.min(Math.floor(v), rows - 2);
    const fu = smooth(u - i);
    const fv = smooth(v - j);
    const at = (a: number, b: number) => values[b * cols + a];
    return lerp(lerp(at(i, j), at(i + 1, j), fu), lerp(at(i, j + 1), at(i + 1, j + 1), fu), fv);
  };
};

// 얼굴을 width 픽셀 너비로 줄였다가 GRID 크기로 부드럽게 늘린다. 작을수록 큰 윤곽만 남는다.
const coarseFace = (width: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_WIDTH;
  canvas.height = GRID_HEIGHT;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(faceCanvas(faces[0], width, false), 0, 0, GRID_WIDTH, GRID_HEIGHT);
  return context.getImageData(0, 0, GRID_WIDTH, GRID_HEIGHT).data;
};

// 학습 횟수마다의 출력(RGBA, GRID_WIDTH×GRID_HEIGHT). 큰 윤곽부터 배우고, 잔 잡음은 점점 걷힌다.
// 같은 입력(잡음 z)으로 그린 그림이라 회차가 바뀌어도 얼룩의 자리는 조금씩만 바뀐다.
export const trainingFrames = () => {
  const next = random(53);
  const base = { blotch: blotches(next, 7, 8), speckle: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, next) };
  const tints = [0, 1, 2].map(() => blotches(next, 4, 5));
  return snapshots.map((_, k) => {
    const p = k / last;
    const fresh = { blotch: blotches(next, 7, 8), speckle: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, next) };
    const learned = 1 - (1 - p) ** 2;
    const face = k > 0 ? coarseFace(Math.min(Math.round(2 * 16 ** p), GRID_WIDTH)) : undefined;
    const data = new Uint8ClampedArray(GRID_WIDTH * GRID_HEIGHT * 4);
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const i = y * GRID_WIDTH + x;
        const blotch = lerp(base.blotch(x, y), fresh.blotch(x, y), .45);
        const speckle = lerp(base.speckle[i], fresh.speckle[i], .5);
        const gray = .1 + .72 * (.55 * blotch + .45 * speckle);
        for (let c = 0; c < 3; c++) {
          const noise = clamp(gray + (tints[c](x, y) - .5) * .22) * 255;
          data[i * 4 + c] = face ? lerp(noise, face[i * 4 + c], learned) : noise;
        }
        data[i * 4 + 3] = 255;
      }
    }
    return data;
  });
};

// 출력 한 장을 그림 파일(data URL)로. SVG 판의 <image> 에 쓴다.
export const frameImage = (data: Uint8ClampedArray) => {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_WIDTH;
  canvas.height = GRID_HEIGHT;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), GRID_WIDTH, GRID_HEIGHT), 0, 0);
  return canvas.toDataURL();
};
