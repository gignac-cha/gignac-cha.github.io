// 봇 시간대 — the bots-by-hour histogram.
//
// The query answers with three columns, hour / views / bot_views, and this panel draws two of them
// on one axis: a bar for the hour's total views with the bot share overlaid at its base. Drawing
// bot_views alone (what this panel used to do) throws away the only thing that makes the number
// readable — 3 bot views at 04:00 and 3 bot views at 14:00 look identical even when the site served
// 4 human views in one hour and 40 in the other. The comparison IS the finding, so both series stay
// on the same scale.
//
// Both series go through fillMissingHours: the tracker GROUPs BY hour over the rows that exist, so
// a quiet hour produces no row at all, and drawing a sparse response as-is silently turns a
// 24-hour shape into however many bars came back (see the module header of tools/zero-filling.ts).
// Reading the two columns through the same filler also guarantees the pairs stay aligned — both
// results are exactly the 24 hour keys, in order, so index i means the same hour in both.
//
// No timezone switch here (createHourBars' timezoneToggle stays off): the bot share is read against
// the site's own UTC-labelled traffic, and a second per-panel zone control would invite comparing
// two panels that are no longer on the same axis.

import { computeNiceMaximum } from '../tools/chart-geometry.ts';
import { formatCount } from '../tools/formatting.ts';
import type { BotsByHourRow } from '../tools/tracker-client.ts';
import { fillMissingHours } from '../tools/zero-filling.ts';

const LABEL_EVERY = 3;
const MINIMUM_BAR_PERCENTAGE = 3;

function createLegend(): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'chart-legend';

  const entries: Array<{ labelText: string; seriesClass: string }> = [
    { labelText: '전체', seriesClass: 'series-footprints' },
    { labelText: '봇', seriesClass: 'series-bots' },
  ];

  for (const entry of entries) {
    const item = document.createElement('span');
    item.className = 'legend-entry';

    const swatch = document.createElement('span');
    swatch.className = `legend-swatch ${entry.seriesClass}`;
    item.appendChild(swatch);

    const text = document.createElement('span');
    text.textContent = entry.labelText;
    item.appendChild(text);

    legend.appendChild(item);
  }

  return legend;
}

export function createBotsByHourPanel(rows: ReadonlyArray<BotsByHourRow>): HTMLElement {
  const totalHourValues = fillMissingHours(rows, 'views');
  const botHourValues = fillMissingHours(rows, 'bot_views');

  const container = document.createElement('div');
  container.className = 'hour-bars-container bot-hour-bars-container';
  container.appendChild(createLegend());

  const rawMaximum = totalHourValues.reduce(
    (maximum, bin, index) => Math.max(maximum, bin.value, botHourValues[index]?.value ?? 0),
    0,
  );
  const maximumValue = computeNiceMaximum(rawMaximum);

  const chart = document.createElement('div');
  chart.className = 'hour-bars-chart';
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', '시간대별 전체 페이지 뷰와 봇 페이지 뷰 분포 (UTC)');

  const toHeightPercentage = (value: number): string => {
    if (value <= 0 || maximumValue <= 0) {
      return '0%';
    }
    return `${Math.max(MINIMUM_BAR_PERCENTAGE, (value / maximumValue) * 100)}%`;
  };

  totalHourValues.forEach((bin, index) => {
    const botValue = botHourValues[index]?.value ?? 0;

    const column = document.createElement('div');
    column.className = 'hour-column';
    column.title = `${bin.hour}:00 (UTC) · 전체 ${formatCount(bin.value)} · 봇 ${formatCount(botValue)}`;

    const track = document.createElement('div');
    track.className = 'hour-track';
    // The bot bar is drawn over the total bar rather than beside it, so the pair reads as "this
    // much of that". Positioning is set here, next to the heights it belongs with, because the
    // overlay only exists in this panel and the track class is shared with the single-series
    // histogram.
    track.style.position = 'relative';

    const totalBar = document.createElement('div');
    totalBar.className = 'hour-bar hour-bar-total';
    totalBar.style.height = toHeightPercentage(bin.value);
    track.appendChild(totalBar);

    const botBar = document.createElement('div');
    botBar.className = 'hour-bar hour-bar-bot';
    botBar.style.position = 'absolute';
    botBar.style.left = '0';
    botBar.style.right = '0';
    botBar.style.bottom = '0';
    botBar.style.height = toHeightPercentage(botValue);
    botBar.style.backgroundColor = 'var(--color-series-bots)';
    track.appendChild(botBar);

    column.appendChild(track);

    const label = document.createElement('span');
    label.className = 'hour-label';
    label.textContent = Number(bin.hour) % LABEL_EVERY === 0 ? bin.hour : '';
    column.appendChild(label);

    chart.appendChild(column);
  });

  container.appendChild(chart);

  const totalViews = totalHourValues.reduce((sum, bin) => sum + bin.value, 0);
  const totalBotViews = botHourValues.reduce((sum, bin) => sum + bin.value, 0);

  const caption = document.createElement('p');
  caption.className = 'hour-caption';
  caption.textContent =
    `가로축: 시각 (UTC) · 세로축 최대 ${formatCount(maximumValue)} · 기간 전체 ${formatCount(totalViews)} 중 봇 ${formatCount(totalBotViews)}`;
  container.appendChild(caption);

  return container;
}
