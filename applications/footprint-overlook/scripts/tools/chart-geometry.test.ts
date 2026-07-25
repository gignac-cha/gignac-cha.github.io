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

// A plain 100x100 canvas with no padding, so coordinates read as percentages.
const SIMPLE: ChartDimensions = {
  width: 100,
  height: 100,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
};

// A padded canvas: an 80x80 plot area starting at (10, 10).
const PADDED: ChartDimensions = {
  width: 100,
  height: 100,
  paddingLeft: 10,
  paddingRight: 10,
  paddingTop: 10,
  paddingBottom: 10,
};

describe('computePlotSize', () => {
  it('subtracts the padding from the canvas', () => {
    expect(computePlotSize(PADDED)).toEqual({ width: 80, height: 80 });
  });

  it('clamps to 0 when the padding exceeds the canvas', () => {
    // Vertical padding is untouched (0), so height stays 100; the horizontal padding sums to 160
    // against a width of 100, so only width clamps.
    expect(computePlotSize({ ...SIMPLE, paddingLeft: 80, paddingRight: 80 })).toEqual({ width: 0, height: 100 });
  });
});

describe('computeSeriesPoints', () => {
  it('returns no points for an empty series', () => {
    expect(computeSeriesPoints([], 10, SIMPLE)).toEqual([]);
  });

  it('centres a single point horizontally', () => {
    const points = computeSeriesPoints([5], 10, SIMPLE);
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe(50); // horizontal centre
    expect(points[0].y).toBe(50); // 5 of 10 -> half height
  });

  it('puts the maximum at the top and a zero on the baseline', () => {
    const points = computeSeriesPoints([0, 10], 10, SIMPLE);
    expect(points[0]).toEqual({ x: 0, y: 100 }); // 0 -> baseline
    expect(points[1]).toEqual({ x: 100, y: 0 }); // maximum -> top
  });

  it('flattens every point onto the baseline when the maximum is 0', () => {
    expect(computeSeriesPoints([0, 0, 0], 0, SIMPLE).map((point) => point.y)).toEqual([100, 100, 100]);
  });

  it('places points inside the padded plot area', () => {
    const points = computeSeriesPoints([0, 10], 10, PADDED);
    // Two points share the 80px plot width end to end -> x = 10 and 90.
    expect(points[0]).toEqual({ x: 10, y: 90 }); // 0 -> baseline (paddingTop + plotHeight)
    expect(points[1]).toEqual({ x: 90, y: 10 }); // maximum -> top (paddingTop)
  });

  it('spaces points evenly along x', () => {
    const points = computeSeriesPoints([1, 2, 3, 4, 5], 5, SIMPLE);
    expect(points.map((point) => point.x)).toEqual([0, 25, 50, 75, 100]);
  });
});

describe('toPolylinePoints', () => {
  it('joins points into an "x,y x,y" string', () => {
    expect(toPolylinePoints([{ x: 0, y: 100 }, { x: 50, y: 0 }])).toBe('0,100 50,0');
  });

  it('returns an empty string for no points', () => {
    expect(toPolylinePoints([])).toBe('');
  });
});

describe('toAreaPath', () => {
  it('closes the line down to the baseline', () => {
    const path = toAreaPath([{ x: 0, y: 20 }, { x: 100, y: 80 }], 100);
    expect(path).toBe('M 0 20 L 100 80 L 100 100 L 0 100 Z');
  });

  it('returns an empty string for no points', () => {
    expect(toAreaPath([], 100)).toBe('');
  });

  it('still closes the path for a single point', () => {
    expect(toAreaPath([{ x: 50, y: 30 }], 100)).toBe('M 50 30 L 50 100 L 50 100 Z');
  });
});

describe('computeNiceMaximum', () => {
  it('lifts a zero or non-finite maximum to 1', () => {
    expect(computeNiceMaximum(0)).toBe(1);
    expect(computeNiceMaximum(-5)).toBe(1);
    expect(computeNiceMaximum(Number.NaN)).toBe(1);
  });

  it('rounds up to a readable bound', () => {
    expect(computeNiceMaximum(1)).toBe(1);
    expect(computeNiceMaximum(7)).toBe(10);
    expect(computeNiceMaximum(23)).toBe(25);
    expect(computeNiceMaximum(48)).toBe(50);
    expect(computeNiceMaximum(50)).toBe(50);
    expect(computeNiceMaximum(120)).toBe(200);
    expect(computeNiceMaximum(2.3)).toBe(2.5);
  });
});

describe('findMaximumValue', () => {
  it('finds the maximum across several series', () => {
    expect(findMaximumValue([1, 5, 3], [2, 9, 4])).toBe(9);
  });

  it('returns 0 for empty input', () => {
    expect(findMaximumValue([], [])).toBe(0);
    expect(findMaximumValue()).toBe(0);
  });

  it('ignores negative and NaN entries', () => {
    expect(findMaximumValue([-3, Number.NaN, 2])).toBe(2);
  });
});

describe('computeYAxisTicks', () => {
  it('divides 0..maximum into evenly spaced ticks', () => {
    expect(computeYAxisTicks(50, 5)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('returns [0] when tickCount is 0 or less', () => {
    expect(computeYAxisTicks(50, 0)).toEqual([0]);
  });
});

describe('valueToY', () => {
  it('maps a value to its y pixel', () => {
    expect(valueToY(0, 10, SIMPLE)).toBe(100);
    expect(valueToY(10, 10, SIMPLE)).toBe(0);
    expect(valueToY(5, 10, SIMPLE)).toBe(50);
  });

  it('maps to the baseline when the maximum is 0', () => {
    expect(valueToY(0, 0, SIMPLE)).toBe(100);
  });
});

describe('indexToX', () => {
  it('maps an index to its x pixel', () => {
    expect(indexToX(0, 5, SIMPLE)).toBe(0);
    expect(indexToX(4, 5, SIMPLE)).toBe(100);
  });

  it('centres a single point', () => {
    expect(indexToX(0, 1, SIMPLE)).toBe(50);
  });
});
