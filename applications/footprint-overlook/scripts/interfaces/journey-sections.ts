// Interface components for Journey (여정) analytics: top landing pages, page transitions, and one
// visitor's chronological timeline.

import { DIRECT_REFERRER_LABEL } from '../tools/dimension-labels.ts';
import { shortenHref, toDisplayText } from '../tools/formatting.ts';
import { sortRecentRows } from '../tools/table-sorting.ts';
import type {
  PageTransitionRow,
  RecentFootprintRow,
  TopLandingRow,
} from '../tools/tracker-client.ts';
import { createRankedBarList } from './ranked-bars.ts';
import { createRecentTable } from './recent-table.ts';

export function createTopLandingsPanel(rows: ReadonlyArray<TopLandingRow>): HTMLElement {
  const items = rows.map((row) => ({
    label: shortenHref(row.href),
    fullLabel: toDisplayText(row.href, '값 없음 (href 미기록)'),
    value: row.landings,
    // A null href is a landing whose page was never reported — a gap, so it folds into the
    // footnote instead of ranking as if it were a page.
    isUnreported: row.href === null,
  }));

  return createRankedBarList(items, { foldUnreported: true });
}

export function createPageTransitionsPanel(rows: ReadonlyArray<PageTransitionRow>): HTMLElement {
  const items = rows.map((row) => {
    const fromLabel = shortenHref(row.from_href);
    const toLabel = shortenHref(row.to_href);
    return {
      label: `${fromLabel} ➔ ${toLabel}`,
      // A null from_href is not a gap: it is how an entry looks — the visit that started the
      // session had no previous page. Only a missing DESTINATION is unreported, which is why the
      // flag below reads to_href alone.
      fullLabel: `${toDisplayText(row.from_href, DIRECT_REFERRER_LABEL)} ➔ ${toDisplayText(row.to_href)}`,
      value: row.transitions,
      isUnreported: row.to_href === null,
    };
  });

  return createRankedBarList(items, { foldUnreported: true });
}

export function createVisitorTimelinePanel(
  uuid: string,
  rows: ReadonlyArray<RecentFootprintRow>,
  onClearHighlight?: () => void,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'visitor-timeline-panel';

  const headerBar = document.createElement('div');
  headerBar.className = 'recent-highlight-bar';

  const info = document.createElement('span');
  info.className = 'highlight-status';
  info.textContent = `방문자 [${uuid}] 의 타임라인 (${rows.length}건 수집됨)`;
  headerBar.appendChild(info);

  if (onClearHighlight !== undefined) {
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'highlight-clear-button';
    clearButton.textContent = '타임라인 닫기';
    clearButton.addEventListener('click', onClearHighlight);
    headerBar.appendChild(clearButton);
  }

  container.appendChild(headerBar);

  // A timeline reads forwards, so this one view sorts oldest-first — the opposite of the 최근 조회
  // table, which answers "what just happened". Same tested comparator as that table
  // (tools/table-sorting.ts), just the other direction.
  const chronologicalRows = sortRecentRows(rows, 'time', true);

  container.appendChild(
    createRecentTable(chronologicalRows, {
      highlightedUUID: uuid,
      onToggleHighlight: () => onClearHighlight?.(),
    }),
  );

  return container;
}
