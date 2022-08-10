/** Original source from:
  * @url https://heftyniceglitches--five-nine.repl.co/
  * @date 2020-10-20
*/

const g = {
  point: { x: 0, y: 0 },
};
const windowResized = e => {
  const canvas = document.getElementById('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', e => {
  windowResized();
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  setTimeout(update = () => {
    const { width, height } = canvas;
    const { point } = g;

    context.clearRect(0, 0, width, height);

    const size = parseInt(width / 20);
    for (let j = parseInt(-height / size); j < height / size; ++j) {
      for (let i = parseInt(-width / size); i < width / size; ++i) {
        const x = size * i + width / 2;
        const y = size * j + height / 2;
        const dx = (x - point.x) / width;
        const dy = (y - point.y) / height;
        const r = size / 4 * (Math.sqrt(.25 + Math.abs(dx) * .75) + Math.sqrt(.25 + Math.abs(dy) * .75));
        const cx = x + (size ** 2) * dx * (dy ** 2);
        const cy = y + (size ** 2) * dy * (dx ** 2);
        const d = Math.abs(dx) + Math.abs(dy);
        const blur = r + 1 + size / 2 * d;
        const rg = context.createRadialGradient(...[cx, cy, r, cx, cy, blur].map(x => parseInt(x)));
        const c = 256 - d * 128;
        rg.addColorStop(0, `rgba(${c}, ${c}, ${c}, 1)`);
        rg.addColorStop(.5, `rgba(${c}, ${c}, ${c}, .5)`);
        rg.addColorStop(1, `rgba(${c}, ${c}, ${c}, 0)`);
        context.fillStyle = rg;
        context.fillRect(cx - blur, cy - blur, blur * 2, blur * 2);
      }
    }

    setTimeout(update, 1000 / 60);
  });
});
window.addEventListener('resize', windowResized);
window.addEventListener('mousemove', e => {
  g.point.x = e.clientX;
  g.point.y = e.clientY;
});
window.addEventListener('touchmove', e => {
  Array.from(e.touches).forEach(t => {
    g.point.x = t.clientX;
    g.point.y = t.clientY;
  });
});
