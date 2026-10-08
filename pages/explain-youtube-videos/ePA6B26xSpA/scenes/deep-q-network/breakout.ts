// 벽돌 깨기(아타리 2600 Breakout) 물리를 그대로 흉내 낸 작은 시뮬레이션.
// 장면을 만들 때 단계마다 한 번 끝까지 돌려 프레임을 기록해 두고, 재생 시간으로 그 프레임을 꺼내 그린다(탐색해도 같은 장면).
// 공을 받는 쪽(라켓)의 움직임은 학습된 신경망이 아니라 단계마다 정한 규칙으로 재연한다.

export const FIELD = { width: 144, height: 190 };
export const BRICKS = { columns: 18, rows: 6, top: 40, width: 8, height: 6 };
// 위 두 줄 7점, 가운데 두 줄 4점, 아래 두 줄 1점 (아타리 Breakout 점수).
export const ROW_POINTS = [7, 7, 4, 4, 1, 1];
export const PADDLE = { y: 180, width: 16 };
const RADIUS = 1.5;
const DT = 1 / 240;
const FPS = 60;

export interface Frame {
  ballX: number;
  ballY: number;
  ballVisible: boolean;
  paddleX: number;
  score: number;
  // 깨진 벽돌 수(기록 순서대로 events 의 앞에서부터).
  broken: number;
}

export interface BrickEvent {
  time: number;
  row: number;
  column: number;
  points: number;
}

export interface MissEvent {
  time: number;
  x: number;
}

export interface Run {
  frames: Frame[];
  bricks: boolean[][];
  hits: BrickEvent[];
  misses: MissEvent[];
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Launch {
  at: number;
  ball: Ball;
}

export interface RunOptions {
  duration: number;
  bricks: boolean[][];
  launches: Launch[];
  paddleX: number;
  paddleSpeed: number;
  // 라켓이 가려는 자리. 공과 벽돌 상태를 보고 정한다.
  policy: (time: number, ball: Ball | undefined, bricks: boolean[][]) => number;
  speed: number;
}

// 아타리 Breakout 처럼 위쪽 두 줄(주황·빨강) 벽돌을 처음 깨면 공이 빨라진다.
const FAST = 1.45;

export const fullWall = () => Array.from({ length: BRICKS.rows }, () => Array.from({ length: BRICKS.columns }, () => true));

// 라켓에 맞은 자리(-1 왼쪽 끝 ~ 1 오른쪽 끝)에 따라 튕겨 나가는 각도가 정해진다.
export const bounce = (offset: number, speed: number) => {
  const angle = offset * (Math.PI / 3);
  return { vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) };
};

// 벽만 있다고 보고, 공이 y 높이에 닿을 때의 x (좌우 벽 반사 포함).
export const reachX = (ball: Ball, y: number) => {
  const t = (y - ball.y) / ball.vy;
  if (t < 0) {
    return undefined;
  }
  const span = FIELD.width - 2 * RADIUS;
  let x = ball.x - RADIUS + ball.vx * t;
  x = ((x % (2 * span)) + 2 * span) % (2 * span);
  return RADIUS + (x > span ? 2 * span - x : x);
};

export const simulate = ({ duration, bricks: initial, launches, paddleX, paddleSpeed, policy, speed }: RunOptions): Run => {
  const bricks = initial.map((row) => [...row]);
  const frames: Frame[] = [];
  const hits: BrickEvent[] = [];
  const misses: MissEvent[] = [];
  let ball: Ball | undefined;
  let paddle = paddleX;
  let score = 0;
  let nextLaunch = 0;
  let fast = false;
  const steps = Math.ceil(duration / DT);
  for (let step = 0; step <= steps; step++) {
    const time = step * DT;
    if (step % (240 / FPS) === 0) {
      frames.push({ ballX: ball?.x ?? 0, ballY: ball?.y ?? 0, ballVisible: ball !== undefined, paddleX: paddle, score, broken: hits.length });
    }
    while (nextLaunch < launches.length && launches[nextLaunch].at <= time) {
      ball = { ...launches[nextLaunch].ball };
      if (fast) {
        ball.vx *= FAST;
        ball.vy *= FAST;
      }
      nextLaunch++;
    }
    const target = policy(time, ball, bricks);
    const move = Math.max(-paddleSpeed * DT, Math.min(paddleSpeed * DT, target - paddle));
    paddle = Math.max(PADDLE.width / 2, Math.min(FIELD.width - PADDLE.width / 2, paddle + move));
    if (!ball) {
      continue;
    }
    const previous = { x: ball.x, y: ball.y };
    ball.x += ball.vx * DT;
    ball.y += ball.vy * DT;
    if (ball.x < RADIUS) {
      ball.x = RADIUS;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > FIELD.width - RADIUS) {
      ball.x = FIELD.width - RADIUS;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < RADIUS) {
      ball.y = RADIUS;
      ball.vy = Math.abs(ball.vy);
    }
    // 벽돌: 공 중심이 살아 있는 칸에 들어가면 그 벽돌을 깨고, 들어온 방향으로 튕긴다(한 번에 하나).
    const row = Math.floor((ball.y - BRICKS.top) / BRICKS.height);
    const column = Math.floor(ball.x / BRICKS.width);
    if (row >= 0 && row < BRICKS.rows && column >= 0 && column < BRICKS.columns && bricks[row][column]) {
      bricks[row][column] = false;
      score += ROW_POINTS[row];
      hits.push({ time, row, column, points: ROW_POINTS[row] });
      if (row <= 1 && !fast) {
        fast = true;
        ball.vx *= FAST;
        ball.vy *= FAST;
      }
      const previousRow = Math.floor((previous.y - BRICKS.top) / BRICKS.height);
      if (previousRow !== row) {
        ball.vy = -ball.vy;
        ball.y = previous.y;
      } else {
        ball.vx = -ball.vx;
        ball.x = previous.x;
      }
    }
    // 라켓
    if (ball.vy > 0 && previous.y < PADDLE.y - RADIUS && ball.y >= PADDLE.y - RADIUS && Math.abs(ball.x - paddle) <= PADDLE.width / 2 + RADIUS) {
      const offset = Math.max(-1, Math.min(1, (ball.x - paddle) / (PADDLE.width / 2)));
      Object.assign(ball, bounce(offset, speed * (fast ? FAST : 1)), { y: PADDLE.y - RADIUS });
    }
    if (ball.y > FIELD.height + 6) {
      misses.push({ time, x: ball.x });
      ball = undefined;
    }
  }
  return { frames, bricks, hits, misses };
};

// 기록한 프레임에서 그 시점의 것을 꺼낸다(공은 두 프레임 사이를 잇는다).
export const frameAt = (run: Run, time: number): Frame => {
  const position = Math.max(0, Math.min(run.frames.length - 1, time * FPS));
  const index = Math.floor(position);
  const current = run.frames[index];
  const next = run.frames[Math.min(index + 1, run.frames.length - 1)];
  const fraction = position - index;
  if (!current.ballVisible || !next.ballVisible || Math.abs(next.ballX - current.ballX) > 20 || Math.abs(next.ballY - current.ballY) > 20) {
    return current;
  }
  return {
    ...current,
    ballX: current.ballX + (next.ballX - current.ballX) * fraction,
    ballY: current.ballY + (next.ballY - current.ballY) * fraction,
    paddleX: current.paddleX + (next.paddleX - current.paddleX) * fraction,
  };
};
