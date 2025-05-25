export const gravity = { x: 0, y: -1000 };

/** @param {ApplyForceParameters} */
const applyForce = ({ index, accelerations, force }) => {
  accelerations.x[index] += force.x;
  accelerations.y[index] += force.y;
};
/** @param {ApplyForcesParameters} */
export const applyForces = ({ currentIndex, accelerations, force }) => {
  for (let i = 0; i < currentIndex; ++i) {
    applyForce({ index: i, accelerations, force });
  }
};

/** @param {GetGridPositionParameters} */
const getGridPosition = ({ x, y, gridSize, rowCount, columnCount }) => {
  const rowIndex = Math.floor(Math.max(0, Math.min(y / gridSize, rowCount)));
  const columnIndex = Math.floor(Math.max(0, Math.min(x / gridSize, columnCount)));
  return { rowIndex, columnIndex };
};
/** @param {GetKeyByIndexParameters} */
export const getKeyByIndex = ({ index, positions, settlement, gridSize, rowCount, columnCount }) => {
  const x = positions.current.x[index];
  const y = positions.current.y[index];
  return getKeyByPosition({ x, y, settlement, gridSize, rowCount, columnCount });
};
/** @param {GetKeyByPositionParameters} */
const getKeyByPosition = ({ x, y, settlement, gridSize, rowCount, columnCount }) => {
  const { rowIndex, columnIndex } = getGridPosition({ x, y, gridSize, rowCount, columnCount });
  if (!settlement.has(`${columnIndex}:${rowIndex}`)) {
    settlement.set(`${columnIndex}:${rowIndex}`, new Set());
  }
  return `${columnIndex}:${rowIndex}`;
};

/** @param {UpdatePositionParameters} */
const updatePosition = ({
  index,
  positions,
  accelerations,
  settlement,
  gridSize,
  rowCount,
  columnCount,
  stepDeltaTime,
}) => {
  const velocity = {
    x: positions.current.x[index] - positions.previous.x[index],
    y: positions.current.y[index] - positions.previous.y[index],
  };

  positions.previous.x[index] = positions.current.x[index];
  positions.previous.y[index] = positions.current.y[index];

  settlement.get(getKeyByIndex({ index, positions, settlement, gridSize, rowCount, columnCount })).delete(index);

  positions.current.x[index] += velocity.x + accelerations.x[index] * stepDeltaTime ** 2;
  positions.current.y[index] += velocity.y + accelerations.y[index] * stepDeltaTime ** 2;

  settlement.get(getKeyByIndex({ index, positions, settlement, gridSize, rowCount, columnCount })).add(index);

  accelerations.x[index] = 0;
  accelerations.y[index] = 0;
};
/** @param {UpdatePositionsParameters} */
export const updatePositions = ({
  currentIndex,
  positions,
  accelerations,
  settlement,
  width,
  height,
  gridSize,
  rowCount,
  columnCount,
  objectCount,
  stepDeltaTime,
}) => {
  for (let i = 0; i < currentIndex; ++i) {
    updatePosition({
      index: i,
      positions,
      accelerations,
      settlement,
      width,
      height,
      gridSize,
      rowCount,
      columnCount,
      objectCount,
      stepDeltaTime,
    });
  }
};

/** @type {Point[]} */
const directions = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];
/** @param {GetGridObjectIndicesParameters} */
const getGridObjectIndices = ({ index, positions, settlement, gridSize, rowCount, columnCount }) => {
  /** @type {number[]} */
  const indices = [];
  for (const direction of directions) {
    const gridPosition = {
      x: positions.current.x[index] + direction.x * gridSize,
      y: positions.current.y[index] + direction.y * gridSize,
    };
    const set = settlement.get(getKeyByPosition({ ...gridPosition, settlement, gridSize, rowCount, columnCount }));
    set.delete(index);
    for (const j of set) {
      if (j !== index) {
        indices.push(j);
      }
    }
    for (const j of indices) {
      set.delete(j);
    }
  }
  return indices;
};
/** @param {ResolveCollisionParameters} */
export const resolveCollision = ({ index: i, indices, positions, radiusArray }) => {
  let collisionCount = 0;
  for (const j of indices) {
    const vector = {
      x: positions.current.x[i] - positions.current.x[j],
      y: positions.current.y[i] - positions.current.y[j],
    };
    const distance = (vector.x ** 2 + vector.y ** 2) ** 0.5;
    const minimumDistance = radiusArray[i] + radiusArray[j];
    if (distance < minimumDistance) {
      const normalizedVector = {
        x: vector.x / distance,
        y: vector.y / distance,
      };
      const difference = minimumDistance - distance;

      positions.current.x[i] += normalizedVector.x * (difference / 2);
      positions.current.y[i] += normalizedVector.y * (difference / 2);

      positions.current.x[j] -= normalizedVector.x * (difference / 2);
      positions.current.y[j] -= normalizedVector.y * (difference / 2);

      collisionCount++;
    }
  }
  return collisionCount;
};
/** @param {ResolveCollisionsParameters} */
export const resolveCollisions = ({
  currentIndex,
  positions,
  radiusArray,
  settlement,
  height,
  gridSize,
  rowCount,
  columnCount,
}) => {
  const startTime = Date.now();
  let collisionCount = 0;
  for (let i = 0; i < currentIndex; ++i) {
    if (positions.current.y[i] + radiusArray[i] < height - 1) {
      const indices = getGridObjectIndices({
        index: i,
        positions,
        settlement,
        gridSize,
        rowCount,
        columnCount,
      });
      collisionCount += resolveCollision({ index: i, indices, positions, radiusArray });
      settlement.get(getKeyByIndex({ index: i, positions, settlement, gridSize, rowCount, columnCount })).add(i);
      for (const j of indices) {
        settlement.get(getKeyByIndex({ index: j, positions, settlement, gridSize, rowCount, columnCount })).add(j);
      }
    }
  }
  const elapsedTime = Date.now() - startTime;
  return { elapsedTime, collisionCount };
};

/** @param {ApplyConstraintParameters} */
const applyConstraint = ({ index, positions, radiusArray, locked, width, height }) => {
  const radius = radiusArray[index];
  if (positions.current.x[index] - radius < 0) {
    positions.previous.x[index] = positions.current.x[index];
    positions.current.x[index] = radius;
  } else if (positions.current.x[index] + radius >= width - 1) {
    positions.previous.x[index] = positions.current.x[index];
    positions.current.x[index] = width - 1 - radius;
  }
  if (positions.current.y[index] - radius < 0) {
    positions.previous.y[index] = positions.current.y[index];
    positions.current.y[index] = radius;
  } else if (locked[index] === 0 && positions.current.y[index] + radius >= height / 4 + height - 1) {
    positions.previous.y[index] = positions.current.y[index];
    positions.current.y[index] = height / 4 + height - 1 - radius;
  } else if (locked[index] === 1 && positions.current.y[index] + radius >= height - 1) {
    positions.previous.y[index] = positions.current.y[index];
    positions.current.y[index] = height - 1 - radius;
  }
  if (locked[index] === 0 && positions.current.y[index] + radius < height - 1) {
    locked[index] = 1;
  }
};
/** @param {ApplyConstraintsParameters} */
export const applyConstraints = ({ currentIndex, positions, radiusArray, locked, width, height }) => {
  for (let i = 0; i < currentIndex; ++i) {
    applyConstraint({
      index: i,
      positions,
      radiusArray,
      locked,
      width,
      height,
    });
  }
};

