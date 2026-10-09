import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayback } from './playback.ts';

const PLAYING = 1;
const PAUSED = 2;

// YouTube 플레이어처럼 시간을 0.25초마다만 보고하는 가짜 플레이어.
const createFakePlayer = (start: number, rate: number) => {
  let wall = 0;
  let media = start;
  let reported = start;
  let state = PLAYING;
  let sinceReport = 0;
  const player = {
    getCurrentTime: () => reported,
    getPlaybackRate: () => rate,
    getPlayerState: () => state,
    getDuration: () => 3772,
    seekTo: (time: number) => {
      media = time;
    },
  };
  return {
    player: player as unknown as YT.Player,
    now: () => wall,
    advance: (milliseconds: number) => {
      wall += milliseconds;
      if (state === PLAYING) {
        media += (milliseconds / 1000) * rate;
      }
      sinceReport += milliseconds;
      if (sinceReport >= 250) {
        sinceReport = 0;
        reported = media;
      }
    },
    report: () => {
      reported = media;
    },
    pause: () => {
      state = PAUSED;
    },
    media: () => media,
  };
};

describe('createPlayback', () => {
  let fake: ReturnType<typeof createFakePlayer>;

  beforeEach(() => {
    vi.stubGlobal('YT', { PlayerState: { PLAYING } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const setup = (start: number, rate: number) => {
    fake = createFakePlayer(start, rate);
    vi.spyOn(performance, 'now').mockImplementation(() => fake.now());
    return createPlayback(fake.player);
  };

  it('2배속에서도 보고 간격(0.25초)과 상관없이 매 프레임 부드럽게 흐른다', () => {
    const playback = setup(100, 2);
    let previous = playback.time();
    const steps: number[] = [];
    for (let frame = 0; frame < 180; frame++) {
      fake.advance(1000 / 60);
      const time = playback.time();
      steps.push(time - previous);
      previous = time;
    }
    // 한 프레임(16.7ms) × 2배속 ≈ 0.033초. 계단식이면 0.5초씩 뛰고 그 사이엔 0 이 된다.
    expect(Math.max(...steps)).toBeLessThan(.06);
    expect(Math.min(...steps)).toBeGreaterThan(0);
    // 3초 동안 실제 재생 위치와의 차이도 작다.
    expect(Math.abs(previous - fake.media())).toBeLessThan(.3);
  });

  it('다른 곳에서 크게 탐색하면 바로 그 자리로 옮긴다', () => {
    const playback = setup(100, 1);
    fake.advance(16);
    playback.time();
    fake.player.seekTo(500, true);
    fake.report();
    fake.advance(16);
    expect(playback.time()).toBeCloseTo(500, 1);
  });

  it('seek 직후 플레이어가 예전 시간을 보내도 목표 시간을 보여 준다', () => {
    const playback = setup(100, 1);
    playback.seek(300);
    fake.advance(16);
    expect(playback.time()).toBeGreaterThanOrEqual(300);
    expect(playback.time()).toBeLessThan(300.1);
  });

  it('멈춰 있으면 보고된 시간을 그대로 쓴다', () => {
    const playback = setup(42, 1);
    fake.pause();
    fake.advance(1000);
    expect(playback.time()).toBe(42);
  });
});
