import './three-scene.scss';
import type { Scene } from './scenes';

// 장면을 그리는 층. element 를 장면 영역에 채우고 update(time) 으로 그린다.
export interface SceneLayer {
  element: HTMLElement;
  update?: (time: number) => void;
}

// Three.js 로 그린 판으로 장면을 보여 준다. three.js 는 페이지가 한가할 때 미리 받아 두고,
// 장면이 처음 재생될 때 만든다. 그 전이나 WebGL 을 쓸 수 없을 때는 SVG 판을 보여 준다.
export const withThree = (scene: Scene, load: () => Promise<() => SceneLayer>): Scene => {
  const element = document.createElement('div');
  element.className = 'layered-scene';
  scene.element.classList.add('scene-layer');
  element.append(scene.element);

  let module: Promise<() => SceneLayer> | undefined;
  const fetch = () => (module ??= load());
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => void fetch());
  } else {
    setTimeout(() => void fetch(), 2000);
  }

  let three: SceneLayer | undefined;
  let started = false;
  let lastTime = scene.start;
  const start = async () => {
    started = true;
    try {
      const create = await fetch();
      three = create();
    } catch (error) {
      console.warn(`${scene.title}: Three.js 판을 만들지 못해 SVG 판으로 보여 준다.`, error);
      return;
    }
    three.element.classList.add('scene-layer');
    element.append(three.element);
    scene.element.hidden = true;
    three.update?.(lastTime);
  };

  return {
    ...scene,
    element,
    update: (time: number) => {
      lastTime = time;
      if (!started) {
        void start();
      }
      (three ?? scene).update?.(time);
    },
  };
};
