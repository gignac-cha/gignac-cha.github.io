// Interface components for Visitors (방문자) analytics:
// new vs returning visitors per day, visit depth, and the weekly cohort retention matrix.

import { formatCount, MISSING_TEXT } from '../tools/formatting.ts';
import { buildRetentionMatrix } from '../tools/retention-matrices.ts';
import type {
  NewVsReturningByDayRow,
  VisitDepthRow,
  WeeklyRetentionRow,
} from '../tools/tracker-client.ts';
import { createRankedBarList } from './ranked-bars.ts';

const MAXIMUM_DAY_LABELS = 7;
const MINIMUM_BAR_PERCENTAGE = 3;
const STRONG_RETENTION_PERCENTAGE = 30;

// '2026-07-20' -> '07-20'. The year is constant across any range this panel can show.
function toShortDayLabel(day: string): string {
  return day.length >= 10 ? day.slice(5, 10) : day;
}

function createSeriesLegend(entries: ReadonlyArray<{ labelText: string; seriesClass: string }>): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'chart-legend';

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

// new-vs-returning-by-day is a DAILY series, and the two totals it used to be collapsed into threw
// away everything the query was asked for: two bars cannot show that returning visitors only appear
// after a launch, or that a spike was entirely new traffic. It is drawn as one column per day with
// the two counts side by side, on the same axis, so the mix is readable per day and over time.
//
// The returning count is a per-day distinct count, so summing it over the range double-counts a
// visitor who came back on several days — the caption says so, because the 방문자 summary card
// shows the period-wide distinct count and the two numbers legitimately disagree.
export function createNewVsReturningPanel(rows: ReadonlyArray<NewVsReturningByDayRow>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'day-bars-container';
  container.appendChild(
    createSeriesLegend([
      { labelText: '신규 방문자', seriesClass: 'series-footprints' },
      { labelText: '재방문자', seriesClass: 'series-visitors' },
    ]),
  );

  const sortedRows = [...rows].sort((left, right) => left.day.localeCompare(right.day));

  const maximumValue = sortedRows.reduce(
    (maximum, row) => Math.max(maximum, row.new_visitors, row.returning_visitors),
    0,
  );

  const chart = document.createElement('div');
  chart.className = 'hour-bars-chart';
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', '일별 신규 방문자와 재방문자');

  const labelStep = Math.max(1, Math.ceil(sortedRows.length / MAXIMUM_DAY_LABELS));

  const toHeightPercentage = (value: number): string => {
    if (value <= 0 || maximumValue <= 0) {
      return '0%';
    }
    return `${Math.max(MINIMUM_BAR_PERCENTAGE, (value / maximumValue) * 100)}%`;
  };

  sortedRows.forEach((row, index) => {
    const column = document.createElement('div');
    column.className = 'hour-column';
    column.title =
      `${row.day} · 신규 ${formatCount(row.new_visitors)} · 재방문 ${formatCount(row.returning_visitors)}`;

    // Both bars live in one track, which is a flex row: they share its width, which is what makes
    // the pair read as one day rather than two.
    const track = document.createElement('div');
    track.className = 'hour-track';
    track.style.gap = '1px';

    const newBar = document.createElement('div');
    newBar.className = 'hour-bar bar-new-visitors';
    newBar.style.height = toHeightPercentage(row.new_visitors);
    newBar.style.backgroundColor = 'var(--color-series-footprints)';
    track.appendChild(newBar);

    const returningBar = document.createElement('div');
    returningBar.className = 'hour-bar bar-returning-visitors';
    returningBar.style.height = toHeightPercentage(row.returning_visitors);
    returningBar.style.backgroundColor = 'var(--color-series-visitors)';
    track.appendChild(returningBar);

    column.appendChild(track);

    const label = document.createElement('span');
    label.className = 'hour-label';
    label.textContent = index % labelStep === 0 ? toShortDayLabel(row.day) : '';
    column.appendChild(label);

    chart.appendChild(column);
  });

  container.appendChild(chart);

  const totalNew = sortedRows.reduce((sum, row) => sum + row.new_visitors, 0);
  const totalReturning = sortedRows.reduce((sum, row) => sum + row.returning_visitors, 0);

  const caption = document.createElement('p');
  caption.className = 'hour-caption';
  caption.textContent =
    `기간 합계 신규 ${formatCount(totalNew)} · 재방문 ${formatCount(totalReturning)} (재방문 합계는 일별 고유 방문자의 합이라 같은 사람이 여러 날 방문하면 중복 계산됩니다)`;
  container.appendChild(caption);

  return container;
}

