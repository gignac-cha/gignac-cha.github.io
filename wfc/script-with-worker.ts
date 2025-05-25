const worker = new Worker('./worker.ts', { type: 'module' });

const narrow = <T>(value: T) => value;

const state = {
  canvas: document.createElement('canvas'),
  context: narrow<CanvasRenderingContext2D | null>(null),
  imageData: new ImageData(1, 1),
  data: new Uint8ClampedArray(0),
};

const handleQueue = (imageData: ImageData) => {
  imageData.data.set(state.data);
  worker.postMessage({ type: 'queue' });
};

const update = () => {
  requestAnimationFrame(update);

  handleQueue(state.imageData);

  state.context?.putImageData(state.imageData, 0, 0);
};

window.addEventListener('load', () => {
  state.canvas = document.querySelector<HTMLCanvasElement>('#canvas') ?? state.canvas;

  state.canvas.setAttribute('width', `${window.innerWidth}`);
  state.canvas.setAttribute('height', `${window.innerHeight}`);

  state.context = state.canvas.getContext('2d');
  if (!state.context) {
    return;
  }

  state.imageData = state.context.getImageData(0, 0, state.canvas.width, state.canvas.height);

  worker.addEventListener('message', (event: MessageEvent<{ type: 'update'; data: Uint8ClampedArray<ArrayBuffer> }>) => {
    switch (event.data.type) {
      case 'update': {
        state.data = event.data.data;
        return;
      }
    }
  });

  worker.postMessage({ type: 'initialize', width: state.canvas.width, height: state.canvas.height });

  state.canvas.addEventListener('click', (event) => {
    worker.postMessage({ type: 'click', x: event.offsetX, y: event.offsetY });
  });

  requestAnimationFrame(update);
});
