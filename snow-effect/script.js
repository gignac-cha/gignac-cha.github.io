import Canvas from '../modules/canvas.js';

const resize = canvas => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', e => {
  const canvas = new Canvas(document.querySelector('#canvas'));

  resize(canvas);

  const { width, height } = canvas;

  const getRandomReal = n => Math.random() * n;
  const getRandom = n => Math.floor(getRandomReal(n));

  const global = {
    play: true,
    count: Math.floor(width / 10),
    wind: 0,
  };

  const elements = {
    play: document.querySelector('#play'),
    count: document.querySelector('#count'),
    wind: document.querySelector('#wind'),
    debug: document.querySelector('#debug'),
  };

  elements.play.checked = global.play;
  elements.play.addEventListener('change', e => {
    global.play = elements.play.checked;
  });
  elements.count.value = global.count;
  elements.count.max = width;
  elements.count.addEventListener('change', e => {
    global.count = parseInt(elements.count.value);
  });
  elements.wind.value = global.wind;
  elements.wind.addEventListener('change', e => {
    global.wind = parseInt(elements.wind.value);
  });

  const createSnow = () => {
    const snow = {
      i: getRandom(360),
      x: -width * 4 + getRandom(width * 9),
      y: -getRandom(height / 2),
      r: 3 + getRandomReal(5),
      speed: 1 + getRandomReal(5),
    };
    snow.opacity = snow.r / 8;
    return snow;
  };
  const snows = new Array(global.count).fill().map(() => createSnow());

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    if (global.play) {
      canvas.clear();

      for (const snow of snows) {
        const r = snow.i / 360 * 2 * Math.PI;
        const cos = Math.cos(r);
        const x = cos * snow.r * 2;
        canvas.circle(snow.x + x, snow.y, snow.r, `rgba(255, 255, 255, ${snow.opacity})`).fill();
        snow.i++;
        snow.i %= 360;
        snow.x += global.wind / 2;
        snow.y += snow.speed / 2;
      }
      for (let i = snows.length - 1; i >= 0; --i) {
        const snow = snows[i];
        if (snow.x < -width * 4 || snow.x > width + width * 4) {
          snows.splice(i, 1);
        }
        if (snow.y + snow.r > height) {
          snows.splice(i, 1);
        }
      }
      if (snows.length < global.count) {
        snows.push(...new Array(global.count - snows.length).fill().map(() => createSnow()));
      }
    }

    elements.debug.textContent = `Play: ${global.play}\nCount: ${global.count}\nWind: ${global.wind}`;
  });
});
window.addEventListener('resize', e => {
  resize();
});
