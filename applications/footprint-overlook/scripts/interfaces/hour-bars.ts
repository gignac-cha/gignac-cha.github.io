// 시간대 분포 — 24 vertical bars, one per hour-of-day bin. A thin DOM factory: the 24 bins are
// produced by fillMissingHours (tools/zero-filling.ts), the axis maximum by computeNiceMaximum
// (tools/chart-geometry.ts) and the timezone shift by shiftHourlyDistribution
// (tools/hourly-timezone.ts) — all pure and unit-tested, so nothing here needs a test of its own.
//
// Why plain elements instead of the SVG the trend chart uses: this is a fixed 24-column histogram
// with no interpolation, no shared axis and no hover geometry, so the whole drawing is "give each
// bar a height percentage". CSS does that responsively for free, while an SVG would need the
// viewBox mapping and the non-scaling-stroke workarounds that line-chart.ts carries.
//
// The bins arrive as UTC hours — the tracker groups them with substr(received_at, 12, 2) over a
// UTC-stamped column (see the module header of tools/date-ranges.ts) — and the KST option re-bins
// them by adding a fixed offset modulo 24. That rotation is sound *here* precisely because this
// histogram has already collapsed the date away: a bin means "views that landed in hour H, summed
// over the whole range", so moving H cannot move a view across a day boundary — there is no day
// axis left to cross, and the 24 bins still sum to the same total. (The same shift applied to a
// per-day-by-hour heatmap would be wrong: the late hours of each day would have to migrate into
// the following day's row.) The caption and every bar tooltip name the active zone, so a bar is
// never read in the wrong frame.
//
// The toggle is opt-in via options.timezoneToggle. 시간대 분포 turns it on; the bot histogram does
// not, because a second zone control inside a panel that is read against the site's UTC-labelled
// traffic is noise. The selection is state of one mounted list: a re-render (range change, SWR
// refresh) rebuilds the panel in UTC, which is deliberate — the dashboard owns no zone preference
// and inventing a persisted one here would put two sources of truth on the page.

import { computeNiceMaximum } from '../tools/chart-geometry.ts';
import { formatCount } from '../tools/formatting.ts';
import { shiftHourlyDistribution } from '../tools/hourly-timezone.ts';
import type { HourValue } from '../tools/zero-filling.ts';

const LABEL_EVERY = 3;
const MINIMUM_BAR_PERCENTAGE = 3;
const KST_OFFSET_HOURS = 9;

export interface HourBarsOptions {
  // Renders the UTC / KST switch above the bars. Off by default: only the 시간대 분포 panel asks
  // its reader to think about zones.
  timezoneToggle?: boolean;
}

type HourZone = 'UTC' | 'KST';

export function createHourBars(
  hourValues: ReadonlyArray<HourValue>,
  options: HourBarsOptions = {},
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hour-bars-container';

  const showTimezoneToggle = options.timezoneToggle === true;
  let currentZone: HourZone = 'UTC';

  const createZoneButton = (zone: HourZone, labelText: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = currentZone === zone ? 'panel-toggle-button is-active' : 'panel-toggle-button';
    button.textContent = labelText;
    button.setAttribute('aria-pressed', currentZone === zone ? 'true' : 'false');
    button.addEventListener('click', () => {
      if (currentZone === zone) {
        return;
      }
      currentZone = zone;
      renderContent();
    });
    return button;
  };

  const renderContent = (): void => {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (showTimezoneToggle) {
      const toggleGroup = document.createElement('div');
      toggleGroup.className = 'panel-toggle-group';
      toggleGroup.setAttribute('role', 'group');
      toggleGroup.setAttribute('aria-label', '시간대 선택');
      toggleGroup.appendChild(createZoneButton('UTC', 'UTC'));
      toggleGroup.appendChild(createZoneButton('KST', 'KST (+9)'));
      container.appendChild(toggleGroup);
    }

    const activeHourValues = currentZone === 'KST'
      ? shiftHourlyDistribution(hourValues, KST_OFFSET_HOURS)
      : hourValues;

    const rawMaximum = activeHourValues.reduce((maximum, bin) => Math.max(maximum, bin.value), 0);
    const maximumValue = computeNiceMaximum(rawMaximum);

    const chart = document.createElement('div');
    chart.className = 'hour-bars-chart';
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `시간대별 페이지 뷰 분포 (${currentZone})`);

    for (const bin of activeHourValues) {
      const column = document.createElement('div');
      column.className = 'hour-column';
      column.title = `${bin.hour}:00 (${currentZone}) · 페이지 뷰 ${formatCount(bin.value)}`;

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
      label.textContent = Number(bin.hour) % LABEL_EVERY === 0 ? bin.hour : '';
      column.appendChild(label);

      chart.appendChild(column);
    }

    container.appendChild(chart);

    const caption = document.createElement('p');
    caption.className = 'hour-caption';
    caption.textContent = `가로축: 시각 (${currentZone}) · 세로축 최대 ${formatCount(maximumValue)}`;
    container.appendChild(caption);
  };

  renderContent();
  return container;
}
