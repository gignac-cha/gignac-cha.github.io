import { appear, clamp, ease, lerp, progress } from '../../../shared/diagram';
import { drug, experiment, plddt, predicted, sequence } from './protein';

// 45:26 "이번 상대는 바둑이 아니라 단백질" ~ 46:24 "AI가 과학의 한복판으로 걸어 들어간 순간이었습니다".
// SVG 판(scene.ts)과 Three.js 판(three.ts)이 같은 박자, 같은 움직임을 쓰도록 위치·색은 여기서 시간만으로 계산한다.
export const start = 2726.3;
export const end = 2784.4;
export const at = {
  protein: 2727.4,
  machine: 2729.6,
  string: 2731.9,
  beads: 2732.8,
  fold: 2736.0,
  shape: 2737.6,
  function: 2739.4,
  medicine: 2742.6,
  lock: 2745.4,
  key: 2746.3,
  problem: 2748.4,
  unknown: 2750.1,
  experiment: 2752.4,
  years: 2754.4,
  decades: 2756.7,
  contest: 2759.4,
  alphafold: 2763.1,
  compare: 2764.0,
  accuracy: 2765.1,
  released: 2769.8,
  count: 2770.7,
  free: 2774.4,
  rest: 2776.6,
};

export type Vec3 = [number, number, number];
export type Rgb = [number, number, number];
export const count = sequence.length;

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};
// 무지개색(N 끝 파랑 → C 끝 빨강). 서열 글자와 구슬이 같은 색이라 접혀도 순서를 따라갈 수 있다.
export const rainbow = (i: number) => `hsl(${(240 - (240 * i) / (count - 1)).toFixed(0)}, 72%, 62%)`;
const rainbowRgb = (i: number) => hslToRgb(240 - (240 * i) / (count - 1), .72, .62);
// 알파폴드가 쓰는 확신도(pLDDT) 색.
export const confidence = (value: number): Rgb =>
  value > 90 ? [0, 83, 214] : value > 70 ? [101, 203, 243] : value > 50 ? [255, 219, 19] : [255, 125, 69];
const gray: Rgb = [110, 112, 122];
export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgb = (color: Rgb) => `rgb(${color.map(Math.round).join(',')})`;

// "아미노산 구슬이 줄줄이 꿰어진 끈": 세 줄로 굽이치는 끈 위에 같은 간격으로 구슬을 놓는다(화면 좌표).
const stringLayout = (() => {
  const left = 190;
  const right = 1410;
  const rows = [380, 470, 560];
  const turn = (rows[1] - rows[0]) / 2;
  const straight = right - left;
  const arc = Math.PI * turn;
  const total = 3 * straight + 2 * arc;
  const pointAt = (s: number): [number, number] => {
    for (let row = 0; row < 3; row++) {
      const forward = row % 2 === 0;
      if (s <= straight) {
        return [forward ? left + s : right - s, rows[row]];
      }
      s -= straight;
      if (row < 2) {
        if (s <= arc) {
          const angle = s / turn;
          const cx = forward ? right : left;
          const cy = rows[row] + turn;
          return forward ? [cx + turn * Math.sin(angle), cy - turn * Math.cos(angle)] : [cx - turn * Math.sin(angle), cy - turn * Math.cos(angle)];
        }
        s -= arc;
      }
    }
    return [right, rows[2]];
  };
  return Array.from({ length: count }, (_, i) => pointAt((i / (count - 1)) * total));
})();

// 장면 중심(800, 470), 1 Å = 10 px 기준으로 끈의 자리를 Å 좌표로 바꿔 둔다(접힌 모양과 같은 공간에서 섞기 위해).
export const SCALE = 10;
const stringPoints: Vec3[] = stringLayout.map(([x, y]) => [(x - 800) / SCALE, (470 - y) / SCALE, 0]);

