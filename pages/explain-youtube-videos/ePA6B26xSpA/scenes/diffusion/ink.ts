import { clamp, ease, lerp, progress } from '../../../shared/diagram.ts';
import { gaussian } from './noise.ts';
import { at } from './timing.ts';

// 잉크: 물보다 무거운 잉크 방울은 한 덩어리로 들어가 소용돌이 고리를 이루며 가라앉고(꼬리와 가닥을 남기며 말려 들어간다),
// 그 뒤 브라운 운동(무작위 걸음)으로 천천히 번져 물 전체가 뿌옇게 된다. 모든 위치는 '잉크 시계' 하나로 정해진다.
// 거꾸로 돌릴 때는 이 시계를 되감아, 입자마다 같은 길을 되짚어 다시 한 방울로 모인다.
// SVG 판은 수조를 옆에서 본 x, y 만 쓰고, Three.js 판은 같은 입자에 앞뒤(z)를 더해 입체로 그린다.
export const tank = { left: 520, right: 1080, top: 300, bottom: 700 };
export const surface = 320;
// 수조의 앞뒤 폭(SVG 픽셀 단위). 3D 판에서만 쓴다.
export const DEPTH = 280;
export const PARTICLES = 640;
const WALK = 60;
// 착수 뒤 흐른 잉크 시간(초). 물 전체가 뿌예지는 데 INK_END 초.
const INK_END = at.gather - at.land;
export const inkClock = (time: number) =>
  time < at.gather ? clamp(time - at.land, 0, INK_END) : INK_END * (1 - ease(progress(time, at.gather, at.gathered)));
const reflect = (value: number, low: number, high: number) => {
  const span = high - low;
  let v = (value - low) % (2 * span);
  if (v < 0) {
    v += 2 * span;
  }
  return low + (v > span ? 2 * span - v : v);
};
export const unit = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};
// 입자 넷 중 셋은 소용돌이 고리(도넛 모양), 하나는 수면에서 이어지는 꼬리. 고리 입자 일부는 아래로 처지는 가닥이 된다.
export const inkParticles = (() => {
  const steps = gaussian(20151, PARTICLES * WALK * 2);
  return Array.from({ length: PARTICLES }, (_, p) => {
    const walk: Array<[number, number]> = [[0, 0]];
    for (let k = 0; k < WALK; k++) {
      const index = (p * WALK + k) * 2;
      walk.push([walk[k][0] + steps[index] * 40, walk[k][1] + steps[index + 1] * 40]);
    }
    return {
      walk,
      stem: p % 4 === 3,
      around: unit(p * 7 + 8) * Math.PI * 2,
      radius: Math.sqrt(unit(p * 7 + 1)),
      angle: unit(p * 7 + 2) * Math.PI * 2,
      along: unit(p * 7 + 3),
      phase: unit(p * 7 + 4) * Math.PI * 2,
      finger: unit(p * 7 + 5) < .22 ? unit(p * 7 + 6) : 0,
    };
  });
})();
type InkParticle = (typeof inkParticles)[number];
const walkAt = (path: Array<[number, number]>, amount: number) => {
  const position = clamp(amount) * WALK;
  const k = Math.min(Math.floor(position), WALK - 1);
  const f = position - k;
  return [lerp(path[k][0], path[k + 1][0], f), lerp(path[k][1], path[k + 1][1], f)];
};
const settle = (e: number, tau: number) => 1 - Math.exp(-e / tau);
// 번진 정도(0 = 갓 떨어진 진한 잉크, 1 = 물 전체에 고르게). 처음 1초는 거의 번지지 않는다.
export const diffusedAt = (e: number) => ease(clamp((e - 1) / (INK_END - 1.4)));

