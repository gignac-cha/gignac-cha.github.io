import './timeline.scss';
import type { Playback } from './playback';
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
export const renderTimeline = (playback: Playback, container: HTMLElement, scenes: Scene[], { exploredUntil }: Coverage = {}) => {
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
  // 막대는 canvas 에 그린다. 현재 위치와 마우스 주변이 렌즈처럼 부풀어 그 근처 장면 구간이 크게 보인다.
  const canvas = create('canvas', 'timeline-canvas', track) as HTMLCanvasElement;
  const context = canvas.getContext('2d')!;
  const head = create('div', 'timeline-head', track);
  const hover = create('div', 'timeline-hover', track);
  const tooltip = create('div', 'timeline-tooltip', track);

  let duration = 0;
  let scrub: number | undefined;
  // 마우스 렌즈: 올리면 부드럽게 커지고 떠나면 줄어든다.
  let pointerX: number | undefined;
  let lens = 0;
  let lastFrame = performance.now();

  const sceneAt = (time: number) => scenes.find((scene) => scene.start <= time && time < scene.end);
  const isUnexplored = (time: number) => exploredUntil !== undefined && time >= exploredUntil;
  const ratio = (time: number) => (duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 0);
  const timeAt = (event: PointerEvent) => {
    const rect = track.getBoundingClientRect();
    return Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) * duration;
  };

  const layout = () => {
    setText(total, formatTime(duration));
  };

  // 색은 페이지 토큰에서 읽는다.
  const style = getComputedStyle(container);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const colors = {
    rail: token('--border', '#27272b'),
    accent: token('--accent', '#5b9dff'),
    played: 'rgba(255, 255, 255, .22)',
  };
  const hatch = (() => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 8;
    const tileContext = tile.getContext('2d')!;
    tileContext.strokeStyle = 'rgba(255, 255, 255, .16)';
    tileContext.lineWidth = 3;
    tileContext.beginPath();
    tileContext.moveTo(-2, 10);
    tileContext.lineTo(10, -2);
    tileContext.stroke();
    return context.createPattern(tile, 'repeat');
  })();

  // 막대 두께(절반): 기본 5px, 현재 위치에서 12px, 마우스 아래에서 10px까지. 가우스 곡선으로 부드럽게 이어진다.
  const thickness = { base: 5, head: 7, headSpread: 64, lens: 5, lensSpread: 48 };
  let halfAt = new Float32Array(0);
  let drawn = '';

  const draw = (time: number) => {
    const width = track.clientWidth;
    const height = track.clientHeight;
    const scale = window.devicePixelRatio || 1;
    const key = `${width}x${height}@${scale}:${Math.round(ratio(time) * width * 4)}:${pointerX === undefined ? '' : Math.round(pointerX)}:${lens.toFixed(3)}:${duration}`;
    if (key === drawn || !width || !height) {
      return;
    }
    drawn = key;
    if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);

    const middle = height / 2;
    const headX = ratio(time) * width;
    if (halfAt.length !== width + 1) {
      halfAt = new Float32Array(width + 1);
    }
    for (let x = 0; x <= width; x++) {
      const nearHead = thickness.head * Math.exp(-((x - headX) ** 2) / (2 * thickness.headSpread ** 2));
      const nearPointer = pointerX === undefined ? 0 : thickness.lens * lens * Math.exp(-((x - pointerX) ** 2) / (2 * thickness.lensSpread ** 2));
      halfAt[x] = Math.min(thickness.base + Math.max(nearHead, nearPointer), middle - 1);
    }
    const band = (from: number, to: number, fill: string | CanvasPattern) => {
      const left = Math.max(0, Math.min(from, width));
      const right = Math.max(left + 2, Math.min(to, width));
      context.beginPath();
      context.moveTo(left, middle - halfAt[Math.round(left)]);
      for (let x = Math.ceil(left); x <= Math.min(right, width); x++) {
        context.lineTo(x, middle - halfAt[x]);
      }
      for (let x = Math.min(Math.floor(right), width); x >= left; x--) {
        context.lineTo(x, middle + halfAt[x]);
      }
      context.closePath();
      context.fillStyle = fill;
      context.fill();
    };

    // 현재 위치 둘레의 은은한 빛(사건의 지평선처럼 주변이 휘어 보이게).
    const glow = context.createRadialGradient(headX, middle, 0, headX, middle, 34);
    glow.addColorStop(0, 'rgba(91, 157, 255, .28)');
    glow.addColorStop(1, 'rgba(91, 157, 255, 0)');
    context.fillStyle = glow;
    context.fillRect(headX - 34, 0, 68, height);

    band(0, width, colors.rail);
    band(0, headX, colors.played);
    const active = sceneAt(time);
    for (const scene of scenes) {
      context.globalAlpha = scene === active ? 1 : .45;
      band(ratio(scene.start) * width, ratio(scene.end) * width, colors.accent);
    }
    context.globalAlpha = 1;
    if (exploredUntil !== undefined && hatch) {
      band(ratio(exploredUntil) * width, width, hatch);
    }
  };

  track.addEventListener('pointerenter', (event) => {
    pointerX = event.clientX - track.getBoundingClientRect().left;
  });
  track.addEventListener('pointerleave', () => {
    if (scrub === undefined) {
      pointerX = undefined;
    }
  });

  track.addEventListener('pointerdown', (event) => {
    if (duration <= 0) {
      return;
    }
    track.setPointerCapture(event.pointerId);
    scrub = timeAt(event);
    playback.seek(scrub, false);
  });
  track.addEventListener('pointermove', (event) => {
    if (duration <= 0) {
      return;
    }
    const time = timeAt(event);
    const position = `${ratio(time) * 100}%`;
    pointerX = event.clientX - track.getBoundingClientRect().left;
    hover.style.left = position;
    tooltip.style.left = position;
    const scene = sceneAt(time);
    setText(tooltip, scene ? `${formatTime(time)} · ${scene.title}` : isUnexplored(time) ? `${formatTime(time)} · 준비 중` : formatTime(time));
    if (scrub !== undefined) {
      scrub = time;
      playback.seek(scrub, false);
    }
  });
  const release = (event: PointerEvent) => {
    if (scrub === undefined) {
      return;
    }
    playback.seek(timeAt(event));
    scrub = undefined;
  };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  track.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 30 : 5;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const time = playback.time() + (event.key === 'ArrowLeft' ? -step : step);
      playback.seek(Math.min(Math.max(time, 0), duration));
    }
  });

  const update = () => {
    if (duration <= 0) {
      duration = playback.duration();
      if (duration > 0) {
        layout();
      }
    }
    // 끄는 동안에는 플레이어가 따라오기 전이므로 손가락 위치를 보여 준다.
    const time = scrub ?? playback.time();
    const position = `${ratio(time) * 100}%`;
    head.style.left = position;
    setText(current, formatTime(time));
    track.setAttribute('aria-valuenow', String(Math.floor(time)));
    const active = sceneAt(time);
    const outside = !active && isUnexplored(time);
    setText(sceneName, active?.title ?? (outside ? '준비 중인 구간' : ''));
    sceneName.classList.toggle('unexplored', outside);

    // 마우스 렌즈는 0.15초 남짓에 걸쳐 커지고 줄어든다.
    const now = performance.now();
    const step = Math.min((now - lastFrame) / 150, 1);
    lastFrame = now;
    const target = pointerX === undefined ? 0 : 1;
    lens += (target - lens) * step;
    if (Math.abs(target - lens) < .002) {
      lens = target;
    }
    draw(time);
    requestAnimationFrame(update);
  };
  update();
};
