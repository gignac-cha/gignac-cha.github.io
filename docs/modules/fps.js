const textMap = {
  F: [
    [1, 1, 1],
    [1],
    [1, 1, 1],
    [1],
    [1]
  ],
  P: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1],
    [1]
  ],
  S: [
    [1, 1, 1],
    [1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1]
  ],
  ":": [
    [1],
    [],
    [1]
  ],
  0: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1]
  ],
  1: [
    [0, 1],
    [1, 1],
    [0, 1],
    [0, 1],
    [1, 1, 1]
  ],
  2: [
    [1, 1, 1],
    [1, 0, 1],
    [0, 1],
    [1],
    [1, 1, 1]
  ],
  3: [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1]
  ],
  4: [
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1]
  ],
  5: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1]
  ],
  6: [
    [0, 1],
    [1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1]
  ],
  7: [
    [1, 1, 1],
    [0, 0, 1],
    [0, 1],
    [0, 1],
    [0, 1]
  ],
  8: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1]
  ],
  9: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 1]
  ]
};
export default class FPS {
  constructor(width = 80, height = 60) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.timestamps = [];
    this.fps = 1;
    this.paddingTop = 10;
    this.update = (timestamp) => {
      requestAnimationFrame(this.update);
      this.timestamps.push(timestamp);
      const counts = [];
      for (let i = this.timestamps.length - 1; i >= 0; --i) {
        const key = Math.floor(this.timestamps[i] / (1e3 / this.fps));
        const count = counts.find((count2) => count2.key === key);
        if (count) {
          count.value++;
        } else {
          counts.unshift({ key, value: 1 });
        }
        if (counts.length > this.width + 1) {
          counts.shift();
          this.timestamps.splice(0, i);
          break;
        }
      }
      const maximum = Math.max(...counts.map((count) => count.value)) * this.fps;
      const context = this.canvas.getContext("2d");
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        data.fill(63);
        for (let i = 0; i < counts.length - 1; ++i) {
          const value = counts[i].value * this.fps;
          const x = this.width - (counts.length - 1) + i;
          const height = Math.floor(value / maximum * (this.height - this.paddingTop));
          const y = this.height - height;
          data[y * this.width * 4 + x * 4 + 0] = 255;
          data[y * this.width * 4 + x * 4 + 1] = 255;
          data[y * this.width * 4 + x * 4 + 2] = 255;
          data[y * this.width * 4 + x * 4 + 3] = 255;
          for (let j = 1; j < height; ++j) {
            data[(y + j) * this.width * 4 + x * 4 + 0] = 63;
            data[(y + j) * this.width * 4 + x * 4 + 1] = 127;
            data[(y + j) * this.width * 4 + x * 4 + 2] = 255;
            data[(y + j) * this.width * 4 + x * 4 + 3] = 255;
          }
        }
        this.drawText(data, textMap.F, 1, 1);
        this.drawText(data, textMap.P, 5, 1);
        this.drawText(data, textMap.S, 9, 1);
        this.drawText(data, textMap[":"], 13, 2);
        if (counts.length > 1) {
          const lastCount = counts[counts.length - 2];
          const fpsText = `${lastCount.value * this.fps}`;
          for (let i = 0; i < fpsText.length; ++i) {
            this.drawText(data, textMap[fpsText[i]], 15 + i * 4, 1);
          }
        }
        context.putImageData(imageData, 0, 0);
      }
    };
    this.canvas.setAttribute("width", `${width}`);
    this.canvas.setAttribute("height", `${height}`);
    requestAnimationFrame(this.update);
  }
  get element() {
    return this.canvas;
  }
  drawText(data, map, x, y) {
    if (map) {
      for (let j = 0; j < map.length; ++j) {
        const row = map[j];
        for (let i = 0; i < row.length; ++i) {
          if (row[i] > 0) {
            data[(y + j) * this.width * 4 + (x + i) * 4 + 0] = 127;
            data[(y + j) * this.width * 4 + (x + i) * 4 + 1] = 255;
            data[(y + j) * this.width * 4 + (x + i) * 4 + 2] = 127;
            data[(y + j) * this.width * 4 + (x + i) * 4 + 3] = 255;
          }
        }
      }
    }
  }
}
