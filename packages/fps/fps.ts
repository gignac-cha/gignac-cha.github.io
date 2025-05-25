type TextMap = { [key: string]: number[][] };
const textMap: TextMap = {
  F: [
    [1, 1, 1],
    [1],
    [1, 1, 1],
    [1],
    [1],
  ],
  P: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1],
    [1],
  ],
  S: [
    [1, 1, 1],
    [1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  ':': [
    [1],
    [],
    [1],
  ],
  0: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  1: [
    [0, 1],
    [1, 1],
    [0, 1],
    [0, 1],
    [1, 1, 1],
  ],
  2: [
    [1, 1, 1],
    [1, 0, 1],
    [0, 1],
    [1],
    [1, 1, 1],
  ],
  3: [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  4: [
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
  ],
  5: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  6: [
    [0, 1],
    [1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  7: [
    [1, 1, 1],
    [0, 0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
  ],
  8: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  9: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 1],
  ],
};

interface Count {
  key: number;
  value: number;
}

export default class FPS {
  private canvas: HTMLCanvasElement = document.createElement('canvas');
  private timestamps: number[] = [];
  private fps: number = 1;
  private paddingTop: number = 10;

  constructor(private width: number = 80, private height: number = 60) {
    this.canvas.setAttribute('width', `${width}`);
    this.canvas.setAttribute('height', `${height}`);
    requestAnimationFrame(this.update);
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  update = (timestamp: number): void => {
    requestAnimationFrame(this.update);

    this.timestamps.push(timestamp);

    const counts: Count[] = [];
    for (let i = this.timestamps.length - 1; i >= 0; --i) {
      const key: number = Math.floor(this.timestamps[i] / (1000 / this.fps));
      const count: Count | undefined = counts.find((count: Count) => count.key === key);
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
    const maximum = Math.max(...counts.map((count: Count) => count.value)) * this.fps;

    const context: CanvasRenderingContext2D | null = this.canvas.getContext('2d');
    if (context) {
      const imageData: ImageData = context.getImageData(0, 0, this.width, this.height);
      const data: Uint8ClampedArray = imageData.data;
      data.fill(0x3f);

      for (let i = 0; i < counts.length - 1; ++i) {
        const value: number = counts[i].value * this.fps;
        const x: number = this.width - (counts.length - 1) + i;
        const height: number = Math.floor(value / maximum * (this.height - this.paddingTop));
        const y: number = this.height - height;
        data[y * this.width * 4 + x * 4 + 0] = 0xff;
        data[y * this.width * 4 + x * 4 + 1] = 0xff;
        data[y * this.width * 4 + x * 4 + 2] = 0xff;
        data[y * this.width * 4 + x * 4 + 3] = 0xff;
        for (let j = 1; j < height; ++j) {
          data[(y + j) * this.width * 4 + x * 4 + 0] = 0x3f;
          data[(y + j) * this.width * 4 + x * 4 + 1] = 0x7f;
          data[(y + j) * this.width * 4 + x * 4 + 2] = 0xff;
          data[(y + j) * this.width * 4 + x * 4 + 3] = 0xff;
        }
      }

      this.drawText(data, textMap.F, 1, 1);
      this.drawText(data, textMap.P, 5, 1);
      this.drawText(data, textMap.S, 9, 1);
      this.drawText(data, textMap[':'], 13, 2);

      if (counts.length > 1) {
        const lastCount: Count = counts[counts.length - 2];
        const fpsText: string = `${lastCount.value * this.fps}`;
        for (let i = 0; i < fpsText.length; ++i) {
          this.drawText(data, textMap[fpsText[i]], 15 + i * 4, 1);
        }
      }

      context.putImageData(imageData, 0, 0);
    }
  }

  drawText(data: Uint8ClampedArray, map: number[][], x: number, y: number) {
    if (map) {
      for (let j = 0; j < map.length; ++j) {
        const row: number[] = map[j];
        for (let i = 0; i < row.length; ++i) {
          if (row[i] > 0) {
            data[(y + j) * this.width * 4 + (x + i) * 4 + 0] = 0x7f;
            data[(y + j) * this.width * 4 + (x + i) * 4 + 1] = 0xff;
            data[(y + j) * this.width * 4 + (x + i) * 4 + 2] = 0x7f;
            data[(y + j) * this.width * 4 + (x + i) * 4 + 3] = 0xff;
          }
        }
      }
    }
  }
}
