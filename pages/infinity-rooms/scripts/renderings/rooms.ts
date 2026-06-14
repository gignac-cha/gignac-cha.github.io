// 방 빌더 계층입니다. 벽(도어웨이 커넥터 포함)·바닥·천장·몰딩·조명·스켈레톤 그리드·가구 배치를 만들고
// 방 격자 좌표별 렌더 상태 맵을 관리합니다.

import * as THREE from 'three';
import {
  DOORWAY_HEIGHT,
  DOORWAY_WIDTH,
  HALF_ROOM_DEPTH,
  HALF_ROOM_WIDTH,
  ROOM_DEPTH,
  ROOM_GAP,
  ROOM_HEIGHT,
  ROOM_WIDTH,
} from '../tools/constants.ts';
import { createRoomKey, findRoomCenter, listAdjacentRoomCoordinates } from '../tools/room-grid.ts';
import type { RoomCoordinate, RoomDoorStates, RoomSummary } from '../tools/room-grid.ts';
import { FURNITURE_NAMES } from './furniture.ts';
import type { RoomThemeData } from '../languages/room-themes.ts';
import { createDoor } from './door.ts';
import { createFurnitureObject, FURNITURE_SPECIFICATIONS } from './furniture.ts';
import { disposeObjectTree } from './renderers.ts';

type RoomFurnitureItem = RoomThemeData['furniture'][number];

// 미생성(스켈레톤) 방의 반투명 표면 색입니다.
const SKELETON_WALL_COLOR = '#dbe2ea';
const SKELETON_FLOOR_COLOR = '#b8c1cc';
const SKELETON_CEILING_COLOR = '#f4f7fb';
const SKELETON_SURFACE_OPACITY = 0.35;

// 스켈레톤 방의 문 색을 좌표 시드로 고르는 후보 팔레트입니다.
const SKELETON_DOOR_COLORS = [0x334155, 0x1e3a8a, 0x064e3b, 0x701a75];

const TRIM_COLOR = 0x334155;
const DASHED_GRID_COLOR = 0x94a3b8;

// 바닥 몰딩 두께와 문 주변에서 몰딩을 비워 두는 절반 폭입니다.
const MOLDING_EDGE = 0.08;
const MOLDING_DOORWAY_HALF_WIDTH = 1;

// 스켈레톤 점선 그리드에서 문 개구부로 비워 두는 절반 폭과 문 상단 높이(격자선 단위)입니다.
const GRID_DOORWAY_HALF_WIDTH = 1;
const GRID_DOORWAY_TOP = 3;

// 문 통로 앞 가구 배치를 비워 두는 영역 크기입니다.
const DOORWAY_CLEARANCE_HALF_WIDTH = 1.3;
const DOORWAY_CLEARANCE_DEPTH = 1.8;
const NEAR_WALL_THRESHOLD = 4.2;

// 충돌 반경이 있는 가구가 벽에 붙지 않도록 하는 한계와 완화 반복 횟수입니다.
const FURNITURE_WALL_GUARD = 4.5;
const COLLISION_RELAXATION_ITERATIONS = 6;

const WALL_FRAME_MOUNT_HEIGHT = 2.0;

// 벽에 부착되는 가구(벽면에 스냅하고 벽을 등지도록 회전)와 천장에 매다는 가구(천장 높이에 배치)의 이름 집합입니다.
const WALL_MOUNTED_NAMES = new Set<string>(['wall-frame', 'mirror', 'wall-clock', 'curtains', 'sconce']);
const CEILING_MOUNTED_NAMES = new Set<string>(['ceiling-light', 'ceiling-fan', 'chandelier']);

// 벽 부착 가구의 벽면 여백(벽 평면에서 살짝 띄움)과 마운트 높이입니다.
const WALL_MOUNT_OFFSET = 0.06;
// sconce 는 보통 눈높이보다 위에 다는 보조 조명이라 더 높게, 나머지 벽 부착물은 표준 높이로 둡니다.
const SCONCE_MOUNT_HEIGHT = 2.6;

function findFurnitureRadius(name: string): number {
  return FURNITURE_SPECIFICATIONS[name]?.radius ?? 0.5;
}

// 가구가 어느 배치 부류(바닥/벽/천장)인지 판정합니다.
function isWallMountedFurniture(name: string): boolean {
  return WALL_MOUNTED_NAMES.has(name);
}

function isCeilingMountedFurniture(name: string): boolean {
  return CEILING_MOUNTED_NAMES.has(name);
}

// 가구의 배치 부류에 따른 Y 높이를 정합니다. 바닥 가구는 0, 천장 가구는 천장 높이, 벽 부착물은 마운트 높이입니다.
function findFurnitureMountY(name: string): number {
  if (isCeilingMountedFurniture(name)) {
    return ROOM_HEIGHT;
  }
  if (name === 'sconce') {
    return SCONCE_MOUNT_HEIGHT;
  }
  if (isWallMountedFurniture(name)) {
    return WALL_FRAME_MOUNT_HEIGHT;
  }
  return 0;
}

function createDashedLineMaterial(): THREE.LineDashedMaterial {
  return new THREE.LineDashedMaterial({
    color: DASHED_GRID_COLOR,
    dashSize: 0.12,
    gapSize: 0.08,
    transparent: true,
    opacity: 0.45,
  });
}

interface DoorwayWallParameters {
  wallMaterial: THREE.Material;
  floorMaterial: THREE.Material;
  position: THREE.Vector3;
  rotationY: number;
  isGenerated: boolean;
  doorColor: number;
}

