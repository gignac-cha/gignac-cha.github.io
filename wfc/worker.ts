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

interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const state = {
  queue: narrow<Point[]>([]),
  imageData: {
    data: new Uint8ClampedArray(0),
    width: 0,
    height: 0,
  },
};

const dot = (imageData: ImageData, { point, color }: { point: Point; color: Color }) => {
  const index = (point.y * imageData.width + point.x) * 4;
  imageData.data[index + 0] = color.r;
  imageData.data[index + 1] = color.g;
  imageData.data[index + 2] = color.b;
  imageData.data[index + 3] = color.a;
};

const color = (imageData: ImageData, { point }: { point: Point }) => {
  const r = imageData.data[(point.y * imageData.width + point.x) * 4 + 0];
  const g = imageData.data[(point.y * imageData.width + point.x) * 4 + 1];
  const b = imageData.data[(point.y * imageData.width + point.x) * 4 + 2];
  const a = imageData.data[(point.y * imageData.width + point.x) * 4 + 3];
  return { r, g, b, a };
};

const random = (start: number, end: number) => {
  if (start > end) {
    [start, end] = [end, start];
  }
  return start + Math.floor(Math.random() * (end - start));
};

const range = (start: number, value: number, end: number) => {
  return start <= value && value <= end;
};

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
    if (!range(0, neighbor.x, imageData.width - 1)) {
      continue;
    }
    if (!range(0, neighbor.y, imageData.height - 1)) {
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
        r: random(0, 0x100),
        g: random(0, 0x100),
        b: random(0, 0x100),
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
    if (!range(0, neighbor.x, imageData.width - 1)) {
      continue;
    }
    if (!range(0, neighbor.y, imageData.height - 1)) {
      continue;
    }
    if (color(imageData, { point: neighbor }).a > 0) {
      continue;
    }
    if (map.has(key(neighbor))) {
      continue;
    }
    state.queue.splice(random(0, state.queue.length), 0, neighbor);
    // const indices = state.queue.flatMap((_, i) => Array(i + 1).fill(i));
    // state.queue.splice(choice(indices), 0, neighbor);
    map.set(key(neighbor), true);
  }
};

addEventListener(
  'message',
  (
    event: MessageEvent<
      | {
          type: 'initialize';
          width: number;
          height: number;
        }
      | { type: 'click'; x: number; y: number }
      | { type: 'queue' }
    >,
  ) => {
    switch (event.data.type) {
      case 'initialize': {
        state.imageData.data = new Uint8ClampedArray(event.data.width * event.data.height * 4);
        state.imageData.width = event.data.width;
        state.imageData.height = event.data.height;
        return;
      }
      case 'click': {
        const { x, y } = event.data;
        state.queue.unshift({ x, y });
        return;
      }
      case 'queue': {
        const length = Math.min(0x100, Math.max(1, Math.floor(state.queue.length / 2)));
        for (let i = 0; i < length; ++i) {
          const point = state.queue.shift();
          if (!point) {
            return;
          }
          map.delete(key(point));
          collapse(state.imageData, { point });
          propagate(state.imageData, { point });
        }
        postMessage({ type: 'update', data: state.imageData.data });
        return;
      }
    }
  },
);
