import { applyConstraints, applyForces, gravity, resolveCollisions, updatePositions } from '../utilities.js';

const variables = {
  initialized: false,
  running: false,

  positions: null,
  accelerations: null,
  radiusArray: null,
  settlement: null,
  locked: null,
  width: null,
  height: null,
  gridSize: null,
  rowCount: null,
  columnCount: null,
  objectCount: null,
  step: null,
  stepDeltaTime: null,

  currentIndex: 0,
  totalTime: 0,
  elapsedTime: 0,
  collisionCount: 0,

  intervalId: null,
};

const initialize = ({
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
}) => {
  variables.initialized = false;

  variables.positions = positions;
  variables.accelerations = accelerations;
  variables.radiusArray = radiusArray;
  variables.settlement = settlement;
  variables.locked = locked;
  variables.width = width;
  variables.height = height;
  variables.gridSize = gridSize;
  variables.rowCount = rowCount;
  variables.columnCount = columnCount;
  variables.objectCount = objectCount;
  variables.step = step;
  variables.stepDeltaTime = stepDeltaTime;

  variables.currentIndex = 0;
  variables.totalTime = 0;
  variables.elapsedTime = 0;
  variables.collisionCount = 0;

  variables.initialized = true;
};

const postMessage = () => {
  const { positions, currentIndex, totalTime, elapsedTime, collisionCount } = variables;
  const { x, y } = positions.current;
  self.postMessage({ type: 'next', x, y, currentIndex, totalTime, elapsedTime, collisionCount });
};

const update = (forceUpdate = false) => {
  const { initialized, running, currentIndex, accelerations, objectCount, step, stepDeltaTime } = variables;

  if (initialized && (forceUpdate || running)) {
    variables.totalTime += stepDeltaTime * step;
    variables.elapsedTime = 0;
    variables.collisionCount = 0;

    if (currentIndex < variables.totalTime * 100) {
      variables.currentIndex = Math.min(currentIndex + 1, objectCount);
    }

    for (let i = 0; i < variables.step; ++i) {
      applyForces({ currentIndex: variables.currentIndex, x: accelerations.x, y: accelerations.y, force: gravity });
      updatePositions(variables);
      const { elapsedTime, collisionCount } = resolveCollisions(variables);
      variables.elapsedTime += elapsedTime;
      variables.collisionCount += collisionCount;
      applyConstraints(variables);
    }

    postMessage();
  }
};

self.addEventListener('message', (event) => {
  switch (event.data.type) {
    case 'initialize': {
      if (variables.intervalId) {
        clearInterval(variables.intervalId);
      }
      initialize(event.data);
      variables.intervalId = setInterval(update, variables.stepDeltaTime * variables.step * 1000);
      break;
    }
    case 'pause': {
      if (variables.initialized) {
        variables.running = false;
      }
      break;
    }
    case 'resume': {
      if (variables.initialized) {
        variables.running = true;
      }
      break;
    }
    case 'next': {
      update(true);
      break;
    }
  }
});
