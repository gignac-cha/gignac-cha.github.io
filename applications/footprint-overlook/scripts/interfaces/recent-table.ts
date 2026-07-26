// The 최근 조회 table: time, uuid (shortened), href and a summary of arguments.
// All string shaping is delegated to the pure formatting module, which also decides how a missing
// value renders — every column here except received_at can arrive as SQL null (see the row types
// in tools/tracker-client.ts), so both the cell text and the title tooltip go through a formatter
// rather than touching the raw value. Assigning a null straight to textContent or title would put
// the literal string "null" on screen. Column ordering lives in tools/table-sorting.ts for the
// same reason: null handling is the part that is easy to get wrong, so it is tested separately.
//
// Narrow screens get a compact layout. The desktop markup is unchanged — the same four columns in
// the same order — and two extra nodes ride along that CSS hides above the mobile breakpoint: a
// .recent-table-compact-toggle button in the time cell and a following tr.recent-row-details
// carrying the uuid and arguments values. Rebuilding the table into two columns for mobile would
// mean a second row factory and a second set of null-handling rules; hiding columns and moving the
// hidden values into an expandable row keeps one source of truth for what a row says.

import { detectBotEvidence } from '../tools/bot-detection.ts';
import { formatTimestamp, shortenHref, shortenUuid, summarizeArguments, toDisplayText } from '../tools/formatting.ts';
import { matchesHighlight } from '../tools/highlight-uuid.ts';
import { sortRecentRows, type RecentTableSortColumn } from '../tools/table-sorting.ts';
import type { RecentFootprintRow } from '../tools/tracker-client.ts';

// Visitor highlighting hooks. highlightedUUID paints every matching row; onToggleHighlight makes
// each uuid cell a click target so a visitor can be highlighted straight from the table — the
// visitor uuid lives on the tracked site's origin and cannot be auto-detected here (see the
// module header of tools/highlight-uuid.ts), so clicking a row beats retyping 36 characters.
export interface RecentTableOptions {
  highlightedUUID: string | null;
  onToggleHighlight: (uuidValue: string) => void;
  // "더 보기". The table owns no fetching: it reports the limit it would like to see next and the
  // dashboard decides what that costs (one recent-footprints request, not a page reload).
  onLoadMore?: (nextLimit: number) => void;
  canLoadMore?: boolean;
  // The limit handed to onLoadMore, also shown on the button so the click is not a surprise.
  nextLimit?: number;
}

const DEFAULT_NEXT_LIMIT = 100;

const COLUMN_HEADERS: Array<{ key: RecentTableSortColumn; label: string }> = [
  { key: 'time', label: '시각 (UTC)' },
  { key: 'uuid', label: 'UUID' },
  { key: 'href', label: 'href' },
  { key: 'arguments', label: 'arguments' },
];

function createBotTag(row: RecentFootprintRow): HTMLElement | null {
  const evidence = detectBotEvidence(row.verified_bot_category, row.user_agent);
  if (!evidence.isBot) {
    return null;
  }

  const botTag = document.createElement('span');
  botTag.className = 'bot-tag';

  if (evidence.source === 'verified') {
    botTag.classList.add('is-verified');
    botTag.textContent = '🤖 검증 봇';
    botTag.title = `Cloudflare 검증 봇 · ${evidence.category ?? ''}`.trimEnd();
    return botTag;
  }

  botTag.textContent = '🤖 봇 추정';
  botTag.title = `봇으로 추정되는 user_agent: ${toDisplayText(row.user_agent)}`;
  return botTag;
}

// The mobile-only detail row: the two columns the compact layout hides, spelled out in full rather
// than shortened — the row is opened on purpose, so there is room for the whole value.
function createDetailsRow(row: RecentFootprintRow): HTMLTableRowElement {
  const detailsRow = document.createElement('tr');
  detailsRow.className = 'recent-row-details';
  detailsRow.hidden = true;

  const cell = document.createElement('td');
  cell.colSpan = COLUMN_HEADERS.length;

  const uuidLine = document.createElement('p');
  uuidLine.className = 'recent-row-details-line';
  uuidLine.textContent = `UUID: ${toDisplayText(row.uuid)}`;
  cell.appendChild(uuidLine);

  const argumentsLine = document.createElement('p');
  argumentsLine.className = 'recent-row-details-line';
  argumentsLine.textContent = `arguments: ${toDisplayText(row.arguments)}`;
  cell.appendChild(argumentsLine);

  detailsRow.appendChild(cell);
  return detailsRow;
}

