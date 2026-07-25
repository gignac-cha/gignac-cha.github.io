// Hand-drawn SVG line/area chart — no chart or date library. It overlays three series (page views,
// distinct visitors and bot views per day) on one shared y axis, with axis labels and a small
// hover tooltip; the bot series is drawn as a muted dashed line so it reads as a subset of the
// page-view line rather than a competing metric. Every coordinate and path string comes from the
// pure chart-geometry module, leaving only element assembly here.
//
// The CSS class names and the internal identifiers keep saying "footprints": they name the QUERY
// the series comes from (footprints-by-day) and the storage column behind it, which the de-theming
// deliberately left alone. Only what a reader sees — legend, tooltip, aria-label — says 페이지 뷰.

import {
  type ChartDimensions,
  type Point,
  computeNiceMaximum,
  computeSeriesPoints,
  computeYAxisTicks,
  findMaximumValue,
  indexToX,
  toAreaPath,
  toPolylinePoints,
  valueToY,
} from '../tools/chart-geometry.ts';
import { formatCount } from '../tools/formatting.ts';
import type { DayValue } from '../tools/zero-filling.ts';
import { clearElement } from './section-states.ts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// Fixed viewBox dimensions. The SVG scales to 100% width in CSS, so the chart is responsive
// without measuring the DOM — no resize observer, no re-render on layout change, and the geometry
// stays deterministic and testable.
// See https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
const DIMENSIONS: ChartDimensions = {
  width: 720,
  height: 300,
  paddingLeft: 44,
  paddingRight: 16,
  paddingTop: 16,
  paddingBottom: 34,
};

const Y_TICK_COUNT = 4;
const MAXIMUM_X_LABELS = 7;

// Per-series CSS classes; the colours themselves live in styles/_chart.scss.
const SERIES_CLASS = {
  footprints: 'series-footprints',
  visitors: 'series-visitors',
  bots: 'series-bots',
} as const;

function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tagName);
}

// Shortens a UTC 'YYYY-MM-DD' key to 'MM-DD' for the x axis.
function toShortDayLabel(day: string): string {
  const match = day.match(/\d{4}-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : day;
}

// Draws the y-axis grid lines and their labels.
function appendYAxis(svg: SVGSVGElement, maximumValue: number): void {
  const ticks = computeYAxisTicks(maximumValue, Y_TICK_COUNT);
  for (const tickValue of ticks) {
    const y = valueToY(tickValue, maximumValue, DIMENSIONS);

    const gridLine = createSvgElement('line');
    gridLine.setAttribute('class', 'chart-grid-line');
    gridLine.setAttribute('x1', String(DIMENSIONS.paddingLeft));
    gridLine.setAttribute('x2', String(DIMENSIONS.width - DIMENSIONS.paddingRight));
    gridLine.setAttribute('y1', String(y));
    gridLine.setAttribute('y2', String(y));
    svg.appendChild(gridLine);

    const label = createSvgElement('text');
    label.setAttribute('class', 'chart-axis-label chart-axis-label-y');
    label.setAttribute('x', String(DIMENSIONS.paddingLeft - 8));
    label.setAttribute('y', String(y + 3));
    label.setAttribute('text-anchor', 'end');
    label.textContent = formatCount(tickValue);
    svg.appendChild(label);
  }
}

// Draws x-axis date labels at even intervals, thinned to at most MAXIMUM_X_LABELS so a 90-day
// range does not render 90 overlapping labels.
function appendXAxis(svg: SVGSVGElement, days: ReadonlyArray<string>): void {
  const count = days.length;
  if (count === 0) {
    return;
  }
  const step = Math.max(1, Math.ceil(count / MAXIMUM_X_LABELS));
  const baselineY = DIMENSIONS.height - DIMENSIONS.paddingBottom;

  for (let index = 0; index < count; index += step) {
    const x = indexToX(index, count, DIMENSIONS);
    const label = createSvgElement('text');
    label.setAttribute('class', 'chart-axis-label chart-axis-label-x');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(baselineY + 18));
    label.setAttribute('text-anchor', 'middle');
    label.textContent = toShortDayLabel(days[index]);
    svg.appendChild(label);
  }
}