// 번지기 전 모양: 옆에서 본 x, y 와 앞뒤 z(수조 가운데가 0).
const shape = (particle: InkParticle, e: number) => {
  const ringY = surface + 20 + 200 * settle(e, 1.25);
  const ringR = 6 + 58 * settle(e, 1.1);
  const core = 9 + 25 * settle(e, 1.3);
  let x: number;
  let y: number;
  let z: number;
  if (particle.stem) {
    // 꼬리: 수면에서 고리까지 이어지는 가는 줄. 아래로 갈수록 굵고 구불구불하다.
    const v = particle.along;
    y = lerp(surface + 8, ringY - core * .4, v ** .8);
    x = 800 + (2 + 11 * v) * Math.sin(v * 9 + particle.phase + e * 1.3) * settle(e, .6) + (particle.radius - .5) * (3 + 6 * v);
    z = (2 + 11 * v) * Math.cos(v * 7 + particle.phase + e * 1.1) * settle(e, .6) + Math.sin(particle.around) * (2 + 5 * v);
  } else {
    // 고리: 도넛 모양 소용돌이를 옆에서 본 모습(버섯 머리). 가운데로는 아래로, 바깥으로는 위로 말려 돌고,
    // 심에 가까운 입자가 더 빨리 돌아 나선 무늬가 말려 나온다.
    const spin = 7.5 * settle(e, 1.3) * (1.25 - .45 * particle.radius);
    const theta = particle.angle - spin;
    const r = core * particle.radius;
    const across = Math.cos(particle.around);
    const depth = Math.sin(particle.around);
    x = 800 + (ringR + r * Math.cos(theta)) * across;
    y = ringY + r * Math.sin(theta);
    z = (ringR + r * Math.cos(theta)) * depth;
    if (particle.finger > 0 && e > .9) {
      // 고리에서 떨어져 아래로 처지는 가닥.
      const hang = 95 * settle(e - .9, 1.6) * particle.finger;
      x += Math.sign(across) * 16 * Math.sin(particle.finger * 5 + particle.phase) * settle(e - .9, 1.6);
      z += Math.sign(depth) * 16 * Math.sin(particle.finger * 7 + particle.phase) * settle(e - .9, 1.6);
      y += hang;
    }
  }
  return [x, y, z];
};

// SVG 판: 옆에서 본 위치.
export const inkPosition = (particle: InkParticle, e: number) => {
  const [x, y] = shape(particle, e);
  const [dx, dy] = walkAt(particle.walk, diffusedAt(e) ** 2);
  return [reflect(x + dx, tank.left + 12, tank.right - 12), reflect(y + dy, surface + 10, tank.bottom - 12)];
};

// Three.js 판: 같은 x, y 에 앞뒤로도 무작위 걸음을 더한 위치. 앞뒤 걸음은 처음 쓸 때 만든다.
let depthWalks: Float32Array | undefined;
export const inkPosition3d = (p: number, e: number) => {
  if (!depthWalks) {
    const steps = gaussian(20152, PARTICLES * WALK);
    depthWalks = new Float32Array(PARTICLES * (WALK + 1));
    for (let q = 0; q < PARTICLES; q++) {
      for (let k = 0; k < WALK; k++) {
        depthWalks[q * (WALK + 1) + k + 1] = depthWalks[q * (WALK + 1) + k] + steps[q * WALK + k] * 40;
      }
    }
  }
  const particle = inkParticles[p];
  const [x, y, z] = shape(particle, e);
  const amount = diffusedAt(e) ** 2;
  const [dx, dy] = walkAt(particle.walk, amount);
  const position = clamp(amount) * WALK;
  const k = Math.min(Math.floor(position), WALK - 1);
  const dz = lerp(depthWalks[p * (WALK + 1) + k], depthWalks[p * (WALK + 1) + k + 1], position - k);
  return [
    reflect(x + dx, tank.left + 12, tank.right - 12),
    reflect(y + dy, surface + 10, tank.bottom - 12),
    reflect(z + dz, -DEPTH / 2 + 12, DEPTH / 2 - 12),
  ];
};