// 가운데에 문 개구부가 있는 벽 한 면을 만듭니다.
// 벽 로컬 좌표에서 -Z 방향이 항상 방 바깥(방 사이 간격 쪽)을 향합니다.
function createDoorwayWall(parameters: DoorwayWallParameters): THREE.Group {
  const { wallMaterial, floorMaterial, position, rotationY, isGenerated, doorColor } = parameters;

  const wallGroup = new THREE.Group();
  wallGroup.position.copy(position);
  wallGroup.rotation.y = rotationY;

  // 문 개구부 양옆 벽 패널입니다.
  const sidePanelWidth = (ROOM_WIDTH - DOORWAY_WIDTH) / 2;
  const sidePanelCenterX = (DOORWAY_WIDTH + sidePanelWidth) / 2;

  const leftPanelMesh = new THREE.Mesh(new THREE.PlaneGeometry(sidePanelWidth, ROOM_HEIGHT), wallMaterial);
  leftPanelMesh.position.set(-sidePanelCenterX, ROOM_HEIGHT / 2, 0);
  wallGroup.add(leftPanelMesh);

  const rightPanelMesh = new THREE.Mesh(new THREE.PlaneGeometry(sidePanelWidth, ROOM_HEIGHT), wallMaterial);
  rightPanelMesh.position.set(sidePanelCenterX, ROOM_HEIGHT / 2, 0);
  wallGroup.add(rightPanelMesh);

  // 문 개구부 위쪽 헤더 패널입니다.
  const headerHeight = ROOM_HEIGHT - DOORWAY_HEIGHT;
  const headerMesh = new THREE.Mesh(new THREE.PlaneGeometry(DOORWAY_WIDTH, headerHeight), wallMaterial);
  headerMesh.position.set(0, DOORWAY_HEIGHT + headerHeight / 2, 0);
  wallGroup.add(headerMesh);

  // 문틀입니다.
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    metalness: 0.1,
    transparent: !isGenerated,
    opacity: isGenerated ? 1.0 : SKELETON_SURFACE_OPACITY,
  });

  const verticalFrameGeometry = new THREE.BoxGeometry(0.06, DOORWAY_HEIGHT, 0.12);
  const leftFrameMesh = new THREE.Mesh(verticalFrameGeometry, frameMaterial);
  leftFrameMesh.position.set(-DOORWAY_WIDTH / 2, DOORWAY_HEIGHT / 2, 0);
  wallGroup.add(leftFrameMesh);

  const rightFrameMesh = new THREE.Mesh(verticalFrameGeometry, frameMaterial);
  rightFrameMesh.position.set(DOORWAY_WIDTH / 2, DOORWAY_HEIGHT / 2, 0);
  wallGroup.add(rightFrameMesh);

  const topFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(DOORWAY_WIDTH + 0.06, 0.06, 0.12), frameMaterial);
  topFrameMesh.position.set(0, DOORWAY_HEIGHT, 0);
  wallGroup.add(topFrameMesh);

  // 생성 완료된 방은 개구부를 열어 두고, 스켈레톤 방에만 반투명 문을 답니다.
  if (!isGenerated) {
    wallGroup.add(createDoor({ isGenerated, color: doorColor }));
  }

  // 방 사이 간격(ROOM_GAP) 중 이 방의 몫(절반)을 덮는 문 통로 연결부(터널)입니다.
  const halfGap = ROOM_GAP / 2;
  const halfDoorwayWidth = DOORWAY_WIDTH / 2;

  const connectorFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(DOORWAY_WIDTH, halfGap), floorMaterial);
  connectorFloorMesh.rotation.x = -Math.PI / 2;
  connectorFloorMesh.position.set(0, 0.002, -halfGap / 2);
  wallGroup.add(connectorFloorMesh);

  const connectorTopMesh = new THREE.Mesh(new THREE.PlaneGeometry(DOORWAY_WIDTH, halfGap), wallMaterial);
  connectorTopMesh.rotation.x = Math.PI / 2;
  connectorTopMesh.position.set(0, DOORWAY_HEIGHT, -halfGap / 2);
  wallGroup.add(connectorTopMesh);

  const connectorLeftJambMesh = new THREE.Mesh(new THREE.PlaneGeometry(halfGap, DOORWAY_HEIGHT), wallMaterial);
  connectorLeftJambMesh.rotation.y = Math.PI / 2;
  connectorLeftJambMesh.position.set(-halfDoorwayWidth, DOORWAY_HEIGHT / 2, -halfGap / 2);
  wallGroup.add(connectorLeftJambMesh);

  const connectorRightJambMesh = new THREE.Mesh(new THREE.PlaneGeometry(halfGap, DOORWAY_HEIGHT), wallMaterial);
  connectorRightJambMesh.rotation.y = Math.PI / 2;
  connectorRightJambMesh.position.set(halfDoorwayWidth, DOORWAY_HEIGHT / 2, -halfGap / 2);
  wallGroup.add(connectorRightJambMesh);

  return wallGroup;
}

// 바닥 둘레 몰딩을 추가합니다. 네 면 모두 문이 있으므로 문 주변은 비워 둡니다.
function addRoomMoldings(roomGroup: THREE.Group, trimMaterial: THREE.Material): void {
  const segmentLength = HALF_ROOM_WIDTH - MOLDING_DOORWAY_HALF_WIDTH;
  const segmentCenter = MOLDING_DOORWAY_HALF_WIDTH + segmentLength / 2;

  // 앞/뒤 벽(X축과 평행)의 몰딩입니다.
  [-HALF_ROOM_DEPTH, HALF_ROOM_DEPTH].forEach((positionZ) => {
    [-segmentCenter, segmentCenter].forEach((centerX) => {
      const moldingMesh = new THREE.Mesh(new THREE.BoxGeometry(segmentLength, MOLDING_EDGE, MOLDING_EDGE), trimMaterial);
      moldingMesh.position.set(centerX, MOLDING_EDGE / 2, positionZ);
      roomGroup.add(moldingMesh);
    });
  });

  // 좌/우 벽(Z축과 평행)의 몰딩입니다.
  [-HALF_ROOM_WIDTH, HALF_ROOM_WIDTH].forEach((positionX) => {
    [-segmentCenter, segmentCenter].forEach((centerZ) => {
      const moldingMesh = new THREE.Mesh(new THREE.BoxGeometry(MOLDING_EDGE, MOLDING_EDGE, segmentLength), trimMaterial);
      moldingMesh.position.set(positionX, MOLDING_EDGE / 2, centerZ);
      roomGroup.add(moldingMesh);
    });
  });
}

