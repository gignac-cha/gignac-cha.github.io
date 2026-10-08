import { BRICKS, bounce, FIELD, fullWall, PADDLE, reachX, simulate, type Run } from './breakout';

// 세 단계의 판(데모 영상의 학습 10분·120분·240분 모습을 재연).
// 시각은 각 단계가 시작한 뒤의 초.

const launchY = 96;
const paddleTop = PADDLE.y - 1.5;

// 1. 학습 초기: 라켓이 공과 상관없이 이리저리 움직여 공을 번번이 놓친다.
const clumsy = (): Run =>
  simulate({
    duration: 4.8,
    bricks: fullWall(),
    launches: [
      { at: 0, ball: { x: 104, y: launchY, vx: 46, vy: 128 } },
      { at: 1.15, ball: { x: 48, y: launchY, vx: -38, vy: 128 } },
      { at: 2.3, ball: { x: 96, y: launchY, vx: -52, vy: 128 } },
      { at: 3.45, ball: { x: 60, y: launchY, vx: 44, vy: 128 } },
    ],
    paddleX: 40,
    paddleSpeed: 90,
    policy: (time) => 72 + 46 * Math.sin(time * 1.9 + 2.2) + 14 * Math.sin(time * 5.3),
    speed: 140,
  });

// 2. 능숙해진 뒤: 공이 떨어질 자리로 미리 가서 받아 친다. 받을 때마다 맞는 자리를 바꿔 여러 벽돌을 깬다.
const skilled = (): Run => {
  const bricks = fullWall();
  for (const [row, column] of [[5, 4], [5, 5], [5, 9], [4, 9], [5, 13], [5, 14], [4, 13]]) {
    bricks[row][column] = false;
  }
  let returns = 0;
  let lastDown = false;
  return simulate({
    duration: 4.2,
    bricks,
    launches: [{ at: 0, ball: { x: 70, y: 120, vx: -50, vy: 135 } }],
    paddleX: 72,
    paddleSpeed: 260,
    policy: (_, ball) => {
      if (!ball || ball.vy < 0) {
        lastDown = false;
        return ball ? ball.x : 72;
      }
      if (!lastDown) {
        returns++;
        lastDown = true;
      }
      const landing = reachX(ball, paddleTop) ?? ball.x;
      const offset = returns % 2 ? .45 : -.4;
      return landing - offset * (PADDLE.width / 2);
    },
    speed: 150,
  });
};

// 3. 터널: 왼쪽 두 줄을 거의 다 파 놓은 상태에서, 공을 그 구멍으로만 올려 보낸다.
// 마지막 벽돌을 깨 구멍을 뚫고, 다음 공은 구멍을 지나 벽돌 위로 올라가 위에서부터 알아서 부순다.
const tunnelColumns = [0, 1];
const isOpen = (bricks: boolean[][], x: number, y: number) => {
  const row = Math.floor((y - BRICKS.top) / BRICKS.height);
  const column = Math.floor(x / BRICKS.width);
  return row < 0 || row >= BRICKS.rows || column < 0 || column >= BRICKS.columns || !bricks[row][column];
};
// 라켓 어디에 맞힐지(offset): 터널이 뚫렸으면 벽돌 위로, 아직이면 터널 안 남은 벽돌의 아랫면에 닿도록 고른다.
const aimOffset = (landing: number, bricks: boolean[][], speed: number) => {
  const remaining = tunnelColumns.map((column) => ({ column, alive: bricks.map((row, index) => (row[column] ? index : -1)).filter((index) => index >= 0) }));
  const open = remaining.find(({ alive }) => alive.length === 0);
  let goal = { x: 8, y: BRICKS.top - 6 };
  if (open) {
    goal = { x: open.column * BRICKS.width + BRICKS.width / 2, y: BRICKS.top - 6 };
  } else {
    // 남은 벽돌이 가장 적은 줄을 먼저 뚫는다.
    const next = remaining.reduce((a, b) => (b.alive.length < a.alive.length ? b : a));
    goal = { x: next.column * BRICKS.width + BRICKS.width / 2, y: BRICKS.top + (Math.max(...next.alive) + 1) * BRICKS.height - 1 };
  }
  let best = { offset: 0, error: Infinity };
  for (let offset = -.95; offset <= .95; offset += .005) {
    const after = { x: landing, y: paddleTop, ...bounce(offset, speed) };
    const arrival = reachX(after, goal.y);
    if (arrival === undefined) {
      continue;
    }
    // 벽돌 구역을 지나는 동안 살아 있는 벽돌에 걸리면 안 된다.
    let clear = true;
    for (let y = BRICKS.top + BRICKS.rows * BRICKS.height; y > goal.y + .5; y -= .5) {
      const x = reachX(after, y);
      if (x === undefined || !isOpen(bricks, x, y)) {
        clear = false;
        break;
      }
    }
    const error = Math.abs(arrival - goal.x) + Math.abs(offset) * .5;
    if (clear && error < best.error) {
      best = { offset, error };
    }
  }
  return best.offset;
};

const tunnel = (): Run => {
  const bricks = fullWall();
  for (let row = 1; row < BRICKS.rows; row++) {
    for (const column of tunnelColumns) {
      bricks[row][column] = false;
    }
  }
  // 오른쪽에도 앞서 깬 자국이 조금 있다.
  for (const [row, column] of [[5, 6], [5, 7], [4, 7], [5, 11], [5, 15], [4, 15], [5, 16]]) {
    bricks[row][column] = false;
  }
  const speed = 150;
  let plan: number | undefined;
  return simulate({
    duration: 26,
    bricks,
    launches: [{ at: 0, ball: { x: 60, y: 110, vx: -30, vy: 150 } }],
    paddleX: 48,
    paddleSpeed: 320,
    policy: (_, ball, current) => {
      if (!ball || ball.vy < 0 || ball.y < BRICKS.top + BRICKS.rows * BRICKS.height) {
        plan = undefined;
        return ball && ball.vy < 0 ? ball.x : 72;
      }
      const landing = reachX(ball, paddleTop) ?? ball.x;
      plan ??= aimOffset(landing, current, speed);
      return landing - plan * (PADDLE.width / 2);
    },
    speed,
  });
};

export const createGames = () => ({ clumsy: clumsy(), skilled: skilled(), tunnel: tunnel() });
export { FIELD };
