import './scene-index.scss';
import type { Scene } from './scenes';

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = (time % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${seconds}`;
};

const create = (tag: string, className?: string, text?: string) => {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
};

export const renderSceneIndex = (player: YT.Player, container: HTMLElement, scenes: Scene[]) => {
  const clock = create('time', 'scene-index-clock', formatTime(0));
  const label = create('h2', 'panel-label', '장면 인덱스');
  label.append(clock);
  const list = create('ol', 'scene-index-list');

  const entries = scenes.map((scene, index) => {
    const item = create('li', 'scene-index-item');
    const button = create('button', 'scene-index-scene');
    button.append(
      create('span', 'scene-index-number', String(index + 1).padStart(2, '0')),
      create('span', 'scene-index-title', scene.title),
      create('time', 'scene-index-range', `${formatTime(scene.start)} – ${formatTime(scene.end)}`),
    );
    button.addEventListener('click', () => player.seekTo(scene.start, true));
    const row = create('div', 'scene-index-row');
    row.append(button);
    item.append(row);

    const chapters = (scene.chapters ?? []).map(({ time, title }) => {
      const chapter = create('li', 'scene-index-chapter');
      const link = create('button', 'scene-index-chapter-link');
      link.append(create('time', undefined, formatTime(time)), create('span', undefined, title));
      link.addEventListener('click', () => player.seekTo(time, true));
      chapter.append(link);
      return { time, element: chapter };
    });
    if (chapters.length > 0) {
      const chapterList = create('ol', 'scene-index-chapters');
      chapterList.append(...chapters.map(({ element }) => element));
      item.append(chapterList);

      const toggle = create('button', 'scene-index-toggle');
      toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>';
      toggle.setAttribute('aria-label', '세부 단계 펼치기');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        const expanded = item.classList.toggle('expanded');
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      row.append(toggle);
    }
    list.append(item);
    return { scene, element: item, chapters };
  });
  container.append(label, list);

  const update = () => {
    const time = player.getCurrentTime();
    const formatted = formatTime(time);
    if (clock.textContent !== formatted) {
      clock.textContent = formatted;
    }
    for (const { scene, element, chapters } of entries) {
      const active = scene.start <= time && time < scene.end;
      element.classList.toggle('active', active);
      const current = active ? chapters.findLast((chapter) => chapter.time <= time) : undefined;
      for (const chapter of chapters) {
        chapter.element.classList.toggle('active', chapter === current);
      }
    }
    requestAnimationFrame(update);
  };
  update();
};