// 문 개구부가 비어 있는 벽면 점선 그리드(스켈레톤)를 만듭니다.
function createSkeletonWallGrid(position: THREE.Vector3, rotationY: number): THREE.LineSegments {
  const points: THREE.Vector3[] = [];

  // 왼쪽 구간(문 왼편)의 세로선과 가로선입니다.
  const leftVerticalCount = HALF_ROOM_WIDTH - GRID_DOORWAY_HALF_WIDTH + 1;
  Array.from({ length: leftVerticalCount }, (_, lineIndex) => -HALF_ROOM_WIDTH + lineIndex).forEach((lineX) => {
    points.push(new THREE.Vector3(lineX, 0, 0));
    points.push(new THREE.Vector3(lineX, ROOM_HEIGHT, 0));
  });
  Array.from({ length: ROOM_HEIGHT + 1 }, (_, lineIndex) => lineIndex).forEach((lineY) => {
    points.push(new THREE.Vector3(-HALF_ROOM_WIDTH, lineY, 0));
    points.push(new THREE.Vector3(-GRID_DOORWAY_HALF_WIDTH, lineY, 0));
  });

  // 오른쪽 구간(문 오른편)의 세로선과 가로선입니다.
  Array.from({ length: leftVerticalCount }, (_, lineIndex) => GRID_DOORWAY_HALF_WIDTH + lineIndex).forEach((lineX) => {
    points.push(new THREE.Vector3(lineX, 0, 0));
    points.push(new THREE.Vector3(lineX, ROOM_HEIGHT, 0));
  });
  Array.from({ length: ROOM_HEIGHT + 1 }, (_, lineIndex) => lineIndex).forEach((lineY) => {
    points.push(new THREE.Vector3(GRID_DOORWAY_HALF_WIDTH, lineY, 0));
    points.push(new THREE.Vector3(HALF_ROOM_WIDTH, lineY, 0));
  });

  // 문 개구부 위쪽 헤더 구간입니다.
  points.push(new THREE.Vector3(0, GRID_DOORWAY_TOP, 0));
  points.push(new THREE.Vector3(0, ROOM_HEIGHT, 0));
  Array.from({ length: ROOM_HEIGHT - GRID_DOORWAY_TOP + 1 }, (_, lineIndex) => GRID_DOORWAY_TOP + lineIndex).forEach((lineY) => {
    points.push(new THREE.Vector3(-GRID_DOORWAY_HALF_WIDTH, lineY, 0));
    points.push(new THREE.Vector3(GRID_DOORWAY_HALF_WIDTH, lineY, 0));
  });

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const lineSegments = new THREE.LineSegments(geometry, createDashedLineMaterial());
  lineSegments.position.copy(position);
  lineSegments.rotation.y = rotationY;
  lineSegments.computeLineDistances();
  return lineSegments;
}

// 바닥/천장용 점선 격자 헬퍼를 만듭니다.
function createSkeletonPlaneGrid(positionY: number): THREE.GridHelper {
  const gridHelper = new THREE.GridHelper(ROOM_WIDTH, ROOM_WIDTH, DASHED_GRID_COLOR, DASHED_GRID_COLOR);
  gridHelper.position.set(0, positionY, 0);
  (gridHelper.material as THREE.Material).dispose();
  gridHelper.material = createDashedLineMaterial();
  gridHelper.computeLineDistances();
  return gridHelper;
}

// 가구를 벽 중 가장 가까운 면에 붙이고 벽을 바라보지 않도록 회전시킵니다.
function snapItemToNearestWall(item: RoomFurnitureItem, wallOffset: number): void {
  const distanceToLeft = item.x - -HALF_ROOM_WIDTH;
  const distanceToRight = HALF_ROOM_WIDTH - item.x;
  const distanceToBack = item.z - -HALF_ROOM_DEPTH;
  const distanceToFront = HALF_ROOM_DEPTH - item.z;
  const minimumDistance = Math.min(distanceToLeft, distanceToRight, distanceToBack, distanceToFront);

  if (minimumDistance === distanceToLeft) {
    item.x = -HALF_ROOM_WIDTH + wallOffset;
    item.rotation = Math.PI / 2;
  } else if (minimumDistance === distanceToRight) {
    item.x = HALF_ROOM_WIDTH - wallOffset;
    item.rotation = -Math.PI / 2;
  } else if (minimumDistance === distanceToBack) {
    item.z = -HALF_ROOM_DEPTH + wallOffset;
    item.rotation = 0;
  } else {
    item.z = HALF_ROOM_DEPTH - wallOffset;
    item.rotation = Math.PI;
  }
}

