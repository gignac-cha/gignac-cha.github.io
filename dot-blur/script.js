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

  const circle = (context, x, y, r, color) => {
    context.beginPath();
    context.fillStyle = color;
    context.arc(x, y, r, 0, 2 * Math.PI);
    context.fill();
    context.closePath();
  };
  const rectangle = (context, x, y, width, height, color) => {
    context.beginPath();
    context.fillStyle = color;
    context.rect(x, y, width, height);
    context.fill();
    context.closePath();
  };

  const radius = 10;
  const size = radius * 6;
  const w = Math.floor(width / size + 1);
  const h = Math.floor(height / size + 1);

  const mouse = {};

  canvas.addEventListener('mousemove', e => {
    const x = e.clientX;
    const y = e.clientY;
    mouse.move = { x, y };
  });

  requestAnimationFrame(update = () => {
    requestAnimationFrame(update);

    context.clearRect(0, 0, width, height);

    for (let j = 0; j < h; ++j) {
      for (let i = 0; i < w; ++i) {
        const x = size * i + radius;
        const y = size * j + radius;
        if (mouse.move) {
          const dx = (x - mouse.move.x) / width;
          const dy = (y - mouse.move.y) / height;
          const r = radius * ((.25 + Math.abs(dx) * .75) ** .5 + (.25 + Math.abs(dy) * .75) ** .5);
          const cx = x + (size ** 2) * dx * (dy ** 2);
          const cy = y + (size ** 2) * dy * (dx ** 2);
          const d = Math.abs(dx) + Math.abs(dy);
          const blur = r + 1 + size * d;
          const rg = context.createRadialGradient(cx, cy, r, cx, cy, blur);
          const c = 0xff - d * 0x7f;
          rg.addColorStop(0, `rgba(${c}, ${c}, ${c}, 1)`);
          rg.addColorStop(.5, `rgba(${c}, ${c}, ${c}, .5)`);
          rg.addColorStop(1, `rgba(${c}, ${c}, ${c}, 0)`);
          rectangle(context, cx - blur, cy - blur, blur * 2, blur * 2, rg);
        } else {
          circle(context, x, y, radius, 'rgba(255, 255, 255, .1)');
        }
      }
    }
  });
});
window.addEventListener('resize', e => {
  resize();
});
