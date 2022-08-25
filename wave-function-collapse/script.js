import Canvas from '../modules/canvas.js';
import { random } from '../modules/random.js';
import { range } from '../modules/range.js';
import FPS from '../modules/fps.js';

const canvas = new Canvas();

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', e => {
  canvas.element = document.querySelector('#canvas');

  const fps = new FPS();
  fps.element.classList.add('fps');
  document.body.appendChild(fps.element);

  resize();

  const size = 1;
  const directions = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  const directionsExtended = [
    ...directions,
    [-1, -1], [-1, 1], [1, -1], [1, 1],
    [-2, 0], [0, -2], [2, 0], [0, 2],
    [-3, 0], [0, -3], [3, 0], [0, 3],
  ];

  const getRandomColor = () => [random(0x100), random(0x100), random(0x100)];
  const getRGBFromColor = color => {
    const r = (color >> 0x10) & 0xff;
    const g = (color >> 0x08) & 0xff;
    const b = (color >> 0x00) & 0xff;
    return [r, g, b];
  };
  const getColorFromRGB = (r, g, b) => (r << 0x10) | (g << 0x08) | (b << 0x00);

  const map = range(canvas.width * canvas.height, -1);
  const superpositions = range(canvas.width * canvas.height, null);

  const constraints = {
    recalculate: (x1, y1, x2, y2) => {
      const key1 = y1 * Math.floor(canvas.width / size) + x1;
      const key2 = y2 * Math.floor(canvas.width / size) + x2;
      if (!superpositions[key2]) {
        superpositions[key2] = {
          minimum: 0xffffff,
          maximum: 0x000000,
        };
      }
      const [r1, g1, b1] = getRGBFromColor(map[key1]);
      const [r2, g2, b2] = getRGBFromColor(superpositions[key2].minimum);
      const r3 = Math.min(r2, Math.max(r1 - 0x04, 0x00));
      const g3 = Math.min(g2, Math.max(g1 - 0x04, 0x00));
      const b3 = Math.min(b2, Math.max(b1 - 0x04, 0x00));
      superpositions[key2].minimum = getColorFromRGB(r3, g3, b3);
      const [r4, g4, b4] = getRGBFromColor(superpositions[key2].maximum);
      const r5 = Math.max(r4, Math.min(r1 + 0x04, 0xff));
      const g5 = Math.max(g4, Math.min(g1 + 0x04, 0xff));
      const b5 = Math.max(b4, Math.min(b1 + 0x04, 0xff));
      superpositions[key2].maximum = getColorFromRGB(r5, g5, b5);
    },
  };
  const propagate = (x1, y1) => {
    for (const [dx, dy] of directionsExtended) {
      const x2 = x1 + dx;
      const y2 = y1 + dy;
      if (0 <= x2 && x2 < canvas.width / size && 0 <= y2 && y2 < canvas.height / size) {
        constraints.recalculate(x1, y1, x2, y2);
      }
    }
  };
  const collapse = (x, y) => {
    const key = y * Math.floor(canvas.width / size) + x;
    if (superpositions[key]) {
      const [r1, g1, b1] = getRGBFromColor(superpositions[key].minimum);
      const [r2, g2, b2] = getRGBFromColor(superpositions[key].maximum);
      const r = random(r1, r2);
      const g = random(g1, g2);
      const b = random(b1, b2);
      map[key] = getColorFromRGB(r, g, b);
    } else {
      map[key] = getColorFromRGB(...getRandomColor());
    }
    propagate(x, y);
  };

  const queue = [];
  const state = { clickCount: 0 };

  canvas.addEventListener('click', e => {
    const x = Math.floor(e.clientX / size);
    const y = Math.floor(e.clientY / size);
    const key = y * Math.floor(canvas.width / size) + x;
    if (map[key] < 0) {
      queue.unshift([x, y]);
      state.clickCount++;
    }
  });

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    const { width, height } = canvas;

    canvas.clear();

    for (let i = 0; i < 1000; ++i) {
      if (queue.length > 0) {
        const [x1, y1] = queue.shift();
        const key1 = y1 * Math.floor(width / size) + x1;
        if (map[key1] < 0) {
          collapse(x1, y1);
          for (const [dx, dy] of directions) {
            const x2 = x1 + dx;
            const y2 = y1 + dy;
            if (0 <= x2 && x2 < width / size && 0 <= y2 && y2 < height / size) {
              const key2 = y2 * Math.floor(width / size) + x2;
              if (map[key2] < 0) {
                queue.splice(random(queue.length), 0, [x2, y2]);
              }
            }
          }
        }
      }
    }

    canvas.setImageData(data => {
      for (let i = 0; i < map.length; ++i) {
        if (map[i] >= 0) {
          const x1 = i % Math.floor(width / size) * size;
          const y1 = Math.floor(i / (width / size)) * size;
          const [r, g, b] = getRGBFromColor(map[i]);
          for (let dy = 0; dy < size; ++dy) {
            const y2 = (y1 + dy) * width * 4;
            for (let dx = 0; dx < size; ++dx) {
              const x2 = (x1 + dx) * 4;
              data[y2 + x2 + 0] = r;
              data[y2 + x2 + 1] = g;
              data[y2 + x2 + 2] = b;
              data[y2 + x2 + 3] = 0xff;
            }
          }
        }
      }
    });
  });
});
window.addEventListener('resize', e => {
  resize();
});