// 네 방향 문 통로 앞 공간을 가구가 막지 않도록 밀어냅니다.
function applyDoorwayClearance(item: RoomFurnitureItem): void {
  const isWallMounted = isWallMountedFurniture(item.name) || item.name === 'bookshelf';

  if (Math.abs(item.x) < DOORWAY_CLEARANCE_HALF_WIDTH && item.z < -HALF_ROOM_DEPTH + DOORWAY_CLEARANCE_DEPTH) {
    if (isWallMounted || item.z < -NEAR_WALL_THRESHOLD) {
      item.x = item.x >= 0 ? DOORWAY_CLEARANCE_HALF_WIDTH : -DOORWAY_CLEARANCE_HALF_WIDTH;
    } else {
      item.z = -HALF_ROOM_DEPTH + DOORWAY_CLEARANCE_DEPTH;
    }
  }
  if (Math.abs(item.x) < DOORWAY_CLEARANCE_HALF_WIDTH && item.z > HALF_ROOM_DEPTH - DOORWAY_CLEARANCE_DEPTH) {
    if (isWallMounted || item.z > NEAR_WALL_THRESHOLD) {
      item.x = item.x >= 0 ? DOORWAY_CLEARANCE_HALF_WIDTH : -DOORWAY_CLEARANCE_HALF_WIDTH;
    } else {
      item.z = HALF_ROOM_DEPTH - DOORWAY_CLEARANCE_DEPTH;
    }
  }
  if (item.x < -HALF_ROOM_WIDTH + DOORWAY_CLEARANCE_DEPTH && Math.abs(item.z) < DOORWAY_CLEARANCE_HALF_WIDTH) {
    if (isWallMounted || item.x < -NEAR_WALL_THRESHOLD) {
      item.z = item.z >= 0 ? DOORWAY_CLEARANCE_HALF_WIDTH : -DOORWAY_CLEARANCE_HALF_WIDTH;
    } else {
      item.x = -HALF_ROOM_WIDTH + DOORWAY_CLEARANCE_DEPTH;
    }
  }
  if (item.x > HALF_ROOM_WIDTH - DOORWAY_CLEARANCE_DEPTH && Math.abs(item.z) < DOORWAY_CLEARANCE_HALF_WIDTH) {
    if (isWallMounted || item.x > NEAR_WALL_THRESHOLD) {
      item.z = item.z >= 0 ? DOORWAY_CLEARANCE_HALF_WIDTH : -DOORWAY_CLEARANCE_HALF_WIDTH;
    } else {
      item.x = HALF_ROOM_WIDTH - DOORWAY_CLEARANCE_DEPTH;
    }
  }
}

// 천장 가구가 천장 평면에서 서로 명백히 겹치지 않도록 최소 간격을 둡니다.
const CEILING_SPREAD_MIN_DISTANCE = 1.8;
const CEILING_SPREAD_ITERATIONS = 6;
// 천장 가구가 천장 격자 밖으로 나가지 않도록 두는 한계입니다.
const CEILING_GUARD = 4.0;

// 같은 벽에 붙은 벽 부착 가구가 겹치지 않도록 벽을 따라 최소로 띄우는 간격입니다.
const WALL_SPREAD_MIN_DISTANCE = 1.2;
const WALL_SPREAD_ITERATIONS = 6;

// 천장 가구 목록을 천장 평면(X,Z)에서 서로 밀어내 분산시키고 방 안으로 클램프합니다.
function spreadCeilingItems(ceilingItems: RoomFurnitureItem[]): void {
  Array.from({ length: CEILING_SPREAD_ITERATIONS }).forEach(() => {
    ceilingItems.forEach((item, index) => {
      ceilingItems.forEach((other, otherIndex) => {
        if (otherIndex <= index) {
          return;
        }
        const distance = Math.hypot(item.x - other.x, item.z - other.z);
        if (distance < CEILING_SPREAD_MIN_DISTANCE) {
          const overlap = CEILING_SPREAD_MIN_DISTANCE - distance;
          const pushX = distance === 0 ? 1 : (item.x - other.x) / distance;
          const pushZ = distance === 0 ? 0 : (item.z - other.z) / distance;
          item.x += pushX * overlap * 0.5;
          item.z += pushZ * overlap * 0.5;
          other.x -= pushX * overlap * 0.5;
          other.z -= pushZ * overlap * 0.5;
        }
      });
    });
  });

  ceilingItems.forEach((item) => {
    item.x = Math.max(-CEILING_GUARD, Math.min(CEILING_GUARD, item.x));
    item.z = Math.max(-CEILING_GUARD, Math.min(CEILING_GUARD, item.z));
  });
}

// 같은 벽면에 스냅된 벽 부착 가구들이 겹치지 않도록 벽을 따라(자유 축으로) 분산시킵니다.
function spreadWallItems(wallItems: RoomFurnitureItem[]): void {
  // 같은 벽면 판정: 벽에 스냅되면 좌/우 벽은 |x| 가 거의 HALF_ROOM_WIDTH, 앞/뒤 벽은 |z| 가 거의 HALF_ROOM_DEPTH 입니다.
  const isLeftRightWall = (item: RoomFurnitureItem): boolean => Math.abs(Math.abs(item.x) - HALF_ROOM_WIDTH) < 0.5;

  Array.from({ length: WALL_SPREAD_ITERATIONS }).forEach(() => {
    wallItems.forEach((item, index) => {
      wallItems.forEach((other, otherIndex) => {
        if (otherIndex <= index) {
          return;
        }
        // 다른 벽면에 있는 가구끼리는 분산 대상이 아닙니다.
        const sameLeftRight = isLeftRightWall(item) === isLeftRightWall(other);
        if (!sameLeftRight) {
          return;
        }
        // 좌/우 벽이면 Z축, 앞/뒤 벽이면 X축이 벽을 따라 움직일 수 있는 자유 축입니다.
        const alongLeftRight = isLeftRightWall(item);
        const itemAlong = alongLeftRight ? item.z : item.x;
        const otherAlong = alongLeftRight ? other.z : other.x;
        const onSameWallSide = alongLeftRight
          ? Math.sign(item.x) === Math.sign(other.x)
          : Math.sign(item.z) === Math.sign(other.z);
        if (!onSameWallSide) {
          return;
        }
        const gap = Math.abs(itemAlong - otherAlong);
        if (gap < WALL_SPREAD_MIN_DISTANCE) {
          const overlap = WALL_SPREAD_MIN_DISTANCE - gap;
          const push = gap === 0 ? 1 : Math.sign(itemAlong - otherAlong);
          if (alongLeftRight) {
            item.z += push * overlap * 0.5;
            other.z -= push * overlap * 0.5;
            item.z = Math.max(-CEILING_GUARD, Math.min(CEILING_GUARD, item.z));
            other.z = Math.max(-CEILING_GUARD, Math.min(CEILING_GUARD, other.z));
          } else {
            item.x += push * overlap * 0.5;
            other.x -= push * overlap * 0.5;
            item.x = Math.max(-CEILING_GUARD, Math.min(CEILING_GUARD, item.x));
            other.x = Math.max(-CEILING_GUARD, Math.min(CEILING_GUARD, other.x));
          }
        }
      });
    });
  });
}

