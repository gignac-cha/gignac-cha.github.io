// The 최근 조회 table: time, uuid (shortened), href and a summary of arguments.
// All string shaping is delegated to the pure formatting module, which also decides how a missing
// value renders — every column here except received_at can arrive as SQL null (see the row types
// in tools/tracker-client.ts), so both the cell text and the title tooltip go through a formatter
// rather than touching the raw value. Assigning a null straight to textContent or title would put
// the literal string "null" on screen.

import { detectBotEvidence } from '../tools/bot-detection.ts';
import { formatTimestamp, shortenHref, shortenUuid, summarizeArguments, toDisplayText } from '../tools/formatting.ts';
import type { RecentFootprintRow } from '../tools/tracker-client.ts';

// The time column is labelled UTC because that is what it is: received_at is stamped server-side
// in UTC and rendered without conversion, on the same axis as every chart (see the module header
// of tools/date-ranges.ts). Silently converting to the viewer's local zone would put this table
// on a different day boundary from the charts above it.
const COLUMN_HEADERS = ['시각 (UTC)', 'UUID', 'href', 'arguments'] as const;

// Builds the 🤖 badge for a flagged row, or null when neither bot signal fired.
//
// The two signals get different words because they carry different confidence, and collapsing
// them into one badge would throw away the only thing the reader can act on. A verified bot is
// Cloudflare's own IP/reverse-DNS verdict and names its category, so the badge states it as fact
// and the tooltip says which crawler family it was; the User-Agent heuristic is a substring match
// on a header the client fully controls, so its badge says "추정" and its tooltip shows the raw
// string that triggered it, letting a reader judge a false positive for themselves.
// See tools/bot-detection.ts for why both signals exist and in which order they are consulted.
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

    // Display hint only: the same two signals the tracker ORs together server-side for the
    // bot-ratio card (see tools/bot-detection.ts, which mirrors its hint list).
    const botTag = createBotTag(row);
    if (botTag !== null) {
      tableRow.classList.add('is-bot');
    }

    const timeCell = document.createElement('td');
    timeCell.className = 'cell-time';
    timeCell.appendChild(document.createTextNode(formatTimestamp(row.received_at)));
    if (botTag !== null) {
      timeCell.appendChild(botTag);
    }
    tableRow.appendChild(timeCell);

    const uuidCell = document.createElement('td');
    uuidCell.className = 'cell-uuid';
    uuidCell.textContent = shortenUuid(row.uuid);
    uuidCell.title = toDisplayText(row.uuid);
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
  }
  table.appendChild(tbody);

  wrapper.appendChild(table);
  return wrapper;
}
