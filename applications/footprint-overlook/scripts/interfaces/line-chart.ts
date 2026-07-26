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
import { formatCount, MISSING_TEXT } from '../tools/formatting.ts';
import { getSteppedChartWidth } from '../tools/responsive-chart-steps.ts';
import type { DayValue } from '../tools/zero-filling.ts';
import { clearElement } from './section-states.ts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const BASE_DIMENSIONS: Omit<ChartDimensions, 'width'> = {
  height: 300,
  paddingLeft: 44,
  paddingRight: 16,
  paddingTop: 16,
  paddingBottom: 34,
};

const Y_TICK_COUNT = 4;
const MAXIMUM_X_LABELS = 7;

const SERIES_CLASS = {
  footprints: 'series-footprints',
  visitors: 'series-visitors',
  bots: 'series-bots',
} as const;

function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tagName);
}

function toShortDayLabel(day: string): string {
  const match = day.match(/\d{4}-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : day;
}

function appendYAxis(svg: SVGSVGElement, maximumValue: number, dimensions: ChartDimensions): void {
  const ticks = computeYAxisTicks(maximumValue, Y_TICK_COUNT);
  for (const tickValue of ticks) {
    const y = valueToY(tickValue, maximumValue, dimensions);

    const gridLine = createSvgElement('line');
    gridLine.setAttribute('class', 'chart-grid-line');
    gridLine.setAttribute('x1', String(dimensions.paddingLeft));
    gridLine.setAttribute('x2', String(dimensions.width - dimensions.paddingRight));
    gridLine.setAttribute('y1', String(y));
    gridLine.setAttribute('y2', String(y));
    svg.appendChild(gridLine);

    const label = createSvgElement('text');
    label.setAttribute('class', 'chart-axis-label chart-axis-label-y');
    label.setAttribute('x', String(dimensions.paddingLeft - 8));
    label.setAttribute('y', String(y + 3));
    label.setAttribute('text-anchor', 'end');
    label.textContent = formatCount(tickValue);
    svg.appendChild(label);
  }
}

function appendXAxis(svg: SVGSVGElement, days: ReadonlyArray<string>, dimensions: ChartDimensions): void {
  const count = days.length;
  if (count === 0) {
    return;
  }
  const step = Math.max(1, Math.ceil(count / MAXIMUM_X_LABELS));
  const baselineY = dimensions.height - dimensions.paddingBottom;

  for (let index = 0; index < count; index += step) {
    const x = indexToX(index, count, dimensions);
    const label = createSvgElement('text');
    label.setAttribute('class', 'chart-axis-label chart-axis-label-x');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(baselineY + 18));
    label.setAttribute('text-anchor', 'middle');
    label.textContent = toShortDayLabel(days[index]);
    svg.appendChild(label);
  }
}

