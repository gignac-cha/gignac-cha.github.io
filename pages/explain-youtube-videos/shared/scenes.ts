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

export const syncScenes = (player: YT.Player, container: HTMLElement, scenes: Scene[]) => {
  for (const { element } of scenes) {
    element.classList.add('scene');
    container.append(element);
  }
  const update = () => {
    const time = player.getCurrentTime();
    for (const scene of scenes) {
      const active = scene.start <= time && time < scene.end;
      scene.element.classList.toggle('active', active);
      if (active) {
        scene.update?.(time);
      }
    }
    requestAnimationFrame(update);
  };
  update();
};