// 테마 데이터의 가변 길이 가구 목록을 방에 배치합니다. 벽 부착·천장 매달기·문 통로 확보·충돌 완화를 거칩니다.
// 같은 종류가 여러 번 반복돼도(예: 의자 3개) 각 항목을 독립적으로 처리합니다.
function placeFurnitureForRoom(roomGroup: THREE.Group, furnitureList: RoomThemeData['furniture']): void {
  const items: RoomFurnitureItem[] = furnitureList.map((item) => ({ ...item }));

  // 벽 부착 가구는 가장 가까운 벽에 스냅해 벽을 등지도록 회전시킵니다.
  items.forEach((item) => {
    if (isWallMountedFurniture(item.name)) {
      snapItemToNearestWall(item, WALL_MOUNT_OFFSET);
    }
    if (item.name === 'bookshelf') {
      snapItemToNearestWall(item, 0.22);
    }
  });

  // 같은 벽면의 벽 부착물끼리 겹치지 않도록 벽을 따라 분산합니다.
  spreadWallItems(items.filter((item) => isWallMountedFurniture(item.name)));

  // 천장 가구끼리 천장 평면에서 겹치지 않도록 분산합니다.
  spreadCeilingItems(items.filter((item) => isCeilingMountedFurniture(item.name)));

  items.forEach((item, index) => {
    // 천장 가구는 문 통로 위 공간을 가리지 않으므로 클리어런스 대상에서 제외합니다.
    if (!isCeilingMountedFurniture(item.name)) {
      applyDoorwayClearance(item);
    }

    const itemRadius = findFurnitureRadius(item.name);
    if (itemRadius > 0) {
      // 바닥 가구끼리 겹치지 않도록 서로 밀어내는 완화를 여러 번 반복합니다.
      Array.from({ length: COLLISION_RELAXATION_ITERATIONS }).forEach(() => {
        items.forEach((other, otherIndex) => {
          if (otherIndex === index || FURNITURE_SPECIFICATIONS[other.name]?.radius === 0) {
            return;
          }

          const otherRadius = findFurnitureRadius(other.name);
          const distance = Math.hypot(item.x - other.x, item.z - other.z);
          const minimumDistance = itemRadius + otherRadius;

          if (distance < minimumDistance) {
            const overlap = minimumDistance - distance;
            const pushX = distance === 0 ? 1 : (item.x - other.x) / distance;
            const pushZ = distance === 0 ? 0 : (item.z - other.z) / distance;

            item.x += pushX * overlap * 0.5;
            item.z += pushZ * overlap * 0.5;
            other.x -= pushX * overlap * 0.5;
            other.z -= pushZ * overlap * 0.5;
          }
        });
      });

      item.x = Math.max(-FURNITURE_WALL_GUARD, Math.min(FURNITURE_WALL_GUARD, item.x));
      item.z = Math.max(-FURNITURE_WALL_GUARD, Math.min(FURNITURE_WALL_GUARD, item.z));
    }

    const furnitureObject = createFurnitureObject({
      name: item.name,
      variant: item.variant,
      color: item.color,
      legColor: item.legColor,
      topColor: item.topColor,
      lightColor: item.lightColor,
      artColor: item.artColor,
      frameColor: item.frameColor,
      beddingColor: item.beddingColor,
      handleColor: item.handleColor,
      bodyColor: item.bodyColor,
      potColor: item.potColor,
      foliageColor: item.foliageColor,
      glassColor: item.glassColor,
      waterColor: item.waterColor,
      bladeColor: item.bladeColor,
    });

    // 시점 중앙 포커스(레티클·디테일 패널)에서 읽을 가구 메타데이터를 그룹에 태깅합니다.
    // colors 에는 실제로 설정된 색상 필드만 담습니다(undefined 필드 제외).
    furnitureObject.userData.furniture = {
      name: item.name,
      variant: item.variant ?? 1,
      colors: collectFurnitureColors(item),
    };

    const itemY = findFurnitureMountY(item.name);
    furnitureObject.position.set(item.x, itemY, item.z);
    furnitureObject.rotation.y = item.rotation;
    roomGroup.add(furnitureObject);
  });
}

// 가구 항목에 실제로 설정된 색상 필드만 추려 { 필드명: hex } 형태로 모읍니다(undefined 제외).
function collectFurnitureColors(item: RoomFurnitureItem): Record<string, string> {
  const colorFieldNames = [
    'color',
    'legColor',
    'topColor',
    'lightColor',
    'artColor',
    'frameColor',
    'beddingColor',
    'handleColor',
    'bodyColor',
    'potColor',
    'foliageColor',
    'glassColor',
    'waterColor',
    'bladeColor',
  ] as const;

  const colors: Record<string, string> = {};
  colorFieldNames.forEach((fieldName) => {
    const value = item[fieldName];
    if (typeof value === 'string') {
      colors[fieldName] = value;
    }
  });
  return colors;
}

