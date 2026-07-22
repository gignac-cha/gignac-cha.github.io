// 손수 그리는 SVG 라인/영역 차트의 지오메트리(스케일·좌표·경로)를 계산하는 순수 함수 계층입니다.
// DOM 의존이 없어 vitest 로 단독 검증할 수 있습니다. SVG 요소 생성은 interfaces/line-chart.ts 가 담당합니다.

// 픽셀 좌표 한 점입니다.
export interface Point {
  x: number;
  y: number;
}

// 차트 캔버스 크기와 축 라벨을 위한 내부 여백입니다.
export interface ChartDimensions {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}

// 좌표 계산에서 소수점 잡음을 줄이기 위한 반올림(소수 2자리)입니다.
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// 플롯 영역(여백을 뺀 실제 그리기 영역)의 가로/세로 크기입니다.
export function computePlotSize(dimensions: ChartDimensions): { width: number; height: number } {
  return {
    width: Math.max(0, dimensions.width - dimensions.paddingLeft - dimensions.paddingRight),
    height: Math.max(0, dimensions.height - dimensions.paddingTop - dimensions.paddingBottom),
  };
}

// 값 배열(인덱스 0..N-1 이 x축)을 픽셀 좌표로 변환합니다.
// - 점이 0개면 빈 배열, 1개면 플롯 가로 중앙에 둡니다.
// - maximumValue 가 0 이하이면 모든 점을 바닥(baseline)에 둡니다(전부 0인 구간).
export function computeSeriesPoints(
  values: ReadonlyArray<number>,
  maximumValue: number,
  dimensions: ChartDimensions,
): Point[] {
  const plot = computePlotSize(dimensions);
  const count = values.length;

  if (count === 0) {
    return [];
  }

  const baselineY = dimensions.paddingTop + plot.height;

  return values.map((value, index) => {
    const x =
      count === 1
        ? dimensions.paddingLeft + plot.width / 2
        : dimensions.paddingLeft + (plot.width * index) / (count - 1);

    const ratio = maximumValue <= 0 ? 0 : value / maximumValue;
    const y = baselineY - plot.height * ratio;

    return { x: round(x), y: round(y) };
  });
}

// 픽셀 점들을 SVG polyline/polygon 의 points 속성 문자열로 변환합니다.
export function toPolylinePoints(points: ReadonlyArray<Point>): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
}

// 라인 아래를 채우는 영역(area) path 를 만듭니다. baseline 까지 내려 닫습니다.
export function toAreaPath(points: ReadonlyArray<Point>, baselineY: number): string {
  if (points.length === 0) {
    return '';
  }

  const [first, ...rest] = points;
  const segments = [`M ${round(first.x)} ${round(first.y)}`];
  for (const point of rest) {
    segments.push(`L ${round(point.x)} ${round(point.y)}`);
  }

  const last = points[points.length - 1];
  segments.push(`L ${round(last.x)} ${round(baselineY)}`);
  segments.push(`L ${round(first.x)} ${round(baselineY)}`);
  segments.push('Z');

  return segments.join(' ');
}

// 여러 시리즈를 함께 그릴 때 공통으로 쓸 y축 최댓값을 "보기 좋은 값"으로 올림합니다.
// 예: 0 -> 1, 7 -> 10, 23 -> 25, 48 -> 50. (축이 데이터 꼭대기에 딱 붙지 않도록.)
export function computeNiceMaximum(rawMaximum: number): number {
  if (!Number.isFinite(rawMaximum) || rawMaximum <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawMaximum));
  const normalized = rawMaximum / magnitude; // [1, 10)

  let niceNormalized: number;
  if (normalized <= 1) {
    niceNormalized = 1;
  } else if (normalized <= 2) {
    niceNormalized = 2;
  } else if (normalized <= 2.5) {
    niceNormalized = 2.5;
  } else if (normalized <= 5) {
    niceNormalized = 5;
  } else {
    niceNormalized = 10;
  }

  return Math.round(niceNormalized * magnitude);
}

// 여러 수치 배열을 한꺼번에 훑어 최댓값을 구합니다(빈 입력이면 0).
export function findMaximumValue(...valueLists: ReadonlyArray<ReadonlyArray<number>>): number {
  let maximum = 0;
  for (const values of valueLists) {
    for (const value of values) {
      if (Number.isFinite(value) && value > maximum) {
        maximum = value;
      }
    }
  }
  return maximum;
}

// y축 눈금 값들을 0 부터 maximumValue 까지 tickCount 등분으로 만듭니다.
// tickCount 는 "구간 수"이므로 눈금 개수는 tickCount + 1 입니다.
export function computeYAxisTicks(maximumValue: number, tickCount: number): number[] {
  if (tickCount <= 0) {
    return [0];
  }

  const ticks: number[] = [];
  for (let index = 0; index <= tickCount; index += 1) {
    ticks.push(round((maximumValue * index) / tickCount));
  }
  return ticks;
}

// 값 하나를 y 픽셀 좌표로 변환합니다(축 눈금 라벨 배치용).
export function valueToY(value: number, maximumValue: number, dimensions: ChartDimensions): number {
  const plot = computePlotSize(dimensions);
  const baselineY = dimensions.paddingTop + plot.height;
  const ratio = maximumValue <= 0 ? 0 : value / maximumValue;
  return round(baselineY - plot.height * ratio);
}

// x 인덱스 하나를 x 픽셀 좌표로 변환합니다(x축 라벨 배치·hover 매핑용).
export function indexToX(index: number, count: number, dimensions: ChartDimensions): number {
  const plot = computePlotSize(dimensions);
  if (count <= 1) {
    return round(dimensions.paddingLeft + plot.width / 2);
  }
  return round(dimensions.paddingLeft + (plot.width * index) / (count - 1));
}
