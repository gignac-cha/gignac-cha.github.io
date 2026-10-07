import './timeline.scss';
import type { Coverage, Scene } from './scenes';

const formatTime = (time: number) => {
  const total = Math.max(Math.floor(time), 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
};

const create = (tag: string, className: string, parent: Element) => {
  const element = document.createElement(tag);
  element.className = className;
  parent.append(element);
  return element;
};

const setText = (element: Element, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

// 영상 아래의 재생 바. 장면 구간을 막대 위에 표시하고, 누르거나 끌어서 이동한다.
export const renderTimeline = (player: YT.Player, container: HTMLElement, scenes: Scene[], { exploredUntil }: Coverage = {}) => {
  const header = create('div', 'timeline-header', container);
  const clock = create('div', 'timeline-clock', header);
  const current = create('time', 'timeline-current', clock);
  create('span', 'timeline-separator', clock).textContent = '/';
  const total = create('time', 'timeline-total', clock);
  const sceneName = create('div', 'timeline-scene', header);

  const track = create('div', 'timeline-track', container);
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', '재생 위치');
  track.tabIndex = 0;
  const rail = create('div', 'timeline-rail', track);
  const played = create('div', 'timeline-played', rail);
  const segments = scenes.map((scene) => ({ scene, element: create('div', 'timeline-segment', rail) }));
  // 아직 장면 작업을 하지 않은 구간: 빗금으로 표시한다.
  const unexplored = exploredUntil === undefined ? undefined : create('div', 'timeline-unexplored', rail);
  const head = create('div', 'timeline-head', track);
  const hover = create('div', 'timeline-hover', track);
  const tooltip = create('div', 'timeline-tooltip', track);

  let duration = 0;
  let scrub: number | undefined;

  const sceneAt = (time: number) => scenes.find((scene) => scene.start <= time && time < scene.end);
  const isUnexplored = (time: number) => exploredUntil !== undefined && time >= exploredUntil;
  const ratio = (time: number) => (duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 0);
  const timeAt = (event: PointerEvent) => {
    const rect = track.getBoundingClientRect();
    return Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) * duration;
  };

  const layout = () => {
    for (const { scene, element } of segments) {
      element.style.left = `${ratio(scene.start) * 100}%`;
      element.style.width = `${(ratio(scene.end) - ratio(scene.start)) * 100}%`;
    }
    setText(total, formatTime(duration));
    if (unexplored && exploredUntil !== undefined) {
      unexplored.style.left = `${ratio(exploredUntil) * 100}%`;
      unexplored.style.width = `${(1 - ratio(exploredUntil)) * 100}%`;
    }
  };

  track.addEventListener('pointerdown', (event) => {
    if (duration <= 0) {
      return;
    }
    track.setPointerCapture(event.pointerId);
    scrub = timeAt(event);
    player.seekTo(scrub, false);
  });
  track.addEventListener('pointermove', (event) => {
    if (duration <= 0) {
      return;
    }
    const time = timeAt(event);
    const position = `${ratio(time) * 100}%`;
    hover.style.left = position;
    tooltip.style.left = position;
    const scene = sceneAt(time);
    setText(tooltip, scene ? `${formatTime(time)} · ${scene.title}` : isUnexplored(time) ? `${formatTime(time)} · 미탐색` : formatTime(time));
    if (scrub !== undefined) {
      scrub = time;
      player.seekTo(scrub, false);
    }
  });
  const release = (event: PointerEvent) => {
    if (scrub === undefined) {
      return;
    }
    player.seekTo(timeAt(event), true);
    scrub = undefined;
  };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  track.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 30 : 5;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const time = player.getCurrentTime() + (event.key === 'ArrowLeft' ? -step : step);
      player.seekTo(Math.min(Math.max(time, 0), duration), true);
    }
  });

  const update = () => {
    if (duration <= 0) {
      duration = player.getDuration();
      if (duration > 0) {
        layout();
      }
    }
    // 끄는 동안에는 플레이어가 따라오기 전이므로 손가락 위치를 보여 준다.
    const time = scrub ?? player.getCurrentTime();
    const position = `${ratio(time) * 100}%`;
    played.style.width = position;
    head.style.left = position;
    setText(current, formatTime(time));
    track.setAttribute('aria-valuenow', String(Math.floor(time)));
    const active = sceneAt(time);
    const outside = !active && isUnexplored(time);
    setText(sceneName, active?.title ?? (outside ? '미탐색 구간' : ''));
    sceneName.classList.toggle('unexplored', outside);
    for (const { scene, element } of segments) {
      element.classList.toggle('active', scene === active);
    }
    requestAnimationFrame(update);
  };
  update();
};
