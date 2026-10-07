// 장면·목록·재생 바가 함께 쓰는 재생 시계.
//
// YouTube IFrame API 의 getCurrentTime() 은 플레이어가 메시지로 보내 준 값을 저장해 둔 것이라 1초에 몇 번만 바뀐다.
// 그대로 쓰면 장면이 계단식으로 움직이고, 2배속이면 한 번에 건너뛰는 폭도 두 배가 되어 뚝뚝 끊긴다.
// 그래서 마지막으로 받은 시간에 (흐른 시간 × 재생 속도)를 더해 매 프레임 보간하고, 새 값이 오면 조금씩 맞춘다.
export interface Playback {
  time: () => number;
  seek: (time: number, allowSeekAhead?: boolean) => void;
  duration: () => number;
}

// 받은 값과 보간 값이 이보다 멀어지면 탐색으로 보고 바로 그 자리로 옮긴다.
const jump = 1;
// 작은 차이는 이만큼씩만 따라가 화면이 튀지 않게 한다.
const follow = .25;
// 탐색 직후 플레이어가 아직 예전 시간을 보내는 동안은 무시한다.
const seekGrace = 1500;

export const createPlayback = (player: YT.Player): Playback => {
  let base = player.getCurrentTime();
  let baseAt = performance.now();
  let reported = base;
  let pending: { target: number; until: number } | undefined;
  let cached = { at: -Infinity, value: base };

  const estimate = (now: number) => base + ((now - baseAt) / 1000) * player.getPlaybackRate();

  const time = () => {
    const now = performance.now();
    // 같은 프레임에서 여러 모듈이 불러도 같은 값을 쓰도록.
    if (now - cached.at < 2) {
      return cached.value;
    }
    const latest = player.getCurrentTime();
    const playing = player.getPlayerState() === YT.PlayerState.PLAYING;
    if (pending && (Math.abs(latest - pending.target) < jump || now > pending.until)) {
      pending = undefined;
    }
    let value: number;
    if (!playing) {
      value = pending ? pending.target : latest;
      base = value;
      baseAt = now;
      reported = latest;
    } else {
      value = estimate(now);
      if (!pending && latest !== reported) {
        reported = latest;
        const drift = latest - value;
        if (Math.abs(drift) > jump) {
          value = latest;
        } else {
          value += drift * follow;
        }
        base = value;
        baseAt = now;
      }
    }
    cached = { at: now, value: Math.max(value, 0) };
    return cached.value;
  };

  const seek = (target: number, allowSeekAhead = true) => {
    player.seekTo(target, allowSeekAhead);
    base = target;
    baseAt = performance.now();
    pending = { target, until: baseAt + seekGrace };
    cached = { at: -Infinity, value: target };
  };

  return { time, seek, duration: () => player.getDuration() };
};
