import './scene-index.scss';
import type { Playback } from './playback';
import type { Coverage, Scene } from './scenes';
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

const formatRemaining = (seconds: number) => {
  const total = Math.max(Math.ceil(seconds), 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const renderSceneIndex = (playback: Playback, container: HTMLElement, scenes: Scene[], { exploredUntil }: Coverage = {}) => {
  const manual = load<Record<string, boolean>>('index-expanded', {});
  const clock = create('time', 'scene-index-clock', formatTime(0));
  // 라벨은 페이지에 미리 있을 수 있다(자리 바꾸기 버튼이 먼저 붙어 있으면 그 앞에 시계를 둔다).
  const label = container.querySelector('.panel-label') ?? create('h2', 'panel-label', '장면 목록');
  label.insertBefore(clock, label.querySelector('.dock-controls'));
  const list = create('ol', 'scene-index-list');

  const entries = scenes.map((scene, index) => {
    const item = create('li', 'scene-index-item');
    const button = create('button', 'scene-index-scene');
    button.append(
      create('span', 'scene-index-number', String(index + 1).padStart(2, '0')),
    );
    // 제목이 한 줄을 다 쓰도록 시간 구간은 아래 줄에 둔다.
    const text = create('span', 'scene-index-text');
    text.append(
      create('span', 'scene-index-title', scene.title),
      create('time', 'scene-index-range', `${formatTime(scene.start)} – ${formatTime(scene.end)}`),
    );
    button.append(text);
    button.addEventListener('click', () => playback.seek(scene.start));
    const row = create('div', 'scene-index-row');
    row.append(button);
    // 재생 중인 장면 안에서 얼마나 왔는지.
    const progress = create('div', 'scene-index-progress');
    const fill = create('div', 'scene-index-progress-fill');
    progress.append(fill);
    item.append(row, progress);

    const chapters = (scene.chapters ?? []).map(({ time, title }) => {
      const chapter = create('li', 'scene-index-chapter');
      const link = create('button', 'scene-index-chapter-link');
      link.append(create('time', undefined, formatTime(time)), create('span', undefined, title));
      link.addEventListener('click', () => playback.seek(time));
      chapter.append(link);
      return { time, element: chapter };
    });
    if (chapters.length > 0) {
      const chapterList = create('ol', 'scene-index-chapters');
      chapterList.append(...chapters.map(({ element }) => element));
      item.append(chapterList);

      const toggle = create('button', 'scene-index-toggle');
      toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>';
      toggle.setAttribute('aria-label', '단계 펼치기');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        manual[sceneKey(scene)] = !item.classList.contains('expanded');
        save('index-expanded', manual);
      });
      row.append(toggle);
    }
    list.append(item);
    return { scene, element: item, chapters, fill, toggle: item.querySelector('.scene-index-toggle') };
  });
  container.append(label, list);

  // 장면이 없는 구간: 다음 장면 앞에 끼어들어 다음 장면까지 남은 시간과 진행을 보여 준다. 누르면 다음 장면으로.
  const gap = create('li', 'scene-index-gap');
  const gapButton = create('button', 'scene-index-gap-button');
  const gapLabel = create('span', 'scene-index-gap-label');
  const gapRemaining = create('time', 'scene-index-gap-remaining');
  const gapHead = create('span', 'scene-index-gap-head');
  gapHead.append(gapLabel, gapRemaining);
  const gapBar = create('span', 'scene-index-gap-bar');
  const gapFill = create('span', 'scene-index-gap-fill');
  gapBar.append(gapFill);
  gapButton.append(gapHead, gapBar);
  gap.append(gapButton);
  let gapTarget: number | undefined;
  gapButton.addEventListener('click', () => gapTarget !== undefined && playback.seek(gapTarget));
  const setText = (element: Element, content: string) => {
    if (element.textContent !== content) {
      element.textContent = content;
    }
  };

  // 목록 위에 마우스가 있을 때는 사용자가 훑어보는 중이므로 자동 스크롤하지 않는다.
  let browsing = false;
  list.addEventListener('pointerenter', () => (browsing = true));
  list.addEventListener('pointerleave', () => (browsing = false));
  let shown: HTMLElement | undefined;
  // 재생 바 위치나 창 크기가 바뀌면 목록 높이가 달라지므로, 재생 중인 항목을 다시 보이게 한다.
  window.addEventListener('resize', () => (shown = undefined));

  const update = () => {
    const time = playback.time();
    const formatted = formatTime(time);
    if (clock.textContent !== formatted) {
      clock.textContent = formatted;
    }
    let playing: HTMLElement | undefined;
    for (const { scene, element, chapters, fill, toggle } of entries) {
      const active = scene.start <= time && time < scene.end;
      element.classList.toggle('active', active);
      if (active) {
        playing = element;
        fill.style.width = `${(((time - scene.start) / (scene.end - scene.start)) * 100).toFixed(2)}%`;
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
        toggle?.setAttribute('aria-label', expanded ? '단계 접기' : '단계 펼치기');
      }
    }
    // 장면이 없는 구간이면 다음 장면 앞(없으면 목록 끝)에 진행 줄을 둔다.
    gap.classList.toggle('visible', !playing);
    if (!playing) {
      const next = entries.find(({ scene }) => scene.start > time);
      const from = entries.findLast(({ scene }) => scene.end <= time)?.scene.end ?? 0;
      const preparing = exploredUntil !== undefined && time >= exploredUntil;
      const until = next && !preparing ? next.scene.start : !preparing ? exploredUntil : undefined;
      const anchor = next && !preparing ? next.element : null;
      if (gap.parentElement !== list || gap.nextSibling !== anchor) {
        list.insertBefore(gap, anchor);
      }
      gap.classList.toggle('preparing', preparing);
      gapTarget = next && !preparing ? next.scene.start : undefined;
      gapButton.toggleAttribute('disabled', gapTarget === undefined);
      setText(gapLabel, next && !preparing ? `다음 장면 · ${next.scene.title}` : preparing ? '준비 중인 구간' : '준비 중인 구간까지');
      setText(gapRemaining, until !== undefined ? `${formatRemaining(until - time)} 남음` : '');
      gapBar.hidden = until === undefined;
      if (until !== undefined) {
        gapFill.style.width = `${(Math.min(Math.max((time - from) / (until - from), 0), 1) * 100).toFixed(2)}%`;
      }
      playing = gap;
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
