import { createPanel } from '../tools/panel.js';
import { initializeIcons, setIcon, createNotice, downloadCanvas, initializeFullscreen } from '../tools/ui.js';
import { ChromaticModel, COLORS, ALLOWED } from './model.js';

window.addEventListener('load', () => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const stage = $('stage');
  const study = document.querySelector('.chromatic-study');
  const notice = createNotice($('notice'));
  initializeIcons();
  initializeFullscreen($('fullscreen'), notice.show);

  const panel = createPanel({
    title: 'Chromatic Cells / 색의 이웃',
    theme: 'dark',
    indexHref: '../',
    paragraphs: [
      '하나의 색은 이웃이 될 수 있는 색을 품고 있습니다. 산호색, 옥색, 민트색, 보라색과 작은 금빛 조각들이 검은 바탕 위에서 자리를 나누며 하나의 모자이크가 됩니다. 아직 정해지지 않은 칸도 작품의 일부입니다.',
      '이 작품은 Kevin Chapelier의 wavefunctioncollapse 2.1.0 제약 전파 엔진을 로컬 ES 모듈로 사용합니다. 각 칸에는 여섯 가지 색의 가능성이 있으며, 상하좌우의 이웃 규칙으로 불가능한 색을 제거합니다. 다음 칸은 이미 정해진 칸의 가장자리에서 엔트로피와 작은 무작위 편향으로 선택합니다. 같은 색이 모일 확률을 높여 색의 군집을 만듭니다.',
      '아이보리는 모든 색과 이웃할 수 있습니다. 나머지 색은 각각 자기 자신과 정해진 두 색을 허용하는 순환 규칙을 따릅니다. 새 씨앗을 심으면 기존 씨앗은 유지한 채 미정 상태에서 다시 자랍니다. 이웃 규칙과 충돌하는 씨앗은 적용하지 않으며, 성장 중 모순이 생기면 씨앗 상태로 돌아가 멈춥니다. 전체 풀이가 끝나면 성장이 멈춥니다.',
      '타일의 곡선과 선은 색 제약과 별개인 장식 문양입니다. Coding Train의 생성 실험에서 영감을 받았지만, 팔레트와 배치, 성장 순서, 문양은 이 작품을 위해 구성했습니다. 움직임 줄이기 설정에서는 완성되지 않은 첫 구도를 정지 상태로 보여 줍니다.',
    ],
  });
  const colophon = document.querySelector('.colophon');
  colophon.appendChild(panel.trigger);
  colophon.insertBefore(panel.trigger, colophon.children[1]);
  document.body.appendChild(panel.element);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    notice.show('Canvas is unavailable in this browser.', true);
    for (const control of study.querySelectorAll('input, .tool')) control.disabled = true;
    return;
  }

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches;
  let model;
  let selectedColor = 1;
  let edition = 8;
  let scale = Number($('scale').value);
  let tempo = Number($('tempo').value);
  let inlays = true;
  let width = 1;
  let height = 1;
  let dpr = 1;
  let cellSize = 1;
  let originX = 0;
  let originY = 0;
  let cursor = null;
  let keyboardFocus = false;
  let births = [];
  let previousCells = [];
  let lastGrowth = 0;
  let animation = 0;
  let animateUntil = 0;
  let pointerId = null;
  let lastPaint = -1;
  let lastSeedAt = 0;
  let resizeTimer;
  let saveInProgress = false;

  function updateStatus() {
    const complete = model.filled === model.cells.length;
    $('state').textContent = model.filled === 0 ? 'UNWRITTEN' : complete ? 'SETTLED' : paused ? 'STILL' : 'GROWING';
    $('population').textContent = `${String(model.filled).padStart(3, '0')} / ${String(model.cells.length).padStart(3, '0')}`;
    $('edition').textContent = `ARRANGEMENT ${String(edition).padStart(3, '0')}`;
    $('coverage').style.width = `${model.filled / model.cells.length * 100}%`;
    study.dataset.paused = String(paused || complete);
    const label = paused ? 'Play' : 'Pause';
    if ($('play').getAttribute('aria-label') !== label) setIcon($('play'), paused ? 'play' : 'pause');
    $('play').setAttribute('aria-label', label);
    $('play').setAttribute('aria-pressed', String(!paused));
    $('play').dataset.tip = label;
    $('play').title = label;
  }

  function rememberCells(instant = false) {
    const now = performance.now();
    for (let i = 0; i < model.cells.length; i++) {
      if (model.cells[i] !== previousCells[i]) births[i] = instant || paused || motion.matches ? now - 400 : now;
    }
    previousCells = Array.from(model.cells);
    animateUntil = instant || paused || motion.matches ? 0 : now + 400;
    updateStatus();
  }

  function gridDimensions() {
    return {
      columns: Math.max(4, Math.min(64, Math.floor((width - 32) / scale))),
      rows: Math.max(4, Math.min(44, Math.floor((height - 100) / scale))),
    };
  }

  function fitGrid() {
    cellSize = Math.min(scale, (width - 32) / model.width, (height - 100) / model.height);
    cellSize = Math.max(1, cellSize);
    originX = (width - model.width * cellSize) / 2;
    originY = (height - model.height * cellSize) / 2;
  }

  function createGrid(preserve = false) {
    const { columns, rows } = gridDimensions();
    const previous = model;
    model = new ChromaticModel(columns, rows, edition);
    if (preserve && previous) {
      let merged = false;
      for (const [index, color] of previous.pins) {
        const x = Math.min(columns - 1, Math.floor(((index % previous.width) + 0.5) / previous.width * columns));
        const y = Math.min(rows - 1, Math.floor((Math.floor(index / previous.width) + 0.5) / previous.height * rows));
        if (model.pins.has(x + y * columns) || !model.setSeed(x, y, color)) merged = true;
      }
      if (merged) notice.show('Some seeds merged at this cell scale.');
      const target = Math.floor(previous.filled / previous.cells.length * model.cells.length);
      for (let batch = 0; batch < 8 && model.filled < target; batch++) {
        if (!model.step(Math.min(512, target - model.filled))) break;
      }
    } else model.compose();
    cursor = null;
    births = new Array(model.cells.length).fill(-1000);
    previousCells = [];
    fitGrid();
    rememberCells(true);
    lastGrowth = performance.now();
    draw(performance.now());
    wake();
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { columns, rows } = gridDimensions();
    if (!model) createGrid();
    // Resize events are debounced; only a changed grid capacity needs a new solve.
    else if (columns !== model.width || rows !== model.height) createGrid(true);
    else {
      fitGrid();
      draw(performance.now());
      wake();
    }
  }

  function tile(x, y, color, size, index, now, settled) {
    const age = settled || paused || motion.matches ? 1 : Math.min(1, Math.max(0, (now - births[index]) / 340));
    const ease = 1 - (1 - age) ** 3;
    const inset = (1 - ease) * size * 0.38;
    const side = size - inset * 2;
    ctx.save();
    ctx.translate(x + inset, y + inset);
    ctx.globalAlpha = 0.35 + 0.65 * ease;
    ctx.fillStyle = COLORS[color].hex;
    ctx.fillRect(0, 0, side, side);
    if (inlays && side > 8) {
      const column = index % model.width;
      const row = Math.floor(index / model.width);
      const motif = (column + row * 3 + Math.floor(column / 4) + edition) % 8;
      const variant = (Math.floor(column / 3) + Math.floor(row / 3)) % 4;
      ctx.translate(side / 2, side / 2);
      ctx.rotate(variant * Math.PI / 2);
      ctx.translate(-side / 2, -side / 2);
      ctx.beginPath();
      ctx.rect(0, 0, side, side);
      ctx.clip();
      const accents = ALLOWED[color].filter((t) => t !== color);
      ctx.fillStyle = COLORS[accents[(Math.floor(column / 4) + Math.floor(row / 4)) % accents.length]].hex;
      ctx.strokeStyle = color === 0 || color === 2 || color === 5 ? '#293d35' : '#f0eee3';
      ctx.lineWidth = Math.max(0.7, side / 40);
      if (motif < 3) {
        ctx.globalAlpha *= 0.85;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, side * (motif === 0 ? 1 : 0.7), 0, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        ctx.arc(0, 0, side * 0.4, 0, Math.PI / 2);
        ctx.stroke();
      } else if (motif === 3 || motif === 4) {
        ctx.globalAlpha *= 0.35;
        for (let line = 0; line < 3; line++) {
          const at = side * (0.3 + line * 0.16);
          ctx.beginPath();
          ctx.moveTo(at, side * 0.14);
          ctx.lineTo(at, side * 0.86);
          ctx.stroke();
        }
      } else if (motif === 5) {
        ctx.globalAlpha *= 0.65;
        ctx.fillRect(side * 0.34, side * 0.34, side * 0.32, side * 0.32);
      }
    }
    ctx.restore();
  }

  function draw(now, settled = false, showCursor = true) {
    if (!model) return;
    ctx.fillStyle = '#181c1b';
    ctx.fillRect(0, 0, width, height);
    const gap = Math.max(1.5, cellSize * 0.065);
    const size = cellSize - gap;
    for (let i = 0; i < model.cells.length; i++) {
      const x = originX + (i % model.width) * cellSize + gap / 2;
      const y = originY + Math.floor(i / model.width) * cellSize + gap / 2;
      const color = model.cells[i];
      if (color >= 0) tile(x, y, color, size, i, now, settled);
      else {
        const touching = model.neighbors(i).some((j) => model.cells[j] >= 0);
        ctx.fillStyle = touching ? '#252d28' : '#1c221e';
        ctx.fillRect(x, y, size, size);
        if (touching) {
          const options = model.solver.wave[i];
          let offset = 0;
          for (let colorIndex = 0; colorIndex < options.length; colorIndex++) {
            if (!options[colorIndex]) continue;
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = COLORS[colorIndex].hex;
            ctx.fillRect(x + size * 0.2 + offset * size * 0.11, y + size * 0.48, Math.max(1, size * 0.065), Math.max(1, size * 0.065));
            offset++;
          }
          ctx.globalAlpha = 1;
        }
      }
    }
    if (cursor && showCursor) {
      const x = originX + cursor.x * cellSize;
      const y = originY + cursor.y * cellSize;
      ctx.strokeStyle = '#f0eee3';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 1, y - 1, cellSize + 2, cellSize + 2);
      ctx.fillStyle = COLORS[selectedColor].hex;
      ctx.fillRect(x + cellSize - 7, y + 2, 5, 5);
    }
  }

  function grow(count = 1) {
    model.step(count);
    if (model.recovered) {
      paused = true;
      notice.show('The field returned to its seeds after a conflict.');
    }
    rememberCells();
  }

  function frame(now) {
    animation = 0;
    if (document.hidden) return;
    if (!paused && model.pins.size && model.filled < model.cells.length && now - lastGrowth >= 1000 / tempo) {
      const count = Math.min(4, Math.floor((now - lastGrowth) / (1000 / tempo)));
      grow(count);
      lastGrowth = now;
    }
    draw(now);
    if ((!paused && model.pins.size && model.filled < model.cells.length) || now < animateUntil) wake();
  }

  function wake() {
    if (!animation && !document.hidden) animation = window.requestAnimationFrame(frame);
  }

  function setPaused(value) {
    paused = value;
    animateUntil = 0;
    lastGrowth = performance.now();
    updateStatus();
    draw(performance.now(), paused);
    wake();
  }

  function plant(x, y) {
    if (!model.setSeed(x, y, selectedColor)) {
      notice.show('That seed conflicts with a neighboring seed.');
      return;
    }
    notice.clear();
    births = new Array(model.cells.length).fill(-1000);
    previousCells = [];
    rememberCells(true);
    lastGrowth = performance.now();
    draw(performance.now());
    wake();
  }

  function pointAt(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - bounds.left) * width / bounds.width - originX) / cellSize);
    const y = Math.floor(((event.clientY - bounds.top) * height / bounds.height - originY) / cellSize);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= model.width || y >= model.height) return null;
    return { x, y };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    cursor = pointAt(event);
    if (!cursor) return;
    keyboardFocus = false;
    canvas.focus({ preventScroll: true });
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    lastPaint = cursor.x + cursor.y * model.width;
    lastSeedAt = performance.now();
    plant(cursor.x, cursor.y);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!event.isPrimary) return;
    cursor = pointAt(event);
    $('position').textContent = cursor ? `${String(cursor.x + 1).padStart(2, '0')} : ${String(cursor.y + 1).padStart(2, '0')}` : 'CHROMATIC FIELD';
    if (cursor && event.pointerId === pointerId) {
      const index = cursor.x + cursor.y * model.width;
      if (index !== lastPaint && performance.now() - lastSeedAt > 90) {
        lastPaint = index;
        lastSeedAt = performance.now();
        plant(cursor.x, cursor.y);
      }
    }
    wake();
  });
  function release(event) {
    if (event.pointerId !== pointerId) return;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerId = null;
    lastPaint = -1;
    if (event.pointerType !== 'mouse') cursor = null;
    wake();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', () => { pointerId = null; lastPaint = -1; });
  canvas.addEventListener('pointerleave', () => {
    if (pointerId === null && !keyboardFocus) cursor = null;
    $('position').textContent = 'CHROMATIC FIELD';
    wake();
  });
  canvas.addEventListener('focus', () => {
    if (canvas.matches(':focus-visible')) {
      keyboardFocus = true;
      cursor = { x: Math.floor(model.width / 2), y: Math.floor(model.height / 2) };
      wake();
    }
  });
  canvas.addEventListener('blur', () => { keyboardFocus = false; cursor = null; wake(); });

  $('play').addEventListener('click', () => setPaused(!paused));
  $('step').addEventListener('click', () => {
    setPaused(true);
    if (!model.pins.size) plant(Math.floor(model.width / 2), Math.floor(model.height / 2));
    grow(1);
    draw(performance.now(), true);
  });
  $('new').addEventListener('click', () => {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    edition = value[0] % 1000;
    notice.clear();
    createGrid();
  });
  $('reset').addEventListener('click', () => { notice.clear(); createGrid(); });
  $('clear').addEventListener('click', () => {
    model.clear();
    setPaused(true);
    rememberCells(true);
    notice.clear();
    draw(performance.now());
  });
  $('scale').addEventListener('input', () => {
    scale = Number($('scale').value);
    $('scale-value').textContent = `${scale} px`;
  });
  $('scale').addEventListener('change', () => createGrid(true));
  $('tempo').addEventListener('input', () => {
    tempo = Number($('tempo').value);
    $('tempo-value').textContent = `${tempo} / s`;
    wake();
  });
  $('inlays').addEventListener('change', () => { inlays = $('inlays').checked; draw(performance.now()); });
  for (const input of document.querySelectorAll('input[name="color"]')) {
    input.addEventListener('change', () => {
      selectedColor = Number(input.value);
      $('color-name').textContent = COLORS[selectedColor].name;
      wake();
    });
  }
  $('save').addEventListener('click', async () => {
    if (saveInProgress) return;
    saveInProgress = true;
    $('save').disabled = true;
    try {
      draw(performance.now(), true, false);
      await downloadCanvas(canvas, {
        filename: `chromatic-cells-${String(edition).padStart(3, '0')}.png`,
        caption: `Chromatic Cells / 08 / ${String(edition).padStart(3, '0')}`,
        color: '#a0aaa2', left: 24 * dpr, bottom: 18 * dpr,
      });
    } catch {
      notice.show('The image could not be saved.');
    } finally {
      $('save').disabled = false;
      saveInProgress = false;
      draw(performance.now());
      wake();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || panel.element.open) return;
    if (event.target !== canvas && event.target !== document.body) return;
    if (event.key.startsWith('Arrow') && event.target === canvas) {
      event.preventDefault();
      keyboardFocus = true;
      cursor ||= { x: Math.floor(model.width / 2), y: Math.floor(model.height / 2) };
      if (event.key === 'ArrowLeft') cursor.x = Math.max(0, cursor.x - 1);
      if (event.key === 'ArrowRight') cursor.x = Math.min(model.width - 1, cursor.x + 1);
      if (event.key === 'ArrowUp') cursor.y = Math.max(0, cursor.y - 1);
      if (event.key === 'ArrowDown') cursor.y = Math.min(model.height - 1, cursor.y + 1);
      $('position').textContent = `${String(cursor.x + 1).padStart(2, '0')} : ${String(cursor.y + 1).padStart(2, '0')}`;
      wake();
    } else if (event.key === 'Enter' && event.target === canvas && cursor) {
      event.preventDefault();
      plant(cursor.x, cursor.y);
    } else if (event.key === ' ') { event.preventDefault(); setPaused(!paused); }
    else if (event.key === '.') { event.preventDefault(); $('step').click(); }
    else if (event.key.toLowerCase() === 'r') $('reset').click();
    else if (event.key.toLowerCase() === 'n') $('new').click();
    else if (event.key.toLowerCase() === 'c') $('clear').click();
  });
  motion.addEventListener('change', () => { if (motion.matches) setPaused(true); });
  document.addEventListener('visibilitychange', () => { lastGrowth = performance.now(); if (!document.hidden) wake(); });
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 80);
  });
  observer.observe(stage);
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 80);
  });
  resize();
  updateStatus();
}, { once: true });
