const state = { count: 1 };

window.addEventListener('load', (e) => {
  const onClick = () => {
    const count = document.querySelector('#count');
    count.textContent = `${state.count}`;

    count.style.opacity = 0.5;
    count.style.zIndex = 1;

    setTimeout(() => {
      count.style.opacity = null;
      count.style.zIndex = null;
    }, 1000 / 3);
  };

  document.querySelector('#plus').addEventListener('click', (e) => {
    state.count = Math.min(state.count + 1, 36);
    onClick();
  });
  document.querySelector('#minus').addEventListener('click', (e) => {
    state.count = Math.max(state.count - 1, 1);
    onClick();
  });

  const video = document.querySelector('#video');
  const canvas = document.querySelector('#canvas');

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    canvas.setAttribute('width', `${video.videoWidth}`);
    canvas.setAttribute('height', `${video.videoHeight}`);

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const channels = Math.floor(imageData.data.length / (canvas.width * canvas.height));

    const colors = new Array(state.count).fill().map(() => new Array(5).fill(0));
    for (let i = 0; i < imageData.data.length; i += channels) {
      const x = Math.floor((i % (canvas.width * channels)) - canvas.width / 2);
      const y = Math.floor(i / (canvas.width * channels) - canvas.height / 2);
      const r = Math.atan(y / x);
      let d = (r / (2 * Math.PI)) * 360;
      if (x < 0) {
        d += 180;
      } else if (d < 0) {
        d += 360;
      }
      const index = Math.floor(d / (360 / state.count));
      if (colors[index]) {
        colors[index][0] += imageData.data[i + 0];
        colors[index][1] += imageData.data[i + 1];
        colors[index][2] += imageData.data[i + 2];
        colors[index][3] += imageData.data[i + 3];
        colors[index][4]++;
      }
    }

    for (const color of colors) {
      color[0] = Math.floor(color[0] / color[4]);
      color[1] = Math.floor(color[1] / color[4]);
      color[2] = Math.floor(color[2] / color[4]);
    }

    video.style.boxShadow = colors
      .map((color, i) => {
        let x = 0;
        let y = 0;
        if (state.count > 1) {
          const d = (360 / state.count) * i;
          const r = (d / 360) * 2 * Math.PI;
          x = Math.cos(r) * 16;
          y = Math.sin(r) * 16;
        }
        return `${x}rem ${y}rem 8rem 1rem rgba(${color.slice(0, 3)}, 1)`;
      })
      .join(', ');
  });
});
