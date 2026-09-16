import { createPanel } from '../tools/panel.js';
import { initializeIcons, setIcon, createNotice, downloadCanvas, initializeFullscreen } from '../tools/ui.js';
import { Loom, MAX_POLES } from './model.js';
import { LoomRenderer } from './renderer.js';

window.addEventListener(
  'load',
  () => {
    const element = (id) => document.getElementById(id);
    const canvas = element('canvas');
    const stage = element('stage');
    const poleLayer = element('poles');
    const playButton = element('play');
    const saveButton = element('save');
    const tension = element('tension');
    const strength = element('strength');
    const notice = createNotice(element('notice'));
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const buttons = new Map();
    let paused = motionPreference.matches;
    let frame = 0;
    let previousTime = 0;
    let accumulator = 0;
    let drag = null;
    let selectedId = null;
    let model;
    let renderer;

    initializeIcons();
    const panel = createPanel({
      title: 'Magnetic Loom',
      theme: 'dark',
      indexHref: '../',
      paragraphs: [
        '보이지 않는 힘이 실의 방향을 바꾸고, 서로 다른 흐름이 만나 하나의 직물을 이룹니다. 은빛 바탕 사이로 산호색과 청록색 실이 스며들며, 당김과 밀어냄의 흔적을 남깁니다.',
        '264개의 연속된 실은 작은 연결점과 스프링으로 이루어져 있습니다. D3 Force가 움직임과 장력을 계산하고, 양극과 음극으로 표현한 고정점 주위에는 끌림, 밀림, 회전 성분을 합친 예술적 힘의 장을 더했습니다.',
        '이 작품은 실제 자기장이나 전자기 법칙을 정확하게 재현하지 않습니다. 극의 부호와 실의 교차는 시각적 구성을 위한 표현이며, 실제 전하나 자석의 거동과는 다릅니다.',
      ],
    });
    const colophon = document.querySelector('.colophon');
    colophon.append(panel.trigger);
    colophon.querySelector(':scope > span:last-of-type').before(panel.trigger);
    document.body.append(panel.element);
    initializeFullscreen(element('fullscreen'), notice.show);

    try {
      renderer = new LoomRenderer(canvas);
      model = new Loom(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight));
    } catch (error) {
      notice.show('The canvas could not be initialized.', true);
      document.querySelectorAll('.study-actions button, .study-controls input, .study-controls button').forEach((control) => {
        control.disabled = true;
      });
      return;
    }

    function positionPoles() {
      for (const pole of model.poles) {
        const button = buttons.get(pole.id);
        if (!button) continue;
        button.style.left = `${pole.x}px`;
        button.style.top = `${pole.y}px`;
      }
    }

    function draw() {
      renderer.draw(model);
      positionPoles();
    }

    function syncSelection() {
      const selected = model.poles.find((pole) => pole.id === selectedId);
      for (const pole of model.poles) {
        const button = buttons.get(pole.id);
        const sign = pole.sign > 0 ? 'Positive' : 'Negative';
        button.dataset.sign = String(pole.sign);
        button.setAttribute('aria-pressed', String(pole.id === selectedId));
        button.setAttribute('aria-label', `${sign} pole ${pole.id}`);
        button.title = `${sign} pole ${pole.id}`;
        setIcon(button, pole.sign > 0 ? 'plus' : 'minus');
      }
      document.querySelectorAll('input[name="polarity"]').forEach((input) => {
        input.checked = selected ? Number(input.value) === selected.sign : false;
        input.disabled = !selected;
      });
      const count = model.poles.length;
      element('pole-count').textContent = `${count} / ${MAX_POLES}`;
      element('pole-readout').textContent = `${String(count).padStart(2, '0')} / 06 POLES`;
      element('selected-pole').textContent = selected ? String(selected.id).padStart(2, '0') : '--';
      element('remove-pole').disabled = !selected;
      element('add-positive').disabled = count >= MAX_POLES;
      element('add-negative').disabled = count >= MAX_POLES;
    }

    function selectPole(id) {
      selectedId = id;
      syncSelection();
    }

    function redrawEdit() {
      if (paused) model.tick(12, false);
      draw();
    }

    function endDrag(event) {
      if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
      const { button, pointerId } = drag;
      drag = null;
      button.classList.remove('is-dragging');
      if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
    }

    function moveDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const bounds = stage.getBoundingClientRect();
      model.movePole(drag.id, event.clientX - bounds.left - drag.offsetX, event.clientY - bounds.top - drag.offsetY);
      redrawEdit();
    }

    function removeSelected() {
      if (selectedId === null) return;
      endDrag();
      const restoreFocus = poleLayer.contains(document.activeElement);
      model.removePole(selectedId);
      selectedId = model.poles.at(-1)?.id ?? null;
      syncPoleButtons();
      if (restoreFocus) (buttons.get(selectedId) ?? element('add-positive')).focus({ preventScroll: true });
      redrawEdit();
    }

    function poleKey(event, id) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const pole = model.poles.find((item) => item.id === id);
      if (!pole) return;
      const delta = event.shiftKey ? 24 : 6;
      const moves = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
      if (moves[event.key]) {
        event.preventDefault();
        selectPole(id);
        model.movePole(id, pole.x + moves[event.key][0], pole.y + moves[event.key][1]);
        redrawEdit();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        selectPole(id);
        removeSelected();
      } else if (event.key === '+' || event.key === '-') {
        event.preventDefault();
        selectPole(id);
        model.setPolarity(id, event.key === '+' ? 1 : -1);
        syncSelection();
        redrawEdit();
      } else if (event.key === 'Escape') {
        endDrag();
      }
    }

    function syncPoleButtons() {
      for (const [id, button] of buttons) {
        if (!model.poles.some((pole) => pole.id === id)) {
          button.remove();
          buttons.delete(id);
        }
      }
      for (const pole of model.poles) {
        if (buttons.has(pole.id)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'loom-pole';
        button.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Delete + -');
        button.addEventListener('focus', () => selectPole(pole.id));
        button.addEventListener('click', () => selectPole(pole.id));
        button.addEventListener('keydown', (event) => poleKey(event, pole.id));
        button.addEventListener('pointerdown', (event) => {
          if (event.button !== 0 || !event.isPrimary || drag) return;
          const current = model.poles.find((item) => item.id === pole.id);
          if (!current) return;
          event.preventDefault();
          selectPole(pole.id);
          button.focus({ preventScroll: true });
          const bounds = stage.getBoundingClientRect();
          drag = {
            id: pole.id,
            button,
            pointerId: event.pointerId,
            offsetX: event.clientX - bounds.left - current.x,
            offsetY: event.clientY - bounds.top - current.y,
          };
          button.classList.add('is-dragging');
          button.setPointerCapture(event.pointerId);
        });
        button.addEventListener('lostpointercapture', endDrag);
        buttons.set(pole.id, button);
        poleLayer.append(button);
      }
      syncSelection();
      positionPoles();
    }

    function animate(timestamp) {
      frame = 0;
      if (paused || document.hidden) return;
      if (!previousTime) previousTime = timestamp;
      accumulator += Math.min(100, timestamp - previousTime);
      previousTime = timestamp;
      if (accumulator >= 1000 / 30) {
        const steps = Math.min(3, Math.floor(accumulator / (1000 / 30)));
        model.tick(steps);
        accumulator %= 1000 / 30;
        draw();
      }
      frame = requestAnimationFrame(animate);
    }

    function syncPlayback() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      accumulator = 0;
      setIcon(playButton, paused ? 'play' : 'pause');
      const label = paused ? 'Play' : 'Pause';
      playButton.setAttribute('aria-label', label);
      playButton.dataset.tip = label;
      element('motion-readout').textContent = paused ? 'STILL' : 'IN MOTION';
      if (!paused && !document.hidden) frame = requestAnimationFrame(animate);
    }

    function resize() {
      endDrag();
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      if (width !== model.width || height !== model.height) model.resize(width, height);
      renderer.resize(width, height, window.devicePixelRatio);
      draw();
    }

    selectedId = model.poles[0].id;
    syncPoleButtons();
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', () => endDrag());
    playButton.addEventListener('click', () => {
      paused = !paused;
      syncPlayback();
    });
    element('reset').addEventListener('click', () => {
      endDrag();
      model.reset();
      tension.value = '42';
      strength.value = '68';
      element('tension-value').textContent = '42%';
      element('strength-value').textContent = '68%';
      selectedId = model.poles[0].id;
      syncPoleButtons();
      draw();
      notice.show('Composition reset');
    });
    for (const [id, sign] of [
      ['add-positive', 1],
      ['add-negative', -1],
    ]) {
      element(id).addEventListener('click', () => {
        const pole = model.addPole(sign);
        if (!pole) return;
        selectedId = pole.id;
        syncPoleButtons();
        buttons.get(pole.id).focus({ preventScroll: true });
        redrawEdit();
      });
    }
    element('remove-pole').addEventListener('click', removeSelected);
    document.querySelectorAll('input[name="polarity"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        model.setPolarity(selectedId, Number(input.value));
        syncSelection();
        redrawEdit();
      });
    });
    for (const input of [tension, strength]) {
      input.addEventListener('input', () => {
        model.setSettings({ tension: Number(tension.value), strength: Number(strength.value) });
        element(`${input.id}-value`).textContent = `${input.value}%`;
        redrawEdit();
      });
    }
    saveButton.addEventListener('click', async () => {
      if (saveButton.disabled) return;
      saveButton.disabled = true;
      try {
        renderer.draw(model);
        renderer.drawPoleMarks(model);
        const saving = downloadCanvas(canvas, {
          filename: `magnetic-loom-${Date.now()}.png`,
          caption: 'Magnetic Loom / 006',
          color: '#a9afab',
          left: 24 * renderer.dpr,
          bottom: 22 * renderer.dpr,
        });
        draw();
        await saving;
        notice.show('Image saved');
      } catch {
        notice.show('The image could not be saved.');
      } finally {
        saveButton.disabled = false;
        draw();
      }
    });
    motionPreference.addEventListener('change', (event) => {
      if (event.matches) {
        paused = true;
        syncPlayback();
      }
    });
    document.addEventListener('visibilitychange', () => {
      endDrag();
      syncPlayback();
    });
    window.addEventListener('pagehide', () => {
      endDrag();
      cancelAnimationFrame(frame);
      model.destroy();
    });
    window.addEventListener('pageshow', () => {
      resize();
      syncPlayback();
    });
    syncPlayback();
  },
  { once: true },
);