// 회색 톤으로 통일한 쇼룸 가구 견본 색입니다. (실제 테마 색 대신 견본임을 드러냅니다.)
const SHOWROOM_BODY_COLOR = '#94a3b8';
const SHOWROOM_LEG_COLOR = '#475569';
const SHOWROOM_ACCENT_COLOR = '#64748b';

// 쇼룸 가구가 벽을 뚫지 않도록 두는 평면 여백입니다.
const SHOWROOM_WALL_MARGIN = 0.05;

// 23종을 모두 전시하기 위한 격자(열 수)입니다. 6열 × 4행 = 24칸이라 23종이 방을 벗어나지 않고 들어갑니다.
const SHOWROOM_COLUMN_COUNT = 6;
// 견본을 늘어놓을 X·Z 범위(방 안쪽으로 약간 여유)입니다.
const SHOWROOM_GRID_HALF_X = 4.2;
const SHOWROOM_GRID_HALF_Z = 4.0;

// (0,0) 미생성 방에 띄우는 가구 견본 전시(쇼룸) 그룹을 만듭니다.
// 카탈로그 23종을 6열 격자에 한 점씩 늘어놓아 회색 톤으로 보여 줍니다. 변형(variant)은 색인을 돌며 다양하게 보여 줍니다.
// 좌표는 방 로컬 기준입니다.
export function createShowroomGroup(): THREE.Group {
  const showroomGroup = new THREE.Group();

  const totalCount = FURNITURE_NAMES.length;
  const rowCount = Math.ceil(totalCount / SHOWROOM_COLUMN_COUNT);

  // 격자가 방을 벗어나면 들어갈 만큼만 대표로 전시합니다(현재 23종은 6×4 격자에 모두 들어갑니다).
  const maxDisplayCount = SHOWROOM_COLUMN_COUNT * rowCount;
  if (totalCount > maxDisplayCount) {
    console.log(`[Showroom] 가구 ${totalCount}종 중 격자 한도(${maxDisplayCount})만큼만 전시합니다.`);
  }
  const displayCount = Math.min(totalCount, maxDisplayCount);

  // 열·행 간격을 격자 범위에 맞춰 균등 분할합니다.
  const columnStep = SHOWROOM_COLUMN_COUNT > 1 ? (SHOWROOM_GRID_HALF_X * 2) / (SHOWROOM_COLUMN_COUNT - 1) : 0;
  const rowStep = rowCount > 1 ? (SHOWROOM_GRID_HALF_Z * 2) / (rowCount - 1) : 0;

  FURNITURE_NAMES.slice(0, displayCount).forEach((furnitureName, itemIndex) => {
    const columnIndex = itemIndex % SHOWROOM_COLUMN_COUNT;
    const rowIndex = Math.floor(itemIndex / SHOWROOM_COLUMN_COUNT);
    const variant = (itemIndex % 3) + 1;

    const baseX = -SHOWROOM_GRID_HALF_X + columnIndex * columnStep;
    const baseZ = -SHOWROOM_GRID_HALF_Z + rowIndex * rowStep;

    const specification = FURNITURE_SPECIFICATIONS[furnitureName];
    const wallGuardX = HALF_ROOM_WIDTH - specification.width / 2 - SHOWROOM_WALL_MARGIN;
    const wallGuardZ = HALF_ROOM_DEPTH - specification.depth / 2 - SHOWROOM_WALL_MARGIN;

    const itemX = Math.max(-wallGuardX, Math.min(wallGuardX, baseX));
    const itemZ = Math.max(-wallGuardZ, Math.min(wallGuardZ, baseZ));

    const furnitureObject = createFurnitureObject({
      name: furnitureName,
      variant,
      color: SHOWROOM_BODY_COLOR,
      topColor: SHOWROOM_BODY_COLOR,
      legColor: SHOWROOM_LEG_COLOR,
      lightColor: SHOWROOM_ACCENT_COLOR,
      artColor: SHOWROOM_BODY_COLOR,
      frameColor: SHOWROOM_BODY_COLOR,
      beddingColor: SHOWROOM_ACCENT_COLOR,
      handleColor: SHOWROOM_LEG_COLOR,
      bodyColor: SHOWROOM_BODY_COLOR,
      potColor: SHOWROOM_LEG_COLOR,
      foliageColor: SHOWROOM_ACCENT_COLOR,
      glassColor: SHOWROOM_BODY_COLOR,
      waterColor: SHOWROOM_ACCENT_COLOR,
      bladeColor: SHOWROOM_BODY_COLOR,
    });

    const itemY = findFurnitureMountY(furnitureName);
    furnitureObject.position.set(itemX, itemY, itemZ);
    showroomGroup.add(furnitureObject);
  });

  return showroomGroup;
}