// Draws one series (area + line). withArea=false draws the line alone, which is what the dashed
// bot series uses — a third translucent fill would muddy the two underneath it.
function appendSeries(svg: SVGSVGElement, points: ReadonlyArray<Point>, seriesClass: string, withArea = true): void {
  if (points.length === 0) {
    return;
  }
  const baselineY = DIMENSIONS.height - DIMENSIONS.paddingBottom;

  if (withArea) {
    const area = createSvgElement('path');
    area.setAttribute('class', `chart-area ${seriesClass}`);
    area.setAttribute('d', toAreaPath(points, baselineY));
    svg.appendChild(area);
  }

  // A polyline through a single point renders nothing at all, so a one-day range is drawn as a
  // dot instead.
  if (points.length === 1) {
    const dot = createSvgElement('circle');
    dot.setAttribute('class', `chart-point ${seriesClass}`);
    dot.setAttribute('cx', String(points[0].x));
    dot.setAttribute('cy', String(points[0].y));
    dot.setAttribute('r', '3');
    svg.appendChild(dot);
    return;
  }

  const line = createSvgElement('polyline');
  line.setAttribute('class', `chart-line ${seriesClass}`);
  line.setAttribute('points', toPolylinePoints(points));
  svg.appendChild(line);
}

// Rebuilds the legend, including the bot entry only when a bot series is present.
function renderLegend(legend: HTMLElement, hasBots: boolean): void {
  clearElement(legend);

  const items: { label: string; seriesClass: string }[] = [
    { label: '페이지 뷰', seriesClass: SERIES_CLASS.footprints },
    { label: '방문자', seriesClass: SERIES_CLASS.visitors },
  ];
  if (hasBots) {
    items.push({ label: '봇', seriesClass: SERIES_CLASS.bots });
  }

  for (const item of items) {
    const entry = document.createElement('span');
    entry.className = 'legend-entry';

    const swatch = document.createElement('span');
    swatch.className = `legend-swatch ${item.seriesClass}`;
    entry.appendChild(swatch);

    const text = document.createElement('span');
    text.textContent = item.label;
    entry.appendChild(text);

    legend.appendChild(entry);
  }
}

export interface LineChartHandle {
  element: HTMLElement;
  // A null `bots` (query failed or unsupported) omits the series and its legend entry entirely —
  // distinct from an all-zero series, which would claim "no bots visited".
  render(
    footprints: ReadonlyArray<DayValue>,
    visitors: ReadonlyArray<DayValue>,
    bots: ReadonlyArray<DayValue> | null,
  ): void;
}

