import { describe, expect, it } from 'vitest';

import {
  type ChartDimensions,
  computeNiceMaximum,
  computePlotSize,
  computeSeriesPoints,
  computeYAxisTicks,
  findMaximumValue,
  indexToX,
  toAreaPath,
  toPolylinePoints,
  valueToY,
} from './chart-geometry.ts';

// 여백을 0 으로 둔 단순한 100x100 캔버스로 좌표 산수를 검증하기 쉽게 합니다.
const SIMPLE: ChartDimensions = {
  width: 100,
  height: 100,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
};

// 여백이 있는 캔버스(플롯 영역 80x80, 좌상단에서 10,10 시작).
const PADDED: ChartDimensions = {
  width: 100,
  height: 100,
  paddingLeft: 10,
  paddingRight: 10,
  paddingTop: 10,
  paddingBottom: 10,
};

describe('computePlotSize', () => {
  it('여백을 뺀 플롯 크기를 구한다', () => {
    expect(computePlotSize(PADDED)).toEqual({ width: 80, height: 80 });
  });

  it('여백이 크기를 넘으면 0 으로 클램프한다', () => {
    // 세로 여백은 그대로(0)이므로 height 는 100, 가로 여백 합(160)이 폭(100)을 넘어 width 만 0 으로 클램프됩니다.
    expect(computePlotSize({ ...SIMPLE, paddingLeft: 80, paddingRight: 80 })).toEqual({ width: 0, height: 100 });
  });
});

describe('computeSeriesPoints', () => {
  it('빈 값 배열이면 빈 점 배열이다', () => {
    expect(computeSeriesPoints([], 10, SIMPLE)).toEqual([]);
  });

  it('점이 1개면 플롯 가로 중앙에 둔다', () => {
    const points = computeSeriesPoints([5], 10, SIMPLE);
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe(50); // 가로 중앙
    expect(points[0].y).toBe(50); // 값 5 / 최대 10 → 중간 높이
  });

  it('최댓값 점은 맨 위(y=paddingTop), 0 값 점은 바닥(baseline)에 놓인다', () => {
    const points = computeSeriesPoints([0, 10], 10, SIMPLE);
    expect(points[0]).toEqual({ x: 0, y: 100 }); // 0 → 바닥
    expect(points[1]).toEqual({ x: 100, y: 0 }); // 최댓값 → 꼭대기
  });

  it('전부 0(maximumValue<=0)이면 모든 점이 바닥에 붙는다', () => {
    const points = computeSeriesPoints([0, 0, 0], 0, SIMPLE);
    expect(points.map((point) => point.y)).toEqual([100, 100, 100]);
  });

  it('여백을 반영해 플롯 영역 안에 배치한다', () => {
    const points = computeSeriesPoints([0, 10], 10, PADDED);
    // x: 좌우 여백 10 사이 80 폭을 2점이 양끝에서 나눠 가짐 → 10, 90
    expect(points[0]).toEqual({ x: 10, y: 90 }); // 0 → 바닥(paddingTop+plotHeight=90)
    expect(points[1]).toEqual({ x: 90, y: 10 }); // 최댓값 → 꼭대기(paddingTop=10)
  });

  it('점 간 x 간격이 균등하다', () => {
    const points = computeSeriesPoints([1, 2, 3, 4, 5], 5, SIMPLE);
    expect(points.map((point) => point.x)).toEqual([0, 25, 50, 75, 100]);
  });
});

describe('toPolylinePoints', () => {
  it('점들을 "x,y x,y" 문자열로 잇는다', () => {
    expect(toPolylinePoints([{ x: 0, y: 100 }, { x: 50, y: 0 }])).toBe('0,100 50,0');
  });

  it('빈 배열이면 빈 문자열이다', () => {
    expect(toPolylinePoints([])).toBe('');
  });
});

describe('toAreaPath', () => {
  it('라인 아래를 baseline 까지 닫는 path 를 만든다', () => {
    const path = toAreaPath([{ x: 0, y: 20 }, { x: 100, y: 80 }], 100);
    expect(path).toBe('M 0 20 L 100 80 L 100 100 L 0 100 Z');
  });

  it('빈 배열이면 빈 문자열이다', () => {
    expect(toAreaPath([], 100)).toBe('');
  });

  it('점이 1개여도 닫힌 path 를 만든다', () => {
    expect(toAreaPath([{ x: 50, y: 30 }], 100)).toBe('M 50 30 L 50 100 L 50 100 Z');
  });
});

describe('computeNiceMaximum', () => {
  it('0 이하나 비정상 입력은 1 로 올린다', () => {
    expect(computeNiceMaximum(0)).toBe(1);
    expect(computeNiceMaximum(-5)).toBe(1);
    expect(computeNiceMaximum(Number.NaN)).toBe(1);
  });

  it('보기 좋은 상한으로 올린다', () => {
    expect(computeNiceMaximum(1)).toBe(1);
    expect(computeNiceMaximum(7)).toBe(10);
    expect(computeNiceMaximum(23)).toBe(25);
    expect(computeNiceMaximum(48)).toBe(50);
    expect(computeNiceMaximum(50)).toBe(50);
    expect(computeNiceMaximum(120)).toBe(200);
  });
});

describe('findMaximumValue', () => {
  it('여러 시리즈에서 최댓값을 구한다', () => {
    expect(findMaximumValue([1, 5, 3], [2, 9, 4])).toBe(9);
  });

  it('빈 입력이면 0 이다', () => {
    expect(findMaximumValue([], [])).toBe(0);
    expect(findMaximumValue()).toBe(0);
  });

  it('음수/NaN 은 무시하고 양수 최댓값만 본다', () => {
    expect(findMaximumValue([-3, Number.NaN, 2])).toBe(2);
  });
});

describe('computeYAxisTicks', () => {
  it('0 부터 최댓값까지 등분한 눈금을 만든다', () => {
    expect(computeYAxisTicks(50, 5)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('tickCount 가 0 이하이면 [0] 이다', () => {
    expect(computeYAxisTicks(50, 0)).toEqual([0]);
  });
});

describe('valueToY', () => {
  it('값을 y 픽셀로 변환한다', () => {
    expect(valueToY(0, 10, SIMPLE)).toBe(100);
    expect(valueToY(10, 10, SIMPLE)).toBe(0);
    expect(valueToY(5, 10, SIMPLE)).toBe(50);
  });

  it('maximumValue<=0 이면 바닥 좌표다', () => {
    expect(valueToY(0, 0, SIMPLE)).toBe(100);
  });
});

describe('indexToX', () => {
  it('인덱스를 x 픽셀로 변환한다', () => {
    expect(indexToX(0, 5, SIMPLE)).toBe(0);
    expect(indexToX(4, 5, SIMPLE)).toBe(100);
  });

  it('점이 1개면 가로 중앙이다', () => {
    expect(indexToX(0, 1, SIMPLE)).toBe(50);
  });
});
