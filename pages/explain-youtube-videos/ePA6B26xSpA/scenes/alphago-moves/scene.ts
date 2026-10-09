import '../alphago/alphago.scss';
import './alphago-moves.scss';
import { appear, createDiagram, ease, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';
import { createBoard, createReplay, pointName, records, SIZE } from '../alphago/go.ts';

// 34:10 "둘째 판 37번째 수가 나옵니다" ~ 35:01 "이세돌이 따낸 그 한 판이었죠".
const start = 2050.5;
const end = 2101.2;

const at = {
  fifth: 2053.2, // 다섯째 줄에
  drop37: 2054.4, // 돌을 하나 툭 올려놓았어요
  doubt: 2055.8, // 해설자들은 실수가 아니냐며
  rare: 2058.5, // 사람이라면 거의 두지 않는 자리
  chance: 2060.7, // 알파고 스스로도 사람이 이 수를 둘 확률은
  tenThousand: 2063.0, // 만분의 일쯤으로
  meaning: 2068.1, // 대국이 진행될수록 그 한 수의 의미가 드러났습니다
  creative: 2071.2, // 판 전체를 내다본 창의적인 수
  threeZero: 2074.4, // 셋째 판까지 내리 이깁니다
  game4: 2078.9, // 넷째 판에서 반전이
  move78: 2081.5, // 이세돌의 78번째 수
  drop78: 2082.5, // 판 한가운데를 파고드는 한 수
  shaken: 2086.2, // 알파고는 흔들리며 이상한 수를 연달아
  resign: 2089.2, // 알파고가 돌을 던졌습니다
  divine: 2091.1, // 신의 한 수라고 불렀어요
  final: 2096.5, // 최종 결과는 4대 1
  remember: 2099.6, // 기억에 남은 건 이세돌이 따낸 그 한 판
};

const captions: Array<[number, string]> = [
  [start, '제2국, 37번째 수'],
  [at.fifth, '다섯째 줄에 툭'],
  [at.doubt, '해설자들: 실수 아닌가?'],
  [at.rare, '사람이라면 거의 두지 않는 자리'],
  [at.chance, '사람이 이 수를 둘 확률'],
  [at.meaning, '대국이 진행될수록 드러난 의미'],
  [at.creative, '판 전체를 내다본 창의적인 수'],
  [at.threeZero, '알파고 3연승'],
  [at.game4, '제4국의 반전'],
  [at.move78, '이세돌의 78번째 수'],
  [at.drop78, '판 한가운데를 파고든 한 수'],
  [at.shaken, '흔들린 알파고'],
  [at.resign, '알파고의 기권'],
  [at.divine, '신의 한 수'],
  [at.final, '최종 결과 4 : 1'],
  [at.remember, '기억에 남은 한 판'],
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

// 판에 놓인 수: 시간 구간마다 몇 수까지 보였는지.
const game2Plan = [
  { from: start + .1, to: start + 1.9, moves: [0, 36] },
  { from: at.drop37, to: at.drop37, moves: [36, 37] },
  { from: at.meaning, to: at.meaning + 3.2, moves: [37, 150] },
];
const game4Plan = [
  { from: at.game4 - .2, to: at.move78 - .2, moves: [0, 77] },
  { from: at.drop78, to: at.drop78, moves: [77, 78] },
  { from: at.shaken - .6, to: at.shaken + 1.8, moves: [78, 120] },
  { from: at.resign - 1.2, to: at.resign - .1, moves: [120, 180] },
];
const movesAt = (time: number, plan: typeof game2Plan) => {
  let count = 0;
  for (const { from, to, moves } of plan) {
    if (time >= from) {
      count = to === from ? moves[1] : Math.round(moves[0] + (moves[1] - moves[0]) * Math.min(1, (time - from) / (to - from)));
    }
  }
  return count;
};

// 1국~5국 결과(2016년 3월): 알파고 승, 승, 승, 이세돌 승, 알파고 승.
const results = ['알파고', '알파고', '알파고', '이세돌', '알파고'];

// 1/10,000: 100×100 칸 가운데 한 칸.
const oneIn = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#2a2b31';
  context.fillRect(0, 0, 100, 100);
  context.fillStyle = '#ffd75b';
  context.fillRect(63, 41, 1, 1);
  return canvas.toDataURL();
};

const board = { x: 130, y: 205, size: 600 };

const createAlphaGoMoves = () => {
  const { element, root } = createDiagram('alphago-moves', '37수와 78수');
  const caption = createSwapText(root, 800, 140, { class: 'alphago-caption' });
  const game2 = createReplay(records.leeGame2);
  const game4 = createReplay(records.leeGame4);
  const move37 = game2.moves[36];
  const move78 = game4.moves[77];

  const boardGroup = svg('g', { opacity: 0 }, root);
  const goBoard = createBoard(boardGroup, { ...board, labels: true });
  // 다섯째 줄(오른쪽 가장자리에서 다섯 번째 세로줄 = P 줄).
  const fifthX = goBoard.point(move37 % SIZE).x;
  const fifthLine = svg('rect', { class: 'moves-fifth', x: fifthX - 5, y: goBoard.point(0).y - 8, width: 10, height: goBoard.pitch * (SIZE - 1) + 16, rx: 5, opacity: 0 }, goBoard.overlay);
  const fifthLabel = text(goBoard.top, fifthX, board.y + board.size + 30, '다섯째 줄', { class: 'moves-fifth-label', opacity: 0 });
  const ring = svg('circle', { class: 'moves-ring', r: goBoard.pitch * .75, opacity: 0 }, goBoard.top);
  // 수 이름표는 돌의 오른쪽 위에 먼저 붙고, 물음표는 나중에 나오므로 그 위에 그려지게 뒤에 만든다.
  // 물음표는 이름표가 없는 왼쪽 위·왼쪽 아래·오른쪽 아래에 둔다.
  const moveLabel = text(goBoard.top, 0, 0, '', { class: 'moves-label', opacity: 0 });
  const questions = [[-1.3, -1.1], [-1.5, .95], [1.2, 1.25]].map(([dx, dy]) => text(goBoard.top, 0, 0, '?', { class: 'moves-question', 'data-dx': dx, 'data-dy': dy, opacity: 0 }));
  const divine = text(goBoard.top, 0, 0, '신의 한 수', { class: 'moves-divine', opacity: 0 });
  const resignLabel = text(boardGroup, board.x + board.size / 2, board.y + board.size + 64, '', { class: 'moves-result' });

  // 오른쪽: 대국 정보
  const information = createSwapText(root, 820, 250, { class: 'moves-information' });
  const players = text(root, 820, 296, '흑 알파고 · 백 이세돌', { class: 'moves-players', opacity: 0 });

  // 오른쪽: 1/10,000
  const chance = svg('g', { opacity: 0 }, root);
  text(chance, 820, 380, '알파고가 본, 사람이 이 자리에 둘 확률', { class: 'moves-chance-title' });
  svg('image', { href: oneIn(), x: 820, y: 410, width: 320, height: 320, class: 'moves-grid', preserveAspectRatio: 'none' }, chance);
  svg('rect', { class: 'moves-grid-frame', x: 820, y: 410, width: 320, height: 320 }, chance);
  // 빛나는 한 칸을 동그라미로 짚는다.
  const spot = svg('circle', { class: 'moves-spot', cx: 820 + 63.5 * 3.2, cy: 410 + 41.5 * 3.2, r: 16, opacity: 0 }, chance);
  const chanceValue = text(chance, 1180, 600, '1 / 10,000', { class: 'moves-chance', opacity: 0 });
  text(chance, 1180, 650, '10,000칸 중 한 칸', { class: 'moves-chance-note' });

  // 오른쪽: 다섯 판 결과
  const tally = svg('g', { opacity: 0 }, root);
  const chips = results.map((winner, i) => {
    const group = svg('g', { opacity: 0 }, tally);
    const x = 820 + i * 136;
    const chip = svg('rect', { class: `moves-chip ${winner === '이세돌' ? 'lee' : 'alphago'}`, x, y: 420, width: 120, height: 150, rx: 16 }, group);
    text(group, x + 60, 470, `${i + 1}국`, { class: 'moves-chip-round' });
    text(group, x + 60, 530, winner, { class: 'moves-chip-winner' });
    return { group, chip, i };
  });
  const score = createSwapText(tally, 1150, 680, { class: 'moves-score' });
  text(tally, 1150, 730, '알파고 : 이세돌', { class: 'moves-chance-note' });

  const update = (time: number) => {
    caption.update(time, captionAt);
    setAttributes(boardGroup, { opacity: appear(time, start, .4).toFixed(3) });

    // 판: 제2국, 이어서 제4국.
    const onGame4 = time >= at.game4 - .2;
    const replay = onGame4 ? game4 : game2;
    const count = onGame4 ? movesAt(time, game4Plan) : movesAt(time, game2Plan);
    goBoard.update(replay.at(count), count > 0 ? replay.moves[count - 1] : undefined);

    // 다섯째 줄과 37수
    const show37 = !onGame4 && time >= at.drop37;
    setAttributes(fifthLine, { opacity: (appear(time, at.fifth, .3) * (1 - appear(time, at.doubt + 1, .5)) * (onGame4 ? 0 : 1) * .8).toFixed(3) });
    setAttributes(fifthLabel, { opacity: (appear(time, at.fifth, .3) * (1 - appear(time, at.doubt + 1, .5)) * (onGame4 ? 0 : 1)).toFixed(3) });
    const focus = onGame4 ? move78 : move37;
    const focusAt = onGame4 ? at.drop78 : at.drop37;
    const p = goBoard.point(focus);
    const pop = time >= focusAt ? 1 + .6 * (1 - ease(progress(time, focusAt, .35))) : 1;
    const ringOn = onGame4 ? time >= at.drop78 : show37;
    setAttributes(ring, { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: (goBoard.pitch * .75 * pop).toFixed(1), opacity: ringOn ? 1 : 0 });
    ring.classList.toggle('lee', onGame4);
    ring.classList.toggle('glow', (!onGame4 && time >= at.creative) || (onGame4 && time >= at.divine));
    const labelText = onGame4 ? `78수 · ${pointName(move78)}` : `37수 · ${pointName(move37)}`;
    if (moveLabel.textContent !== labelText) {
      moveLabel.textContent = labelText;
    }
    setAttributes(moveLabel, { x: (p.x + goBoard.pitch * 1.1).toFixed(1), y: (p.y - goBoard.pitch * 1.1).toFixed(1), opacity: (appear(time, focusAt + .2, .3) * (onGame4 ? 1 : 1 - appear(time, at.game4 - .6, .3))).toFixed(3) });
    questions.forEach((question) => {
      const dx = Number(question.getAttribute('data-dx'));
      const dy = Number(question.getAttribute('data-dy'));
      setAttributes(question, { x: (p.x + dx * goBoard.pitch).toFixed(1), y: (p.y + dy * goBoard.pitch + 12).toFixed(1), opacity: onGame4 ? 0 : (appear(time, at.doubt + .3, .3) * (1 - appear(time, at.rare + 1, .4))).toFixed(3) });
    });
    setAttributes(divine, { x: (p.x).toFixed(1), y: (p.y + goBoard.pitch * 1.9).toFixed(1), opacity: onGame4 ? appear(time, at.divine, .4).toFixed(3) : 0 });
    const resignText = onGame4 && time >= at.resign ? '알파고 기권 · 이세돌 승' : '';
    if (resignLabel.textContent !== resignText) {
      resignLabel.textContent = resignText;
    }

    // 대국 정보
    information.update(time, (t) => (t >= at.game4 - .2 ? '제4국 · 2016년 3월 13일' : '제2국 · 2016년 3월 10일'));
    setAttributes(players, { opacity: appear(time, start + .3, .4).toFixed(3) });

    // 1/10,000
    setAttributes(chance, { opacity: (appear(time, at.chance - .3, .4) * (1 - appear(time, at.threeZero - .5, .4))).toFixed(3) });
    setAttributes(chanceValue, { opacity: appear(time, at.tenThousand, .3).toFixed(3) });
    setAttributes(spot, { opacity: appear(time, at.tenThousand, .3).toFixed(3), r: (16 + 10 * (1 - ease(progress(time, at.tenThousand, .5)))).toFixed(1) });

    // 다섯 판 결과
    setAttributes(tally, { opacity: appear(time, at.threeZero - .3, .4).toFixed(3) });
    chips.forEach(({ group, chip, i }) => {
      const shownAt = i < 3 ? at.threeZero + i * .2 : i === 3 ? at.resign : at.final;
      setAttributes(group, { opacity: appear(time, shownAt, .3).toFixed(3) });
      chip.classList.toggle('remember', i === 3 && time >= at.remember);
    });
    score.update(time, (t) => (t >= at.final ? '4 : 1' : t >= at.resign ? '3 : 1' : t >= at.threeZero ? '3 : 0' : ''));
  };

  return { element, update };
};

export const createAlphaGoMovesScene = (): Scene => ({
  ...createAlphaGoMoves(),
  title: '37수와 78수',
  start,
  end,
  chapters: [
    { time: start, title: '제2국 37수' },
    { time: at.chance, title: '사람이 둘 확률 1/10,000' },
    { time: at.meaning, title: '판 전체를 내다본 수' },
    { time: at.game4, title: '제4국 78수' },
    { time: at.divine, title: '신의 한 수' },
    { time: at.final, title: '최종 4 : 1' },
  ],
});
