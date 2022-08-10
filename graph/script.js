function resize() {
  const width = $(window).width();
  const height = $(window).height();
  $('#canvas').attr({ width, height });
}

const g = {
  fps: 60,
  graphs: [],
};

$(window).on('load', e => {
  resize();

  const canvas = document.getElementById('canvas');
  requestAnimationFrame(update = t => {
    requestAnimationFrame(update);

    const index = parseInt(t / (1000 / g.fps));

    const context = canvas.getContext('2d');
    const width = $('#canvas').width();
    const height = $('#canvas').height();
    context.clearRect(0, 0, width, height);

    // context.fillStyle = 'white';
    g.graphs.forEach((graph, i) => {
      for (let x = 0; x < (index - graph.i) % (width * 2); x += 1) {
        const px = (x * graph.dx - (index - graph.i) * .1) / 2;
        if (px >= 0) {
          const d = x % 360;
          const r = d / 360 * 2 * Math.PI;
          const sin = Math.sin(r * graph.width);
          const y = sin * graph.size;
          const py = graph.y + y * graph.ratio ** x;
          if (height / 8 * graph.ratio ** x > .5) {
            // context.fillRect(px, py, 1, 1);
            context.beginPath();
            context.fillStyle = graph.color;
            context.arc(px, py, 1, 0, 2 * Math.PI);
            context.fill();
            context.closePath();
          } else if (px < 1) {
            g.graphs = [
              ...g.graphs.slice(0, i),
              ...g.graphs.slice(i + 1),
            ];
          }
        }
      }
    });
    if (g.graphs.length < 50 && parseInt(Math.random() * 10) === 0) {
      const i = index;
      const width = 5 + Math.random() * 10;
      const y = Math.random() * height;
      const dx = 1 + Math.random() * 2;
      const size = height / 16 + Math.random() * height / 8;
      const ratio = .9 + Math.random() * .09;
      const rgb = [
        Math.random() * 256,
        Math.random() * 256,
        Math.random() * 256,
      ].join(', ');
      const color = `rgba(${rgb}, 1)`;
      g.graphs.push({ i, width, y, dx, size, ratio, color });
    }
  });
}).on('resize', e => {
  resize();
}).on('mousemove', e => {
  const x = e.offsetX;
  const y = e.offsetY;
  g.mousemove = { x, y };
});