// Builds the container (legend + SVG); render() redraws the series in place.
export function createLineChart(): LineChartHandle {
  const container = document.createElement('div');
  container.className = 'chart';

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  container.appendChild(legend);

  const svgWrap = document.createElement('div');
  svgWrap.className = 'chart-svg-wrap';
  container.appendChild(svgWrap);

  // Hover tooltip: the values of the nearest day. It lives outside the SVG (and survives each
  // redraw) because HTML text wraps and styles far more easily than an SVG <text> block.
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.setAttribute('role', 'status');
  svgWrap.appendChild(tooltip);

  const render = (
    footprints: ReadonlyArray<DayValue>,
    visitors: ReadonlyArray<DayValue>,
    bots: ReadonlyArray<DayValue> | null,
  ): void => {
    const hasBots = bots !== null;
    renderLegend(legend, hasBots);

    clearElement(svgWrap);
    svgWrap.appendChild(tooltip);
    tooltip.classList.remove('is-visible');

    const footprintValues = footprints.map((dayValue) => dayValue.value);
    const visitorValues = visitors.map((dayValue) => dayValue.value);
    const botValues = bots?.map((dayValue) => dayValue.value) ?? [];
    const days = footprints.map((dayValue) => dayValue.day);

    // The bot values take part in the maximum too: the three series share one axis, and scaling
    // it without them would let the dashed line escape the top of the plot.
    const rawMaximum = findMaximumValue(footprintValues, visitorValues, botValues);
    const maximumValue = computeNiceMaximum(rawMaximum);

    const svg = createSvgElement('svg');
    svg.setAttribute('class', 'chart-svg');
    svg.setAttribute('viewBox', `0 0 ${DIMENSIONS.width} ${DIMENSIONS.height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', hasBots ? '일별 페이지 뷰·방문자·봇 추이' : '일별 페이지 뷰와 방문자 추이');

    appendYAxis(svg, maximumValue);
    appendXAxis(svg, days);

    const footprintPoints = computeSeriesPoints(footprintValues, maximumValue, DIMENSIONS);
    const visitorPoints = computeSeriesPoints(visitorValues, maximumValue, DIMENSIONS);
    const botPoints = hasBots ? computeSeriesPoints(botValues, maximumValue, DIMENSIONS) : [];

    // Painting order is meaningful in SVG (later elements sit on top): visitors, then footprints,
    // then the dashed bot line last so it stays readable over both filled areas.
    appendSeries(svg, visitorPoints, SERIES_CLASS.visitors);
    appendSeries(svg, footprintPoints, SERIES_CLASS.footprints);
    if (hasBots) {
      appendSeries(svg, botPoints, SERIES_CLASS.bots, false);
    }

    // Vertical guide line shown while hovering.
    const guide = createSvgElement('line');
    guide.setAttribute('class', 'chart-hover-guide');
    guide.setAttribute('y1', String(DIMENSIONS.paddingTop));
    guide.setAttribute('y2', String(DIMENSIONS.height - DIMENSIONS.paddingBottom));
    guide.style.display = 'none';
    svg.appendChild(guide);

    svgWrap.appendChild(svg);

    wireHover({ svg, guide, tooltip, days, footprints, visitors, bots });
  };

  return { element: container, render };
}

// Wires the hover interaction, mapping the pointer's x position to a data index through the
// viewBox ratio. Pointer events rather than mouse events so pen and touch input work too.
// See https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
function wireHover(context: {
  svg: SVGSVGElement;
  guide: SVGLineElement;
  tooltip: HTMLElement;
  days: ReadonlyArray<string>;
  footprints: ReadonlyArray<DayValue>;
  visitors: ReadonlyArray<DayValue>;
  bots: ReadonlyArray<DayValue> | null;
}): void {
  const { svg, guide, tooltip, days, footprints, visitors, bots } = context;
  const count = days.length;
  if (count === 0) {
    return;
  }

  const handleMove = (event: PointerEvent): void => {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }
    // Screen coordinates -> viewBox coordinates. The rendered width is whatever CSS decided, so
    // the ratio is the only way back to the fixed coordinate system the geometry uses.
    const viewBoxX = ((event.clientX - rect.left) / rect.width) * DIMENSIONS.width;
    // Position within the plot area -> nearest data index, clamped to the ends so the pointer
    // stays useful over the padding.
    const plotWidth = DIMENSIONS.width - DIMENSIONS.paddingLeft - DIMENSIONS.paddingRight;
    const ratio = plotWidth <= 0 ? 0 : (viewBoxX - DIMENSIONS.paddingLeft) / plotWidth;
    const index = Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));

    const guideX = indexToX(index, count, DIMENSIONS);
    guide.setAttribute('x1', String(guideX));
    guide.setAttribute('x2', String(guideX));
    guide.style.display = 'block';

    tooltip.classList.add('is-visible');
    tooltip.style.left = `${(guideX / DIMENSIONS.width) * 100}%`;
    clearElement(tooltip);

    const dayLabel = document.createElement('div');
    dayLabel.className = 'chart-tooltip-day';
    dayLabel.textContent = days[index];
    tooltip.appendChild(dayLabel);

    const footprintRow = document.createElement('div');
    footprintRow.className = 'chart-tooltip-row';
    footprintRow.textContent = `페이지 뷰 ${formatCount(footprints[index]?.value ?? 0)}`;
    tooltip.appendChild(footprintRow);

    const visitorRow = document.createElement('div');
    visitorRow.className = 'chart-tooltip-row';
    visitorRow.textContent = `방문자 ${formatCount(visitors[index]?.value ?? 0)}`;
    tooltip.appendChild(visitorRow);

    if (bots !== null) {
      const botRow = document.createElement('div');
      botRow.className = 'chart-tooltip-row';
      botRow.textContent = `봇 ${formatCount(bots[index]?.value ?? 0)}`;
      tooltip.appendChild(botRow);
    }
  };

  const handleLeave = (): void => {
    guide.style.display = 'none';
    tooltip.classList.remove('is-visible');
  };

  svg.addEventListener('pointermove', handleMove);
  svg.addEventListener('pointerleave', handleLeave);
}
