import { createPanel } from '../tools/panel.js';
import { initializeIcons, setIcon, createNotice, downloadCanvas, initializeFullscreen } from '../tools/ui.js';
import { FixedClock } from './clock.js';
import { createSurface } from './surface.js';

window.addEventListener(
  'load',
  () => {
    const footer = document.querySelector('.colophon');
    const panel = createPanel({
      title: 'Afterwave',
      theme: 'dark',
      indexHref: '../index.html',
      paragraphs: [
        '손으로 그은 흔적이 물결로 남아 퍼지는 인터랙티브 표면입니다. 파원을 옮겨도 이전 위치에서 생긴 물결은 계속 진행하며 새로운 파동과 만납니다.',
        '표면의 굴곡에 따라 금속성 반사광이 달라집니다. 물결이 남는 정도와 크기, 빛의 방향, 재질을 바꾸며 움직임의 흔적을 탐색합니다.',
      ],
    });
    footer.insertBefore(panel.trigger, footer.lastElementChild);
    document.body.appendChild(panel.element);

    const element = (id) => document.getElementById(id);

    initializeIcons();
    const stage = element('stage');
    const markers = [...document.querySelectorAll('.emitter')];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const clock = new FixedClock();
    const state = {
      running: !reducedMotion.matches,
      memory: 80,
      radius: 22,
      light: 135,
      material: 0,
      sourcesOn: true,
      orbit: false,
      time: 0,
      ticks: 0,
      traces: 0,
      composition: 1,
      width: Math.max(1, stage.clientWidth),
      height: Math.max(1, stage.clientHeight),
      sources: [
        { x: 0.36, y: 0.48 },
        { x: 0.64, y: 0.55 },
      ],
    };
    let surface;
    let frameId = 0;
    let previousTime = 0;
    let pointer = null;
    const notice = createNotice(element('notice'), 2600);
    const notify = notice.show;

    function bindRecovery() {
      if (surface.kind !== 'webgl') return;
      surface.canvas.addEventListener(
        'webglcontextlost',
        (event) => {
          event.preventDefault();
          surface = createSurface(surface.canvas, state.width, state.height, true);
          seed();
          notify('Surface restored in Canvas mode');
          invalidate();
        },
        { once: true },
      );
    }

    try {
      surface = createSurface(element('surface'), state.width, state.height);
      bindRecovery();
    } catch {
      notify('This browser could not create the surface.', true);
      document.querySelectorAll('.actions button, .controls button, .controls input').forEach((control) => {
        control.disabled = true;
      });
      return;
    }

    const clamp = (value, lower = 0.07, upper = 0.93) => Math.max(lower, Math.min(upper, value));
    const damping = () => 0.97 + (state.memory / 100) * 0.028;
    const radius = () => state.radius / 1000;

    function updateSources() {
      state.sources.forEach((source, index) => {
        markers[index].style.left = `${source.x * 100}%`;
        markers[index].style.top = `${source.y * 100}%`;
      });
    }

    function drop(x, y, strength = 0.026, scale = 1) {
      surface.drop(x, y, radius() * scale, strength);
      state.traces++;
    }

    function seed() {
      surface.clear();
      state.traces = 0;
      // Build a short, deterministic emission history, ending at today's source positions.
      for (let tick = 0; tick < 180; tick++) {
        if (tick % 28 === 0) {
          state.sources.forEach((source, index) => {
            const history = (180 - tick) / 180;
            const direction = index ? -1 : 1;
            drop(
              source.x + Math.sin(history * 3.8) * 0.06 * direction,
              source.y + history * 0.1 * direction,
              tick % 56 ? -0.026 : 0.026,
              1.2,
            );
          });
        }
        surface.step(damping());
      }
    }

    function draw() {
      surface.render(state);
      const minutes = Math.floor(state.time / 60);
      const seconds = (state.time % 60).toFixed(1).padStart(4, '0');
      element('elapsed').textContent = `${String(minutes).padStart(2, '0')}:${seconds}`;
      element('trace-count').value = String(state.traces).padStart(3, '0');
    }

    function step(seconds) {
      state.time += seconds;
      state.ticks++;
      if (state.orbit && !pointer) {
        state.sources.forEach((source, index) => {
          const x = source.x - 0.5,
            y = ((source.y - 0.5) * state.height) / state.width;
          const angle = seconds * (index ? -0.07 : 0.09);
          source.x = clamp(0.5 + x * Math.cos(angle) - y * Math.sin(angle), 0.15, 0.85);
          source.y = clamp(
            0.5 + ((x * Math.sin(angle) + y * Math.cos(angle)) * state.width) / state.height,
            0.15,
            0.85,
          );
        });
      }
      if (state.sourcesOn) {
        state.sources.forEach((source, index) => {
          const period = index ? 37 : 31;
          if (state.ticks % period === 0)
            drop(source.x, source.y, Math.floor(state.ticks / period) % 2 ? -0.026 : 0.026);
        });
      }
      surface.step(damping());
    }

    function frame(timestamp) {
      frameId = 0;
      if (document.hidden) {
        previousTime = 0;
        return;
      }
      const delta = previousTime ? (timestamp - previousTime) / 1000 : 0;
      previousTime = timestamp;
      if (state.running) clock.advance(delta, step);
      if (state.orbit) updateSources();
      draw();
      if (state.running) frameId = requestAnimationFrame(frame);
    }
    function invalidate() {
      if (!frameId) frameId = requestAnimationFrame(frame);
    }

    function playback() {
      document.body.dataset.paused = String(!state.running);
      element('live-label').value = state.running ? 'IN MOTION' : 'SUSPENDED';
      const label = state.running ? 'Pause' : 'Play';
      element('play').setAttribute('aria-label', label);
      element('play').dataset.tip = label;
      setIcon(element('play'), state.running ? 'pause' : 'play');
      previousTime = 0;
      invalidate();
    }
    function setSources(enabled) {
      state.sourcesOn = enabled;
      element('sources-on').checked = enabled;
      document.body.dataset.sources = String(enabled);
    }
    function setOrbit(enabled) {
      state.orbit = enabled;
      element('orbit').checked = enabled;
    }

    function release(event) {
      if (!pointer || (event && event.pointerId !== pointer.id)) return;
      const id = pointer.id;
      pointer = null;
      stage.classList.remove('drawing');
      markers.forEach((marker) => marker.classList.remove('dragging'));
      if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    }
    function position(event) {
      const bounds = stage.getBoundingClientRect();
      return {
        x: clamp((event.clientX - bounds.left) / bounds.width),
        y: clamp((event.clientY - bounds.top) / bounds.height),
      };
    }
    function showCursor(point) {
      const size = radius() * Math.min(state.width, state.height) * 2;
      const cursor = element('cursor');
      cursor.style.width = cursor.style.height = `${size}px`;
      cursor.style.margin = `${-size / 2}px`;
      cursor.style.left = `${point.x * 100}%`;
      cursor.style.top = `${point.y * 100}%`;
    }

    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || pointer) return;
      const point = position(event);
      const marker = event.target.closest('.emitter');
      const sourceIndex = marker ? Number(marker.dataset.source) : null;
      pointer = {
        id: event.pointerId,
        sourceIndex,
        last: point,
        offsetX: marker ? state.sources[sourceIndex].x - point.x : 0,
        offsetY: marker ? state.sources[sourceIndex].y - point.y : 0,
      };
      if (marker) {
        setOrbit(false);
        marker.classList.add('dragging');
        marker.focus({ preventScroll: true });
      } else {
        stage.classList.add('drawing');
        showCursor(point);
      }
      drop(point.x, point.y, 0.035);
      stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      invalidate();
    });
    stage.addEventListener('pointermove', (event) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const point = position(event);
      if (pointer.sourceIndex !== null) {
        point.x = clamp(point.x + pointer.offsetX);
        point.y = clamp(point.y + pointer.offsetY);
        Object.assign(state.sources[pointer.sourceIndex], point);
        updateSources();
      } else showCursor(point);
      const distance = Math.hypot(
        (point.x - pointer.last.x) * state.width,
        (point.y - pointer.last.y) * state.height,
      );
      if (distance < 2) return;
      const spacing = Math.max(4, radius() * Math.min(state.width, state.height));
      const samples = Math.max(1, Math.min(16, Math.ceil(distance / spacing)));
      const pressure = event.pressure || 0.5;
      for (let index = 1; index <= samples; index++) {
        const progress = index / samples;
        drop(
          pointer.last.x + (point.x - pointer.last.x) * progress,
          pointer.last.y + (point.y - pointer.last.y) * progress,
          0.012 * (0.5 + pressure),
        );
      }
      pointer.last = point;
      invalidate();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      stage.addEventListener(name, release);
    window.addEventListener('blur', () => release());
    markers.forEach((marker, index) =>
      marker.addEventListener('keydown', (event) => {
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!directions[event.key]) return;
        event.preventDefault();
        setOrbit(false);
        const [x, y] = directions[event.key];
        const distance = event.shiftKey ? 0.04 : 0.01;
        const source = state.sources[index];
        drop(source.x, source.y, 0.015);
        source.x = clamp(source.x + x * distance);
        source.y = clamp(source.y + y * distance);
        drop(source.x, source.y, 0.015);
        updateSources();
        invalidate();
      }),
    );

    element('play').addEventListener('click', () => {
      state.running = !state.running;
      playback();
    });
    element('sources-on').addEventListener('change', (event) => setSources(event.target.checked));
    element('orbit').addEventListener('change', (event) => setOrbit(event.target.checked));
    element('clear').addEventListener('click', () => {
      release();
      setSources(false);
      setOrbit(false);
      surface.clear();
      state.traces = 0;
      invalidate();
    });
    element('reset').addEventListener('click', () => {
      release();
      notice.clear();
      setOrbit(false);
      setSources(true);
      state.composition++;
      state.time = state.ticks = 0;
      clock.reset();
      state.sources = [
        { x: 0.25 + Math.random() * 0.15, y: 0.35 + Math.random() * 0.3 },
        { x: 0.6 + Math.random() * 0.15, y: 0.35 + Math.random() * 0.3 },
      ];
      updateSources();
      seed();
      invalidate();
    });
    for (const id of ['memory', 'radius', 'light']) {
      element(id).addEventListener('input', (event) => {
        state[id] = Number(event.target.value);
        element(`${id}-value`).value = `${state[id]}${id === 'light' ? '\u00b0' : ''}`;
        invalidate();
      });
    }
    document.querySelectorAll('[name="material"]').forEach((input) =>
      input.addEventListener('change', () => {
        state.material = Number(input.value);
        element('material-label').textContent =
          `0${state.material + 1} / ${['PLATINUM', 'NACRE', 'GRAPHITE'][state.material]}`;
        invalidate();
      }),
    );
    element('save').addEventListener('click', async () => {
      const button = element('save');
      button.disabled = true;
      try {
        draw();
        await downloadCanvas(surface.canvas, {
          filename: `afterwave-${String(state.composition).padStart(2, '0')}.png`,
          caption: 'Afterwave.',
          color: '#d5ddd1',
          minimumFontSize: 14,
          left: 20,
          bottom: 20,
        });
        notify('Image saved');
      } catch {
        notify('Image could not be saved');
      } finally {
        button.disabled = false;
      }
    });
    initializeFullscreen(element('fullscreen'), notify);

    document.addEventListener('keydown', (event) => {
      if (
        event.code !== 'Space' ||
        event.target.closest('button, input, select, textarea, [contenteditable]')
      )
        return;
      event.preventDefault();
      state.running = !state.running;
      playback();
    });
    document.addEventListener('visibilitychange', () => {
      previousTime = 0;
      if (!document.hidden) invalidate();
      else release();
    });
    reducedMotion.addEventListener('change', (event) => {
      if (event.matches) {
        state.running = false;
        playback();
      }
    });
    new ResizeObserver(() => {
      state.width = Math.max(1, stage.clientWidth);
      state.height = Math.max(1, stage.clientHeight);
      surface.resize(state.width, state.height);
      invalidate();
    }).observe(stage);

    seed();
    updateSources();
    setSources(true);
    playback();
  },
  { once: true },
);
