import Canvas from '../modules/canvas.js';

const resize = canvas => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', e => {
  const canvas = new Canvas(document.querySelector('#canvas'));

  resize(canvas);

  const { width, height } = canvas;

  const radius = 10;
  const size = radius * 6;
  const w = Math.floor(width / size + 1);
  const h = Math.floor(height / size + 1);

  const mouse = {};

  canvas.addEventListener('mousemove', e => {
    const x = e.clientX;
    const y = e.clientY;
    mouse.move = { x, y };
  });

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    canvas.clear();

    for (let j = 0; j < h; ++j) {
      for (let i = 0; i < w; ++i) {
        const x = size * i + radius;
        const y = size * j + radius;
        if (mouse.move) {
          const dx = (x - mouse.move.x) / width;
          const dy = (y - mouse.move.y) / height;
          const r = radius * ((.25 + Math.abs(dx) * .75) ** .5 + (.25 + Math.abs(dy) * .75) ** .5);
          const cx = x + (size ** 2) * dx * (dy ** 2);
          const cy = y + (size ** 2) * dy * (dx ** 2);
          const d = Math.abs(dx) + Math.abs(dy);
          const blur = r + 1 + size * d;
          const rg = canvas.createRadialGradient(cx, cy, r, cx, cy, blur);
          const c = 0xff - d * 0x7f;
          rg.addColorStop(0, `rgba(${c}, ${c}, ${c}, 1)`);
          rg.addColorStop(.5, `rgba(${c}, ${c}, ${c}, .5)`);
          rg.addColorStop(1, `rgba(${c}, ${c}, ${c}, 0)`);
          canvas.rectangle(cx - blur, cy - blur, blur * 2, blur * 2, rg).fill();
        } else {
          canvas.circle(x, y, radius, 'rgba(255, 255, 255, .1)').fill();
        }
      }
    }
  });
});
window.addEventListener('resize', e => {
  resize();
});