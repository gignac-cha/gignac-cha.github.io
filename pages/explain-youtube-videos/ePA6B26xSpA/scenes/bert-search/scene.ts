import './bert-search.scss';
import { appear, createDiagram, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 41:30.4 "검색어 속 작은 단어 하나의 뜻까지 문맥으로 읽게 된 겁니다" ~ 41:40.9 "…영향을 준다고 밝혔죠".
// 구글이 2019년 10월 검색에 BERT를 넣으며 직접 든 예: "2019 brazil traveler to usa need a visa".
// 예전에는 "to"를 흘려 읽어 미국인이 브라질에 가는 이야기를 보여 줬고, BERT 이후에는 주브라질 미국 대사관의 관광 비자 안내를 보여 줬다.
const start = 2490.4;
const end = 2500.9;
const at = {
  query: 2490.4,
  word: 2491.3,
  before: 2491.9,
  context: 2492.5,
  after: 2493.1,
  leap: 2494.8,
  share: 2497.0,
  one: 2497.7,
};

const query = '2019 brazil traveler to usa need a visa';
const fontSize = 40;
// Menlo 계열 고정폭 글꼴의 글자 폭(0.602em). 단어 위치를 글자 수로 계산한다.
const charWidth = fontSize * .602;
const box = { left: 250, right: 1350, top: 190, height: 92 };
const textX = 330;
const baseline = box.top + box.height / 2 + 14;
const wordX = (word: string, from = 0) => {
  const index = query.indexOf(word, from);
  return { left: textX + index * charWidth, center: textX + (index + word.length / 2) * charWidth, width: word.length * charWidth };
};
const to = wordX(' to ', 0);
const toWord = { left: to.left + charWidth, center: to.center, width: 2 * charWidth };
const traveler = wordX('brazil traveler');
const usa = wordX('usa');

const arc = (from: number, to: number, height: number) => `M${from} ${box.top - 6} C${from} ${box.top - height}, ${to} ${box.top - height}, ${to} ${box.top - 6}`;

const resultCard = (parent: SVGElement, x: number, kind: 'before' | 'after', heading: string, body: string, note: string) => {
  const group = svg('g', { class: `bs-result ${kind}`, transform: `translate(${x} 380)` }, parent);
  svg('rect', { width: 520, height: 176, rx: 18 }, group);
  text(group, 32, 50, heading, { class: 'bs-result-heading' });
  text(group, 32, 104, body, { class: 'bs-result-body' });
  text(group, 32, 146, note, { class: 'bs-result-note' });
  return group;
};

export const createBertSearchScene = (): Scene => {
  const { element, root } = createDiagram('bs', '검색어를 읽는 버트(BERT)');

  // 검색창
  const searchBox = svg('g', { class: 'bs-box' }, root);
  svg('rect', { x: box.left, y: box.top, width: box.right - box.left, height: box.height, rx: box.height / 2 }, searchBox);
  svg('circle', { class: 'bs-icon', cx: 290, cy: box.top + box.height / 2 - 4, r: 13 }, searchBox);
  svg('line', { class: 'bs-icon', x1: 299, y1: box.top + box.height / 2 + 5, x2: 309, y2: box.top + box.height / 2 + 15 }, searchBox);
  const mark = svg('rect', { class: 'bs-mark', x: toWord.left - 6, y: box.top + 18, width: toWord.width + 12, height: box.height - 36, rx: 10 }, root);
  const typed = text(root, textX, baseline, '', { class: 'bs-query' });

  // "to"가 앞뒤 단어와 이어지는 방향: 브라질 여행자가 → 미국으로.
  const links = svg('g', { class: 'bs-links' }, root);
  const linkWho = svg('path', { d: arc(toWord.center, traveler.center, 120), pathLength: 1 }, links);
  const linkWhere = svg('path', { d: arc(toWord.center, usa.center, 90), pathLength: 1 }, links);
  const linkLabels = svg('g', {}, links);
  text(linkLabels, (toWord.center + traveler.center) / 2, box.top - 104, '누가', { class: 'bs-link-label' });
  text(linkLabels, (toWord.center + usa.center) / 2 + 10, box.top - 80, '어디로', { class: 'bs-link-label' });

  const before = resultCard(root, 250, 'before', 'BERT 이전', '미국인이 브라질에 갈 때', '"to"를 흘려 읽어 방향이 거꾸로');
  const beforeCross = svg('path', { class: 'bs-cross', d: 'M710 412 l28 28 M738 412 l-28 28' }, root);
  const after = resultCard(root, 830, 'after', 'BERT 이후', '브라질 사람이 미국에 갈 때', '주브라질 미국 대사관 · 관광 비자 안내');
  const afterCheck = svg('path', { class: 'bs-check', d: 'M1290 428 l12 12 l22 -26' }, root);

  // 구글의 소개와 영향 범위
  const leap = svg('g', { class: 'bs-leap' }, root);
  text(leap, 800, 640, '“검색 역사상 가장 큰 도약 중 하나”', { class: 'bs-quote' });
  text(leap, 800, 684, '구글 검색 블로그 · 2019년 10월', { class: 'bs-source' });

  const share = svg('g', { class: 'bs-share' }, root);
  const icons = Array.from({ length: 10 }, (_, i) => {
    const icon = svg('g', { class: 'bs-share-icon', transform: `translate(${440 + i * 72} 770)` }, share);
    svg('rect', { x: -28, y: -24, width: 56, height: 48, rx: 14 }, icon);
    svg('circle', { cx: -3, cy: -3, r: 9 }, icon);
    svg('line', { x1: 4, y1: 4, x2: 11, y2: 11 }, icon);
    return icon;
  });
  const shareLabel = text(share, 800, 846, '미국 영어 검색 10건 중 1건에 영향', { class: 'bs-share-label' });
  const lit = 3;

  const update = (time: number) => {
    const shown = Math.round(query.length * appear(time, at.query, .7));
    const visible = query.slice(0, shown);
    if (typed.textContent !== visible) {
      typed.textContent = visible;
    }
    setAttributes(searchBox, { opacity: appear(time, at.query - .3, .4).toFixed(3) });
    setAttributes(mark, { opacity: appear(time, at.word, .3).toFixed(3) });

    const linked = appear(time, at.context, .6);
    setAttributes(linkWho, { 'stroke-dashoffset': (1 - linked).toFixed(3) });
    setAttributes(linkWhere, { 'stroke-dashoffset': (1 - appear(time, at.context + .2, .6)).toFixed(3) });
    setAttributes(linkLabels, { opacity: appear(time, at.context + .5, .4).toFixed(3) });

    // 결과는 먼저 예전 것, 문맥을 읽은 뒤 새 것. 소개가 나오면 결과는 한 발 물러난다.
    const resting = 1 - .55 * appear(time, at.leap, .6);
    const wrong = appear(time, at.context, .4);
    setAttributes(before, { opacity: (appear(time, at.before, .4) * (1 - .55 * wrong) * resting).toFixed(3) });
    setAttributes(beforeCross, { opacity: (wrong * resting).toFixed(3) });
    setAttributes(after, { opacity: (appear(time, at.after, .4) * resting).toFixed(3) });
    setAttributes(afterCheck, { opacity: (appear(time, at.after + .3, .3) * resting).toFixed(3) });

    setAttributes(leap, { opacity: appear(time, at.leap, .5).toFixed(3) });
    setAttributes(share, { opacity: appear(time, at.share, .4).toFixed(3) });
    icons.forEach((icon, i) => setAttributes(icon, { opacity: appear(time, at.share + i * .05, .3).toFixed(3) }));
    icons[lit].classList.toggle('lit', time >= at.one);
    setAttributes(shareLabel, { opacity: appear(time, at.one, .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: '검색어를 읽는 버트(BERT)',
    start,
    end,
    chapters: [
      { time: start, title: '작은 단어 "to"' },
      { time: at.context, title: '문맥으로 읽은 방향' },
      { time: at.leap, title: '검색의 큰 도약' },
      { time: at.share, title: '검색 10건 중 1건' },
    ],
  };
};
