import { createPanel } from '../tools/panel.js';
import { initializeIcons, setIcon, createNotice, downloadCanvas, initializeFullscreen } from '../tools/ui.js';
import { Sculpture } from './sculpture.js';

window.addEventListener(
  'load',
  () => {
    const footer = document.querySelector('.colophon');
    const panel = createPanel({
      title: 'Tidal Form',
      theme: 'light',
      indexHref: '../index.html',
      paragraphs: [
        '48개의 고리가 층을 이루는 움직이는 3D 조형물입니다. 각 고리는 조금씩 다른 방향과 속도로 움직이며 하나의 입체를 만듭니다.',
        '시점을 돌려 입체를 감상하고, 고리 가까이 포인터를 가져가 주변 층이 벌어지는 반응을 볼 수 있습니다. 형태, 확장 정도, 비틀림과 재질을 조절할 수 있습니다.',
      ],
    });
    footer.insertBefore(panel.trigger, footer.lastElementChild);
    document.body.appendChild(panel.element);

    const element = (id) => document.getElementById(id);

    initializeIcons();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const notice = createNotice(element('notice'), 2600);
    const notify = notice.show;

    let sculpture;
    try {
      sculpture = new Sculpture(element('stage'), {
        message: notify,
        hover(index) {
          element('selection').textContent =
            index < 0 ? 'OBJECT / 003' : `LAYER / ${String(index + 1).padStart(2, '0')}`;
        },
        time(seconds) {
          element('elapsed').textContent =
            `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
        },
      });
    } catch (error) {
      notify('WebGL 2 is unavailable. Enable graphics acceleration or use another browser.', true);
      document.querySelectorAll('.actions button, .controls button, .controls input').forEach((control) => {
        control.disabled = true;
      });
      element('play-state').textContent = 'UNAVAILABLE';
      console.warn('Tidal Form could not initialize:', error.message);
      return;
    }
    function playback() {
      const running = sculpture.state.running;
      document.body.dataset.paused = String(!running);
      element('play-state').value = running ? 'IN MOTION' : 'SUSPENDED';
      const label = running ? 'Pause' : 'Play';
      element('play').setAttribute('aria-label', label);
      element('play').dataset.tip = label;
      setIcon(element('play'), running ? 'pause' : 'play');
    }
    element('play').addEventListener('click', () => {
      sculpture.set('running', !sculpture.state.running);
      playback();
    });
    element('pulse').addEventListener('click', () => sculpture.impulse());
    element('reset').addEventListener('click', () => {
      notice.clear();
      sculpture.resetView();
    });
    document.querySelectorAll('[name="form"]').forEach((input) =>
      input.addEventListener('change', () => {
        const form = Number(input.value);
        sculpture.set('form', form);
        element('object-name').textContent = `0${form + 1} / ${['SPINDLE', 'VESSEL', 'HALO'][form]}`;
      }),
    );
    document
      .querySelectorAll('[name="finish"]')
      .forEach((input) =>
        input.addEventListener('change', () => sculpture.set('finish', Number(input.value))),
      );
    element('openness').addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sculpture.set('openness', value / 100);
      element('openness-value').value = `${value}%`;
    });
    element('twist').addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sculpture.set('twist', (value * Math.PI) / 180);
      element('twist-value').value = `${value}\u00b0`;
    });
    element('turn').addEventListener('change', (event) => sculpture.set('turn', event.target.checked));
    element('save').addEventListener('click', async () => {
      const button = element('save');
      button.disabled = true;
      try {
        sculpture.render();
        await downloadCanvas(sculpture.canvas, {
          filename: `tidal-form-${['spindle', 'vessel', 'halo'][sculpture.state.form]}.png`,
          caption: 'Tidal Form.',
          color: '#3c4b46',
          minimumFontSize: 14,
          left: 24,
          bottom: 22,
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
        event.target.closest('input, button, select, textarea, [contenteditable]')
      )
        return;
      event.preventDefault();
      sculpture.set('running', !sculpture.state.running);
      playback();
    });
    reducedMotion.addEventListener('change', (event) => {
      if (event.matches) {
        sculpture.set('running', false);
        playback();
      }
    });
    playback();
  },
  { once: true },
);
