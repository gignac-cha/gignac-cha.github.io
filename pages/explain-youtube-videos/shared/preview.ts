import type { Scene } from './scenes';

// preview.html?t=초 : YouTube 없이 그 시점에 보이는 장면만 그린다. 헤드리스 브라우저 스크린샷 검수용.
export const renderPreview = (container: HTMLElement, scenes: Scene[]) => {
  const time = Number(new URLSearchParams(location.search).get('t') ?? 0);
  const active = scenes.filter((scene) => scene.start <= time && time < scene.end);
  for (const scene of active) {
    scene.element.classList.add('scene', 'active');
    container.append(scene.element);
    scene.update?.(time);
  }
  document.title = `${time}s · ${active.map((scene) => scene.title).join(', ') || '장면 없음'}`;
};
