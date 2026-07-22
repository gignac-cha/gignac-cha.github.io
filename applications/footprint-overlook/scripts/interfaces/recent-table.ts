// 최근 발자국 테이블입니다. 시각·uuid(축약)·href·arguments(요약)를 열로 보여 줍니다.
// 문자열 가공은 모두 순수 formatting 모듈이 담당합니다.

import { isBotUserAgent } from '../tools/bot-detection.ts';
import { formatTimestamp, shortenHref, shortenUuid, summarizeArguments } from '../tools/formatting.ts';
import type { RecentFootprintRow } from '../tools/tracker-client.ts';

const COLUMN_HEADERS = ['시각', 'UUID', 'href', 'arguments'] as const;

// 최근 발자국 rows 를 표(table)로 만듭니다.
export function createRecentTable(rows: ReadonlyArray<RecentFootprintRow>): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'recent-table-wrap';

  const table = document.createElement('table');
  table.className = 'recent-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const header of COLUMN_HEADERS) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = header;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tableRow = document.createElement('tr');

    // user_agent 가 봇 패턴이면 행에 표식을 답니다(클라이언트 측 힌트 전용).
    const isBot = isBotUserAgent(row.user_agent);
    if (isBot) {
      tableRow.classList.add('is-bot');
    }

    const timeCell = document.createElement('td');
    timeCell.className = 'cell-time';
    timeCell.appendChild(document.createTextNode(formatTimestamp(row.received_at)));
    if (isBot) {
      const botTag = document.createElement('span');
      botTag.className = 'bot-tag';
      botTag.textContent = '🤖 bot';
      botTag.title = `봇으로 추정되는 user_agent: ${row.user_agent}`;
      timeCell.appendChild(botTag);
    }
    tableRow.appendChild(timeCell);

    const uuidCell = document.createElement('td');
    uuidCell.className = 'cell-uuid';
    uuidCell.textContent = shortenUuid(row.uuid);
    uuidCell.title = row.uuid;
    tableRow.appendChild(uuidCell);

    const hrefCell = document.createElement('td');
    hrefCell.className = 'cell-href';
    hrefCell.textContent = shortenHref(row.href);
    hrefCell.title = row.href;
    tableRow.appendChild(hrefCell);

    const argumentsCell = document.createElement('td');
    argumentsCell.className = 'cell-arguments';
    argumentsCell.textContent = summarizeArguments(row.arguments);
    argumentsCell.title = row.arguments;
    tableRow.appendChild(argumentsCell);

    tbody.appendChild(tableRow);
  }
  table.appendChild(tbody);

  wrapper.appendChild(table);
  return wrapper;
}
