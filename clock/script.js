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

class Canvas {
  constructor(canvas) {
    this.canvas = canvas;
  }
  get width() {
    return $(this.canvas).width();
  }
  get height() {
    return $(this.canvas).height();
  }
  get context() {
    return this.canvas.getContext('2d');
  }
  clear() {
    this.context.clearRect(0, 0, this.width, this.height);
  }
  dot(x, y, color) {
    this.rectangle(x, y, 1, 1, color);
  }
  line(x1, y1, x2, y2, color, width = 1) {
    const { context } = this;
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = width;
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    context.closePath();
  }
  rectangle(x, y, width, height, color, fill = true) {
    const { context } = this;
    context.beginPath();
    if (fill) {
      context.fillStyle = color;
    } else {
      context.strokeStyle = color;
    }
    context.rect(x, y, width, height);
    if (fill) {
      context.fill();
    } else {
      context.stroke();
    }
    context.closePath();
  }
  circle(x, y, r, color, fill = true) {
    const { context } = this;
    context.beginPath();
    if (fill) {
      context.fillStyle = color;
    } else {
      context.strokeStyle = color;
    }
    context.arc(x, y, r, 0, 2 * Math.PI);
    if (fill) {
      context.fill();
    } else {
      context.stroke();
    }
    context.closePath();
  }
  text(x, y, text, color, font, fill = true) {
    const { context } = this;
    context.beginPath();
    if (fill) {
      context.fillStyle = color;
    } else {
      context.strokeStyle = color;
    }
    context.font = '24px Fira Code';
    if (fill) {
      context.fillText(text, x, y);
    } else {
      context.strokeText(text, x, y);
    }
    context.closePath();
  }
}

$(window).on('load', e => {
  resize();

  // const canvas = document.getElementById('canvas');
  const canvas = new Canvas(document.getElementById('canvas'));

  requestAnimationFrame(update = () => {
    requestAnimationFrame(update);

    const { width, height } = $(window).shape();
    canvas.clear();

    const radius = (Math.min(width, height) - 20) / 2;
    const cx = width / 2;
    const cy = height / 2;

    canvas.circle(cx, cy, radius, 'white', false);

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const ms = now.getMilliseconds();

    // hour
    canvas.line(
      cx, cy,
      cx + (radius / 2) * Math.cos((hour % 12) / 12 * 2 * Math.PI - Math.PI / 2),
      cy + (radius / 2) * Math.sin((hour % 12) / 12 * 2 * Math.PI - Math.PI / 2),
      'white', 10
    );

    // minute
    canvas.line(
      cx, cy,
      cx + (radius / 4 * 3) * Math.cos(minute / 60 * 2 * Math.PI - Math.PI / 2),
      cy + (radius / 4 * 3) * Math.sin(minute / 60 * 2 * Math.PI - Math.PI / 2),
      'white', 5
    );

    // second
    canvas.line(
      cx, cy,
      cx + (radius - 10) * Math.cos(second / 60 * 2 * Math.PI - Math.PI / 2),
      cy + (radius - 10) * Math.sin(second / 60 * 2 * Math.PI - Math.PI / 2),
      'white', 1
    );

    // second with millisecond
    canvas.line(
      cx, cy,
      cx + (radius - 10) * Math.cos((second + ms / 10 ** 3) / 60 * 2 * Math.PI - Math.PI / 2),
      cy + (radius - 10) * Math.sin((second + ms / 10 ** 3) / 60 * 2 * Math.PI - Math.PI / 2),
      'gray', 1
    );

    canvas.text(10, height - 10, `${hour}:${minute}:${second}`, 'white', '24px Fira Code');
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
