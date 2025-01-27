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

  const getRandomColor = () => [random(0x100), random(0x100), random(0x100)];
  // const throttle =
  //   (n, i = 0) =>
  //   () =>
  //     ++i % n === 0;

  // const radius = 10;
  // const size = radius * 2;
  // const waves = [];

  // const createWave = (x, y, r, speed, color) => {
  //   const wave = { i: 0, x, y, r, speed, color };
  //   wave.maximum = (speed * (speed + 1)) / 2;
  //   return wave;
  // };

  // canvas.addEventListener('click', (e) => {
  //   const x = Math.floor(e.clientX / size);
  //   const y = Math.floor(e.clientY / size);
  //   waves.push(createWave(x, y, 10, 10, [0xff, 0xff, 0xff]));
  // });
  // const mouseMoveTrigger = throttle(50);
  // canvas.addEventListener('mousemove', (e) => {
  //   if (mouseMoveTrigger()) {
  //     const x = Math.floor(e.clientX / size);
  //     const y = Math.floor(e.clientY / size);
  //     waves.push(createWave(x, y, 5, 10, [0xbf, 0xbf, 0xbf]));
  //   }
  // });
  // canvas.addEventListener('touchmove', (e) => {
  //   if (mouseMoveTrigger()) {
  //     for (const touch of e.touches) {
  //       const x = Math.floor(touch.clientX / size);
  //       const y = Math.floor(touch.clientY / size);
  //       waves.push(createWave(x, y, 5, 10, [0xbf, 0xbf, 0xbf]));
  //       break;
  //     }
  //   }
  // });

  // requestAnimationFrame(function update() {
  //   requestAnimationFrame(update);

  //   const { width, height } = canvas;
  //   const w = Math.floor(width / size + 1);
  //   const h = Math.floor(height / size + 1);

  //   canvas.clear();

  //   for (let j = 0; j < h; ++j) {
  //     for (let i = 0; i < w; ++i) {
  //       const x = size * i + radius;
  //       const y = size * j + radius;
  //       canvas.circle(x, y, 1, 'gray').fill();
  //     }
  //   }

  //   const waveMap = range(w * h, 0);
  //   const waveColorMap = range(w * h);

  //   for (const wave of waves) {
  //     wave.i += wave.speed;
  //     wave.speed--;
  //     for (let i = 0; i < 360; ++i) {
  //       const r = (i / 360) * 2 * Math.PI;
  //       const sin = Math.sin(r);
  //       const cos = Math.cos(r);
  //       for (let j = -0.2; j <= 0.2; j += 0.1) {
  //         const x = wave.x + Math.floor(cos * ((wave.r * wave.i) / wave.maximum + j));
  //         const y = wave.y + Math.floor(sin * ((wave.r * wave.i) / wave.maximum + j));
  //         if (0 <= x && x < w && 0 <= y && y < h) {
  //           const k = y * w + x;
  //           waveMap[k] += wave.speed / wave.maximum;
  //           if (waveMap[k] > 0.5) {
  //             waveMap[k] = 0.5;
  //           }
  //           waveColorMap[k] = wave.color;
  //         }
  //       }
  //     }
  //   }
  //   for (let i = waves.length - 1; i >= 0; --i) {
  //     if (waves[i].speed < 0) {
  //       waves.splice(i, 1);
  //     }
  //   }

  //   for (let i = 0; i < waveMap.length; ++i) {
  //     if (waveMap[i] > 0) {
  //       const x = (i % w) * size + radius;
  //       const y = Math.floor(i / w) * size + radius;
  //       const color = `rgba(${waveColorMap[i][0]}, ${waveColorMap[i][1]}, ${waveColorMap[i][2]}, 1)`;
  //       canvas.circle(x, y, radius * waveMap[i], color).fill();
  //     }
  //   }

  //   if (random(100) < 10) {
  //     const wave = createWave(
  //       random(w),
  //       random(h),
  //       random(Math.min(w, h) / 2, Math.min(w, h)),
  //       random(50, 100),
  //       getRandomColor(),
  //     );
  //     waves.push(wave);
  //   }
  // });

  const dots = range(100, () => ({
    x: random(canvas.width),
    y: random(canvas.height),
    color: getRandomColor(),
  }));

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    for (const dot of dots) {
    }
    canvas.circle();
  });
});
window.addEventListener('resize', (e) => {
  resize();
});