// 방 한 칸의 3차원 그룹을 만듭니다. themeData 가 null 이면 반투명 스켈레톤 방을 만듭니다.
function buildRoomGroup(coordinate: RoomCoordinate, themeData: RoomThemeData | null): THREE.Group {
  const isGenerated = themeData !== null;
  const roomGroup = new THREE.Group();
  const roomCenter = findRoomCenter(coordinate);
  roomGroup.position.set(roomCenter.x, 0, roomCenter.z);

  const surfaceOpacity = isGenerated ? 1.0 : SKELETON_SURFACE_OPACITY;

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(themeData?.room.wallColor ?? SKELETON_WALL_COLOR),
    roughness: 0.86,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: !isGenerated,
    opacity: surfaceOpacity,
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(themeData?.room.floorColor ?? SKELETON_FLOOR_COLOR),
    roughness: 0.9,
    metalness: 0.01,
    side: THREE.DoubleSide,
    transparent: !isGenerated,
    opacity: surfaceOpacity,
  });

  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(themeData?.room.ceilingColor ?? SKELETON_CEILING_COLOR),
    roughness: 0.8,
    metalness: 0.01,
    side: THREE.DoubleSide,
    transparent: !isGenerated,
    opacity: surfaceOpacity,
  });

  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  roomGroup.add(floorMesh);

  const ceilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), ceilingMaterial);
  ceilingMesh.position.y = ROOM_HEIGHT;
  ceilingMesh.rotation.x = Math.PI / 2;
  roomGroup.add(ceilingMesh);

  // 스켈레톤 방의 문 색을 좌표 시드로 결정합니다. (생성 완료된 방은 개구부를 열어 두므로 문이 없습니다.)
  const seedIndex = Math.abs(coordinate.roomX * 7 + coordinate.roomZ * 13) % SKELETON_DOOR_COLORS.length;
  const doorColor = SKELETON_DOOR_COLORS[seedIndex];

  // 방마다 자기 벽 4면을 모두 렌더링합니다. 인접 방의 벽과는 ROOM_GAP 만큼 물리적으로 떨어져 있어 겹치지 않습니다.
  const wallParameters = { wallMaterial, floorMaterial, isGenerated, doorColor };
  roomGroup.add(createDoorwayWall({ ...wallParameters, position: new THREE.Vector3(0, 0, -HALF_ROOM_DEPTH), rotationY: 0 }));
  roomGroup.add(createDoorwayWall({ ...wallParameters, position: new THREE.Vector3(0, 0, HALF_ROOM_DEPTH), rotationY: Math.PI }));
  roomGroup.add(createDoorwayWall({ ...wallParameters, position: new THREE.Vector3(-HALF_ROOM_WIDTH, 0, 0), rotationY: Math.PI / 2 }));
  roomGroup.add(createDoorwayWall({ ...wallParameters, position: new THREE.Vector3(HALF_ROOM_WIDTH, 0, 0), rotationY: -Math.PI / 2 }));

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: TRIM_COLOR,
    roughness: 0.7,
    metalness: 0.08,
  });
  addRoomMoldings(roomGroup, trimMaterial);

  if (!isGenerated) {
    // 미생성 방은 바닥·천장·벽 4면에 반투명 점선 그리드를 덧그립니다.
    const skeletonGridGroup = new THREE.Group();
    skeletonGridGroup.add(createSkeletonPlaneGrid(0.002));
    skeletonGridGroup.add(createSkeletonPlaneGrid(ROOM_HEIGHT - 0.002));
    skeletonGridGroup.add(createSkeletonWallGrid(new THREE.Vector3(0, 0.002, -HALF_ROOM_DEPTH + 0.002), 0));
    skeletonGridGroup.add(createSkeletonWallGrid(new THREE.Vector3(0, 0.002, HALF_ROOM_DEPTH - 0.002), Math.PI));
    skeletonGridGroup.add(createSkeletonWallGrid(new THREE.Vector3(-HALF_ROOM_WIDTH + 0.002, 0.002, 0), Math.PI / 2));
    skeletonGridGroup.add(createSkeletonWallGrid(new THREE.Vector3(HALF_ROOM_WIDTH - 0.002, 0.002, 0), -Math.PI / 2));
    roomGroup.add(skeletonGridGroup);
  }

  if (themeData) {
    placeFurnitureForRoom(roomGroup, themeData.furniture);
  }

  return roomGroup;
}

export interface RoomRenderState {
  roomX: number;
  roomZ: number;
  isGenerated: boolean;
  isGenerating: boolean;
  // 직전 테마 생성 요청이 실패해 스켈레톤으로 남은 방인지 여부입니다(기본 false).
  isFailed: boolean;
  themeData: RoomThemeData | null;
  group: THREE.Group;
}

export interface RoomStore {
  // 해당 좌표에 방이 없으면 스켈레톤을 만듭니다. 새로 만들었으면 true 를 반환합니다.
  ensureSkeletonRoom(coordinate: RoomCoordinate): boolean;
  // 상하좌우 인접 좌표 4곳에 스켈레톤을 보장합니다. 하나라도 새로 만들었으면 true 를 반환합니다.
  ensureAdjacentSkeletonRooms(coordinate: RoomCoordinate): boolean;
  findRoomState(coordinate: RoomCoordinate): RoomRenderState | null;
  // 상하좌우 인접 방 중 이미 생성 완료된 첫 방의 테마 데이터를 반환합니다. 없으면 null 입니다.
  findGeneratedNeighborTheme(coordinate: RoomCoordinate): RoomThemeData | null;
  setRoomGenerating(coordinate: RoomCoordinate, isGenerating: boolean): void;
  // 해당 방의 생성 실패 표시를 설정합니다. 재시도·재생성·생성 성공 시 false 로 클리어됩니다.
  setRoomFailed(coordinate: RoomCoordinate, isFailed: boolean): void;
  // 테마 데이터를 적용해 스켈레톤을 생성 완료된 방으로 다시 만듭니다.
  applyRoomTheme(coordinate: RoomCoordinate, themeData: RoomThemeData): void;
  // 현재 방과 인접 방의 생성 상태로 각 면의 통행 가능 여부를 판정합니다.
  findDoorStates(coordinate: RoomCoordinate): RoomDoorStates;
  listRoomSummaries(): RoomSummary[];
  disposeAll(): void;
}

