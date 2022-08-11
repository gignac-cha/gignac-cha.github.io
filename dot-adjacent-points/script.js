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
  finished: -1,
  connectionCount: 10,
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
  for (let i = 0; i < 1000; ++i) {
    // const x = Math.random() * width;
    // const y = Math.random() * height;
    const d = Math.random() * 360;
    const r = d / 360 * 2 * Math.PI;
    const sin = Math.sin(r);
    const cos = Math.cos(r);
    const l = Math.tan(Math.random()) * (width ** 2 + height ** 2) ** .5 / 4;
    const x = width / 2 + cos * l;
    const y = height / 2 + sin * l;
    const rgba = getRandomRGB();
    g.points.push({ i, x, y, rgba });
  }

  const canvas = document.getElementById('canvas');

  requestAnimationFrame(update = () => {
    requestAnimationFrame(update);

    const { width, height } = $(window).shape();
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);

    context.fillStyle = 'black';
    context.strokeStyle = 'white';
    // for (let i = 0; i < g.points.length; ++i) {
    //   const point = g.points[i];
    //   context.beginPath();
    //   context.arc(point.x, point.y, 2, 0, 2 * Math.PI);
    //   context.fill();
    //   context.stroke();
    //   context.closePath();
    //   if (!point.painted) {
    //     point.painted = true;
    //     break;
    //   }
    // }
    for (let point of g.points) {
      context.beginPath();
      context.arc(point.x, point.y, 2, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
      context.closePath();
      if (!point.painted) {
        point.painted = true;
        break;
      }
    }
    context.strokeStyle = 'rgba(255, 255, 255, .2)';
    // g.points.forEach(point => point.connected = false);
    const filtered = g.points.filter(point => point.painted);
    filtered.forEach(point => {
      const { i, x, y } = point;
      // const notConnected = filtered.filter(p => p.i !== i && !p.connected);
      // const sorted = Array.from(notConnected)
      const sorted = Array.from(filtered.filter(p => p.i !== i))
        .sort((p1, p2) => {
          const d1 = (p1.x - x) ** 2 + (p1.y - y) ** 2;
          const d2 = (p2.x - x) ** 2 + (p2.y - y) ** 2;
          return d1 - d2;
        });
      const ps = sorted.slice(0, g.connectionCount);
      ps.forEach(p => {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(p.x, p.y);
        context.stroke();
        context.closePath();
      });
      // point.connected = true;
      // filtered.filter(p => p.i !== i).forEach(p => {
      //   context.beginPath();
      //   context.moveTo(x, y);
      //   context.lineTo(p.x, p.y);
      //   context.stroke();
      //   context.closePath();
      // });
    });
  });
}).on('resize', e => {
  resize();
  // }).on('mousemove', e => {
  //   const x = e.clientX;
  //   const y = e.clientY;
  //   g.mousemove = { x, y };
  //   updatePoints(x, y);
  // }).on('touchmove', e => {
  //   const touch = Array.from(e.touches).shift();
  //   const x = touch.clientX;
  //   const y = touch.clientY;
  //   g.touchmove = { x, y };
  //   updatePoints(x, y);
});
