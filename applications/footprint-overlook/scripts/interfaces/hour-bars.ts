// 시간대 분포 — 24 vertical bars, one per hour-of-day bin. A thin DOM factory: the 24 bins are
// produced by fillMissingHours (tools/zero-filling.ts) and the axis maximum by computeNiceMaximum
// (tools/chart-geometry.ts), both pure and unit-tested, so nothing here needs a test of its own.
//
// Why plain elements instead of the SVG the trend chart uses: this is a fixed 24-column histogram
// with no interpolation, no shared axis and no hover geometry, so the whole drawing is "give each
// bar a height percentage". CSS does that responsively for free, while an SVG would need the
// viewBox mapping and the non-scaling-stroke workarounds that line-chart.ts carries.
//
// The bins are UTC hours — the tracker groups them with substr(received_at, 12, 2) over a
// UTC-stamped column (see the module header of tools/date-ranges.ts) — and the caption says so
// rather than shifting them into the reader's zone. Converting would be worse than it looks: an
// hour histogram over a multi-day range cannot be re-bucketed by adding an offset without also
// moving traffic across day boundaries, and every other axis on this page is already UTC.

import { computeNiceMaximum } from '../tools/chart-geometry.ts';
import { formatCount } from '../tools/formatting.ts';
import type { HourValue } from '../tools/zero-filling.ts';

// Label every third bar. All 24 would collide at the panel's width, and a 3-hour grid keeps the
// familiar 00 / 06 / 12 / 18 anchors visible.
const LABEL_EVERY = 3;

// A bar for a non-zero hour is never thinner than this, for the same reason the ranked bars have a
// minimum width: a one-pixel sliver is indistinguishable from an empty bin, which would misread as
// "no traffic in this hour".
const MINIMUM_BAR_PERCENTAGE = 3;

export function createHourBars(hourValues: ReadonlyArray<HourValue>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hour-bars';

  const rawMaximum = hourValues.reduce((maximum, bin) => Math.max(maximum, bin.value), 0);
  const maximumValue = computeNiceMaximum(rawMaximum);

  const chart = document.createElement('div');
  chart.className = 'hour-bars-chart';
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', '시간대별 페이지 뷰 분포 (UTC)');

  for (const bin of hourValues) {
    const column = document.createElement('div');
    column.className = 'hour-column';
    // The title carries the exact figure, which is what makes the unlabelled bars readable at all
    // without adding a hover tooltip layer.
    column.title = `${bin.hour}:00 (UTC) · 페이지 뷰 ${formatCount(bin.value)}`;

    const track = document.createElement('div');
    track.className = 'hour-track';

    const bar = document.createElement('div');
    bar.className = 'hour-bar';
    const heightRatio = maximumValue > 0 ? bin.value / maximumValue : 0;
    bar.style.height = bin.value > 0 ? `${Math.max(MINIMUM_BAR_PERCENTAGE, heightRatio * 100)}%` : '0%';
    track.appendChild(bar);
    column.appendChild(track);

    const label = document.createElement('span');
    label.className = 'hour-label';
    // Kept in the DOM even when blank so all 24 columns share one baseline height; an empty label
    // on two out of three columns would otherwise make the bars different lengths.
    label.textContent = Number(bin.hour) % LABEL_EVERY === 0 ? bin.hour : '';
    column.appendChild(label);

    chart.appendChild(column);
  }

  container.appendChild(chart);

  const caption = document.createElement('p');
  caption.className = 'hour-caption';
  caption.textContent = `가로축: 시각 (UTC) · 세로축 최대 ${formatCount(maximumValue)}`;
  container.appendChild(caption);

  return container;
}
