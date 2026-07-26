// A ranked list of horizontal bars, with the unreported rows folded into a footnote.
//
// Whether a row is "unreported" is NOT decided here and is not guessed from its text. The caller
// builds each item from a database row and knows whether the column was SQL null, so it sets
// isUnreported at that point; this file only partitions on the flag (tools/unreported-folding.ts).
// The earlier label-sniffing version had to be removed because it could not distinguish the two
// meanings a Korean label carries: '직접 유입' is ordinary, fully-reported traffic (a visit with no
// referrer), while '미보고 (source 없음)' is a missing measurement, and a keyword list matching on
// '미상' folded the first one away as if the data were absent.

import { formatCount } from '../tools/formatting.ts';
import { partitionUnreportedItems } from '../tools/unreported-folding.ts';

// One row of the list.
export interface RankedItem {
  label: string; // display label (a shortened href/origin, or the missing marker)
  fullLabel: string; // untruncated text for the title tooltip
  value: number;
  // True when the underlying column was null / unset — the value is a measurement gap, not a
  // category. Absent means "reported", so a panel that has no gaps says nothing.
  isUnreported?: boolean;
}

export interface RankedBarListOptions {
  // Default true. When on, unreported rows leave the list and are summarised in a footnote that
  // can put them back; when off, they are ranked inline like any other row (the 신규/재방문 and
  // 방문 깊이 panels, whose buckets are all reported by construction).
  foldUnreported?: boolean;
}

// Builds the list. Bar widths are proportional to the largest value.
export function createRankedBarList(
  items: ReadonlyArray<RankedItem>,
  options: RankedBarListOptions = {},
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ranked-bars-container';

  // Compared against false explicitly: an options object that omits the key must still fold, and
  // `!options.foldUnreported` would read the omission as "show them".
  let showUnreportedInList = options.foldUnreported === false;

  const { reported, unreported } = partitionUnreportedItems(items);
  const totalUnreportedValue = unreported.reduce((sum, item) => sum + item.value, 0);

  const renderContent = (): void => {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const displayItems = showUnreportedInList ? [...items] : reported;

    const list = document.createElement('ul');
    list.className = 'ranked-bars';

    const maximumValue = displayItems.reduce((maximum, item) => Math.max(maximum, item.value), 0);

    for (const item of displayItems) {
      const row = document.createElement('li');
      row.className = item.isUnreported === true ? 'ranked-row is-unreported' : 'ranked-row';

      const head = document.createElement('div');
      head.className = 'ranked-head';

      const label = document.createElement('span');
      label.className = 'ranked-label';
      label.textContent = item.label;
      label.title = item.fullLabel;
      head.appendChild(label);

      const count = document.createElement('span');
      count.className = 'ranked-count';
      count.textContent = formatCount(item.value);
      head.appendChild(count);

      row.appendChild(head);

      const track = document.createElement('div');
      track.className = 'ranked-track';

      const bar = document.createElement('div');
      bar.className = 'ranked-bar';
      const widthRatio = maximumValue > 0 ? item.value / maximumValue : 0;
      const widthPercentage = item.value > 0 ? Math.max(2, widthRatio * 100) : 0;
      bar.style.width = `${widthPercentage}%`;
      track.appendChild(bar);

      row.appendChild(track);
      list.appendChild(row);
    }

    container.appendChild(list);

    // Only panels that actually have a gap get the footnote. A panel with nothing unreported must
    // stay silent: a "미보고 합계 0건" line would read as a measurement problem where there is none.
    if (unreported.length > 0) {
      const footnote = document.createElement('div');
      footnote.className = 'unreported-footnote';

      const textSpan = document.createElement('span');
      textSpan.textContent = `미보고/미상 항목 합계 ${formatCount(totalUnreportedValue)}건`;
      footnote.appendChild(textSpan);

      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = 'unreported-toggle-button';
      toggleButton.textContent = showUnreportedInList ? '각주로 접기' : '목록에 포함하기';
      toggleButton.setAttribute('aria-expanded', showUnreportedInList ? 'true' : 'false');
      toggleButton.addEventListener('click', () => {
        showUnreportedInList = !showUnreportedInList;
        renderContent();
      });
      footnote.appendChild(toggleButton);

      container.appendChild(footnote);
    }
  };

  renderContent();
  return container;
}