export function createRecentTable(
  rows: ReadonlyArray<RecentFootprintRow>,
  options?: RecentTableOptions,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'recent-table-wrap';

  // Newest first is the default because this table answers "what just happened"; the visitor
  // timeline asks for the opposite order explicitly.
  let sortColumn: RecentTableSortColumn = 'time';
  let sortAscending = false;

  const table = document.createElement('table');
  table.className = 'recent-table';

  const renderTableBody = (): void => {
    while (table.firstChild) {
      table.removeChild(table.firstChild);
    }

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const column of COLUMN_HEADERS) {
      const headerCell = document.createElement('th');
      headerCell.scope = 'col';
      headerCell.className = `sortable-header column-${column.key}`;
      headerCell.style.cursor = 'pointer';
      const arrow = sortColumn === column.key ? (sortAscending ? ' ▲' : ' ▼') : '';
      headerCell.textContent = `${column.label}${arrow}`;
      headerCell.setAttribute(
        'aria-sort',
        sortColumn === column.key ? (sortAscending ? 'ascending' : 'descending') : 'none',
      );
      headerCell.addEventListener('click', () => {
        if (sortColumn === column.key) {
          sortAscending = !sortAscending;
        } else {
          sortColumn = column.key;
          sortAscending = true;
        }
        renderTableBody();
      });
      headerRow.appendChild(headerCell);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const sortedRows = sortRecentRows(rows, sortColumn, sortAscending);

    const tbody = document.createElement('tbody');
    for (const row of sortedRows) {
      const tableRow = document.createElement('tr');

      const botTag = createBotTag(row);
      if (botTag !== null) {
        tableRow.classList.add('is-bot');
      }

      const isHighlighted = matchesHighlight(row.uuid, options?.highlightedUUID ?? null);
      if (isHighlighted) {
        tableRow.classList.add('is-highlighted');
      }

      const detailsRow = createDetailsRow(row);

      const timeCell = document.createElement('td');
      timeCell.className = 'cell-time';

      const compactToggle = document.createElement('button');
      compactToggle.type = 'button';
      compactToggle.className = 'recent-table-compact-toggle';
      compactToggle.textContent = '＋';
      compactToggle.title = 'UUID·arguments 펼치기';
      compactToggle.setAttribute('aria-expanded', 'false');
      compactToggle.setAttribute('aria-label', '이 행의 UUID와 arguments 펼치기');
      let isExpanded = false;
      compactToggle.addEventListener('click', () => {
        isExpanded = !isExpanded;
        // Both the attribute and the class: the attribute alone already collapses the row (nothing
        // in the stylesheet sets `display` on it), and the class gives the stylesheet a selector
        // for the expanded state without having to fight the user agent's [hidden] rule.
        detailsRow.hidden = !isExpanded;
        detailsRow.classList.toggle('is-expanded', isExpanded);
        compactToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        compactToggle.textContent = isExpanded ? '－' : '＋';
      });
      timeCell.appendChild(compactToggle);

      timeCell.appendChild(document.createTextNode(formatTimestamp(row.received_at)));
      if (botTag !== null) {
        timeCell.appendChild(botTag);
      }
      tableRow.appendChild(timeCell);

      const uuidCell = document.createElement('td');
      uuidCell.className = 'cell-uuid';
      if (options !== undefined && typeof row.uuid === 'string' && row.uuid.length > 0) {
        const uuidValue = row.uuid;
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'uuid-toggle';
        toggleButton.textContent = shortenUuid(uuidValue);
        toggleButton.title = isHighlighted
          ? `${uuidValue}\n클릭하면 강조를 해제합니다.`
          : `${uuidValue}\n클릭하면 이 방문자를 강조합니다.`;
        toggleButton.setAttribute('aria-pressed', isHighlighted ? 'true' : 'false');
        toggleButton.addEventListener('click', () => options.onToggleHighlight(uuidValue));
        uuidCell.appendChild(toggleButton);
      } else {
        uuidCell.textContent = shortenUuid(row.uuid);
        uuidCell.title = toDisplayText(row.uuid);
      }
      tableRow.appendChild(uuidCell);

      const hrefCell = document.createElement('td');
      hrefCell.className = 'cell-href';
      hrefCell.textContent = shortenHref(row.href);
      hrefCell.title = toDisplayText(row.href);
      tableRow.appendChild(hrefCell);

      const argumentsCell = document.createElement('td');
      argumentsCell.className = 'cell-arguments';
      argumentsCell.textContent = summarizeArguments(row.arguments);
      argumentsCell.title = toDisplayText(row.arguments);
      tableRow.appendChild(argumentsCell);

      tbody.appendChild(tableRow);
      tbody.appendChild(detailsRow);
    }
    table.appendChild(tbody);
  };

  renderTableBody();
  wrapper.appendChild(table);

  const onLoadMore = options?.onLoadMore;
  if (onLoadMore !== undefined && options?.canLoadMore === true) {
    const nextLimit = options.nextLimit ?? DEFAULT_NEXT_LIMIT;
    const loadMoreButton = document.createElement('button');
    loadMoreButton.type = 'button';
    loadMoreButton.className = 'highlight-clear-button recent-load-more-button';
    loadMoreButton.style.marginTop = '12px';
    loadMoreButton.textContent = `더 보기 (${nextLimit}건 조회)`;
    loadMoreButton.addEventListener('click', () => onLoadMore(nextLimit));
    wrapper.appendChild(loadMoreButton);
  }

  return wrapper;
}
