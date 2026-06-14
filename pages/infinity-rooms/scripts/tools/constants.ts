// 방 공간 구성에 사용하는 순수 상수 모음입니다. DOM/Three.js 의존이 없습니다.

export const ROOM_WIDTH = 10;
export const ROOM_HEIGHT = 5;
export const ROOM_DEPTH = 10;

// 인접한 방의 벽이 같은 평면에 겹치지 않도록 방 사이에 두는 물리적 간격입니다.
export const ROOM_GAP = 1;

// 방 중심 사이의 거리 (방 크기 + 벽 사이 간격). 월드 좌표 <-> 방 격자 좌표 변환의 기준입니다.
export const ROOM_PITCH_X = ROOM_WIDTH + ROOM_GAP;
export const ROOM_PITCH_Z = ROOM_DEPTH + ROOM_GAP;

export const HALF_ROOM_WIDTH = ROOM_WIDTH / 2;
export const HALF_ROOM_DEPTH = ROOM_DEPTH / 2;

export const DOORWAY_WIDTH = 1.2;
export const DOORWAY_HEIGHT = 2.2;

// 플레이어 시점(카메라) 눈높이입니다.
export const EYE_HEIGHT = 1.7;

// 초당 이동 속도입니다.
export const MOVEMENT_SPEED = 3.2;

// 마우스 이동량 대비 시점 회전 비율입니다.
export const LOOK_SPEED = 0.0022;

// 벽과 플레이어 사이에 유지하는 충돌 여유 거리입니다.
export const WALL_COLLISION_MARGIN = 0.35;
