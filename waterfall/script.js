import Canvas from '../modules/canvas.js';
import FPS from '../modules/fps.js';
import { random } from '../modules/random.js';
import { isInRange, range } from '../modules/range.js';
import { applyConstraints, resolveCollisions, updatePositions } from './utilities.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
window.addEventListener('load', async (event) => {
  const parallelCount = 4;

  const worker = new Worker('./workers/worker.js', { type: 'module' });

  const fps = new FPS();
  fps.element.classList.add('fps');
  document.body.appendChild(fps.element);

  const elements = {
    /** @type {HTMLButtonElement} */ play: document.querySelector('#play'),
    /** @type {HTMLButtonElement} */ next: document.querySelector('#next'),
    /** @type {HTMLInputElement} */ image: document.querySelector('#image'),
    /** @type {HTMLButtonElement} */ replay: document.querySelector('#replay'),
    /** @type {HTMLButtonElement} */ record: document.querySelector('#record'),
    /** @type {HTMLCanvasElement} */ headerCanvas: document.querySelector('#header-canvas'),
    /** @type {HTMLCanvasElement} */ mainCanvas: document.querySelector('#main-canvas'),
  };

  const headerCanvas = new Canvas(elements.headerCanvas);
  const mainCanvas = new Canvas(elements.mainCanvas);

  const width = 640;
  const height = 640;
  headerCanvas.width = width;
  headerCanvas.height = height / 4;
  mainCanvas.width = width;
  mainCanvas.height = height;

  const getRandomColor = () => [random(0x40, 0x100), random(0x40, 0x100), random(0x40, 0x100)];
  const getColorCode = (r, g, b, a = 1) => `rgba(${r}, ${g}, ${b}, ${a})`;

  const defaultRadius = 10;
  const gridSize = defaultRadius * 2;
  const rowCount = Math.floor(height / gridSize);
  const columnCount = Math.floor(width / gridSize);
  const objectCount = Math.floor(rowCount * columnCount);
  const step = 8;
  const positions = {
    current: {
      x: new Float64Array(objectCount),
      y: new Float64Array(objectCount),
    },
    previous: {
      x: new Float64Array(objectCount),
      y: new Float64Array(objectCount),
    },
  };
  const accelerations = {
    x: new Float64Array(objectCount),
    y: new Float64Array(objectCount),
  };
  const radiusArray = new Float64Array(objectCount);
  /** @type {Map<string, Set<number>>} */
  const settlement = new Map();
  const locked = new Uint8Array(objectCount);
  const initialForce = (3 * defaultRadius) / step;
  /** @param {number} index */
  const resetState = (index) => {
    positions.current.y[index] = height + height / 4 - defaultRadius * 2;
    positions.current.x[index] = index % 2 === 0 ? defaultRadius * 2 : width - defaultRadius * 2;

    const degree = (index % 90) * 4;
    const radian = (degree / 360) * 2 * Math.PI;
    positions.previous.x[index] =
      positions.current.x[index] + (index % 2 === 0 ? -1 : 1) * Math.abs(Math.cos(radian)) * initialForce;
    positions.previous.y[index] = positions.current.y[index] + Math.abs(Math.sin(radian)) * initialForce;
    positions.current.x[index] = index % 2 === 0 ? defaultRadius * 2 : width - defaultRadius * 2;

    accelerations.x[index] = 0;
    accelerations.y[index] = 0;
  };
  const resetStates = () => {
    range(objectCount).forEach((i) => resetState(i));
    for (let j = 0; j < rowCount; ++j) {
      for (let i = 0; i < columnCount; ++i) {
        settlement.set(`${i}:${j}`, new Set());
      }
    }
    locked.fill(0);
  };
  /** @param {number} index */
  const createObject = (index) => {
    const color = getColorCode(...getRandomColor());
    radiusArray[index] = defaultRadius;
    return { index, color };
  };
  const objects = range(objectCount).map((index) => createObject(index));
  resetStates();

  const frameCount = 60;
  const deltaTime = 1 / frameCount;
  const stepDeltaTime = deltaTime / step;
  let currentIndex = 0;
  let totalTime = 0;
  let elapsedTime = 0;
  let collisionCount = 0;

  /** @param {number} index */
  const drawObject = (index) => {
    const x = positions.current.x[index];
    const y = positions.current.y[index];
    const radius = radiusArray[index];
    const color = objects[index].color;
    if (y + radius > height) {
      headerCanvas.circle(x, height / 4 - (y - height), radius, color).fill();
    }
    if (y - radius < height) {
      mainCanvas.circle(x, height - y, radius, color).fill();
    }
  };
  const drawObjects = () => {
    range(currentIndex).forEach((i) => drawObject(i));
  };

  /** @type {FrameRequestCallback} */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const update = (time) => {
    requestAnimationFrame(update);

    headerCanvas.clear();
    mainCanvas.clear();
    drawObjects();

    elements.debug.textContent = JSON.stringify(
      { currentIndex, totalTime: Math.floor(totalTime * 1000), elapsedTime, collisionCount },
      null,
      2,
    );
  };

  requestAnimationFrame(update);

  worker.addEventListener('message', (/** @type {MessageEvent<MessageEventData>} */ event) => {
    switch (event.data.type) {
      case 'next': {
        positions.current.x.set(event.data.x);
        positions.current.y.set(event.data.y);
        currentIndex = event.data.currentIndex;
        totalTime = event.data.totalTime;
        elapsedTime = event.data.elapsedTime;
        collisionCount = event.data.collisionCount;
      }
    }
  });

  /** @param {MessageEventDataType} type */
  const postMessage = (type) => {
    switch (type) {
      case 'initialize': {
        worker.postMessage({
          type,
          positions,
          accelerations,
          radiusArray,
          settlement,
          locked,
          width,
          height,
          gridSize,
          rowCount,
          columnCount,
          objectCount,
          step,
          stepDeltaTime,
          parallelCount,
        });
        break;
      }
      case 'pause': {
        worker.postMessage({ type });
        break;
      }
      case 'resume': {
        worker.postMessage({ type });
        break;
      }
      case 'next': {
        worker.postMessage({ type });
        break;
      }
    }
  };

  postMessage('initialize');

  let playing = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  elements.play.addEventListener('click', (event) => {
    if (playing) {
      elements.play.textContent = '|> Play';
      postMessage('pause');
    } else {
      elements.play.textContent = '|| Pause';
      postMessage('resume');
    }
    playing = !playing;
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  elements.next.addEventListener('click', (event) => {
    playing = false;
    elements.play.textContent = '|> Play';
    postMessage('pause');
    postMessage('next');
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  elements.replay.addEventListener('click', async (event) => {
    resetStates();
    postMessage('initialize');
  });

  /**
   *
   * @param {File} file
   * @returns {Promise<string>}
   */
  const readImageDataURL = async (file) =>
    new Promise((resolve) => {
      const fileReader = new FileReader();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fileReader.addEventListener('load', (event) => resolve(fileReader.result));
      fileReader.readAsDataURL(file);
    });

  /**
   *
   * @param {string} dataURL
   * @returns {Promise<HTMLCanvasElement>}
   */
  const copyImageToCanvas = async (dataURL) =>
    new Promise((resolve) => {
      const img = document.createElement('img');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      img.addEventListener('load', (event) => {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('width', `${width}`);
        canvas.setAttribute('height', `${height}`);
        const context = canvas.getContext('2d');
        const imageSize = { x: 0, y: 0, width: img.width, height: img.height };
        if (width / height > imageSize.width / imageSize.height) {
          imageSize.height = height * (imageSize.width / width);
          imageSize.y = (img.height - imageSize.height) / 2;
        } else {
          imageSize.width = width * (imageSize.height / height);
          imageSize.x = (img.width - imageSize.width) / 2;
        }
        context.drawImage(img, imageSize.x, imageSize.y, imageSize.width, imageSize.height, 0, 0, width, height);
        resolve(canvas);
      });
      img.setAttribute('src', dataURL);
    });

  /** @param {HTMLCanvasElement} */
  const copyImageToObjects = (canvas) => {
    const context = canvas.getContext('2d');
    const { data } = context.getImageData(0, 0, width, height);
    for (const object of objects) {
      const x = Math.floor(positions.current.x[object.index]);
      const y = height - 1 - Math.floor(positions.current.y[object.index]);
      const index = y * width * 4 + x * 4;
      const [r, g, b] = data.slice(index, index + 3);
      object.color = getColorCode(r, g, b);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  elements.image.addEventListener('change', async (event) => {
    /** @type {HTMLInputElement} */
    const image = elements.image;
    for (const file of image.files) {
      const dataURL = await readImageDataURL(file);
      const canvas = await copyImageToCanvas(dataURL);
      copyImageToObjects(canvas);
      break;
    }
  });
});
