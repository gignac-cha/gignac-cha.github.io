declare interface Point {
  x: number;
  y: number;
}
declare interface PointArray {
  x: Float64Array;
  y: Float64Array;
}

declare interface Positions {
  current: PointArray;
  previous: PointArray;
}
declare type Settlement = Map<string, Set<number>>;

declare interface InitializeParameters {
  positions: Positions;
  accelerations: PointArray;
  radiusArray: Float64Array;
  settlement: Settlement;
  locked: Uint8Array;
  width: number;
  height: number;
  gridSize: number;
  rowCount: number;
  columnCount: number;
  objectCount: number;
  step: number;
  stepDeltaTime: number;
}

declare interface ApplyForceParameters {
  index: number;
  accelerations: PointArray;
  force: Point;
}
declare interface ApplyForcesParameters {
  currentIndex: number;
  accelerations: PointArray;
  force: Point;
}

declare interface GetGridPositionParameters {
  x: number;
  y: number;
  gridSize: number;
  rowCount: number;
  columnCount: number;
}

declare interface GetKeyByIndexParameters {
  index: number;
  positions: Positions;
  gridSize: number;
  rowCount: number;
  columnCount: number;
}
declare interface GetKeyByPositionParameters {
  x: number;
  y: number;
  settlement: Settlement;
  gridSize: number;
  rowCount: number;
  columnCount: number;
}

declare interface UpdatePositionParameters {
  index: number;
  positions: Positions;
  accelerations: PointArray;
  settlement: Settlement;
  gridSize: number;
  rowCount: number;
  columnCount: number;
  stepDeltaTime: number;
}
declare interface UpdatePositionsParameters {
  currentIndex: number;
  positions: Positions;
  accelerations: PointArray;
  settlement: Uint8Array;
  width: number;
  height: number;
  gridSize: number;
  rowCount: number;
  columnCount: number;
  objectCount: number;
  stepDeltaTime: number;
}

declare interface GetGridObjectIndicesParameters {
  index: number;
  positions: Positions;
  settlement: Settlement;
  gridSize: number;
  rowCount: number;
  columnCount: number;
}

declare interface ResolveCollisionParameters {
  index: number;
  indices: number[];
  positions: Positions;
  radiusArray: Float64Array;
}
declare interface ResolveCollisionsParameters {
  currentIndex: number;
  positions: Positions;
  radiusArray: Float64Array;
  settlement: Settlement;
  height: number;
  gridSize: number;
  rowCount: number;
  columnCount: number;
}

declare interface ApplyConstraintParameters {
  index: number;
  positions: Positions;
  radiusArray: Float64Array;
  locked: Uint8Array;
  width: number;
  height: number;
}
declare interface ApplyConstraintsParameters {
  currentIndex: number;
  positions: Positions;
  radiusArray: Float64Array;
  locked: Uint8Array;
  width: number;
  height: number;
}

declare type MessageEventDataType = 'initialize' | 'pause' | 'resume' | 'next';
declare interface MessageEventData {
  type: MessageEventDataType;
}
