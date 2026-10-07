// 주소 끝에 #t=초 를 붙이면 그 시점으로 이동해 멈춘 상태로 보여준다. 장면 검수용 링크.
export const seekFromHash = (player: YT.Player) => {
  const seek = () => {
    const match = location.hash.match(/^#t=(\d+(?:\.\d+)?)$/);
    if (!match) {
      return;
    }
    const time = Number(match[1]);
    const pauseOnPlay = (event: YT.OnStateChangeEvent) => {
      if (event.data === YT.PlayerState.PLAYING) {
        player.pauseVideo();
        player.seekTo(time, true);
        player.removeEventListener('onStateChange', pauseOnPlay);
      }
    };
    player.addEventListener('onStateChange', pauseOnPlay);
    player.mute();
    player.seekTo(time, true);
  };
  window.addEventListener('hashchange', seek);
  seek();
};
