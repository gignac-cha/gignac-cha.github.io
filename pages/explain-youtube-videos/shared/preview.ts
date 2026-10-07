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
  // 헤드리스 브라우저는 창 크기를 다 맞추기 전에 한 번 그리므로, 크기가 바뀌면 다시 그린다(글자와 3D 위치가 맞도록).
  window.addEventListener('resize', () => {
    for (const scene of active) {
      scene.update?.(time);
    }
  });
  document.title = `${time}s · ${active.map((scene) => scene.title).join(', ') || '장면 없음'}`;
};