export const rotateY = ([x, y, z]: Vec3, angle: number): Vec3 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c + z * s, y, -x * s + z * c];
};
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// 끈 → 접힌 모양 비율. 처음엔 접힌 단백질, "아미노산이라는"에서 풀려 끈이 되고, "저절로"에서 다시 접힌다.
const foldAmount = (time: number, i: number) => {
  const unfold = ease(clamp((progress(time, at.string, 1.7) - .25 * (i / count)) / .75));
  const refold = ease(clamp((progress(time, at.fold, 1.8) - .3 * (1 - i / count)) / .7));
  return 1 - unfold + refold;
};

// 단백질 전체의 놓임새(화면 중심, 1 Å 당 픽셀)와 천천히 좌우로 흔들리는 각도.
export const view = (time: number) => {
  const side = ease(progress(time, at.problem - .6, .9));
  return {
    cx: lerp(800, 1170, side),
    cy: 470,
    scale: lerp(SCALE, 8, side),
    yaw: .24 * Math.sin((time - start) * .32),
    side,
  };
};

// 단계마다 무엇이 얼마나 보이는지.
export const phase = (time: number) => {
  const { side } = view(time);
  const predictedAmount = appear(time, at.alphafold + .3, .8);
  return {
    shown: appear(time, at.protein, .6) * (1 - appear(time, at.released, .6)),
    predictedAmount,
    // 끈만 보고 맞혀야 할 때(모양을 모른다): 흐린 회색.
    unknown: side * (1 - predictedAmount),
    pocket: appear(time, at.function, .5) * (1 - appear(time, at.problem - .6, .5)),
    medicine: appear(time, at.medicine, .5) * (1 - appear(time, at.problem - .6, .5)),
    docking: ease(progress(time, at.key, 1.1)),
    truth: appear(time, at.compare, .6) * .9,
  };
};

// 아미노산(α탄소) 위치, Å. 화면에 맞춘 좌표계(x 오른쪽, y 위, z 앞)이며 단백질 중심이 원점.
export const residues = (time: number) => {
  const { yaw } = view(time);
  const { predictedAmount } = phase(time);
  return experiment.map((native, i) => {
    const folded = rotateY(mix3(native, predicted[i], predictedAmount), yaw);
    const fold = foldAmount(time, i);
    return { position: mix3(stringPoints[i], folded, fold), fold };
  });
};

// 실험으로 밝힌 구조(정답), 같은 좌표계.
export const truth = (time: number) => experiment.map((native) => rotateY(native, view(time).yaw));

// 구슬 색: 처음엔 무지개, 모양을 모를 땐 회색, 알파폴드가 예측하면 확신도 색으로 N 끝부터 칠해진다.
export const residueColors = (time: number) => {
  const { unknown } = phase(time);
  return experiment.map((_, i) => {
    const colored = progress(time, at.alphafold + .4 + (.9 * i) / count, .25);
    return colored > 0 ? mixRgb(gray, confidence(plddt[i]), colored) : mixRgb(rainbowRgb(i), gray, unknown);
  });
};

const drugCenter = drug.reduce<Vec3>((sum, { position }) => [sum[0] + position[0] / drug.length, sum[1] + position[1] / drug.length, sum[2] + position[2] / drug.length], [0, 0, 0]);
export const pocketCenter = (time: number) => rotateY(drugCenter, view(time).yaw);

// 약(메토트렉세이트) 원자 위치. 오른쪽에서 돌며 다가와 결정 구조에서 들어가 있던 자리에 꼭 맞게 들어간다.
export const drugAtoms = (time: number): Vec3[] => {
  const { yaw } = view(time);
  const { docking } = phase(time);
  const spin = (1 - docking) * 1.6;
  return drug.map(({ position }) => {
    const local: Vec3 = [position[0] - drugCenter[0], position[1] - drugCenter[1], position[2] - drugCenter[2]];
    const turned = rotateY(local, spin);
    const [x, y, z] = rotateY([turned[0] + drugCenter[0], turned[1] + drugCenter[1], turned[2] + drugCenter[2]], yaw);
    return [x + (1 - docking) * 44, y + (1 - docking) * 4, z];
  });
};
