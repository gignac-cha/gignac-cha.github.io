// DDPM(Ho 외, 2020)의 실제 잡음 일정: β 가 1000 단계에 걸쳐 0.0001 에서 0.02 로 늘어난다.
// t 단계의 그림 x_t = √ᾱ_t · x_0 + √(1−ᾱ_t) · ε  (ᾱ_t = (1−β_1)(1−β_2)…(1−β_t), ε 는 표준 정규 잡음).
export const STEPS = 1000;
export const alphaBar = (() => {
  const values = [1];
  for (let t = 1; t <= STEPS; t++) {
    const beta = 1e-4 + ((.02 - 1e-4) * (t - 1)) / (STEPS - 1);
    values.push(values[t - 1] * (1 - beta));
  }
  return values;
})();

// 같은 씨앗이면 항상 같은 잡음(탐색해도 같은 그림).
export const gaussian = (seed: number, length: number) => {
  let state = seed >>> 0;
  const uniform = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const values = new Float32Array(length);
  for (let i = 0; i < length; i += 2) {
    const u = Math.max(uniform(), 1e-9);
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    values[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < length) {
      values[i + 1] = r * Math.sin(2 * Math.PI * v);
    }
  }
  return values;
};

// t 단계(소수도 가능)의 그림을 RGBA 로 그린다. image 는 −1~1 로 바꾼 사진, noise 는 같은 크기의 ε.
export const paintStep = (target: ImageData, image: Float32Array, noise: Float32Array, t: number) => {
  const low = Math.floor(t);
  const high = Math.min(low + 1, STEPS);
  const bar = alphaBar[low] + (alphaBar[high] - alphaBar[low]) * (t - low);
  const keep = Math.sqrt(bar);
  const add = Math.sqrt(1 - bar);
  const data = target.data;
  for (let p = 0, c = 0; p < data.length; p += 4, c += 3) {
    for (let k = 0; k < 3; k++) {
      const value = keep * image[c + k] + add * noise[c + k];
      data[p + k] = ((value + 1) / 2) * 255;
    }
    data[p + 3] = 255;
  }
};