export function createRoomStore(worldGroup: THREE.Group): RoomStore {
  const roomStatesMap = new Map<string, RoomRenderState>();

  const buildRoomState = (coordinate: RoomCoordinate, themeData: RoomThemeData | null): RoomRenderState => {
    return {
      roomX: coordinate.roomX,
      roomZ: coordinate.roomZ,
      isGenerated: themeData !== null,
      isGenerating: false,
      // 새 방·스켈레톤은 항상 실패 표시 없이 시작합니다(재생성 시에도 클리어된 상태로 다시 만들어집니다).
      isFailed: false,
      themeData,
      group: buildRoomGroup(coordinate, themeData),
    };
  };

  const checkRoomGenerated = (coordinate: RoomCoordinate): boolean => {
    return roomStatesMap.get(createRoomKey(coordinate))?.isGenerated ?? false;
  };

  const ensureSkeletonRoom = (coordinate: RoomCoordinate): boolean => {
    const key = createRoomKey(coordinate);
    if (roomStatesMap.has(key)) {
      return false;
    }
    const roomState = buildRoomState(coordinate, null);
    roomStatesMap.set(key, roomState);
    // 스켈레톤은 만들어지는 즉시 씬에 붙이고, 실제 생성되기 전까지 절대 제거하지 않습니다(항상 존재).
    worldGroup.add(roomState.group);
    return true;
  };

  return {
    ensureSkeletonRoom,

    ensureAdjacentSkeletonRooms(coordinate) {
      return listAdjacentRoomCoordinates(coordinate)
        .map((adjacentCoordinate) => ensureSkeletonRoom(adjacentCoordinate))
        .some((isCreated) => isCreated);
    },

    findRoomState(coordinate) {
      return roomStatesMap.get(createRoomKey(coordinate)) ?? null;
    },

    findGeneratedNeighborTheme(coordinate) {
      for (const adjacentCoordinate of listAdjacentRoomCoordinates(coordinate)) {
        const neighborState = roomStatesMap.get(createRoomKey(adjacentCoordinate));
        if (neighborState?.isGenerated && neighborState.themeData) {
          return neighborState.themeData;
        }
      }
      return null;
    },

    setRoomGenerating(coordinate, isGenerating) {
      const roomState = roomStatesMap.get(createRoomKey(coordinate));
      if (roomState) {
        roomState.isGenerating = isGenerating;
        // 생성을 새로 시작하면 직전 실패 표시를 지웁니다(스피너와 실패 칩이 동시에 뜨지 않도록).
        if (isGenerating) {
          roomState.isFailed = false;
        }
      }
    },

    setRoomFailed(coordinate, isFailed) {
      const roomState = roomStatesMap.get(createRoomKey(coordinate));
      if (roomState) {
        roomState.isFailed = isFailed;
      }
    },

    applyRoomTheme(coordinate, themeData) {
      const key = createRoomKey(coordinate);
      const nextState = buildRoomState(coordinate, themeData);

      const previousState = roomStatesMap.get(key);
      if (previousState) {
        worldGroup.remove(previousState.group);
        disposeObjectTree(previousState.group);
      }

      roomStatesMap.set(key, nextState);
      // 생성 완료된 방 그룹을 곧바로 씬에 붙입니다.
      worldGroup.add(nextState.group);
    },

    findDoorStates(coordinate) {
      const isCurrentGenerated = checkRoomGenerated(coordinate);
      return {
        positiveX: isCurrentGenerated || checkRoomGenerated({ roomX: coordinate.roomX + 1, roomZ: coordinate.roomZ }),
        negativeX: isCurrentGenerated || checkRoomGenerated({ roomX: coordinate.roomX - 1, roomZ: coordinate.roomZ }),
        positiveZ: isCurrentGenerated || checkRoomGenerated({ roomX: coordinate.roomX, roomZ: coordinate.roomZ + 1 }),
        negativeZ: isCurrentGenerated || checkRoomGenerated({ roomX: coordinate.roomX, roomZ: coordinate.roomZ - 1 }),
      };
    },

    listRoomSummaries() {
      return Array.from(roomStatesMap.values()).map((roomState) => ({
        roomX: roomState.roomX,
        roomZ: roomState.roomZ,
        isGenerated: roomState.isGenerated,
        isGenerating: roomState.isGenerating,
        isFailed: roomState.isFailed,
        themeColor: roomState.themeData?.room.wallColor ?? null,
        themeName: roomState.themeData?.room.theme ?? null,
      }));
    },

    disposeAll() {
      roomStatesMap.forEach((roomState) => {
        if (roomState.group.parent === worldGroup) {
          worldGroup.remove(roomState.group);
        }
        disposeObjectTree(roomState.group);
      });
      roomStatesMap.clear();
    },
  };
}

export interface SceneLighting {
  group: THREE.Group;
  // 주 조명을 활성 방 중심 위로 옮깁니다.
  setActiveRoomCenter(x: number, z: number): void;
}

// 장면 전역 조명(주변광 + 주 점광원)을 만듭니다.
export function createSceneLighting(): SceneLighting {
  const group = new THREE.Group();

  const ambientLight = new THREE.AmbientLight(0x8aa0b8, 1.8);
  group.add(ambientLight);

  const keyLight = new THREE.PointLight(0xffffff, 9, 18);
  keyLight.position.set(0, ROOM_HEIGHT - 0.8, 0);
  group.add(keyLight);

  return {
    group,
    setActiveRoomCenter(x, z) {
      keyLight.position.set(x, ROOM_HEIGHT - 0.8, z);
    },
  };
}

// 방 바깥 배경(하늘 구체와 지면)을 만듭니다.
export function createEnvironmentGroup(): THREE.Group {
  const environmentGroup = new THREE.Group();

  const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x075985, side: THREE.BackSide });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 15), skyMaterial);
  skyMesh.position.set(0, 0, 0);
  environmentGroup.add(skyMesh);

  const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), groundMaterial);
  groundMesh.position.set(0, -0.2, 0);
  groundMesh.rotation.x = -Math.PI / 2;
  environmentGroup.add(groundMesh);

  return environmentGroup;
}
