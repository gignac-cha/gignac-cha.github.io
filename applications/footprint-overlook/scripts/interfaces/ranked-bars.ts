// 순위 막대 목록(top-pages / top-origins)입니다. 라벨 + 수치 + 비례 막대(styled div)로 구성합니다.
// 최대값 대비 비율 계산은 순수 summaries.maxRowValue 를 씁니다.

import { formatCount } from '../tools/formatting.ts';

// 막대 한 줄에 필요한 데이터입니다.
export interface RankedItem {
  label: string; // 화면 표기 라벨(축약된 href/origin)
  fullLabel: string; // title 툴팁용 원문
  value: number;
}

// 막대 목록(ul)을 만듭니다. 최대값을 분모로 각 막대 폭을 비례 배분합니다.
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
    // 값이 있으면 최소 2% 폭을 줘 눈에 보이게 합니다.
    const widthPercentage = item.value > 0 ? Math.max(2, widthRatio * 100) : 0;
    bar.style.width = `${widthPercentage}%`;
    track.appendChild(bar);

    row.appendChild(track);
    list.appendChild(row);
  }

  return list;
}
