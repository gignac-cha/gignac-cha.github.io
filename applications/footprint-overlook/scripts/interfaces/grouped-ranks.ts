// Several small ranked lists stacked inside one panel, each under its own heading — what the
// 방문 환경 panel is built from (색 구성표 · 상위 언어 · 화면 폭).
//
// Why one panel instead of three: those three dimensions each produce two to six bars, and a
// full-width card per dimension would fill the page with headers and whitespace while burying the
// panels that actually carry a ranking. Grouping them keeps the "what kind of browser is reading
// this" question in one place, at the same visual weight as the single-dimension panels beside it.
//
// A group whose query failed is simply not passed in (see dashboard.ts), so this factory never
// needs an error state: it renders exactly the groups it was given, and the panel as a whole falls
// back to its own error/empty state when none survived.

import { createRankedBarList, type RankedItem } from './ranked-bars.ts';

export interface RankedGroup {
  title: string;
  items: ReadonlyArray<RankedItem>;
  // Shown instead of the bars when the query succeeded with no rows — an empty dimension is a
  // fact about the period, not a failure, and blanking the group would hide that it was asked.
  emptyText: string;
}

export function createGroupedRanks(groups: ReadonlyArray<RankedGroup>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ranked-groups';

  for (const group of groups) {
    const section = document.createElement('div');
    section.className = 'ranked-group';

    const title = document.createElement('h3');
    title.className = 'ranked-group-title';
    title.textContent = group.title;
    section.appendChild(title);

    if (group.items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'ranked-group-empty';
      empty.textContent = group.emptyText;
      section.appendChild(empty);
    } else {
      section.appendChild(createRankedBarList(group.items));
    }

    container.appendChild(section);
  }

  return container;
}
