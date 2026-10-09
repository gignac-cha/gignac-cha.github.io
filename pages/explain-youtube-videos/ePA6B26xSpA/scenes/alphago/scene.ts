import './alphago.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';
import { createBoard, createReplay, EMPTY, records, SIZE } from './go.ts';

// 33:27 "다음 목표로 바둑을 골라요" ~ 33:56 "자기 자신과 수없이 대국하며 실력을 키웠어요".
const start = 2006.8;
const end = 2036.0;

const at = {
  wall: 2008.7, // 인공지능의 마지막 성벽
  cases: 2011.6, // 둘 수 있는 경우의 수가
  atoms: 2013.3, // 우주의 원자 수보다 많다고 하죠
  search: 2015.4, // 체스처럼 모든 수를 따져보는
  impossible: 2017.2, // 도저히 불가능했어요
  decade: 2018.9, // 적어도 10년은 더 걸릴 거라고
  eyes: 2022.8, // 두 개의 신경망 눈
  policy: 2024.7, // 하나는 어디에 둘 만한지
  narrow: 2026.3, // 후보를 좁히는 눈
  value: 2027.6, // 다른 하나는 판세가 누구에게 유리한지 읽는 눈
  human: 2031.2, // 사람 고수들의 기보를 보고 배웠습니다
  self: 2034.2, // 자기 자신과 수없이 대국하며
};

