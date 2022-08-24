import Canvas from '../modules/canvas.js';
import { random } from '../modules/random.js';
import { range } from '../modules/range.js';

const canvas = new Canvas();

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', e => {
  canvas.element = document.querySelector('#canvas');

  resize();

  const points = [];
  const distances = [];

  const getDistance = (point1, point2) => ((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2) ** .5;

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    const { width, height } = canvas;

    canvas.clear();

    for (let i = 0; i < points.length; ++i) {
      canvas.circle(points[i].x, points[i].y, 2, 'white').fill();
      const targets = distances[i].map((distance, i) => ({ i, distance }));
      targets.sort((a, b) => a.distance - b.distance);
      for (const target of targets.slice(1, 11)) {
        canvas.line(points[i], points[target.i], 'rgba(255, 255, 255, .1)').stroke();
      }
    }

    const point = { x: random(width), y: random(height) };
    distances.push([]);
    for (let i = 0; i < points.length; ++i) {
      const distance = getDistance(points[i], point);
      distances[i].push(distance);
    }
    for (let i = 0; i < points.length; ++i) {
      distances[distances.length - 1].push(distances[i][distances.length - 1]);
    }
    distances[distances.length - 1].push(0);
    points.push(point);
  });
});
window.addEventListener('resize', e => {
  resize();
});
