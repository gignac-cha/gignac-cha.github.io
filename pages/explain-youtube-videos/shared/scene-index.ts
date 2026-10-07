import './scene-index.scss';
import type { Scene } from './scenes';
import { load, save } from './storage';

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

// 세부 단계는 재생 중인 장면만 자동으로 펼쳤다가 지나가면 접는다.
// 사용자가 직접 펼치거나 접은 장면은 손댄 상태(dirty)로 기억해 자동으로 바꾸지 않고, 새로고침해도 유지한다.
const sceneKey = (scene: Scene) => `${scene.start}:${scene.title}`;

export const renderSceneIndex = (player: YT.Player, container: HTMLElement, scenes: Scene[]) => {
  const manual = load<Record<string, boolean>>('index-expanded', {});
  const clock = create('time', 'scene-index-clock', formatTime(0));
  // 라벨은 페이지에 미리 있을 수 있다(자리 바꾸기 버튼이 먼저 붙어 있으면 그 앞에 시계를 둔다).
  const label = container.querySelector('.panel-label') ?? create('h2', 'panel-label', '장면 인덱스');
  label.insertBefore(clock, label.querySelector('.dock-controls'));
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
        manual[sceneKey(scene)] = !item.classList.contains('expanded');
        save('index-expanded', manual);
      });
      row.append(toggle);
    }
    list.append(item);
    return { scene, element: item, chapters, toggle: item.querySelector('.scene-index-toggle') };
  });
  container.append(label, list);

  // 목록 위에 마우스가 있을 때는 사용자가 훑어보는 중이므로 자동 스크롤하지 않는다.
  let browsing = false;
  list.addEventListener('pointerenter', () => (browsing = true));
  list.addEventListener('pointerleave', () => (browsing = false));
  let shown: HTMLElement | undefined;
  // 재생 바 위치나 창 크기가 바뀌면 목록 높이가 달라지므로, 재생 중인 항목을 다시 보이게 한다.
  window.addEventListener('resize', () => (shown = undefined));

  const update = () => {
    const time = player.getCurrentTime();
    const formatted = formatTime(time);
    if (clock.textContent !== formatted) {
      clock.textContent = formatted;
    }
    let playing: HTMLElement | undefined;
    for (const { scene, element, chapters, toggle } of entries) {
      const active = scene.start <= time && time < scene.end;
      element.classList.toggle('active', active);
      if (active) {
        playing = element;
      }
      const current = active ? chapters.findLast((chapter) => chapter.time <= time) : undefined;
      for (const chapter of chapters) {
        chapter.element.classList.toggle('active', chapter === current);
      }
      const expanded = manual[sceneKey(scene)] ?? active;
      if (chapters.length > 0 && element.classList.contains('expanded') !== expanded) {
        element.classList.toggle('expanded', expanded);
        element.classList.toggle('manual', sceneKey(scene) in manual);
        toggle?.setAttribute('aria-expanded', String(expanded));
      }
    }
    // 재생 중인 장면이 바뀌면 목록에서 보이는 자리로 옮긴다.
    if (playing && playing !== shown && !browsing) {
      const item = playing.getBoundingClientRect();
      const view = list.getBoundingClientRect();
      if (item.top < view.top) {
        list.scrollBy({ top: item.top - view.top - 8, behavior: 'smooth' });
      } else if (item.bottom > view.bottom) {
        list.scrollBy({ top: item.bottom - view.bottom + 8, behavior: 'smooth' });
      }
    }
    shown = playing;
    requestAnimationFrame(update);
  };
  update();
};
