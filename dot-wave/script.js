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

  const getRandomReal = n => Math.random() * n;
  const getRandom = n => Math.floor(getRandomReal(n));

  const circle = (context, x, y, r, color) => {
    context.beginPath();
    context.fillStyle = color;
    context.arc(x, y, r, 0, 2 * Math.PI);
    context.fill();
    context.closePath();
  };

  requestAnimationFrame(update = () => {
    requestAnimationFrame(update);

    context.clearRect(0, 0, width, height);
  });
});
window.addEventListener('resize', e => {
  resize();
});
