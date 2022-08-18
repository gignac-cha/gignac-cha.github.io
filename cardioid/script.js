import Canvas from '../modules/canvas.js';

const resize = canvas => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', e => {
  const canvas = new Canvas(document.querySelector('#canvas'));

  resize(canvas);

  const elements = {
    debug: document.querySelector('#debug'),
  };

  const { width, height } = canvas;

  const mouse = {
    move: { x: width / 2, y: height / 2 },
  };

  canvas.addEventListener('mousemove', e => {
    const x = e.clientX;
    const y = e.clientY;
    mouse.move = { x, y };
  });

  const state = {
    factor: 1,
  };

  const getPoint = (degree, x, y, distance) => {
    const radian = degree / 360 * 2 * Math.PI;
    const sine = Math.sin(radian);
    const cosine = Math.cos(radian);
    const dx = cosine * distance;
    const dy = sine * distance;
    return { x: x + dx, y: y + dy };
  };

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    canvas.clear();

    const radius = Math.min(width, height) / 2 - 100;
    const count = Math.max(1, Math.floor(radius - Math.abs(mouse.move.x - width / 2)));
    const delta = -(mouse.move.y - height / 2) / radius;

    canvas.circle(width / 2, height / 2, radius, 'white').stroke();
    for (let i = 0; i < count; ++i) {
      const p1 = getPoint(360 / count * i, width / 2, height / 2, radius);
      const j = Math.floor((i * state.factor) % count);
      const p2 = getPoint(360 / count * j, width / 2, height / 2, radius);
      canvas.line(p1, p2, 'white').stroke();
      canvas.circle(p1.x, p1.y, 5, 'white').stroke();
    }

    state.factor = Math.max(1, state.factor + delta);

    elements.debug.textContent = `count: ${count}\nfactor: ${state.factor.toFixed(2)}\ndelta: ${delta.toFixed(2)}`;
  });
});
window.addEventListener('resize', e => {
  resize();
});
