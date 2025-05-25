import FPS from '@packages/fps/fps';
import { random } from '@packages/tools/random';
import { isInRange } from '@packages/tools/range';

const narrow = <T>(value: T) => value;

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface Range {
  minimum: number;
  maximum: number;
}

const state = {
  canvas: document.createElement('canvas'),
  queue: narrow<Point[]>([]),
  context: narrow<CanvasRenderingContext2D | null>(null),
  imageData: new ImageData(1, 1),
};

const dot = (imageData: ImageData, { point, color }: { point: Point; color: Color }) => {
  const index = (point.y * imageData.width + point.x) * 4;
  imageData.data[index + 0] = color.r;
  imageData.data[index + 1] = color.g;
  imageData.data[index + 2] = color.b;
  imageData.data[index + 3] = color.a;
};

const rect = (imageData: ImageData, { point, size, color }: { point: Point; size: Size; color: Color }) => {
  for (let y = point.y; y < point.y + size.height; y++) {
    for (let x = point.x; x < point.x + size.width; x++) {
      const index = (y * imageData.width + x) * 4;
      imageData.data[index + 0] = color.r;
      imageData.data[index + 1] = color.g;
      imageData.data[index + 2] = color.b;
      imageData.data[index + 3] = color.a;
    }
  }
};

const color = (imageData: ImageData, { point }: { point: Point }) => {
  const r = imageData.data[(point.y * imageData.width + point.x) * 4 + 0];
  const g = imageData.data[(point.y * imageData.width + point.x) * 4 + 1];
  const b = imageData.data[(point.y * imageData.width + point.x) * 4 + 2];
  const a = imageData.data[(point.y * imageData.width + point.x) * 4 + 3];
  return { r, g, b, a };
};

const defaultRange = { minimum: 0, maximum: 0x100 };
// const superposition = new Map<`${number},${number}`, Record<keyof Pick<Color, 'r' | 'g' | 'b'>, Range>>();

const key = (point: Point) => `${point.x},${point.y}` as const;

const directions = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
];

const average = (array: number[]) => {
  return array.reduce((a, b) => a + b, 0) / array.length;
};

const collapse = (imageData: ImageData, { point }: { point: Point }) => {
  if (color(imageData, { point }).a > 0) {
    return;
  }
  const colors = narrow<Color[]>([]);
  for (const direction of directions) {
    const neighbor = { x: point.x + direction.x, y: point.y + direction.y };
    if (!isInRange(0, neighbor.x, imageData.width - 1)) {
      continue;
    }
    if (!isInRange(0, neighbor.y, imageData.height - 1)) {
      continue;
    }
    if (color(imageData, { point: neighbor }).a === 0) {
      continue;
    }
    colors.push(color(imageData, { point: neighbor }));
  }
  if (colors.length === 0) {
    dot(imageData, {
      point,
      color: {
        r: random(0x100),
        g: random(0x100),
        b: random(0x100),
        a: 0xff,
      },
    });
    return;
  }
  const r = Math.floor(average(colors.map((color) => color.r)));
  const g = Math.floor(average(colors.map((color) => color.g)));
  const b = Math.floor(average(colors.map((color) => color.b)));
  dot(imageData, {
    point,
    color: {
      r: Math.max(0, Math.min(random(r - 0x2, r + 0x2 + 1), 0xff)),
      g: Math.max(0, Math.min(random(g - 0x2, g + 0x2 + 1), 0xff)),
      b: Math.max(0, Math.min(random(b - 0x2, b + 0x2 + 1), 0xff)),
      a: 0xff,
    },
  });
};

const map = new Map<`${number},${number}`, unknown>();

const propagate = (imageData: ImageData, { point }: { point: Point }) => {
  for (const direction of directions) {
    const neighbor = { x: point.x + direction.x, y: point.y + direction.y };
    if (!isInRange(0, neighbor.x, imageData.width - 1)) {
      continue;
    }
    if (!isInRange(0, neighbor.y, imageData.height - 1)) {
      continue;
    }
    if (color(imageData, { point: neighbor }).a > 0) {
      continue;
    }
    if (map.has(key(neighbor))) {
      continue;
    }
    state.queue.splice(random(state.queue.length), 0, neighbor);
    // const indices = state.queue.flatMap((_, i) => Array(i + 1).fill(i));
    // state.queue.splice(choice(indices), 0, neighbor);
    map.set(key(neighbor), true);
  }
};

const handleQueue = (imageData: ImageData) => {
  const length = Math.min(0x1000, Math.max(1, Math.floor(state.queue.length / 2)));
  for (let i = 0; i < length; ++i) {
    const point = state.queue.shift();
    if (!point) {
      return;
    }
    map.delete(key(point));
    collapse(imageData, { point });
    propagate(imageData, { point });
  }
};

const update = () => {
  requestAnimationFrame(update);

  handleQueue(state.imageData);

  state.context?.putImageData(state.imageData, 0, 0);
};

window.addEventListener('load', () => {
  const fps = new FPS({
    style: {
      position: 'fixed',
      top: '0px',
      right: '0px',
      zIndex: '100',
    },
  });
  document.body.appendChild(fps.element);

  state.canvas = document.querySelector<HTMLCanvasElement>('#canvas') ?? state.canvas;

  state.canvas.setAttribute('width', `${window.innerWidth}`);
  state.canvas.setAttribute('height', `${window.innerHeight}`);

  state.context = state.canvas.getContext('2d');
  if (!state.context) {
    return;
  }

  state.imageData = state.context.getImageData(0, 0, state.canvas.width, state.canvas.height);

  state.canvas.addEventListener('click', (event) => {
    state.queue.unshift({ x: event.offsetX, y: event.offsetY });
  });

  requestAnimationFrame(update);
});
