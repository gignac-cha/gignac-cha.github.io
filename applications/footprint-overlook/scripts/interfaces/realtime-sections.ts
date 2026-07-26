// 준실시간 — the views-by-minute activity strip (the last ~30 one-minute buckets).
//
// This factory is stateless and polls nothing: it draws the rows it is handed. The 60-second
// refresh, and the decision to skip it while the tab is hidden, belong to the dashboard, which owns
// the timer and can cancel it on teardown (see interfaces/dashboard.ts). The notice below says
// "60초 간격 자동 갱신" because that is what the reader experiences; keeping the timer out of here
// is what keeps a re-rendered panel from stacking a second interval on the first.
//
// The 1~2분 delay is stated in the panel rather than buried in the README: the newest bucket is
// always partial (collection, then the tracker's own write path), so the last bar dipping is normal
// and must not be read as traffic falling off a cliff.

import { computeNiceMaximum } from '../tools/chart-geometry.ts';
import { formatCount } from '../tools/formatting.ts';
import type { ViewsByMinuteRow } from '../tools/tracker-client.ts';

const LABEL_EVERY = 5;
const MINIMUM_BAR_PERCENTAGE = 4;
const MINUTE_LABEL_START = 11;
const MINUTE_LABEL_END = 16;

// 'YYYY-MM-DDTHH:MM' -> 'HH:MM'.
function toShortMinuteLabel(minute: string): string {
  return minute.length >= MINUTE_LABEL_END ? minute.slice(MINUTE_LABEL_START, MINUTE_LABEL_END) : minute;
}

export function createViewsByMinutePanel(rows: ReadonlyArray<ViewsByMinuteRow>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'views-by-minute-panel';

  const notice = document.createElement('p');
  notice.className = 'panel-subtitle realtime-notice';
  notice.textContent = '⏱ 수집→조회 지연 약 1~2분 (60초 간격 자동 갱신)';
  container.appendChild(notice);

  const rawMaximum = rows.reduce((maximum, row) => Math.max(maximum, row.views), 0);
  const maximumValue = computeNiceMaximum(rawMaximum);

  const chart = document.createElement('div');
  chart.className = 'hour-bars-chart realtime-bars-chart';
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', '분별 페이지 뷰 (최근 30분)');

  rows.forEach((row, index) => {
    const shortTime = toShortMinuteLabel(row.minute);

    const column = document.createElement('div');
    column.className = 'hour-column';
    column.title = `${shortTime} (UTC) · ${formatCount(row.views)} 뷰`;

    const track = document.createElement('div');
    track.className = 'hour-track';

    const bar = document.createElement('div');
    bar.className = 'hour-bar';
    const heightRatio = maximumValue > 0 ? row.views / maximumValue : 0;
    bar.style.height = row.views > 0 ? `${Math.max(MINIMUM_BAR_PERCENTAGE, heightRatio * 100)}%` : '0%';
    track.appendChild(bar);
    column.appendChild(track);

    const label = document.createElement('span');
    label.className = 'hour-label';
    label.textContent = index % LABEL_EVERY === 0 ? shortTime : '';
    column.appendChild(label);

    chart.appendChild(column);
  });

  container.appendChild(chart);

  const totalViews = rows.reduce((sum, row) => sum + row.views, 0);
  const caption = document.createElement('p');
  caption.className = 'hour-caption';
  caption.textContent = `최근 30분 총 ${formatCount(totalViews)} 뷰 · 분당 최대 ${formatCount(maximumValue)}`;
  container.appendChild(caption);

  return container;
}
