// 손수 그리는 SVG 라인/영역 차트입니다(차트/날짜 라이브러리 의존 0).
// 세 시리즈(발자국 by-day, 고유 방문자 by-day, 봇 발자국 by-day)를 겹쳐 그리고,
// x=일자·y=수치·축 라벨·간단한 hover 툴팁을 제공합니다. 봇 시리즈는 파선(dashed) + 뮤트 색으로 구분합니다.
// 좌표·경로 산수는 모두 순수한 chart-geometry.ts 가 담당하고, 여기서는 SVG 요소만 조립합니다.

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

// viewBox 고정 크기 — CSS 로 폭 100% 스케일하므로 DOM 측정 없이 반응형이 됩니다.
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

// 시리즈별 CSS 클래스(색은 styles/_chart.scss 가 정의).
const SERIES_CLASS = {
  footprints: 'series-footprints',
  visitors: 'series-visitors',
  bots: 'series-bots',
} as const;

function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tagName);
}

// 'YYYY-MM-DD' 를 축 라벨용 'MM-DD' 로 줄입니다.
function toShortDayLabel(day: string): string {
  const match = day.match(/\d{4}-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : day;
}

// y축 눈금선과 라벨을 그립니다.
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

// x축 날짜 라벨을 균등 간격으로 그립니다(너무 많으면 솎아 냅니다).
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

// 한 시리즈(영역 + 라인)를 그립니다. withArea=false 이면 영역 채움 없이 라인만 그립니다(봇 파선 시리즈용).
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

  // 점이 하나뿐이면 polyline 대신 점(circle)으로 그립니다.
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

// 범례를 (재)구성합니다. 봇 시리즈가 있을 때만 봇 항목을 포함합니다.
function renderLegend(legend: HTMLElement, hasBots: boolean): void {
  clearElement(legend);

  const items: { label: string; seriesClass: string }[] = [
    { label: '발자국', seriesClass: SERIES_CLASS.footprints },
    { label: '고유 방문자', seriesClass: SERIES_CLASS.visitors },
  ];
  if (hasBots) {
    items.push({ label: '봇 발자국', seriesClass: SERIES_CLASS.bots });
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
  // bots 가 null 이면(bots-by-day 미지원/실패) 봇 시리즈와 범례 항목을 생략합니다.
  render(
    footprints: ReadonlyArray<DayValue>,
    visitors: ReadonlyArray<DayValue>,
    bots: ReadonlyArray<DayValue> | null,
  ): void;
}

// 라인 차트 컨테이너(범례 + SVG)를 만들고, render 로 시리즈를 다시 그립니다.
export function createLineChart(): LineChartHandle {
  const container = document.createElement('div');
  container.className = 'chart';

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  container.appendChild(legend);

  const svgWrap = document.createElement('div');
  svgWrap.className = 'chart-svg-wrap';
  container.appendChild(svgWrap);

  // hover 툴팁(간단): 가장 가까운 일자의 값을 보여 줍니다.
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

    // 봇 값도 포함해 y축 최댓값을 잡습니다(세 시리즈가 같은 축을 공유).
    const rawMaximum = findMaximumValue(footprintValues, visitorValues, botValues);
    const maximumValue = computeNiceMaximum(rawMaximum);

    const svg = createSvgElement('svg');
    svg.setAttribute('class', 'chart-svg');
    svg.setAttribute('viewBox', `0 0 ${DIMENSIONS.width} ${DIMENSIONS.height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', hasBots ? '일별 발자국·고유 방문자·봇 발자국 추이' : '일별 발자국과 고유 방문자 추이');

    appendYAxis(svg, maximumValue);
    appendXAxis(svg, days);

    const footprintPoints = computeSeriesPoints(footprintValues, maximumValue, DIMENSIONS);
    const visitorPoints = computeSeriesPoints(visitorValues, maximumValue, DIMENSIONS);
    const botPoints = hasBots ? computeSeriesPoints(botValues, maximumValue, DIMENSIONS) : [];

    // 방문자(아래) → 발자국 → 봇(파선, 최상단)을 순서대로 겹칩니다. 봇은 영역 채움 없이 파선만 그립니다.
    appendSeries(svg, visitorPoints, SERIES_CLASS.visitors);
    appendSeries(svg, footprintPoints, SERIES_CLASS.footprints);
    if (hasBots) {
      appendSeries(svg, botPoints, SERIES_CLASS.bots, false);
    }

    // hover 상호작용용 세로 가이드 + 강조 점.
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

// hover 상호작용을 배선합니다. viewBox 비율로 마우스 x 를 인덱스에 매핑합니다.
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
    // 화면 좌표 → viewBox 좌표.
    const viewBoxX = ((event.clientX - rect.left) / rect.width) * DIMENSIONS.width;
    // 플롯 영역 비율 → 가장 가까운 인덱스.
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
    footprintRow.textContent = `발자국 ${formatCount(footprints[index]?.value ?? 0)}`;
    tooltip.appendChild(footprintRow);

    const visitorRow = document.createElement('div');
    visitorRow.className = 'chart-tooltip-row';
    visitorRow.textContent = `고유 방문자 ${formatCount(visitors[index]?.value ?? 0)}`;
    tooltip.appendChild(visitorRow);

    if (bots !== null) {
      const botRow = document.createElement('div');
      botRow.className = 'chart-tooltip-row';
      botRow.textContent = `봇 발자국 ${formatCount(bots[index]?.value ?? 0)}`;
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