function appendSeries(
  svg: SVGSVGElement,
  points: ReadonlyArray<Point>,
  seriesClass: string,
  dimensions: ChartDimensions,
  withArea = true,
  visible = true,
): void {
  if (points.length === 0 || !visible) {
    return;
  }
  const baselineY = dimensions.height - dimensions.paddingBottom;

  if (withArea) {
    const area = createSvgElement('path');
    area.setAttribute('class', `chart-area ${seriesClass}`);
    area.setAttribute('d', toAreaPath(points, baselineY));
    svg.appendChild(area);
  }

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

function buildAccessibleTable(
  days: ReadonlyArray<string>,
  footprints: ReadonlyArray<DayValue>,
  visitors: ReadonlyArray<DayValue>,
  bots: ReadonlyArray<DayValue> | null,
): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'visually-hidden';

  const caption = document.createElement('caption');
  caption.textContent = '일별 트래픽 데이터 상세 테이블';
  table.appendChild(caption);

  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  ['날짜', '페이지 뷰', '방문자', '봇'].forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  days.forEach((day, index) => {
    const row = document.createElement('tr');

    const dayCell = document.createElement('td');
    dayCell.textContent = day;
    row.appendChild(dayCell);

    const footprintCell = document.createElement('td');
    footprintCell.textContent = String(footprints[index]?.value ?? 0);
    row.appendChild(footprintCell);

    const visitorCell = document.createElement('td');
    visitorCell.textContent = String(visitors[index]?.value ?? 0);
    row.appendChild(visitorCell);

    // The dash, not 'N/A': this is the same "not measured" the rest of the page renders as 미상,
    // and a screen reader should hear the page's own vocabulary rather than a second one.
    const botCell = document.createElement('td');
    botCell.textContent = bots === null ? MISSING_TEXT : String(bots[index]?.value ?? 0);
    row.appendChild(botCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  return table;
}

export interface LineChartHandle {
  element: HTMLElement;
  render(
    footprints: ReadonlyArray<DayValue>,
    visitors: ReadonlyArray<DayValue>,
    bots: ReadonlyArray<DayValue> | null,
  ): void;
  // Disconnects the ResizeObserver below. The chart is rebuilt whenever the dashboard is torn down
  // and re-mounted (view switch), and an observer that outlives its element keeps both the callback
  // and the detached container alive.
  teardown(): void;
}

export function createLineChart(): LineChartHandle {
  const container = document.createElement('div');
  container.className = 'chart';

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  container.appendChild(legend);

  const svgWrap = document.createElement('div');
  svgWrap.className = 'chart-svg-wrap';
  container.appendChild(svgWrap);

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.setAttribute('role', 'status');
  svgWrap.appendChild(tooltip);

  let currentFootprints: ReadonlyArray<DayValue> = [];
  let currentVisitors: ReadonlyArray<DayValue> = [];
  let currentBots: ReadonlyArray<DayValue> | null = null;

  const seriesVisibility = {
    footprints: true,
    visitors: true,
    bots: true,
  };

  let currentViewBoxWidth: 720 | 1080 | 1440 = 720;

  function renderLegend(legendElement: HTMLElement, hasBots: boolean): void {
    clearElement(legendElement);

    const items: Array<{ key: 'footprints' | 'visitors' | 'bots'; label: string; seriesClass: string }> = [
      { key: 'footprints', label: '페이지 뷰', seriesClass: SERIES_CLASS.footprints },
      { key: 'visitors', label: '방문자', seriesClass: SERIES_CLASS.visitors },
    ];
    if (hasBots) {
      items.push({ key: 'bots', label: '봇', seriesClass: SERIES_CLASS.bots });
    }

    for (const item of items) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = `legend-entry ${seriesVisibility[item.key] ? '' : 'is-disabled'}`;
      entry.style.background = 'none';
      entry.style.border = 'none';
      entry.style.cursor = 'pointer';
      entry.style.opacity = seriesVisibility[item.key] ? '1' : '0.35';

      const swatch = document.createElement('span');
      swatch.className = `legend-swatch ${item.seriesClass}`;
      entry.appendChild(swatch);

      const text = document.createElement('span');
      text.textContent = item.label;
      entry.appendChild(text);

      entry.addEventListener('click', () => {
        seriesVisibility[item.key] = !seriesVisibility[item.key];
        drawChart();
      });

      legendElement.appendChild(entry);
    }
  }

  function drawChart(): void {
    const hasBots = currentBots !== null;
    renderLegend(legend, hasBots);

    clearElement(svgWrap);
    svgWrap.appendChild(tooltip);
    tooltip.classList.remove('is-visible');

    const dimensions: ChartDimensions = {
      ...BASE_DIMENSIONS,
      width: currentViewBoxWidth,
    };

    const footprintValues = currentFootprints.map((dayValue) => dayValue.value);
    const visitorValues = currentVisitors.map((dayValue) => dayValue.value);
    const botValues = currentBots?.map((dayValue) => dayValue.value) ?? [];
    // The footprint series is the zero-filled window (tools/zero-filling.ts), so it carries every
    // day of the range in order and is the x axis for all three series.
    const days = currentFootprints.map((dayValue) => dayValue.day);

    const rawMaximum = findMaximumValue(footprintValues, visitorValues, botValues);
    const maximumValue = computeNiceMaximum(rawMaximum);

    const svg = createSvgElement('svg');
    // chart-focusable marks the element that actually takes focus (tabindex below) so the
    // stylesheet has one selector for the keyboard focus ring; chart-svg stays the layout hook.
    svg.setAttribute('class', 'chart-svg chart-focusable');
    svg.setAttribute('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-label', hasBots ? '일별 페이지 뷰·방문자·봇 추이 (화살표 키로 일자 이동)' : '일별 페이지 뷰와 방문자 추이 (화살표 키로 일자 이동)');

    appendYAxis(svg, maximumValue, dimensions);
    appendXAxis(svg, days, dimensions);

    const footprintPoints = computeSeriesPoints(footprintValues, maximumValue, dimensions);
    const visitorPoints = computeSeriesPoints(visitorValues, maximumValue, dimensions);
    const botPoints = hasBots ? computeSeriesPoints(botValues, maximumValue, dimensions) : [];

    appendSeries(svg, visitorPoints, SERIES_CLASS.visitors, dimensions, true, seriesVisibility.visitors);
    appendSeries(svg, footprintPoints, SERIES_CLASS.footprints, dimensions, true, seriesVisibility.footprints);
    if (hasBots) {
      appendSeries(svg, botPoints, SERIES_CLASS.bots, dimensions, false, seriesVisibility.bots);
    }

    const guide = createSvgElement('line');
    guide.setAttribute('class', 'chart-hover-guide');
    guide.setAttribute('y1', String(dimensions.paddingTop));
    guide.setAttribute('y2', String(dimensions.height - dimensions.paddingBottom));
    guide.style.display = 'none';
    svg.appendChild(guide);

    svgWrap.appendChild(svg);
    svgWrap.appendChild(buildAccessibleTable(days, currentFootprints, currentVisitors, currentBots));

    wireInteractions({ svg, guide, tooltip, days, footprints: currentFootprints, visitors: currentVisitors, bots: currentBots, dimensions });
  }

  const render = (
    footprints: ReadonlyArray<DayValue>,
    visitors: ReadonlyArray<DayValue>,
    bots: ReadonlyArray<DayValue> | null,
  ): void => {
    currentFootprints = footprints;
    currentVisitors = visitors;
    currentBots = bots;
    drawChart();
  };

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const steppedWidth = getSteppedChartWidth(entry.contentRect.width);
        if (steppedWidth !== currentViewBoxWidth) {
          currentViewBoxWidth = steppedWidth;
          if (currentFootprints.length > 0) {
            drawChart();
          }
        }
      }
    });
    resizeObserver.observe(container);
  }

  const teardown = (): void => {
    resizeObserver?.disconnect();
    resizeObserver = null;
  };

  return { element: container, render, teardown };
}

