import { createPanel } from '../tools/panel.js';
import { initializeIcons, setIcon, createNotice, downloadCanvas, initializeFullscreen } from '../tools/ui.js';
import { clampPoint } from './wave-field.js';
import { createRenderer } from './renderer.js';

window.addEventListener(
  'load',
  () => {
    const footer = document.querySelector('.colophon');
    const panel = createPanel({
      title: 'Resonance',
      theme: 'dark',
      indexHref: '../index.html',
      paragraphs: [
        '여러 파동이 겹쳐 만드는 간섭 무늬를 탐색하는 시각화입니다. 파원을 움직이면 파동이 서로 강해지거나 약해지는 위치가 달라지며, 화면 전체의 패턴이 변합니다.',
        '같은 파동을 등고선, 표면, 점의 세 가지 표현으로 바라볼 수 있습니다. 파원 배치와 파장, 속도, 색상을 조절하며 서로 다른 무늬를 만듭니다.',
      ],
    });
    footer.insertBefore(panel.trigger, footer.lastElementChild);
    document.body.appendChild(panel.element);

    const element = (id) => document.getElementById(id);

    initializeIcons();

    const stage = element('stage');
    const sourceLayer = element('sources');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const state = {
      sources: [],
      selected: null,
      nextId: 1,
      wavelength: 88,
      tempo: 0.65,
      time: 0,
      seconds: 0,
      mode: 0,
      palette: 0,
      running: !reducedMotion.matches,
      drift: false,
      arrangement: 1,
      width: 1,
      height: 1,
    };
    let renderer;
    let frameId = 0;
    let previousTime = 0;
    let previousPaint = 0;
    let pointer = null;
    const notice = createNotice(element('notice'), 2800);
    const notify = notice.show;

    function bindContextLoss() {
      if (renderer.kind !== 'webgl') return;
      renderer.canvas.addEventListener(
        'webglcontextlost',
        (event) => {
          event.preventDefault();
          renderer = createRenderer(renderer.canvas, true);
          renderer.resize(state.width, state.height);
          notify('Canvas mode active');
          invalidate();
        },
        { once: true },
      );
    }

    try {
      renderer = createRenderer(element('field'));
      bindContextLoss();
    } catch {
      notify('This browser could not create a drawing canvas.');
      return;
    }

    const formatCount = (count) => String(count).padStart(2, '0');
    function syncSources() {
      const existing = new Map(
        [...sourceLayer.children].map((button) => [Number(button.dataset.id), button]),
      );
      for (const [index, source] of state.sources.entries()) {
        let button = existing.get(source.id);
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'source';
          button.dataset.id = source.id;
          button.appendChild(document.createElement('span'));
          sourceLayer.appendChild(button);
        }
        existing.delete(source.id);
        button.setAttribute('aria-label', `Wave source ${index + 1}`);
        button.setAttribute('aria-pressed', String(source.id === state.selected));
        button.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight Delete');
        button.firstElementChild.textContent = formatCount(index + 1);
        positionSource(source, button);
      }
      for (const button of existing.values()) button.remove();
      element('source-count').value = formatCount(state.sources.length);
      element('readout').textContent = `${state.sources.length} OSCILLATORS / 1 FIELD`;
      element('add').disabled = state.sources.length >= 6;
      element('remove').disabled = state.sources.length <= 1;
      invalidate();
    }

    function positionSource(source, button = sourceLayer.querySelector(`[data-id="${source.id}"]`)) {
      button.style.left = `${source.x * 100}%`;
      button.style.top = `${source.y * 100}%`;
    }

    function addSource(x, y, phase = 0) {
      if (state.sources.length >= 6) {
        notify('Six sources maximum');
        return null;
      }
      const source = { id: state.nextId++, ...clampPoint(x, y), phase };
      state.sources.push(source);
      state.selected = source.id;
      syncSources();
      return source;
    }

    function removeSource(id = state.selected) {
      if (state.sources.length <= 1) return;
      const index = state.sources.findIndex((source) => source.id === id);
      if (index < 0) return;
      const restoreFocus = document.activeElement?.classList.contains('source');
      state.sources.splice(index, 1);
      state.selected = state.sources[Math.min(index, state.sources.length - 1)].id;
      syncSources();
      if (restoreFocus) sourceLayer.querySelector(`[data-id="${state.selected}"]`).focus();
    }

    function updatePlayback() {
      document.body.dataset.paused = String(!state.running);
      const label = state.running ? 'Pause' : 'Play';
      element('play').setAttribute('aria-label', label);
      element('play').dataset.tip = label;
      element('play-state').textContent = state.running ? 'LIVE' : 'HELD';
      setIcon(element('play'), state.running ? 'pause' : 'play');
      previousTime = 0;
      invalidate();
    }

    function setDrift(enabled) {
      state.drift = enabled;
      element('drift').checked = enabled;
      invalidate();
    }

    function reset() {
      notice.clear();
      pointer = null;
      state.sources = [];
      state.nextId = 1;
      state.wavelength = 88;
      state.tempo = 0.65;
      state.mode = 0;
      state.palette = 0;
      state.time = 0;
      state.seconds = 0;
      state.arrangement = 1;
      state.running = !reducedMotion.matches;
      setDrift(false);
      element('wavelength').value = 88;
      element('wavelength-value').value = '88';
      element('tempo').value = 65;
      element('tempo-value').value = '0.65';
      document.querySelector('[name="expression"][value="0"]').checked = true;
      document.querySelector('[name="palette"][value="0"]').checked = true;
      element('field-number').textContent = 'FIG. 01';
      addSource(0.36, 0.5);
      addSource(0.64, 0.5);
      state.selected = state.sources[0].id;
      syncSources();
      updatePlayback();
    }

    function draw() {
      const sources = state.sources.map((source) => ({
        x: source.x * state.width,
        y: source.y * state.height,
        phase: source.phase,
      }));
      renderer.render({
        ...state,
        sources,
        wavelength: state.wavelength * Math.min(1, Math.min(state.width, state.height) / 480),
      });
      element('time').textContent = `t + ${state.seconds.toFixed(2).padStart(6, '0')}`;
    }

    function frame(timestamp) {
      frameId = 0;
      if (document.hidden) {
        previousTime = 0;
        return;
      }
      const delta = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.05) : 0;
      previousTime = timestamp;
      if (state.running) {
        state.time = (state.time + delta * state.tempo * Math.PI * 2) % (Math.PI * 2);
        state.seconds += delta;
        if (state.drift && !pointer) {
          for (const source of state.sources) {
            const x = source.x - 0.5;
            const y = ((source.y - 0.5) * state.height) / state.width;
            const angle = delta * 0.08;
            const position = clampPoint(
              0.5 + x * Math.cos(angle) - y * Math.sin(angle),
              0.5 + ((x * Math.sin(angle) + y * Math.cos(angle)) * state.width) / state.height,
            );
            Object.assign(source, position);
            positionSource(source);
          }
        }
      }
      if (renderer.kind === 'webgl' || timestamp - previousPaint > 32 || !state.running) {
        draw();
        previousPaint = timestamp;
      }
      if (state.running) frameId = requestAnimationFrame(frame);
    }

    function invalidate() {
      if (!frameId) frameId = requestAnimationFrame(frame);
    }

    function pointerPosition(event) {
      const bounds = stage.getBoundingClientRect();
      return clampPoint(
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height,
      );
    }

    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || pointer || event.target.closest('#notice')) return;
      const position = pointerPosition(event);
      const button = event.target.closest('.source');
      const source = button
        ? state.sources.find((item) => item.id === Number(button.dataset.id))
        : addSource(position.x, position.y);
      if (!source) return;
      setDrift(false);
      state.selected = source.id;
      pointer = {
        id: event.pointerId,
        source,
        offsetX: source.x - position.x,
        offsetY: source.y - position.y,
      };
      syncSources();
      const marker = sourceLayer.querySelector(`[data-id="${source.id}"]`);
      marker.classList.add('dragging');
      marker.focus({ preventScroll: true });
      stage.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    stage.addEventListener('pointermove', (event) => {
      const position = pointerPosition(event);
      element('coordinates').textContent = `X ${position.x.toFixed(3)} / Y ${position.y.toFixed(3)}`;
      if (!pointer || event.pointerId !== pointer.id) return;
      Object.assign(pointer.source, clampPoint(position.x + pointer.offsetX, position.y + pointer.offsetY));
      positionSource(pointer.source);
      invalidate();
    });

    function releasePointer(event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      const marker = sourceLayer.querySelector(`[data-id="${pointer.source.id}"]`);
      marker?.classList.remove('dragging');
      pointer = null;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    }
    stage.addEventListener('pointerup', releasePointer);
    stage.addEventListener('pointercancel', releasePointer);
    stage.addEventListener('lostpointercapture', releasePointer);
    stage.addEventListener('contextmenu', (event) => {
      const button = event.target.closest('.source');
      if (!button) return;
      event.preventDefault();
      removeSource(Number(button.dataset.id));
    });
    sourceLayer.addEventListener('click', (event) => {
      const button = event.target.closest('.source');
      if (!button) return;
      state.selected = Number(button.dataset.id);
      syncSources();
    });
    sourceLayer.addEventListener('keydown', (event) => {
      const button = event.target.closest('.source');
      if (!button) return;
      const source = state.sources.find((item) => item.id === Number(button.dataset.id));
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (directions[event.key]) {
        event.preventDefault();
        setDrift(false);
        const [x, y] = directions[event.key];
        const step = event.shiftKey ? 0.04 : 0.01;
        Object.assign(source, clampPoint(source.x + x * step, source.y + y * step));
        state.selected = source.id;
        syncSources();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSource(source.id);
      }
    });

    element('play').addEventListener('click', () => {
      state.running = !state.running;
      updatePlayback();
    });
    element('reset').addEventListener('click', reset);
    element('shuffle').addEventListener('click', () => {
      setDrift(false);
      state.arrangement++;
      for (const source of state.sources) {
        source.x = 0.18 + Math.random() * 0.64;
        source.y = 0.18 + Math.random() * 0.64;
        source.phase = Math.random() * Math.PI * 2;
      }
      element('field-number').textContent = `FIG. ${formatCount(state.arrangement)}`;
      syncSources();
    });
    element('add').addEventListener('click', () => {
      const angle = state.sources.length * 2.39996;
      addSource(0.5 + Math.cos(angle) * 0.23, 0.5 + Math.sin(angle) * 0.23);
    });
    element('remove').addEventListener('click', () => removeSource());
    element('wavelength').addEventListener('input', (event) => {
      state.wavelength = Number(event.target.value);
      element('wavelength-value').value = String(state.wavelength);
      invalidate();
    });
    element('tempo').addEventListener('input', (event) => {
      state.tempo = Number(event.target.value) / 100;
      element('tempo-value').value = state.tempo.toFixed(2);
      invalidate();
    });
    document.querySelectorAll('[name="expression"]').forEach((input) =>
      input.addEventListener('change', () => {
        state.mode = Number(input.value);
        invalidate();
      }),
    );
    document.querySelectorAll('[name="palette"]').forEach((input) =>
      input.addEventListener('change', () => {
        state.palette = Number(input.value);
        invalidate();
      }),
    );
    element('drift').addEventListener('change', (event) => setDrift(event.target.checked));
    element('save').addEventListener('click', async () => {
      const button = element('save');
      button.disabled = true;
      try {
        draw();
        await downloadCanvas(renderer.canvas, {
          filename: `resonance-${String(state.arrangement).padStart(2, '0')}.png`,
          caption: 'Resonance.',
          color: '#dce7df',
          minimumFontSize: 12,
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

    document.addEventListener('visibilitychange', () => {
      previousTime = 0;
      if (!document.hidden) invalidate();
    });
    document.addEventListener('keydown', (event) => {
      if (
        event.code !== 'Space' ||
        event.target.closest('input, button, select, textarea, [contenteditable]')
      )
        return;
      event.preventDefault();
      state.running = !state.running;
      updatePlayback();
    });
    reducedMotion.addEventListener('change', (event) => {
      if (event.matches) {
        state.running = false;
        setDrift(false);
        updatePlayback();
      }
    });
    function resize() {
      const bounds = stage.getBoundingClientRect();
      state.width = Math.max(1, bounds.width);
      state.height = Math.max(1, bounds.height);
      renderer.resize(state.width, state.height);
      invalidate();
    }
    resize();
    new ResizeObserver(resize).observe(stage);

    reset();
  },
  { once: true },
);