const captions: Array<[number, string]> = [
  [start, '다음 목표: 바둑'],
  [at.wall, '인공지능의 마지막 성벽'],
  [at.cases, '둘 수 있는 경우의 수'],
  [at.atoms, '우주의 원자 수보다 많다'],
  [at.search, '체스처럼 모든 수를 따져 보면?'],
  [at.impossible, '도저히 불가능'],
  [at.decade, '전문가들: 적어도 10년은 더'],
  [at.eyes, '알파고의 두 신경망 눈'],
  [at.policy, '눈 하나: 어디에 둘 만한가'],
  [at.value, '다른 눈: 지금 누가 유리한가'],
  [at.human, '처음엔 사람 고수들의 기보로'],
  [at.self, '그다음엔 자기 자신과 대국'],
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

// 판: 제2국의 36수까지(37수 바로 앞).
const shown = 36;
const placeFrom = start + .5;
const placeEach = .08;
// 정책망 그림: 빈 자리 전체 → 몇 곳. 실제 신경망 출력이 아니라 "후보를 좁힌다"는 설명용 표시다.
const candidates = ['qk', 'pk', 'ng', 'qh', 'mj'].map((p) => (p.charCodeAt(1) - 97) * SIZE + (p.charCodeAt(0) - 97));

// AlphaGo 논문(Silver et al. 2016)의 탐색 크기: 체스 b≈35, d≈80 / 바둑 b≈250, d≈150.
const trees = [
  { name: '체스', breadth: 35, depth: 80, x: 900 },
  { name: '바둑', breadth: 250, depth: 150, x: 1280 },
];
const power = (breadth: number, depth: number) => Math.round(depth * Math.log10(breadth));

const board = { x: 110, y: 195, size: 540 };

const createAlphaGo = () => {
  const { element, root } = createDiagram('alphago', '알파고의 두 눈');
  const caption = createSwapText(root, 800, 140, { class: 'alphago-caption' });
  const replay = createReplay(records.leeGame2);

  const boardGroup = svg('g', { opacity: 0 }, root);
  const goBoard = createBoard(boardGroup, board);
  // 정책망: 빈 자리마다 작은 점, 이어서 후보 몇 곳만 빛난다.
  const position = replay.at(shown);
  const emptyDots = Array.from({ length: SIZE * SIZE }, (_, index) => index)
    .filter((index) => position[index] === EMPTY)
    .map((index) => {
      const p = goBoard.point(index);
      return svg('circle', { class: 'alphago-empty', cx: p.x, cy: p.y, r: goBoard.pitch * .16, opacity: 0 }, goBoard.top);
    });
  const candidateGlows = candidates.map((index, i) => {
    const p = goBoard.point(index);
    return svg('circle', { class: 'alphago-candidate', cx: p.x, cy: p.y, r: goBoard.pitch * (.5 - i * .04), opacity: 0 }, goBoard.top);
  });
  const boardNote = text(boardGroup, board.x + board.size / 2, board.y + board.size + 34, '이세돌과의 제2국, 36수까지', { class: 'alphago-board-note' });
  // 가치망: 판 아래의 판세 막대.
  const gauge = svg('g', { opacity: 0 }, root);
  const gaugeBox = { x: board.x, y: board.y + board.size + 62, width: board.size };
  svg('rect', { class: 'alphago-gauge white', x: gaugeBox.x, y: gaugeBox.y, width: gaugeBox.width, height: 26, rx: 13 }, gauge);
  const gaugeBlack = svg('rect', { class: 'alphago-gauge black', x: gaugeBox.x, y: gaugeBox.y, width: gaugeBox.width / 2, height: 26, rx: 13 }, gauge);
  text(gauge, gaugeBox.x, gaugeBox.y + 56, '흑 유리', { class: 'alphago-gauge-label', 'text-anchor': 'start' });
  text(gauge, gaugeBox.x + gaugeBox.width, gaugeBox.y + 56, '백 유리', { class: 'alphago-gauge-label', 'text-anchor': 'end' });

  // 오른쪽 1: 경우의 수
  const counts = svg('g', { opacity: 0 }, root);
  const countRows = [
    { label: '바둑판에 나올 수 있는 국면', base: '2.08 × 10', exponent: '170', value: 170, at: at.cases, className: 'go' },
    { label: '우주의 원자', base: '약 10', exponent: '80', value: 80, at: at.atoms, className: 'atoms' },
  ].map((row, i) => {
    const group = svg('g', { opacity: 0 }, counts);
    const y = 300 + i * 170;
    text(group, 760, y, row.label, { class: 'alphago-count-label' });
    const number = text(group, 760, y + 62, row.base, { class: `alphago-count ${row.className}` });
    const sup = svg('tspan', { dy: -26, class: 'alphago-exponent' }, number);
    sup.textContent = row.exponent;
    const bar = svg('rect', { class: `alphago-count-bar ${row.className}`, x: 760, y: y + 86, width: 0, height: 18, rx: 9 }, group);
    return { ...row, group, bar };
  });
  text(counts, 760, 660, '막대 길이 = 0의 개수', { class: 'alphago-footnote', 'text-anchor': 'start' });

  // 오른쪽 2: 모든 수를 따지는 나무
  const search = svg('g', { opacity: 0 }, root);
  const treeGroups = trees.map((tree) => {
    const group = svg('g', { opacity: 0 }, search);
    const rootY = 270;
    let d = '';
    for (let i = 0; i < tree.breadth; i++) {
      const angle = lerp(-1.05, 1.05, tree.breadth === 1 ? .5 : i / (tree.breadth - 1));
      d += `M${tree.x},${rootY}L${(tree.x + Math.sin(angle) * 170).toFixed(1)},${(rootY + Math.cos(angle) * 230).toFixed(1)}`;
    }
    const fan = svg('path', { class: 'alphago-fan', d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, group);
    svg('circle', { class: 'alphago-root', cx: tree.x, cy: rootY, r: 10 }, group);
    text(group, tree.x, 560, tree.name, { class: 'alphago-tree-name' });
    text(group, tree.x, 600, `한 수에 약 ${tree.breadth}가지 · 한 판 약 ${tree.depth}수`, { class: 'alphago-tree-detail' });
    const total = text(group, tree.x, 660, `${tree.breadth}`, { class: 'alphago-tree-total' });
    const exponent = svg('tspan', { dy: -22, class: 'alphago-exponent' }, total);
    exponent.textContent = String(tree.depth);
    const rest = svg('tspan', { dy: 22 }, total);
    rest.textContent = ` ≈ 10`;
    const exponent2 = svg('tspan', { dy: -22, class: 'alphago-exponent' }, total);
    exponent2.textContent = String(power(tree.breadth, tree.depth));
    return { tree, group, fan };
  });
  const cross = svg('g', { opacity: 0 }, search);
  svg('path', { class: 'alphago-cross', d: `M${trees[1].x - 130},300L${trees[1].x + 130},500M${trees[1].x + 130},300L${trees[1].x - 130},500` }, cross);
  const decade = text(search, 1090, 740, '전문가 예상: 적어도 10년은 더', { class: 'alphago-decade', opacity: 0 });

  // 오른쪽 3: 두 눈
  const eyes = svg('g', { opacity: 0 }, root);
  const eyeCards = [
    { title: '정책망', body: '어디에 둘 만한가', detail: '수백 곳 → 후보 몇 곳', at: at.policy, className: 'policy', y: 250 },
    { title: '가치망', body: '지금 누가 유리한가', detail: '판세를 한눈에 읽는다', at: at.value, className: 'value', y: 430 },
  ].map((card) => {
    const group = svg('g', { opacity: 0 }, eyes);
    svg('rect', { class: `alphago-eye ${card.className}`, x: 760, y: card.y, width: 720, height: 150, rx: 22 }, group);
    // 눈 모양
    const cx = 850;
    const cy = card.y + 75;
    svg('path', { class: `alphago-eye-shape ${card.className}`, d: `M${cx - 48},${cy}Q${cx},${cy - 44} ${cx + 48},${cy}Q${cx},${cy + 44} ${cx - 48},${cy}Z` }, group);
    svg('circle', { class: `alphago-pupil ${card.className}`, cx, cy, r: 15 }, group);
    text(group, 930, card.y + 62, card.title, { class: 'alphago-eye-title' });
    text(group, 930, card.y + 108, card.body, { class: 'alphago-eye-body' });
    text(group, 1460, card.y + 108, card.detail, { class: 'alphago-eye-detail' });
    return { ...card, group };
  });

  // 오른쪽 4: 배운 순서
  const learning = svg('g', { opacity: 0 }, root);
  const stepCards = [
    { title: '1. 사람 고수의 기보', detail: 'KGS 바둑 서버 6~9단 · 16만 판 · 약 3천만 국면', at: at.human, y: 640 },
    { title: '2. 자기 자신과 대국', detail: '두 알파고가 수없이 두고, 그 결과로 다시 배운다', at: at.self, y: 760 },
  ].map((card) => {
    const group = svg('g', { opacity: 0 }, learning);
    svg('rect', { class: 'alphago-step', x: 760, y: card.y - 46, width: 720, height: 100, rx: 18 }, group);
    text(group, 790, card.y - 4, card.title, { class: 'alphago-step-title' });
    text(group, 790, card.y + 34, card.detail, { class: 'alphago-step-detail' });
    return { ...card, group };
  });
  const selfPlay = svg('g', { opacity: 0 }, learning);
  const spinner = svg('path', { class: 'alphago-loop', d: 'M1420,700a26,26 0 1,1 -1,0' }, selfPlay);

  const update = (time: number) => {
    caption.update(time, captionAt);

    // 판
    setAttributes(boardGroup, { opacity: appear(time, start, .5).toFixed(3) });
    const placed = Math.min(shown, Math.max(0, Math.floor((time - placeFrom) / placeEach) + 1));
    goBoard.update(replay.at(placed), placed > 0 ? replay.moves[placed - 1] : undefined);
    setAttributes(boardNote, { opacity: appear(time, placeFrom + shown * placeEach, .4).toFixed(3) });
    const policyOn = appear(time, at.policy, .4) * (1 - appear(time, at.human, .5));
    const narrowed = ease(progress(time, at.narrow, .7));
    emptyDots.forEach((dot) => setAttributes(dot, { opacity: (policyOn * (1 - narrowed) * .9).toFixed(3) }));
    candidateGlows.forEach((glow, i) => setAttributes(glow, { opacity: (policyOn * appear(time, at.narrow + .2 + i * .08, .3)).toFixed(3) }));
    // 판세 막대: 흔들리다가 한쪽으로 기운다(설명용).
    setAttributes(gauge, { opacity: (appear(time, at.value, .4) * (1 - appear(time, at.human, .5))).toFixed(3) });
    const settle = ease(progress(time, at.value + .3, 2));
    const lean = lerp(.5 + .12 * Math.sin(time * 6), .58, settle);
    setAttributes(gaugeBlack, { width: (gaugeBox.width * lean).toFixed(1) });

    // 오른쪽 1: 경우의 수
    setAttributes(counts, { opacity: (appear(time, at.cases - .2, .4) * (1 - appear(time, at.search - .3, .3))).toFixed(3) });
    countRows.forEach(({ group, bar, value, at: from }) => {
      setAttributes(group, { opacity: appear(time, from, .4).toFixed(3) });
      setAttributes(bar, { width: (ease(progress(time, from + .2, .8)) * value * 4).toFixed(1) });
    });

    // 오른쪽 2: 나무
    setAttributes(search, { opacity: (appear(time, at.search - .2, .4) * (1 - appear(time, at.eyes - .4, .4))).toFixed(3) });
    treeGroups.forEach(({ group, fan }, i) => {
      setAttributes(group, { opacity: appear(time, at.search + i * .5, .3).toFixed(3) });
      setAttributes(fan, { 'stroke-dashoffset': (1 - ease(progress(time, at.search + i * .5, .8))).toFixed(4) });
    });
    setAttributes(cross, { opacity: appear(time, at.impossible, .3).toFixed(3) });
    setAttributes(decade, { opacity: appear(time, at.decade, .4).toFixed(3) });

    // 오른쪽 3: 두 눈
    setAttributes(eyes, { opacity: appear(time, at.eyes - .2, .4).toFixed(3) });
    eyeCards.forEach(({ group, at: from }) => setAttributes(group, { opacity: (time >= at.eyes ? Math.max(appear(time, from, .4), appear(time, at.eyes, .4) * .35) : 0).toFixed(3) }));

    // 오른쪽 4: 배운 순서
    setAttributes(learning, { opacity: appear(time, at.human - .2, .4).toFixed(3) });
    stepCards.forEach(({ group, at: from }) => setAttributes(group, { opacity: appear(time, from, .4).toFixed(3) }));
    setAttributes(selfPlay, { opacity: appear(time, at.self + .3, .4).toFixed(3) });
    setAttributes(spinner, { transform: `rotate(${((time * 240) % 360).toFixed(1)} 1420 726)` });
  };

  return { element, update };
};

export const createAlphaGoScene = (): Scene => ({
  ...createAlphaGo(),
  title: '알파고의 두 눈',
  start,
  end,
  chapters: [
    { time: start, title: '인공지능의 마지막 성벽' },
    { time: at.cases, title: '우주의 원자보다 많은 경우의 수' },
    { time: at.search, title: '모든 수를 따지기는 불가능' },
    { time: at.eyes, title: '두 신경망 눈' },
    { time: at.policy, title: '후보를 좁히는 눈' },
    { time: at.value, title: '판세를 읽는 눈' },
    { time: at.human, title: '기보, 그리고 자기 대국' },
  ],
});