export function createVisitDepthPanel(rows: ReadonlyArray<VisitDepthRow>): HTMLElement {
  const items = rows.map((row) => ({
    label: `${row.depth_bucket} 페이지`,
    fullLabel: `세션당 ${row.depth_bucket} 페이지 조회한 방문자`,
    value: row.visitors,
  }));

  // Every bucket is a measured depth; there is no null bucket to fold.
  return createRankedBarList(items, { foldUnreported: false });
}

export function createWeeklyRetentionTable(rows: ReadonlyArray<WeeklyRetentionRow>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'recent-table-wrap';

  const matrix = buildRetentionMatrix(rows);
  if (matrix.cohorts.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'section-empty';
    emptyMessage.textContent = '리텐션 데이터가 없습니다.';
    container.appendChild(emptyMessage);
    return container;
  }

  const table = document.createElement('table');
  table.className = 'recent-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const cohortHeader = document.createElement('th');
  cohortHeader.scope = 'col';
  cohortHeader.textContent = '코호트 주';
  headerRow.appendChild(cohortHeader);

  const baselineHeader = document.createElement('th');
  baselineHeader.scope = 'col';
  baselineHeader.textContent = '0주차 (100%)';
  headerRow.appendChild(baselineHeader);

  for (let offset = 1; offset <= matrix.maxOffset; offset += 1) {
    const offsetHeader = document.createElement('th');
    offsetHeader.scope = 'col';
    offsetHeader.textContent = `+${offset}주`;
    headerRow.appendChild(offsetHeader);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (const cohort of matrix.cohorts) {
    const row = document.createElement('tr');
    // A cohort with no week-0 observation has no denominator, so every later week's percentage
    // would be a division by zero that buildRetentionMatrix reports as 0. Rendering that as "0%"
    // states the opposite of what happened — it reads as "nobody came back" when the truth is
    // "we cannot tell". Those cohorts show 미상 (—) instead, in every column.
    const hasBaseline = cohort.cells.get(0) !== undefined && cohort.baselineVisitors > 0;

    const cohortCell = document.createElement('td');
    cohortCell.style.fontWeight = '600';
    cohortCell.textContent = cohort.cohortWeek;
    row.appendChild(cohortCell);

    const baselineCell = document.createElement('td');
    if (hasBaseline) {
      baselineCell.textContent = formatCount(cohort.baselineVisitors);
    } else {
      baselineCell.textContent = MISSING_TEXT;
      baselineCell.title = '이 코호트의 0주차 관측치가 없어 리텐션을 계산할 수 없습니다.';
    }
    row.appendChild(baselineCell);

    for (let offset = 1; offset <= matrix.maxOffset; offset += 1) {
      const cell = document.createElement('td');
      const retentionCell = cohort.cells.get(offset);
      if (retentionCell === undefined || !hasBaseline) {
        cell.textContent = MISSING_TEXT;
        if (retentionCell !== undefined && !hasBaseline) {
          cell.title = `방문자 ${formatCount(retentionCell.visitors)} · 0주차 기준이 없어 비율은 미상입니다.`;
        }
      } else {
        cell.textContent = `${retentionCell.percentage}% (${formatCount(retentionCell.visitors)})`;
        if (retentionCell.percentage >= STRONG_RETENTION_PERCENTAGE) {
          cell.style.fontWeight = '600';
        }
      }
      row.appendChild(cell);
    }

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}
