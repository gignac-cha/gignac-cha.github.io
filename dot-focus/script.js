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

const g = {
  points: [],
  padding: 20,
};

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

$(window).on('load', e => {
  resize();

  const { width, height } = $(window).shape();
  for (let y = -parseInt(height / g.padding / 2); y < height / g.padding / 2; ++y) {
    for (let x = -parseInt(width / g.padding / 2); x < width / g.padding / 2; ++x) {
      const l = ((x ** 2) + (y ** 2)) ** .5;
      const cos = x / l;
      let r = Math.acos(cos);
      if (y < 0) r = 2 * Math.PI - r;
      const d = r / (2 * Math.PI) * 360;
      const rgba = getRandomRGB();
      g.points.push({ id: null, x, y, r: 2, d, rgba });
    }
  }

  const canvas = document.getElementById('canvas');

  requestAnimationFrame(update = () => {
    requestAnimationFrame(update);

    const { width, height } = $(window).shape();
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);

    // context.fillStyle = 'white';
    // context.strokeStyle = 'white';
    g.points.forEach((point, i) => {
      const x = width / 2 + point.x * g.padding;
      const y = height / 2 + point.y * g.padding;
      const l = 10;
      const r = point.d / 360 * 2 * Math.PI;
      const sin = Math.sin(r);
      const cos = Math.cos(r);
      const dx = cos * l;
      const dy = sin * l;
      const color = getColor(point.rgba);
      context.fillStyle = color;
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - dx, y - dy);
      context.stroke();
      context.closePath();
      context.beginPath();
      let scale = 1 / point.rgba.a ** .5;
      if (scale < 1) scale = 1;
      context.arc(x, y, point.r * scale, 0, 2 * Math.PI);
      context.fill();
      context.closePath();
      // context.beginPath();
      // const l = 5
      // const r = (point.d + 90) / 360 * 2 * Math.PI;
      // const sin = Math.sin(r);
      // const cos = -Math.cos(r);
      // const dx = cos * l;
      // const dy = sin * l;
      // context.moveTo(x + dx, y + dy);
      // context.lineTo(x - dx, y - dy);
      // context.stroke();
      // context.closePath();
      // context.beginPath();
      // context.arc(x + dx, y + dy, point.r, 0, 2 * Math.PI);
      // context.arc(x - dx, y - dy, point.r, 0, 2 * Math.PI);
      // context.fill();
      // context.closePath();
    });
  });
}).on('resize', e => {
  resize();
}).on('mousemove', e => {
  const x = e.clientX;
  const y = e.clientY;
  g.mousemove = { x, y };
  updatePoints(x, y);
}).on('touchmove', e => {
  const touch = Array.from(e.touches).shift();
  const x = touch.clientX;
  const y = touch.clientY;
  g.touchmove = { x, y };
  updatePoints(x, y);
});

function updatePoints(x, y) {
  const { width, height } = $(window).shape();
  g.points.forEach(point => {
    const dx = point.x - (x - width / 2) / g.padding;
    const dy = point.y - (y - height / 2) / g.padding;
    const l = (dx ** 2 + dy ** 2) ** .5;
    const cos = dx / l;
    let r = Math.acos(cos);
    if (dy < 0) r = 2 * Math.PI - r;
    point.d = r / (2 * Math.PI) * 360;
    point.rgba.a = 1 - l / (Math.min(width, height) / 2 / g.padding);
  });
}