function wireInteractions(context: {
  svg: SVGSVGElement;
  guide: SVGLineElement;
  tooltip: HTMLElement;
  days: ReadonlyArray<string>;
  footprints: ReadonlyArray<DayValue>;
  visitors: ReadonlyArray<DayValue>;
  bots: ReadonlyArray<DayValue> | null;
  dimensions: ChartDimensions;
}): void {
  const { svg, guide, tooltip, days, footprints, visitors, bots, dimensions } = context;
  const count = days.length;
  if (count === 0) {
    return;
  }

  let focusedIndex = -1;

  function updateTooltipForIndex(index: number): void {
    focusedIndex = index;
    const guideX = indexToX(index, count, dimensions);
    guide.setAttribute('x1', String(guideX));
    guide.setAttribute('x2', String(guideX));
    guide.style.display = 'block';

    tooltip.classList.add('is-visible');
    tooltip.style.left = `${(guideX / dimensions.width) * 100}%`;
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
  }

  // Which day the pointer is over, or null when the element has no laid-out width yet.
  const toIndexFromEvent = (event: PointerEvent): number | null => {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) {
      return null;
    }
    const viewBoxX = ((event.clientX - rect.left) / rect.width) * dimensions.width;
    const plotWidth = dimensions.width - dimensions.paddingLeft - dimensions.paddingRight;
    const ratio = plotWidth <= 0 ? 0 : (viewBoxX - dimensions.paddingLeft) / plotWidth;
    return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
  };

  const hideTooltip = (): void => {
    focusedIndex = -1;
    guide.style.display = 'none';
    tooltip.classList.remove('is-visible');
  };

  // Set when a tap CLOSED the tooltip, and cleared when that finger lifts. Without it the stray
  // pointermove some browsers emit for a stationary tap would re-open what the tap just closed.
  let closedByCurrentGesture = false;

  const handleMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' && closedByCurrentGesture) {
      return;
    }
    const index = toIndexFromEvent(event);
    if (index !== null) {
      updateTooltipForIndex(index);
    }
  };

  // A touch never hovers: the browser fires pointerdown/move/up and then pointerleave the instant
  // the finger lifts, so on a phone the tooltip used to flash and vanish and the chart was
  // effectively unreadable. Leave therefore closes the tooltip only for a real hovering device;
  // a touch or pen tap toggles it instead, and tapping the same day again closes it.
  const handleLeave = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      hideTooltip();
    }
  };

  const handleDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      return;
    }
    const index = toIndexFromEvent(event);
    if (index === null) {
      return;
    }
    if (index === focusedIndex && tooltip.classList.contains('is-visible')) {
      hideTooltip();
      closedByCurrentGesture = true;
      return;
    }
    closedByCurrentGesture = false;
    updateTooltipForIndex(index);
  };

  const handleGestureEnd = (): void => {
    closedByCurrentGesture = false;
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextIndex = focusedIndex <= 0 ? count - 1 : focusedIndex - 1;
      updateTooltipForIndex(nextIndex);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextIndex = focusedIndex >= count - 1 ? 0 : focusedIndex + 1;
      updateTooltipForIndex(nextIndex);
    }
  };

  svg.addEventListener('pointerdown', handleDown);
  svg.addEventListener('pointermove', handleMove);
  svg.addEventListener('pointerup', handleGestureEnd);
  svg.addEventListener('pointercancel', handleGestureEnd);
  svg.addEventListener('pointerleave', handleLeave);
  svg.addEventListener('keydown', handleKeydown);
}
