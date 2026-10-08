import '../alphago/alphago.scss';
import './alphago-zero.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';
import { createBoard, createReplay, records } from '../alphago/go';

// 35:16 "알파고 제로라는 새 버전이었어요" ~ 35:34 "보여준 거죠".
const start = 2115.8;
const end = 2134.0;

const at = {
  noRecords: 2119.0, // 사람의 기보를 하나도 보지 않았습니다
  zero: 2119.5, // 하나도
  rules: 2121.2, // 규칙만 알려주고
  alone: 2122.0, // 혼자 두며 배우게 한 거예요
  days: 2123.6, // 불과 사흘 만에
  caught: 2125.5, // 이세돌을 이긴 버전을 따라잡았어요
  match: 2127.5, // 그 버전을 상대로
  hundred: 2128.0, // 100대 0이라는 성적을
  beyond: 2130.8, // 사람의 지식 없이도 사람을 넘어설 수 있다는 걸
};

const captions: Array<[number, string]> = [
  [start, '알파고 제로 (2017)'],
  [at.noRecords, '사람의 기보는 하나도 보지 않았다'],
  [at.rules, '규칙만 알려 주고'],
  [at.alone, '혼자 두며 배운다'],
  [at.days, '불과 사흘 만에'],
  [at.caught, '이세돌을 이긴 버전을 따라잡았다'],
  [at.match, '그 버전과 100판'],
  [at.hundred, '100 : 0'],
  [at.beyond, '사람의 지식 없이도 사람을 넘어서다'],
];
const captionAt = (time: number) => {
  let current = '';
  for (const [from, content] of captions) {
    if (from <= time) {
      current = content;
    }
  }
  return current;
};

// 알파고 제로가 혼자 둔 실제 대국(Nature 2017 그림 5c): 학습 3시간·19시간·70시간째.
const selfPlay = [
  { record: records.zero3h, hours: 3, label: '학습 3시간' },
  { record: records.zero19h, hours: 19, label: '학습 19시간' },
  { record: records.zero70h, hours: 70, label: '학습 70시간' },
];
const boardSize = 300;
const boardX = (i: number) => 250 + i * 400;
const boardY = 210;
const shownMoves = 80;
const playFrom = at.alone + .2;
const playFor = 4.6;

// 학습 시간 막대: 0 ~ 72시간(사흘). 오른쪽 끝 너머에 "따라잡음"을 쓰므로 판 줄보다 짧게 둔다.
const timeline = { left: 200, right: 1200, y: 640, hours: 72 };
const hourX = (hours: number) => lerp(timeline.left, timeline.right, hours / timeline.hours);

