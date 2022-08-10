/** Original source from:
  * @url https://repl.it/repls/ButteryWirelessDatabases#script.js
  * @date 2020-09-12
  */

(function () { var script = document.createElement('script'); script.onload = function () { var stats = new Stats(); document.body.appendChild(stats.dom); requestAnimationFrame(function loop() { stats.update(); requestAnimationFrame(loop) }); }; script.src = '//mrdoob.github.io/stats.js/build/stats.min.js'; document.head.appendChild(script); })()

class Options {
  constructor({
    verbose = false,
    fps = 1000 / 60,
    boxSize = 20,
    dotSize = 2,
    rows = -1,
    columns = -1,
    waves = [],
    gridMap = {},
    radians = _.chain().range(360).map(i => 1 + i / 360 * 2 * Math.PI).value(),
  } = {}) {
    this.verbose = verbose;
    this.fps = fps;
    this.boxSize = boxSize;
    this.dotSize = dotSize;
    this.rows = rows;
    this.columns = columns;
    this.waves = waves;
    this.gridMap = gridMap;
    this.radians = radians;
  }
  format() {
    const object = this.verbose ? this : {
      ...this,
      waves: this.waves.length,
      gridMap: _.keys(this.gridMap),
      radians: this.radians.length,
    };
    return JSON.stringify(object, null, 2);
  }
}

class Wave {
  constructor({ x, y, maxRadius = 3, speed = 1, color = 'white' } = {}) {
    this.id = uuidv4();
    this.i = 0;
    this.x = x;
    this.y = y;
    this.r = 0;
    this.maxRadius = maxRadius;
    this.speed = speed;
    this.color = color;
  }
  update() {
    const { gridMap, radians } = window.options;
    this.r = (this.i + _.sum(radians.slice(0, this.i))) / _.sum(radians.slice(0, 180)) * this.maxRadius;
    gridMap[this.id] = _.chain().range(360).map(d => ({
      sin: Math.sin(d / 360 * 2 * Math.PI),
      cos: Math.cos(d / 360 * 2 * Math.PI),
    })).map(({ sin, cos }) => ({
      x: _.toInteger(this.x + this.r * cos),
      y: _.toInteger(this.y + this.r * sin),
      r: Math.sin(this.i / 360 * 2 * Math.PI),
      color: this.color,
    })).uniqBy(JSON.stringify).value();

    this.i += this.speed;
  }
}

((() => {
  window.options = new Options();

  const resize = () => {
    const { boxSize } = window.options;
    let [width, height] = [$(window).width(), $(window).height()];
    width -= width % boxSize;
    height -= height % boxSize;
    $('#canvas').attr({ width, height });
    console.log('[Window Resized]', { width, height })
    window.options.rows = _.toInteger(height / boxSize);
    window.options.columns = _.toInteger(width / boxSize);
  };

  $(window).on('load', e => {
    resize();

    const canvas = document.getElementById('canvas');

    setTimeout(update = (i = 0) => {
      const width = $(canvas).width();
      const height = $(canvas).height();

      const { fps } = window.options;
      const { boxSize, dotSize } = window.options;
      const { rows, columns } = window.options;
      const { waves, gridMap } = window.options;

      const context = canvas.getContext('2d');

      context.clearRect(0, 0, width, height);
      context.fillStyle = '#111';
      context.fillRect(0, 0, width, height);

      const pointMap = {};
      _.chain(gridMap).keys().map(k => gridMap[k]).flatMap().forEach(({ x, y, r, color }) => {
        const key = JSON.stringify({ x, y });
        pointMap[key] = { r: pointMap[key] ? Math.max(pointMap[key].r, r) : r, color };
      }).value();

      context.fillStyle = 'white';
      for (let y = 0; y < rows; ++y) {
        for (let x = 0; x < columns; ++x) {
          const cx = _.toInteger(x * boxSize + boxSize / 2);
          const cy = _.toInteger(y * boxSize + boxSize / 2);
          const key = JSON.stringify({ x, y });
          context.beginPath();
          if (pointMap[key]) {
            const { r, color } = pointMap[key];
            context.fillStyle = color;
            context.arc(cx, cy, dotSize + r * boxSize / 4, 0, 2 * Math.PI);
          } else {
            context.fillStyle = '#333';
            context.arc(cx, cy, dotSize, 0, 2 * Math.PI);
          }
          context.fill();
          context.closePath();
        }
      }

      waves.forEach((wave, i) => {
        wave.update();
        if (wave.i > 180) {
          delete gridMap[wave.id];
          waves.splice(i, 1);
        }
      });

      $('#panel pre').text(window.options.format());

      setTimeout(update, fps, (i + 1) % Math.min(width, height));
    });

    setInterval(() => {
      const { waves, rows, columns } = window.options;
      waves.push(new Wave({
        x: _.random(columns),
        y: _.random(rows),
        maxRadius: _.random(3, Math.min(rows, columns) / 2),
        speed: _.random(3, 10),
      }));
    }, window.options.fps * 60);
  }).on('resize', resize).on('click', e => {
    const { waves, boxSize } = window.options;
    waves.push(new Wave({
      x: _.toInteger(e.clientX / boxSize),
      y: _.toInteger(e.clientY / boxSize),
      maxRadius: 10,
      speed: 30,
      color: '#f7f',
    }));
  }).on('mousemove', _.throttle(e => {
    const { waves, boxSize } = window.options;
    waves.push(new Wave({
      x: _.toInteger(e.clientX / boxSize),
      y: _.toInteger(e.clientY / boxSize),
      speed: 20,
      color: '#37f'
    }));
  }, window.options.fps)).on('touchmove', _.throttle(e => {
    Array.from(e.touches).forEach(e => {
      const { waves, boxSize } = window.options;
      waves.push(new Wave({
        x: _.toInteger(e.clientX / boxSize),
        y: _.toInteger(e.clientY / boxSize),
        speed: 20,
        color: '#37f'
      }));
    });
  }, window.options.fps));
})());
