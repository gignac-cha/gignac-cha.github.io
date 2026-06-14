import { describe, expect, it } from 'vitest';

import {
  DOORWAY_WIDTH,
  HALF_ROOM_WIDTH,
  ROOM_PITCH_X,
  ROOM_PITCH_Z,
  WALL_COLLISION_MARGIN,
} from './constants.ts';
import {
  clampPlayerPosition,
  createRoomKey,
  findRoomCenter,
  findRoomCoordinateFromWorldPosition,
  listAdjacentRoomCoordinates,
  type RoomDoorStates,
} from './room-grid.ts';

const ALL_DOORS_CLOSED: RoomDoorStates = {
  positiveX: false,
  negativeX: false,
  positiveZ: false,
  negativeZ: false,
};

const WALL_LIMIT = HALF_ROOM_WIDTH - WALL_COLLISION_MARGIN;
const DOORWAY_HALF_WIDTH = DOORWAY_WIDTH / 2;

describe('createRoomKey', () => {
  it('격자 좌표를 "x,z" 형식의 키로 만든다', () => {
    expect(createRoomKey({ roomX: 0, roomZ: 0 })).toBe('0,0');
    expect(createRoomKey({ roomX: 2, roomZ: -3 })).toBe('2,-3');
  });
});

describe('findRoomCoordinateFromWorldPosition', () => {
  it('원점은 (0,0) 방이다', () => {
    expect(findRoomCoordinateFromWorldPosition(0, 0)).toEqual({ roomX: 0, roomZ: 0 });
  });

  it('방 피치 경계의 절반을 기준으로 가장 가까운 방을 고른다', () => {
    expect(findRoomCoordinateFromWorldPosition(ROOM_PITCH_X * 0.49, 0).roomX).toBe(0);
    expect(findRoomCoordinateFromWorldPosition(ROOM_PITCH_X * 0.51, 0).roomX).toBe(1);
    expect(findRoomCoordinateFromWorldPosition(0, -ROOM_PITCH_Z * 0.51).roomZ).toBe(-1);
  });

  it('방 중심 좌표는 정확히 해당 방으로 변환된다', () => {
    expect(findRoomCoordinateFromWorldPosition(ROOM_PITCH_X * 3, ROOM_PITCH_Z * -2)).toEqual({ roomX: 3, roomZ: -2 });
  });
});

describe('findRoomCenter', () => {
  it('격자 좌표에 피치를 곱한 월드 좌표를 돌려준다', () => {
    expect(findRoomCenter({ roomX: 0, roomZ: 0 })).toEqual({ x: 0, z: 0 });
    expect(findRoomCenter({ roomX: 1, roomZ: -2 })).toEqual({ x: ROOM_PITCH_X, z: -2 * ROOM_PITCH_Z });
  });

  it('좌표 변환과 역변환이 일치한다', () => {
    const center = findRoomCenter({ roomX: -4, roomZ: 5 });
    expect(findRoomCoordinateFromWorldPosition(center.x, center.z)).toEqual({ roomX: -4, roomZ: 5 });
  });
});

describe('listAdjacentRoomCoordinates', () => {
  it('상하좌우 4개의 인접 방을 나열한다', () => {
    const adjacentRoomCoordinates = listAdjacentRoomCoordinates({ roomX: 1, roomZ: -1 });
    expect(adjacentRoomCoordinates).toHaveLength(4);
    expect(adjacentRoomCoordinates).toContainEqual({ roomX: 2, roomZ: -1 });
    expect(adjacentRoomCoordinates).toContainEqual({ roomX: 0, roomZ: -1 });
    expect(adjacentRoomCoordinates).toContainEqual({ roomX: 1, roomZ: 0 });
    expect(adjacentRoomCoordinates).toContainEqual({ roomX: 1, roomZ: -2 });
  });
});

describe('clampPlayerPosition', () => {
  it('방 내부에 있으면 위치를 바꾸지 않는다', () => {
    const position = { x: 1.5, z: -2.25 };
    expect(clampPlayerPosition(position, ALL_DOORS_CLOSED)).toEqual(position);
  });

  it('문이 없는 벽으로 다가가면 벽 한계에서 멈춘다', () => {
    const clamped = clampPlayerPosition({ x: HALF_ROOM_WIDTH - 0.1, z: 0 }, ALL_DOORS_CLOSED);
    expect(clamped.x).toBeCloseTo(WALL_LIMIT);
    expect(clamped.z).toBe(0);
  });

  it('음수 방향 벽에서도 벽 한계에서 멈춘다', () => {
    const clamped = clampPlayerPosition({ x: 0, z: -(HALF_ROOM_WIDTH - 0.05) }, ALL_DOORS_CLOSED);
    expect(clamped.x).toBe(0);
    expect(clamped.z).toBeCloseTo(-WALL_LIMIT);
  });

  it('문이 있고 문 폭 안에 정렬돼 있으면 벽 한계를 넘을 수 있다', () => {
    const doorStates: RoomDoorStates = { ...ALL_DOORS_CLOSED, positiveX: true };
    const position = { x: HALF_ROOM_WIDTH - 0.1, z: DOORWAY_HALF_WIDTH - 0.1 };
    expect(clampPlayerPosition(position, doorStates)).toEqual(position);
  });

  it('문이 있어도 문 폭 밖에 있으면 벽 한계에서 멈춘다', () => {
    const doorStates: RoomDoorStates = { ...ALL_DOORS_CLOSED, positiveX: true };
    const clamped = clampPlayerPosition({ x: HALF_ROOM_WIDTH - 0.1, z: DOORWAY_HALF_WIDTH + 1 }, doorStates);
    expect(clamped.x).toBeCloseTo(WALL_LIMIT);
    expect(clamped.z).toBeCloseTo(DOORWAY_HALF_WIDTH + 1);
  });

  it('갭 통로를 건너는 중에는 수직축이 문 폭 안으로 제한된다', () => {
    const doorStates: RoomDoorStates = { ...ALL_DOORS_CLOSED, positiveX: true };
    const clamped = clampPlayerPosition({ x: HALF_ROOM_WIDTH + 0.3, z: 1.5 }, doorStates);
    expect(clamped.x).toBeCloseTo(HALF_ROOM_WIDTH + 0.3);
    expect(clamped.z).toBeCloseTo(DOORWAY_HALF_WIDTH);
  });

  it('Z 방향 갭 통로에서는 X 축이 문 폭 안으로 제한된다', () => {
    const clamped = clampPlayerPosition({ x: -2, z: HALF_ROOM_WIDTH + 0.2 }, ALL_DOORS_CLOSED);
    expect(clamped.x).toBeCloseTo(-DOORWAY_HALF_WIDTH);
    expect(clamped.z).toBeCloseTo(HALF_ROOM_WIDTH + 0.2);
  });

  it('원점이 아닌 방에서도 방 중심 기준으로 동작한다', () => {
    const roomCenter = findRoomCenter({ roomX: 2, roomZ: -1 });
    const clamped = clampPlayerPosition({ x: roomCenter.x + HALF_ROOM_WIDTH - 0.1, z: roomCenter.z }, ALL_DOORS_CLOSED);
    expect(clamped.x).toBeCloseTo(roomCenter.x + WALL_LIMIT);
    expect(clamped.z).toBeCloseTo(roomCenter.z);
  });
});