const createAlphaGoZero = () => {
  const { element, root } = createDiagram('alphago-zero', '알파고 제로');
  const caption = createSwapText(root, 800, 140, { class: 'alphago-caption' });

  // 처음: 사람 기보 0, 규칙만
  const cards = svg('g', { opacity: 0 }, root);
  const recordsCard = svg('g', { opacity: 0 }, cards);
  svg('rect', { class: 'zero-card', x: 330, y: 300, width: 420, height: 260, rx: 24 }, recordsCard);
  text(recordsCard, 540, 370, '사람 고수의 기보', { class: 'zero-card-title' });
  const recordsCount = createSwapText(recordsCard, 540, 470, { class: 'zero-card-number' });
  text(recordsCard, 540, 520, '이전 알파고는 약 3천만 국면', { class: 'zero-card-note' });
  const rulesCard = svg('g', { opacity: 0 }, cards);
  svg('rect', { class: 'zero-card rules', x: 850, y: 300, width: 420, height: 260, rx: 24 }, rulesCard);
  text(rulesCard, 1060, 370, '알려 준 것', { class: 'zero-card-title' });
  text(rulesCard, 1060, 470, '바둑 규칙만', { class: 'zero-card-number rules' });

  // 혼자 둔 세 판
  const games = selfPlay.map((game, i) => {
    const group = svg('g', { opacity: 0 }, root);
    const board = createBoard(group, { x: boardX(i), y: boardY, size: boardSize });
    text(group, boardX(i) + boardSize / 2, boardY + boardSize + 40, game.label, { class: 'zero-board-label' });
    const link = svg('line', { class: 'zero-link', x1: boardX(i) + boardSize / 2, y1: boardY + boardSize + 56, x2: hourX(game.hours), y2: timeline.y - 14 }, group);
    return { ...game, group, board, link, replay: createReplay(game.record) };
  });
  // 출처는 판 위에 둔다(판 아래는 학습 시간 막대로 가는 점선이 지나간다).
  const source = text(root, 800, boardY - 20, '', { class: 'alphago-footnote', 'text-anchor': 'middle' });

  // 학습 시간 막대
  const timelineGroup = svg('g', { opacity: 0 }, root);
  svg('line', { class: 'zero-track', x1: timeline.left, x2: timeline.right, y1: timeline.y, y2: timeline.y }, timelineGroup);
  const progressLine = svg('line', { class: 'zero-progress', x1: timeline.left, x2: timeline.left, y1: timeline.y, y2: timeline.y }, timelineGroup);
  for (const hours of [0, 24, 48, 72]) {
    svg('line', { class: 'zero-tick', x1: hourX(hours), x2: hourX(hours), y1: timeline.y - 8, y2: timeline.y + 8 }, timelineGroup);
    text(timelineGroup, hourX(hours), timeline.y + 40, hours === 0 ? '0' : `${hours / 24}일`, { class: 'zero-tick-label' });
  }
  const head = svg('circle', { class: 'zero-head', cy: timeline.y, r: 10 }, timelineGroup);
  // 막대 오른쪽 끝 너머(점선이 닿지 않는 자리).
  const caughtLabel = text(timelineGroup, timeline.right + 28, timeline.y + 8, '이세돌을 이긴 버전 따라잡음', { class: 'zero-caught', opacity: 0 });

  // 100판
  const matches = svg('g', { opacity: 0 }, root);
  const cells = Array.from({ length: 100 }, (_, i) => svg('rect', { class: 'zero-cell', x: 200 + (i % 50) * 24, y: 714 + Math.floor(i / 50) * 26, width: 20, height: 20, rx: 4 }, matches));
  const tally = createSwapText(matches, 800, 834, { class: 'zero-tally' });
  text(matches, 800, 870, '알파고 제로 : 이세돌을 이긴 버전(AlphaGo Lee)', { class: 'alphago-footnote', 'text-anchor': 'middle' });

  const update = (time: number) => {
    caption.update(time, captionAt);

    setAttributes(cards, { opacity: (appear(time, start, .4) * (1 - appear(time, at.alone - .2, .4))).toFixed(3) });
    setAttributes(recordsCard, { opacity: appear(time, start + .3, .4).toFixed(3) });
    recordsCount.update(time, (t) => (t >= at.zero ? '0' : ''));
    recordsCard.classList.toggle('none', time >= at.zero);
    setAttributes(rulesCard, { opacity: appear(time, at.rules, .4).toFixed(3) });

    games.forEach(({ group, board, replay }, i) => {
      setAttributes(group, { opacity: appear(time, at.alone + i * .15, .4).toFixed(3) });
      const count = Math.round(shownMoves * Math.min(1, Math.max(0, (time - playFrom) / playFor)));
      board.update(replay.at(count), count > 0 ? replay.moves[count - 1] : undefined);
    });
    const sourceText = time >= at.alone ? 'Nature 2017 그림 5c의 실제 자기 대국 · 앞 80수' : '';
    if (source.textContent !== sourceText) {
      source.textContent = sourceText;
    }
    setAttributes(source, { opacity: appear(time, at.alone + .6, .4).toFixed(3) });

    const timelineShown = appear(time, at.days - .3, .4);
    setAttributes(timelineGroup, { opacity: timelineShown.toFixed(3) });
    games.forEach(({ link }) => setAttributes(link, { opacity: timelineShown.toFixed(3) }));
    const reached = ease(progress(time, at.days, at.caught - at.days));
    const headX = lerp(timeline.left, timeline.right, reached);
    setAttributes(head, { cx: headX.toFixed(1) });
    setAttributes(progressLine, { x2: headX.toFixed(1) });
    setAttributes(caughtLabel, { opacity: appear(time, at.caught, .4).toFixed(3) });
    games.forEach(({ link, hours }) => link.classList.toggle('lit', headX >= hourX(hours)));

    setAttributes(matches, { opacity: appear(time, at.match, .4).toFixed(3) });
    cells.forEach((cell, i) => cell.classList.toggle('won', time >= at.match + .3 + i * .009));
    tally.update(time, (t) => (t >= at.hundred + .4 ? '100 : 0' : ''));
  };

  return { element, update };
};

export const createAlphaGoZeroScene = (): Scene => ({
  ...createAlphaGoZero(),
  title: '알파고 제로',
  start,
  end,
  chapters: [
    { time: start, title: '사람의 기보 없이' },
    { time: at.alone, title: '혼자 두며 배우기' },
    { time: at.days, title: '사흘 만에 따라잡기' },
    { time: at.match, title: '100 : 0' },
  ],
});
