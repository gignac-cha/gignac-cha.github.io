// Geometry for the hand-drawn SVG line/area chart — scales, coordinates and path strings — as
// pure functions with no DOM access, so every edge case (empty series, a single point, an
// all-zero period) is unit-tested in plain node (chart-geometry.test.ts). Building the SVG
// elements themselves is interfaces/line-chart.ts's job; keeping the arithmetic out of there is
// what makes it testable at all.

// One point in pixel coordinates.
export interface Point {
  x: number;
  y: number;
}

// Canvas size plus the inner padding reserved for axis labels.
export interface ChartDimensions {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}

// Rounds to two decimals. Division-derived coordinates otherwise land in the SVG markup as
// 17.333333333333332, which bloats the document and makes the geometry tests assert on floating
// point noise; two decimals is well below one device pixel at any rendered size.
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// Size of the plot area (the canvas minus its padding).
export function computePlotSize(dimensions: ChartDimensions): { width: number; height: number } {
  return {
    width: Math.max(0, dimensions.width - dimensions.paddingLeft - dimensions.paddingRight),
    height: Math.max(0, dimensions.height - dimensions.paddingTop - dimensions.paddingBottom),
  };
}

// Maps values (index 0..N-1 along x) to pixel coordinates.
// - No points yields an empty list; a single point is centred horizontally, because the usual
//   index/(count-1) spacing would divide by zero there.
// - A maximumValue of 0 or less puts every point on the baseline: an all-zero period is a flat
//   line at the bottom, not a division by zero.
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

// Serializes points into the `points` attribute of an SVG polyline/polygon.
export function toPolylinePoints(points: ReadonlyArray<Point>): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
}

// Builds the filled area path under a line, closed down to the baseline.
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

// Rounds the shared y-axis maximum up to a readable number: 0 -> 1, 7 -> 10, 23 -> 25, 48 -> 50.
// Using the raw maximum instead would pin the tallest point to the very top of the plot and label
// the axis with arbitrary values like 23; the 1 / 2 / 2.5 / 5 / 10 ladder keeps tick labels round
// at every magnitude. A zero or non-finite input returns 1 so the axis never collapses.
export function computeNiceMaximum(rawMaximum: number): number {
  if (!Number.isFinite(rawMaximum) || rawMaximum <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawMaximum));
  const normalized = rawMaximum / magnitude; // in [1, 10)

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

  // toPrecision, not Math.round: rounding to an integer would destroy the 2.5 rung of the ladder
  // (a raw maximum of 2.3 must become 2.5, not 3). This only strips the floating-point noise that
  // the multiply reintroduces.
  return Number((niceNormalized * magnitude).toPrecision(12));
}

// Largest value across several series at once — the three chart lines share one y axis, so they
// must be scaled together. Empty input yields 0.
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

// y-axis tick values from 0 to maximumValue. tickCount counts INTERVALS, so the result has
// tickCount + 1 entries (both ends included).
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

// Maps one value to its y pixel coordinate (used to place axis tick labels).
export function valueToY(value: number, maximumValue: number, dimensions: ChartDimensions): number {
  const plot = computePlotSize(dimensions);
  const baselineY = dimensions.paddingTop + plot.height;
  const ratio = maximumValue <= 0 ? 0 : value / maximumValue;
  return round(baselineY - plot.height * ratio);
}

// Maps one x index to its pixel coordinate (x-axis labels and hover hit-testing). Must stay in
// step with computeSeriesPoints above — the hover guide would otherwise sit beside its data point.
export function indexToX(index: number, count: number, dimensions: ChartDimensions): number {
  const plot = computePlotSize(dimensions);
  if (count <= 1) {
    return round(dimensions.paddingLeft + plot.width / 2);
  }
  return round(dimensions.paddingLeft + (plot.width * index) / (count - 1));
}
