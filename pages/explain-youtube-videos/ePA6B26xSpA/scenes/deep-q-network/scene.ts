import './deep-q-network.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';
import { BRICKS, FIELD, frameAt, PADDLE, type Run } from './breakout.ts';
import { createGames } from './games.ts';

// 32:43 "논문으로 세상을 놀라게 합니다" ~ 33:23 "합성곱 신경망이라는 눈을 붙인 겁니다".
const start = 1963.5;
const end = 2003.1;

const at = {
  atari: 1965.6, // 옛날 아타리 게임기의 게임들을
  pixels: 1969.8, // 화면의 픽셀과
  score: 1971.0, // 점수뿐이었습니다
  rules: 1972.6, // 게임 규칙은 하나도 알려주지 않았죠
  breakout: 1973.9, // 벽돌 깨기 게임에서는
  hole: 1983.3, // 벽 한쪽에 구멍을 뚫는 (시뮬레이션에서 마지막 벽돌이 깨지는 순간)
  behind: 1985.8, // 공을 벽돌 뒤로 올려 보내
  itself: 1987.2, // 알아서 부수게 만드는
  rl: 1990.3, // 강화 학습입니다
  dog: 1991.4, // 강아지에게 간식으로 훈련을
  reward: 1994.3, // 잘하면 보상을 주고
  none: 1995.5, // 못하면 주지 않습니다
  seek: 1996.9, // 스스로 보상을 많이 받는 행동을 찾아가죠
  cnn: 2000.7, // 합성곱 신경망이라는 눈을 붙인 겁니다
};

// 판 세 개(데모 영상의 학습 10분·120분·240분 모습 재연). rate 는 빨리 감기 배율.
const stages = [
  { key: 'clumsy', from: 1975.4, to: 1979.6, rate: 1, label: '학습 10분', note: '공을 번번이 놓친다' },
  { key: 'skilled', from: 1979.6, to: 1981.9, rate: 1.6, label: '학습 120분', note: '능숙하게 받아 친다' },
  { key: 'tunnel', from: 1981.9, to: end + 1, rate: 1, label: '학습 240분', note: '한쪽에 구멍을 뚫는다' },
] as const;
type StageKey = (typeof stages)[number]['key'];

