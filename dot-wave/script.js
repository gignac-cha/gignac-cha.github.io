const resize = () => {
  const canvas = document.querySelector('#canvas');
  canvas.setAttribute('width', window.innerWidth);
  canvas.setAttribute('height', window.innerHeight);
};
window.addEventListener('load', e => {
  resize();

  const canvas = document.querySelector('#canvas');
  const { width, height } = canvas;
  const context = canvas.getContext('2d');

  const getRandomReal = n => Math.random() * n;
  const getRandom = n => Math.floor(getRandomReal(n));
  const getRandomColor = () => [getRandom(0x100), getRandom(0x100), getRandom(0x100)];
  const throttle = (n, i = 0) => () => ++i % n === 0;

  const circle = (context, x, y, r, color) => {
    context.beginPath();
    context.fillStyle = color;
    context.arc(x, y, r, 0, 2 * Math.PI);
    context.fill();
    context.closePath();
  };

  const radius = 10;
  const size = radius * 2;
  const w = Math.floor(width / size + 1);
  const h = Math.floor(height / size + 1);
  const waves = [];

  const createWave = (x, y, r, speed, color) => {
    const wave = { i: 0, x, y, r, speed, color };
    wave.maximum = speed * (speed + 1) / 2;
    return wave;
  };
  const createRandomWave = () => {
    return createWave(getRandom(w), getRandom(h), (Math.min(w, h) / 2 + getRandom(Math.min(w, h))) / 2, 50 + getRandom(50), getRandomColor());
  };

  canvas.addEventListener('click', e => {
    const x = Math.floor(e.clientX / size);
    const y = Math.floor(e.clientY / size);
    waves.push(createWave(x, y, 10, 10, [0xff, 0xff, 0xff]));
  });
  const mouseMoveTrigger = throttle(50);
  canvas.addEventListener('mousemove', e => {
    if (mouseMoveTrigger()) {
      const x = Math.floor(e.clientX / size);
      const y = Math.floor(e.clientY / size);
      waves.push(createWave(x, y, 5, 10, [0xbf, 0xbf, 0xbf]));
    }
  });

  requestAnimationFrame(update = () => {
    requestAnimationFrame(update);

    context.clearRect(0, 0, width, height);

    for (let j = 0; j < h; ++j) {
      for (let i = 0; i < w; ++i) {
        const x = size * i + radius;
        const y = size * j + radius;
        circle(context, x, y, 1, 'gray');
      }
    }

    const waveMap = new Array(w * h).fill(0);
    const waveColorMap = new Array(w * h).fill();

    for (const wave of waves) {
      wave.i += wave.speed;
      wave.speed--;
      for (let i = 0; i < 360; ++i) {
        const r = i / 360 * 2 * Math.PI;
        const sin = Math.sin(r);
        const cos = Math.cos(r);
        for (let j = -.2; j <= .2; j += .1) {
          const x = wave.x + Math.floor(cos * (wave.r * wave.i / wave.maximum + j));
          const y = wave.y + Math.floor(sin * (wave.r * wave.i / wave.maximum + j));
          if (0 <= x && x < w && 0 <= y && y < h) {
            const k = y * w + x;
            waveMap[k] += wave.speed / wave.maximum;
            if (waveMap[k] > .5) {
              waveMap[k] = .5;
            }
            waveColorMap[k] = wave.color;
          }
        }
      }
    }
    for (let i = waves.length - 1; i >= 0; --i) {
      if (waves[i].speed < 0) {
        waves.splice(i, 1);
      }
    }

    for (let i = 0; i < waveMap.length; ++i) {
      if (waveMap[i] > 0) {
        const x = (i % w) * size + radius;
        const y = Math.floor(i / w) * size + radius;
        const color = `rgba(${waveColorMap[i][0]}, ${waveColorMap[i][1]}, ${waveColorMap[i][2]}, 1)`;
        circle(context, x, y, radius * waveMap[i], color);
      }
    }

    if (getRandom(100) < 10) {
      waves.push(createRandomWave());
    }
  });
});
window.addEventListener('resize', e => {
  resize();
});
