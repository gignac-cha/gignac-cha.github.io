import Canvas from '../modules/canvas.js';

const resize = canvas => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', e => {
  const canvas = new Canvas(document.querySelector('#canvas'));

  resize(canvas);

  const { width, height } = canvas;

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

    const x = width / 2;
    const y = height / 2;
    const radius = Math.min(width, height) / 2 - 100;
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const millisecond = now.getMilliseconds();

    const p1 = getPoint(360 / 12 * (hour % 12 + minute / 60 + second / 60 / 60) - 90, x, y, radius / 2);
    canvas.line({ x, y }, p1, 'white', 10).stroke();
    const p2 = getPoint(360 / 60 * (minute + second / 60 + millisecond / 1000 / 60) - 90, x, y, radius / 5 * 4);
    canvas.line({ x, y }, p2, 'white', 5).stroke();
    const p3 = getPoint(360 / 60 * (second) - 90, x, y, radius - 10);
    canvas.line({ x, y }, p3, 'white', 1).stroke();
    const p4 = getPoint(360 / 60 * second - 90 + 360 / 60 / 1000 * millisecond, x, y, radius - 10);
    canvas.line({ x, y }, p4, 'gray', 1).stroke();

    for (let i = 0; i < 60; ++i) {
      if (i % 5 === 0) {
        const p1 = getPoint(360 / 60 * i, x, y, radius - 10);
        const p2 = getPoint(360 / 60 * i, x, y, radius);
        canvas.line(p1, p2, 'white', 5).stroke();
      } else {
        const p1 = getPoint(360 / 60 * i, x, y, radius - 5);
        const p2 = getPoint(360 / 60 * i, x, y, radius);
        canvas.line(p1, p2, 'white', 1).stroke();
      }
    }

    canvas.circle(x, y, radius, 'white').stroke();
    canvas.circle(x, y, radius + 10, 'white', 3).stroke();
    canvas.circle(x, y, 10, 'white').fill();
  });
});
window.addEventListener('resize', e => {
  resize();
});