const captions: Array<[number, string]> = [
  [start, '딥마인드, 2013년'],
  [at.atari, '아타리 게임을 스스로 배운 인공지능'],
  [at.pixels, '주어진 것: 화면의 픽셀과 점수뿐'],
  [at.rules, '게임 규칙은 알려 주지 않았다'],
  [at.breakout, '벽돌 깨기'],
  [stages[0].from + 2, '처음엔 공을 번번이 놓쳤다'],
  [stages[1].from, '몇 시간 뒤엔 능숙해졌다'],
  [stages[2].from, '더 지나자'],
  [at.hole - .2, '벽 한쪽에 구멍을 뚫는 전략'],
  [at.behind, '공을 벽돌 뒤로 올려 보낸다'],
  [at.itself, '알아서 부순다'],
  [at.rl, '강화 학습'],
  [at.dog, '강아지 간식 훈련과 비슷하다'],
  [at.reward, '잘하면 보상'],
  [at.none, '못하면 보상 없음'],
  [at.seek, '보상을 많이 받는 행동을 스스로 찾는다'],
  [at.cnn, '여기에 합성곱 신경망이라는 눈을 붙였다'],
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

// 아타리 2600 Breakout 의 벽돌 색(위에서부터 빨강·주황·황토·노랑·초록·파랑).
const rowColors = ['#c84848', '#c66c3a', '#b47a30', '#a2a22a', '#48a048', '#4248c8'];
const scale = 420 / FIELD.width;
const screen = { x: 110, y: 230, width: 420, height: FIELD.height * scale };
const toScreen = (x: number, y: number) => ({ x: screen.x + x * scale, y: screen.y + y * scale });

// 2013년 논문에 실린 일곱 게임.
const gameNames = ['퐁', '벽돌 깨기', '스페이스 인베이더', '시퀘스트', '빔 라이더', '엔듀로', '큐버트'];

// 인공지능이 실제로 보는 입력: 화면을 84×84 흑백으로 줄인 것(2013년 논문의 전처리).
const grayscale = (bricks: boolean[][], paddleX: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = 84;
  canvas.height = 84;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(84, 84);
  const luminance = (hex: string) => {
    const value = parseInt(hex.slice(1), 16);
    return .299 * (value >> 16) + .587 * ((value >> 8) & 255) + .114 * (value & 255);
  };
  for (let py = 0; py < 84; py++) {
    for (let px = 0; px < 84; px++) {
      const x = ((px + .5) / 84) * FIELD.width;
      const y = ((py + .5) / 84) * FIELD.height;
      let gray = 0;
      const row = Math.floor((y - BRICKS.top) / BRICKS.height);
      const column = Math.floor(x / BRICKS.width);
      if (row >= 0 && row < BRICKS.rows && bricks[row][column]) {
        gray = luminance(rowColors[row]);
      }
      if (Math.abs(y - PADDLE.y) < 2.5 && Math.abs(x - paddleX) < PADDLE.width / 2) {
        gray = luminance(rowColors[0]);
      }
      if (px === 0 || px === 83 || py === 0) {
        gray = 142;
      }
      const offset = (py * 84 + px) * 4;
      image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = gray;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
};

// 2013년 논문의 신경망: 84×84 화면 4장 → 합성곱 16개(8×8) → 합성곱 32개(4×4) → 256 → 행동마다 값.
const network = [
  { label: '화면 4장', detail: '84×84' },
  { label: '합성곱', detail: '16개 · 8×8' },
  { label: '합성곱', detail: '32개 · 4×4' },
  { label: '연결층', detail: '256' },
  { label: '행동', detail: '4가지' },
];
const actions = ['가만히', '발사', '→', '←'];

const createDeepQNetwork = () => {
  const { element, root } = createDiagram('deep-q-network', '강화 학습(DQN)');
  const games: Record<StageKey, Run> = createGames();
  const caption = createSwapText(root, 800, 140, { class: 'dqn-caption' });

  // ── 왼쪽: 게임 화면 ──
  const screenGroup = svg('g', { opacity: 0 }, root);
  svg('rect', { class: 'dqn-screen', x: screen.x - 14, y: screen.y - 44, width: screen.width + 28, height: screen.height + 58, rx: 14 }, screenGroup);
  svg('rect', { class: 'dqn-wall', x: screen.x - 6, y: screen.y - 6, width: screen.width + 12, height: 6 }, screenGroup);
  svg('rect', { class: 'dqn-wall', x: screen.x - 6, y: screen.y - 6, width: 6, height: screen.height + 6 }, screenGroup);
  svg('rect', { class: 'dqn-wall', x: screen.x + screen.width, y: screen.y - 6, width: 6, height: screen.height + 6 }, screenGroup);
  const scoreText = text(screenGroup, screen.x + 10, screen.y - 14, '000', { class: 'dqn-score' });
  const brickCells = Array.from({ length: BRICKS.rows }, (_, row) =>
    Array.from({ length: BRICKS.columns }, (_, column) => {
      const corner = toScreen(column * BRICKS.width, BRICKS.top + row * BRICKS.height);
      return svg('rect', { x: corner.x + .5, y: corner.y + .5, width: BRICKS.width * scale - 1, height: BRICKS.height * scale - 1, fill: rowColors[row] }, screenGroup);
    }),
  );
  const paddle = svg('rect', { class: 'dqn-paddle', y: toScreen(0, PADDLE.y).y - 4, width: PADDLE.width * scale, height: 9 }, screenGroup);
  const ball = svg('rect', { class: 'dqn-ball', width: 7, height: 7 }, screenGroup);
  const missFlash = svg('rect', { class: 'dqn-miss', x: screen.x, y: screen.y + screen.height - 40, width: screen.width, height: 40, opacity: 0 }, screenGroup);
  const holeMark = svg('g', { opacity: 0 }, screenGroup);
  const holeCorner = toScreen(0, BRICKS.top);
  svg('rect', { class: 'dqn-hole', x: holeCorner.x - 4, y: holeCorner.y - 4, width: BRICKS.width * 2 * scale + 8, height: BRICKS.rows * BRICKS.height * scale + 8, rx: 6 }, holeMark);
  text(holeMark, holeCorner.x + BRICKS.width * 2 * scale + 22, holeCorner.y + BRICKS.rows * BRICKS.height * scale + 40, '← 구멍', { class: 'dqn-annotation' });
  const behindMark = text(screenGroup, screen.x + screen.width / 2, screen.y + 30, '벽돌 뒤에서 알아서 부순다', { class: 'dqn-annotation', 'text-anchor': 'middle', opacity: 0 });
  const rewardPop = text(screenGroup, 0, 0, '', { class: 'dqn-pop', opacity: 0 });

  // ── 오른쪽 A: 논문과 일곱 게임 ──
  const paper = svg('g', { opacity: 0 }, root);
  svg('rect', { class: 'dqn-card', x: 660, y: 230, width: 820, height: 120, rx: 18 }, paper);
  text(paper, 690, 282, 'Playing Atari with Deep Reinforcement Learning', { class: 'dqn-paper-title' });
  text(paper, 690, 322, '딥마인드 · 2013년 논문', { class: 'dqn-paper-meta' });
  const cartridges = gameNames.map((name, i) => {
    const group = svg('g', { opacity: 0 }, paper);
    const x = 660 + (i % 4) * 208;
    const y = 400 + Math.floor(i / 4) * 96;
    svg('rect', { class: `dqn-cartridge${name === '벽돌 깨기' ? ' focus' : ''}`, x, y, width: 196, height: 72, rx: 12 }, group);
    text(group, x + 98, y + 46, name, { class: 'dqn-cartridge-text' });
    return group;
  });

  // ── 오른쪽 B: 인공지능이 받은 것 ──
  const given = svg('g', { opacity: 0 }, root);
  const thumb = { x: 680, y: 260, size: 340 };
  const thumbGroup = svg('g', { opacity: 0 }, given);
  svg('image', { href: grayscale(games.clumsy.bricks.map((row) => row.map(() => true)), 40), x: thumb.x, y: thumb.y, width: thumb.size, height: thumb.size, class: 'dqn-pixels', preserveAspectRatio: 'none' }, thumbGroup);
  svg('rect', { class: 'dqn-thumb-frame', x: thumb.x, y: thumb.y, width: thumb.size, height: thumb.size }, thumbGroup);
  text(thumbGroup, thumb.x + thumb.size / 2, thumb.y + thumb.size + 42, '화면 픽셀 84×84 · 흑백', { class: 'dqn-label' });
  const scoreGroup = svg('g', { opacity: 0 }, given);
  svg('rect', { class: 'dqn-card', x: 1100, y: 260, width: 360, height: 150, rx: 18 }, scoreGroup);
  text(scoreGroup, 1280, 316, '점수', { class: 'dqn-label' });
  text(scoreGroup, 1280, 380, '000', { class: 'dqn-big-number' });
  const rulesGroup = svg('g', { opacity: 0 }, given);
  svg('rect', { class: 'dqn-card muted', x: 1100, y: 450, width: 360, height: 150, rx: 18 }, rulesGroup);
  text(rulesGroup, 1280, 510, '게임 규칙', { class: 'dqn-label' });
  text(rulesGroup, 1280, 566, '알려 주지 않음', { class: 'dqn-rules-text' });
  svg('line', { class: 'dqn-cross', x1: 1130, y1: 470, x2: 1430, y2: 580 }, rulesGroup);

  // ── 오른쪽 C: 학습 단계 ──
  const stageGroup = svg('g', { opacity: 0 }, root);
  const stageLabel = createSwapText(stageGroup, 1060, 340, { class: 'dqn-stage' });
  const stageNote = createSwapText(stageGroup, 1060, 410, { class: 'dqn-stage-note' });
  const stageScore = text(stageGroup, 1060, 560, '', { class: 'dqn-big-number' });
  text(stageGroup, 1060, 610, '점수', { class: 'dqn-label' });
  const missCount = text(stageGroup, 1060, 700, '', { class: 'dqn-miss-count' });
  const demoNote = text(stageGroup, 1060, 800, '딥마인드 데모 영상의 학습 시간 · 모습은 재연', { class: 'dqn-footnote' });

  // ── 오른쪽 D: 강화 학습 고리 ──
  const loop = svg('g', { opacity: 0 }, root);
  // 인공지능 → 행동 → 게임, 게임 → 화면과 보상 → 인공지능.
  const agent = { x: 1080, y: 250, width: 300, height: 110 };
  const edge = screen.x + screen.width + 30;
  svg('rect', { class: 'dqn-agent', x: agent.x, y: agent.y, width: agent.width, height: agent.height, rx: 20 }, loop);
  text(loop, agent.x + agent.width / 2, agent.y + 68, '인공지능', { class: 'dqn-agent-text' });
  svg('path', { class: 'dqn-arrow action', d: `M${agent.x},${agent.y + 55}C${agent.x - 240},${agent.y + 55} ${edge + 160},${agent.y + 150} ${edge},${agent.y + 150}` }, loop);
  text(loop, 760, agent.y + 70, '행동 ← → 발사', { class: 'dqn-arrow-label action' });
  svg('path', { class: 'dqn-arrow observe', d: `M${edge},${agent.y + 330}C${edge + 300},${agent.y + 330} ${agent.x + agent.width / 2},${agent.y + 300} ${agent.x + agent.width / 2},${agent.y + agent.height + 12}` }, loop);
  text(loop, 700, agent.y + 380, '화면 + 보상(점수)', { class: 'dqn-arrow-label observe' });
  const rewardBadge = text(loop, agent.x + agent.width / 2 + 120, agent.y + 230, '', { class: 'dqn-reward' });
  const dog = svg('g', { opacity: 0 }, loop);
  svg('rect', { class: 'dqn-card', x: 960, y: 680, width: 520, height: 120, rx: 18 }, dog);
  text(dog, 1220, 728, '강아지 훈련', { class: 'dqn-label' });
  const dogRule = createSwapText(dog, 1220, 772, { class: 'dqn-dog-rule' });
  // 행동마다 기대하는 보상(막대). 많이 받는 행동이 점점 커진다.
  const choice = svg('g', { opacity: 0 }, loop);
  text(choice, 1000, 680, '행동마다 기대하는 보상', { class: 'dqn-label', 'text-anchor': 'start' });
  const choiceBars = actions.map((action, i) => {
    const x = 1000 + i * 120;
    svg('rect', { class: 'dqn-bar-track', x, y: 700, width: 90, height: 120, rx: 8 }, choice);
    const bar = svg('rect', { class: 'dqn-bar', x, y: 820, width: 90, height: 0, rx: 8 }, choice);
    text(choice, x + 45, 856, action, { class: 'dqn-bar-label' });
    return bar;
  });

  // ── 오른쪽 E: 합성곱 신경망이라는 눈 ──
  const eye = svg('g', { opacity: 0 }, root);
  const pixels = grayscale(games.tunnel.bricks.map((row) => row.map(() => true)), 60);
  const layers = network.map((layer, i) => {
    const group = svg('g', { opacity: 0 }, eye);
    const x = 640 + i * 180;
    const depth = [4, 6, 8, 1, 1][i];
    const size = [150, 120, 96, 220, 140][i];
    for (let d = depth - 1; d >= 0; d--) {
      const box = { x: x + d * 8, y: 520 - size / 2 - d * 8, width: i >= 3 ? 40 : size, height: size };
      if (i === 0) {
        svg('image', { href: pixels, ...box, class: 'dqn-pixels', preserveAspectRatio: 'none' }, group);
      }
      svg('rect', { class: `dqn-layer${i === 0 ? ' input' : i === network.length - 1 ? ' output' : ''}`, ...box, rx: i === 0 ? 0 : 6 }, group);
    }
    if (i < network.length - 1) {
      svg('path', { class: 'dqn-flow', d: `M${x + (i >= 3 ? 60 : size + depth * 8 + 6)},520H${x + 172}` }, group);
    }
    text(group, x + 60, 680, layer.label, { class: 'dqn-layer-label' });
    text(group, x + 60, 714, layer.detail, { class: 'dqn-layer-detail' });
    return group;
  });
  const eyeNote = text(eye, 1060, 820, '딥마인드 2013년 논문의 신경망', { class: 'dqn-footnote', opacity: 0 });

  // 단계별 처음 벽돌 상태.
  const initial: Record<StageKey, boolean[][]> = { clumsy: [], skilled: [], tunnel: [] };
  for (const key of ['clumsy', 'skilled', 'tunnel'] as const) {
    const run = games[key];
    const bricks = run.bricks.map((row) => [...row]);
    for (const hit of run.hits) {
      bricks[hit.row][hit.column] = true;
    }
    initial[key] = bricks;
  }

  const stageAt = (time: number) => [...stages].reverse().find((stage) => time >= stage.from) ?? stages[0];

  const update = (time: number) => {
    caption.update(time, captionAt);

    // 게임 화면
    setAttributes(screenGroup, { opacity: appear(time, at.atari, .5).toFixed(3) });
    const stage = stageAt(time);
    const run = games[stage.key];
    const local = Math.max(0, (time - stage.from) * stage.rate);
    const frame = time >= stages[0].from ? frameAt(run, local) : { ...frameAt(games.clumsy, 0), ballVisible: false, paddleX: 40 };
    const brokenSoFar = new Set(run.hits.slice(0, frame.broken).map(({ row, column }) => row * 100 + column));
    brickCells.forEach((row, r) =>
      row.forEach((cell, c) => {
        const alive = time >= stages[0].from ? initial[stage.key][r][c] && !brokenSoFar.has(r * 100 + c) : true;
        setAttributes(cell, { opacity: alive ? 1 : 0 });
      }),
    );
    setAttributes(paddle, { x: (toScreen(frame.paddleX - PADDLE.width / 2, 0).x).toFixed(1) });
    const ballPoint = toScreen(frame.ballX, frame.ballY);
    setAttributes(ball, { x: (ballPoint.x - 3.5).toFixed(1), y: (ballPoint.y - 3.5).toFixed(1), opacity: frame.ballVisible ? 1 : 0 });
    const score = String(frame.score).padStart(3, '0');
    if (scoreText.textContent !== score) {
      scoreText.textContent = score;
    }
    // 놓친 순간 아래쪽이 빨갛게 번쩍인다.
    const lastMiss = stage.key === 'clumsy' ? run.misses.filter((miss) => miss.time <= local).at(-1) : undefined;
    setAttributes(missFlash, { opacity: lastMiss ? (1 - progress(local, lastMiss.time, .6)) * .7 : 0 });
    setAttributes(holeMark, { opacity: (appear(time, at.hole, .4) * (1 - appear(time, at.behind + 1.5, .5))).toFixed(3) });
    setAttributes(behindMark, { opacity: (appear(time, at.itself, .4) * (1 - appear(time, at.rl, .5))).toFixed(3) });
    // 벽돌이 깨질 때 점수가 그 자리에서 떠오른다(보상).
    const recent = stage.key === 'tunnel' && time >= at.rl ? run.hits.filter((hit) => hit.time <= local && local - hit.time < .7).at(-1) : undefined;
    if (recent) {
      const point = toScreen((recent.column + .5) * BRICKS.width, BRICKS.top + recent.row * BRICKS.height);
      const age = (local - recent.time) / .7;
      setAttributes(rewardPop, { x: point.x.toFixed(1), y: (point.y - 10 - age * 30).toFixed(1), opacity: (1 - age).toFixed(3) });
      if (rewardPop.textContent !== `+${recent.points}`) {
        rewardPop.textContent = `+${recent.points}`;
      }
    } else {
      setAttributes(rewardPop, { opacity: 0 });
    }

    // A. 논문과 게임
    setAttributes(paper, { opacity: (appear(time, start, .5) * (1 - appear(time, at.pixels - .5, .4))).toFixed(3) });
    cartridges.forEach((group, i) => setAttributes(group, { opacity: appear(time, at.atari + i * .12, .3).toFixed(3) }));

    // B. 받은 것
    setAttributes(given, { opacity: (appear(time, at.pixels - .2, .4) * (1 - appear(time, stages[0].from, .4))).toFixed(3) });
    setAttributes(thumbGroup, { opacity: appear(time, at.pixels - .2, .4).toFixed(3) });
    setAttributes(scoreGroup, { opacity: appear(time, at.score, .4).toFixed(3) });
    setAttributes(rulesGroup, { opacity: appear(time, at.rules, .4).toFixed(3) });

    // C. 학습 단계
    setAttributes(stageGroup, { opacity: (appear(time, stages[0].from, .4) * (1 - appear(time, at.rl - .3, .4))).toFixed(3) });
    stageLabel.update(time, (t) => (t >= stages[0].from ? stageAt(t).label : ''));
    stageNote.update(time, (t) => {
      if (t < stages[0].from) {
        return '';
      }
      if (t >= at.behind) {
        return '벽돌 뒤로 올려 보낸다';
      }
      return stageAt(t).note;
    });
    if (stageScore.textContent !== String(frame.score)) {
      stageScore.textContent = String(frame.score);
    }
    const misses = stage.key === 'clumsy' ? run.misses.filter((miss) => miss.time <= local).length : 0;
    const missLabel = stage.key === 'clumsy' ? `놓친 공 ${misses}` : '';
    if (missCount.textContent !== missLabel) {
      missCount.textContent = missLabel;
    }
    setAttributes(demoNote, { opacity: appear(time, stages[0].from + .5, .4).toFixed(3) });

    // D. 강화 학습 고리
    setAttributes(loop, { opacity: (appear(time, at.rl - .3, .4) * (1 - appear(time, at.cnn - .9, .4))).toFixed(3) });
    const rewardContent = recent ? `보상 +${recent.points}` : '';
    if (rewardBadge.textContent !== rewardContent) {
      rewardBadge.textContent = rewardContent;
    }
    setAttributes(dog, { opacity: (appear(time, at.dog, .4) * (1 - appear(time, at.seek - .3, .3))).toFixed(3) });
    dogRule.update(time, (t) => (t >= at.none ? '못하면 → 간식 없음' : t >= at.reward ? '잘하면 → 간식' : t >= at.dog ? '잘하면 간식, 못하면 없음' : ''));
    setAttributes(choice, { opacity: appear(time, at.seek, .4).toFixed(3) });
    const learn = ease(progress(time, at.seek + .2, 2.4));
    // 막대 높이는 설명을 위한 그림: 처음엔 비슷하다가 보상을 많이 받은 행동(→, 터널 쪽으로 받아 치기)이 커진다.
    const before = [.45, .4, .5, .42];
    const after = [.2, .15, .35, .95];
    choiceBars.forEach((bar, i) => {
      const value = lerp(before[i], after[i], learn);
      setAttributes(bar, { y: (820 - value * 120).toFixed(1), height: (value * 120).toFixed(1) });
      bar.classList.toggle('best', i === 3 && learn > .6);
    });

    // E. 합성곱 신경망이라는 눈
    setAttributes(eye, { opacity: appear(time, at.cnn - .7, .4).toFixed(3) });
    layers.forEach((group, i) => setAttributes(group, { opacity: appear(time, at.cnn - .5 + i * .2, .3).toFixed(3) }));
    setAttributes(eyeNote, { opacity: appear(time, at.cnn + .8, .4).toFixed(3) });
  };

  return { element, update };
};

export const createDeepQNetworkScene = (): Scene => ({
  ...createDeepQNetwork(),
  title: '강화 학습(DQN)',
  start,
  end,
  chapters: [
    { time: start, title: '아타리 게임을 스스로' },
    { time: at.pixels, title: '픽셀과 점수뿐' },
    { time: stages[0].from, title: '번번이 놓치던 공' },
    { time: stages[1].from, title: '능숙해진 솜씨' },
    { time: stages[2].from, title: '터널 전략' },
    { time: at.rl, title: '강화 학습' },
    { time: at.seek, title: '보상을 많이 받는 행동' },
    { time: at.cnn, title: '합성곱 신경망이라는 눈' },
  ],
});
