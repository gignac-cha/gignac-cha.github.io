import Canvas from '../modules/canvas.js';
import { random } from '../modules/random.js';
import { range } from '../modules/range.js';

const canvas = new Canvas();

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', (e) => {
  canvas.element = document.querySelector('#canvas');

  resize();

  const getRandomColor = () => [random(0x80, 0x100), random(0x80, 0x100), random(0x80, 0x100)];

  const mouse = {};

  canvas.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    mouse.move = { x, y };
  });
  canvas.addEventListener('touchmove', (e) => {
    for (const touch of e.touches) {
      const x = touch.clientX;
      const y = touch.clientY;
      mouse.move = { x, y };
      break;
    }
  });

  const colors = [];

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    const { width, height } = canvas;

    const size = 20;
    const w = Math.floor(width / size + 1);
    const h = Math.floor(height / size + 1);

    while (colors.length < (w + 1) * (h + 1)) {
      colors.push(getRandomColor());
    }

    canvas.clear();

    for (let j = 0; j < h + 1; ++j) {
      for (let i = 0; i < w + 1; ++i) {
        const x = i * size;
        const y = j * size;
        const key = j * w + i;
        const [r, g, b] = colors[key];
        if (mouse.move) {
          const distance = Math.min(width, height) / 2;
          const length = ((mouse.move.x - x) ** 2 + (mouse.move.y - y) ** 2) ** 0.5;
          const ratio = Math.min(1, Math.max(0, distance - length) / length);
          const radius = 2 + (1 - ratio) * 3;
          const color = `rgba(${r}, ${g}, ${b}, ${ratio})`;
          canvas.circle(x, y, radius, color).fill();
          const sin = (mouse.move.y - y) / length;
          const cos = (mouse.move.x - x) / length;
          const point = {
            x: x + cos * Math.min(size / 2, length),
            y: y + sin * Math.min(size / 2, length),
          };
          canvas.line({ x, y }, point, color).stroke();
        }
      }
    }
  });
});
window.addEventListener('resize', (e) => {
  resize();
});
