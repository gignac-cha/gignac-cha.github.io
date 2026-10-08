import { setAttributes, svg, text } from '../../../shared/diagram';

// 스케일링 법칙 논문(Kaplan 외, OpenAI, 2020년 1월)의 실제 맞춤식. L은 테스트 손실(오차, 낮을수록 좋다).
// 식 1.1~1.3: 매개변수 N, 데이터 D(토큰), 연산량 C(PF-일)를 각각 늘릴 때.
export const lossOfParameters = (n: number) => (n / 8.8e13) ** -.076;
export const lossOfData = (d: number) => (d / 5.4e13) ** -.095;
export const lossOfCompute = (c: number) => (c / 3.1e8) ** -.05;
// 학습 곡선(그림 2 왼쪽): 모델 크기 N이 학습 중 글을 tokens 만큼 읽었을 때의 오차.
// 식 1.6(표 3) L(N, S) = (N_c/N)^α_N + (S_c/S_min)^α_S. 논문 학습 배치(512 × 1024 = 2¹⁹ 토큰)로 읽은 토큰을 단계 S로 바꾸고,
// 식 5.4 S_min = S / (1 + B_crit(L)/B), 식 1.4 B_crit(L) = B*/L^(1/α_B) 를 L이 맞물릴 때까지 되풀이해 푼다.
const batch = 2 ** 19;
export const lossOfLearning = (n: number, tokens: number) => {
  const steps = tokens / batch;
  let loss = 4;
  for (let i = 0; i < 40; i++) {
    const minimumSteps = steps / (1 + 2e8 / loss ** (1 / .21) / batch);
    loss = (6.5e13 / n) ** .077 + (2.1e3 / minimumSteps) ** .76;
  }
  return loss;
};

export interface ChartOptions {
  box: { left: number; top: number; width: number; height: number };
  // 가로축은 10의 지수, 세로축은 오차 값(로그 눈금).
  x: [number, number];
  y: [number, number];
  xTicks: [exponent: number, label: string][];
  yTicks: number[];
  xLabel: string;
  yLabel: string;
}

// 로그-로그 그래프. 거듭제곱 법칙은 여기서 곧은 선이 된다.
export const createLogChart = (parent: Element, { box, x, y, xTicks, yTicks, xLabel, yLabel }: ChartOptions) => {
  const group = svg('g', { class: 'sl-chart' }, parent);
  const { left, top, width, height } = box;
  const toX = (exponent: number) => left + ((exponent - x[0]) / (x[1] - x[0])) * width;
  const toY = (value: number) => top + height - ((Math.log10(value) - Math.log10(y[0])) / (Math.log10(y[1]) - Math.log10(y[0]))) * height;

  for (const value of yTicks) {
    svg('line', { class: 'sl-grid', x1: left, y1: toY(value), x2: left + width, y2: toY(value) }, group);
    text(group, left - 14, toY(value) + 8, String(value), { class: 'sl-tick-label', 'text-anchor': 'end' });
  }
  svg('path', { class: 'sl-axis', d: `M${left} ${top - 10} V${top + height} H${left + width + 10}` }, group);
  for (const [exponent, label] of xTicks) {
    svg('line', { class: 'sl-axis', x1: toX(exponent), y1: top + height, x2: toX(exponent), y2: top + height + 8 }, group);
    text(group, toX(exponent), top + height + 36, label, { class: 'sl-tick-label', 'text-anchor': 'middle' });
  }
  text(group, left + width / 2, top + height + 76, xLabel, { class: 'sl-axis-label', 'text-anchor': 'middle' });
  text(group, left - 4, top - 26, yLabel, { class: 'sl-axis-label' });

  // f(지수) = 오차. draw(p)는 from에서 to 쪽으로 p만큼 그린다(점선도 그대로 이어진다).
  const curve = (f: (exponent: number) => number, from: number, to: number, className: string) => {
    const element = svg('path', { class: `sl-curve ${className}` }, group);
    let drawn = -1;
    const draw = (p: number) => {
      const amount = Math.round(p * 120) / 120;
      if (amount === drawn) {
        return;
      }
      drawn = amount;
      const count = Math.max(Math.ceil(amount * 60), 1);
      const points = Array.from({ length: count + 1 }, (_, i) => {
        const exponent = from + (to - from) * amount * (i / count);
        return `${i ? 'L' : 'M'}${toX(exponent).toFixed(1)} ${toY(f(exponent)).toFixed(1)}`;
      });
      setAttributes(element, { d: amount > 0 ? points.join(' ') : '' });
    };
    return { element, draw };
  };

  return { group, toX, toY, curve };
};
