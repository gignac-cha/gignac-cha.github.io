import { load, save } from './storage';

// 그 시점으로 이동해 멈춘 상태로 둔다. 시작 전의 영상은 이동하면 재생이 시작되는데,
// 소리가 켜진 자동 재생은 막히므로 잠깐 음소거했다가 멈춘 뒤 원래대로 돌린다.
export const seekPaused = (player: YT.Player, time: number) => {
  const wasMuted = player.isMuted();
  const pauseOnPlay = (event: YT.OnStateChangeEvent) => {
    if (event.data === YT.PlayerState.PLAYING) {
      player.pauseVideo();
      player.seekTo(time, true);
      if (!wasMuted) {
        player.unMute();
      }
      player.removeEventListener('onStateChange', pauseOnPlay);
    }
  };
  player.addEventListener('onStateChange', pauseOnPlay);
  player.mute();
  player.seekTo(time, true);
};

const hashTime = () => {
  const match = location.hash.match(/^#t=(\d+(?:\.\d+)?)$/);
  return match ? Number(match[1]) : undefined;
};

// 주소 끝에 #t=초 를 붙이면 그 시점으로 이동해 멈춘 상태로 보여준다. 장면 검수용 링크.
export const seekFromHash = (player: YT.Player) => {
  const seek = () => {
    const time = hashTime();
    if (time !== undefined) {
      seekPaused(player, time);
    }
  };
  window.addEventListener('hashchange', seek);
  seek();
};

// 보던 위치를 기억해 새로고침해도 그 화면 그대로 연다. #t= 링크로 열면 링크가 우선한다.
export const rememberPosition = (player: YT.Player, videoId: string) => {
  const key = `position:${videoId}`;
  const { time } = load(key, { time: 0 });
  if (hashTime() === undefined && time > 0) {
    seekPaused(player, time);
  }
  let saved = time;
  window.setInterval(() => {
    const current = player.getCurrentTime();
    if (Math.abs(current - saved) >= .5) {
      saved = current;
      save(key, { time: current });
    }
  }, 1000);
  // 탭을 닫기 직전의 위치도 놓치지 않는다.
  window.addEventListener('pagehide', () => save(key, { time: player.getCurrentTime() }));
};
