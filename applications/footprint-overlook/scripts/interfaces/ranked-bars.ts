// Ranked bar list for top-pages / top-origins: a label, a count, and a proportional bar drawn as
// a styled div (no chart library). Bars are scaled against the largest value in the list, not
// against the period total, so the shape of the ranking stays readable regardless of traffic
// volume.

import { formatCount } from '../tools/formatting.ts';

// One row of the list.
export interface RankedItem {
  label: string; // display label (a shortened href/origin, or the missing marker)
  fullLabel: string; // untruncated text for the title tooltip
  value: number;
}

// Builds the list. Bar widths are proportional to the largest value.
export function createRankedBarList(items: ReadonlyArray<RankedItem>): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'ranked-bars';

  const maximumValue = items.reduce((maximum, item) => Math.max(maximum, item.value), 0);

  for (const item of items) {
    const row = document.createElement('li');
    row.className = 'ranked-row';

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
    // A non-zero value gets at least 2% width: a bar one pixel wide is indistinguishable from no
    // bar at all, which would misread as "this page had no footprints".
    const widthPercentage = item.value > 0 ? Math.max(2, widthRatio * 100) : 0;
    bar.style.width = `${widthPercentage}%`;
    track.appendChild(bar);

    row.appendChild(track);
    list.appendChild(row);
  }

  return list;
}
