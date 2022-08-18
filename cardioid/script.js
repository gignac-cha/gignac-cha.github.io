(function () { var script = document.createElement('script'); script.onload = function () { var stats = new Stats(); document.body.appendChild(stats.dom); requestAnimationFrame(function loop() { stats.update(); requestAnimationFrame(loop) }); }; script.src = '//mrdoob.github.io/stats.js/build/stats.min.js'; document.head.appendChild(script); })()

$.fn.extend({
  shape: function (width, height) {
    if (typeof width === 'number' && typeof height === 'number') {
      return this.attr({ width, height });
    } else {
      const width = this.width();
      const height = this.height();
      return { width, height };
    }
  },
});

function resize() {
  const { width, height } = $(window).shape();
  $('#canvas').shape(width, height);
}

function getColor(rgba) {
  const { r, g, b, a } = rgba;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function getRandomRGB() {
  const r = Math.random() * 256;
  const g = Math.random() * 256;
  const b = Math.random() * 256;
  return { r, g, b, a: 1 };
}
function getRandomColor() {
  return getColor(getRandomRGB());
}

const g = {
  count: 0,
  points: [],
  factor: 0,
  delta: 0,
};

$(window).on('load', e => {
  resize();

  const canvas = document.getElementById('canvas');

  requestAnimationFrame(update = () => {
    requestAnimationFrame(update);

    const { width, height } = $(window).shape();
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);

    const radius = (Math.min(width, height) - 10) / 2;
    // g.count = parseInt(radius);
    context.strokeStyle = 'white';
    context.beginPath();
    context.arc(width / 2, height / 2, radius, 0, 2 * Math.PI);
    context.stroke();
    context.closePath();
    context.fillStyle = 'white';
    const points = new Array(g.count).fill(0).map((_, i) => {
      const d = i * 360 / g.count;
      const r = d / 360 * 2 * Math.PI;
      const sin = Math.sin(r);
      const cos = Math.cos(r);
      const x = width / 2 + cos * radius;
      const y = height / 2 + sin * radius;
      const rgba = getRandomRGB();
      const point = { i, x, y, rgba };
      return point;
    });
    context.beginPath();
    points.forEach((point, i) => {
      const j = parseInt((i * g.factor) % g.count);
      if (j < points.length) {
        const p = points[j];
        context.moveTo(point.x, point.y);
        context.lineTo(p.x, p.y);
      }
    });
    context.stroke();
    context.closePath();
    points.forEach(point => {
      // g.points.forEach(point => {
      context.beginPath();
      context.arc(point.x, point.y, 3, 0, 2 * Math.PI);
      context.stroke();
      context.closePath();
    });

    g.factor += g.delta;
    if (g.factor < 0) {
      g.factor = 0;
    }
    $('#factor').text(`factor: ${parseFloat(g.factor.toFixed(3))}`);
  });
}).on('resize', e => {
  resize();
}).on('mousemove', e => {
  const x = e.clientX;
  const y = e.clientY;
  const { width, height } = $(window).shape();
  g.count = parseInt(width / 2 - Math.abs(width / 2 - x));
  g.delta = (height / 2 - y) / (height / 2) / 10;
  $('#count').text(`count: ${parseFloat(g.count.toFixed(3))}`);
  $('#delta').text(`delta: ${parseFloat(g.delta.toFixed(3))}`);
}).on('touchmove', e => {
  const touch = Array.from(e.touches).shift();
  const x = touch.clientX;
  const y = touch.clientY;
  const { width, height } = $(window).shape();
  g.count = parseInt(width / 2 - Math.abs(width / 2 - x));
  g.delta = (height / 2 - y) / (height / 2) / 10;
  $('#count').text(`count: ${parseFloat(g.count.toFixed(3))}`);
  $('#delta').text(`delta: ${parseFloat(g.delta.toFixed(3))}`);
});
