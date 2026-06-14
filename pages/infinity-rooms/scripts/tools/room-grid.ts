// 방 격자 좌표 변환과 플레이어 이동 제한을 담당하는 순수 함수 계층입니다.
// DOM/Three.js 의존이 없어 vitest 로 단독 검증할 수 있습니다.

import {
  DOORWAY_WIDTH,
  HALF_ROOM_DEPTH,
  HALF_ROOM_WIDTH,
  ROOM_PITCH_X,
  ROOM_PITCH_Z,
  WALL_COLLISION_MARGIN,
} from './constants.ts';

export interface RoomCoordinate {
  roomX: number;
  roomZ: number;
}

// 각 면의 문 존재 여부입니다. positiveX 는 +X(오른쪽) 벽, negativeZ 는 -Z(뒤쪽) 벽을 의미합니다.
export interface RoomDoorStates {
  positiveX: boolean;
  negativeX: boolean;
  positiveZ: boolean;
  negativeZ: boolean;
}

// 미니맵과 씬이 공유하는 방 요약 정보입니다.
export interface RoomSummary {
  roomX: number;
  roomZ: number;
  isGenerated: boolean;
  isGenerating: boolean;
  // 직전 테마 생성 요청이 실패해 스켈레톤으로 남은 방인지 여부입니다. 재시도·재생성 시 false 로 클리어됩니다.
  isFailed: boolean;
  themeColor: string | null;
  // AI 가 생성한 테마 이름입니다. 미생성(스켈레톤) 방은 null 입니다.
  themeName: string | null;
}

// 방 격자 좌표를 맵 키 문자열로 변환합니다. 예: { roomX: 2, roomZ: -3 } -> '2,-3'
export function createRoomKey(coordinate: RoomCoordinate): string {
  return `${coordinate.roomX},${coordinate.roomZ}`;
}

// 월드 좌표에서 가장 가까운 방의 격자 좌표를 구합니다.
export function findRoomCoordinateFromWorldPosition(x: number, z: number): RoomCoordinate {
  return {
    roomX: Math.round(x / ROOM_PITCH_X),
    roomZ: Math.round(z / ROOM_PITCH_Z),
  };
}

// 방 격자 좌표에서 방 중심의 월드 좌표를 구합니다.
export function findRoomCenter(coordinate: RoomCoordinate): { x: number; z: number } {
  return {
    x: coordinate.roomX * ROOM_PITCH_X,
    z: coordinate.roomZ * ROOM_PITCH_Z,
  };
}

// 상하좌우로 인접한 방 4개의 격자 좌표를 나열합니다.
export function listAdjacentRoomCoordinates(coordinate: RoomCoordinate): RoomCoordinate[] {
  return [
    { roomX: coordinate.roomX + 1, roomZ: coordinate.roomZ },
    { roomX: coordinate.roomX - 1, roomZ: coordinate.roomZ },
    { roomX: coordinate.roomX, roomZ: coordinate.roomZ + 1 },
    { roomX: coordinate.roomX, roomZ: coordinate.roomZ - 1 },
  ];
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

// 플레이어 위치를 현재 방의 벽·문 규칙에 맞게 제한합니다.
// - 갭 통로: 방 폭을 벗어나 방 사이 간격을 건너는 중이면 수직축을 문 폭(±DOORWAY_WIDTH/2) 안으로 제한합니다.
// - 벽 한계: 벽에서 WALL_COLLISION_MARGIN 만큼 떨어진 한계를 넘지 못합니다.
// - 문 통과: 해당 면에 문이 있고 문 폭 안에 정렬돼 있으면 한계를 넘는 것을 허용합니다.
export function clampPlayerPosition(position: { x: number; z: number }, doorStates: RoomDoorStates): { x: number; z: number } {
  const coordinate = findRoomCoordinateFromWorldPosition(position.x, position.z);
  const roomCenter = findRoomCenter(coordinate);

  const localX = position.x - roomCenter.x;
  const localZ = position.z - roomCenter.z;

  const wallLimitX = HALF_ROOM_WIDTH - WALL_COLLISION_MARGIN;
  const wallLimitZ = HALF_ROOM_DEPTH - WALL_COLLISION_MARGIN;
  const doorwayHalfWidth = DOORWAY_WIDTH / 2;

  let clampedX = position.x;
  let clampedZ = position.z;

  if (Math.abs(localX) > HALF_ROOM_WIDTH) {
    // 방 사이 간격(문 통로)을 건너는 중에는 통로 폭 안에 머물도록 측면을 제한합니다.
    clampedZ = roomCenter.z + clampNumber(localZ, -doorwayHalfWidth, doorwayHalfWidth);
  } else if (localX < -wallLimitX) {
    if (!doorStates.negativeX || Math.abs(localZ) > doorwayHalfWidth) {
      clampedX = roomCenter.x - wallLimitX;
    }
  } else if (localX > wallLimitX) {
    if (!doorStates.positiveX || Math.abs(localZ) > doorwayHalfWidth) {
      clampedX = roomCenter.x + wallLimitX;
    }
  }

  if (Math.abs(localZ) > HALF_ROOM_DEPTH) {
    clampedX = roomCenter.x + clampNumber(localX, -doorwayHalfWidth, doorwayHalfWidth);
  } else if (localZ < -wallLimitZ) {
    if (!doorStates.negativeZ || Math.abs(localX) > doorwayHalfWidth) {
      clampedZ = roomCenter.z - wallLimitZ;
    }
  } else if (localZ > wallLimitZ) {
    if (!doorStates.positiveZ || Math.abs(localX) > doorwayHalfWidth) {
      clampedZ = roomCenter.z + wallLimitZ;
    }
  }

  return { x: clampedX, z: clampedZ };
}
