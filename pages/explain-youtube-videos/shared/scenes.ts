import './scenes.scss';

export interface Chapter {
  time: number;
  title: string;
}

export interface Scene {
  title: string;
  element: HTMLElement;
  start: number;
  end: number;
  chapters?: Chapter[];
  update?: (time: number) => void;
}

export interface Coverage {
  // 이 시점까지만 장면 작업을 마쳤다. 그 뒤는 미탐색 구간으로 표시한다. 전부 끝나면 지운다.
  exploredUntil?: number;
}

export const formatClock = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

export const syncScenes = (player: YT.Player, container: HTMLElement, scenes: Scene[], { exploredUntil }: Coverage = {}) => {
  if (exploredUntil !== undefined) {
    container.dataset.explored = formatClock(exploredUntil);
  }
  for (const { element } of scenes) {
    element.classList.add('scene');
    container.append(element);
  }
  const update = () => {
    const time = player.getCurrentTime();
    let any = false;
    for (const scene of scenes) {
      const active = scene.start <= time && time < scene.end;
      scene.element.classList.toggle('active', active);
      if (active) {
        any = true;
        scene.update?.(time);
      }
    }
    container.classList.toggle('empty', !any);
    container.classList.toggle('unexplored', !any && exploredUntil !== undefined && time >= exploredUntil);
    requestAnimationFrame(update);
  };
  update();
};
