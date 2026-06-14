// 키보드(WASD/방향키)·마우스(포인터록 + 드래그) 입력으로 1인칭 카메라를 움직이는 계층입니다.
// 충돌 처리는 tools 의 clampPlayerPosition 을 호출하며 물리 로직을 재구현하지 않습니다.

import * as THREE from 'three';
import { EYE_HEIGHT, LOOK_SPEED, MOVEMENT_SPEED } from '../tools/constants.ts';
import { clampPlayerPosition, findRoomCoordinateFromWorldPosition } from '../tools/room-grid.ts';
import type { RoomCoordinate, RoomDoorStates } from '../tools/room-grid.ts';

// 한 이벤트에서 허용하는 시점 회전 입력량의 상한(포인터록 기준)입니다.
const MAXIMUM_LOOK_DELTA = 120;

// 드래그 회전에서 비정상적으로 큰 점프 입력을 무시하는 한계입니다.
const MAXIMUM_DRAG_DELTA = 150;

// 위/아래 시점 각도의 한계(라디안)입니다.
const PITCH_LIMIT = 1.25;

export interface PlayerControllerOptions {
  canvasElement: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  // 현재 위치한 방의 각 면 통행 가능 여부를 조회합니다.
  findDoorStates: (coordinate: RoomCoordinate) => RoomDoorStates;
  // 마우스로 시점이 회전했을 때 호출됩니다.
  onViewRotated: () => void;
}

export interface PlayerController {
  // 한 프레임만큼 이동을 적용합니다. 이동이 있었으면 true 를 반환합니다.
  update(deltaSeconds: number): boolean;
  findPlayerState(): { x: number; z: number; rotationY: number };
  dispose(): void;
}

export function createPlayerController(options: PlayerControllerOptions): PlayerController {
  const { camera, canvasElement } = options;
  camera.rotation.order = 'YXZ';

  const pressedKeys = new Set<string>();
  const state = {
    yaw: 0,
    pitch: 0,
    isDragging: false,
    lastClientX: 0,
    lastClientY: 0,
  };

  const applyLookDelta = (movementX: number, movementY: number) => {
    const clampedX = THREE.MathUtils.clamp(movementX, -MAXIMUM_LOOK_DELTA, MAXIMUM_LOOK_DELTA);
    const clampedY = THREE.MathUtils.clamp(movementY, -MAXIMUM_LOOK_DELTA, MAXIMUM_LOOK_DELTA);

    state.yaw -= clampedX * LOOK_SPEED;
    state.pitch = THREE.MathUtils.clamp(state.pitch - clampedY * LOOK_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
    camera.rotation.set(state.pitch, state.yaw, 0);
    options.onViewRotated();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    pressedKeys.add(event.code);
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    pressedKeys.delete(event.code);
  };

  const handlePointerLockChange = () => {
    state.isDragging = document.pointerLockElement === canvasElement;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement === canvasElement) {
      applyLookDelta(event.movementX, event.movementY);
      return;
    }

    if (!state.isDragging) {
      return;
    }

    const deltaX = event.clientX - state.lastClientX;
    const deltaY = event.clientY - state.lastClientY;

    if (Math.abs(deltaX) < MAXIMUM_DRAG_DELTA && Math.abs(deltaY) < MAXIMUM_DRAG_DELTA) {
      applyLookDelta(deltaX, deltaY);
    }

    state.lastClientX = event.clientX;
    state.lastClientY = event.clientY;
  };

  const handleMouseDown = (event: MouseEvent) => {
    state.isDragging = true;
    state.lastClientX = event.clientX;
    state.lastClientY = event.clientY;
    canvasElement.focus();

    // 일부 브라우저에서 Promise 를 반환하므로 거부 시에도 오류 상태로 수렴시킵니다.
    const pointerLockResult: unknown = canvasElement.requestPointerLock();
    if (pointerLockResult instanceof Promise) {
      pointerLockResult.catch((error: unknown) => {
        console.error('포인터 잠금 요청이 거부되어 드래그 회전만 사용합니다.', error);
      });
    }
  };

  const handleMouseUp = () => {
    if (document.pointerLockElement !== canvasElement) {
      state.isDragging = false;
    }
  };

  canvasElement.tabIndex = 0;
  canvasElement.style.cursor = 'crosshair';
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  document.addEventListener('pointerlockchange', handlePointerLockChange);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  canvasElement.addEventListener('mousedown', handleMouseDown);

  return {
    update(deltaSeconds) {
      const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
      const movement = new THREE.Vector3();

      if (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) {
        movement.add(forward);
      }
      if (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown')) {
        movement.sub(forward);
      }
      if (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) {
        movement.add(right);
      }
      if (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft')) {
        movement.sub(right);
      }

      if (movement.lengthSq() === 0) {
        return false;
      }

      movement.normalize().multiplyScalar(MOVEMENT_SPEED * deltaSeconds);
      camera.position.add(movement);
      camera.position.y = EYE_HEIGHT;

      const coordinate = findRoomCoordinateFromWorldPosition(camera.position.x, camera.position.z);
      const doorStates = options.findDoorStates(coordinate);
      const clampedPosition = clampPlayerPosition({ x: camera.position.x, z: camera.position.z }, doorStates);
      camera.position.x = clampedPosition.x;
      camera.position.z = clampedPosition.z;

      return true;
    },

    findPlayerState() {
      return {
        x: camera.position.x,
        z: camera.position.z,
        rotationY: state.yaw,
      };
    },

    dispose() {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      canvasElement.removeEventListener('mousedown', handleMouseDown);

      if (document.pointerLockElement === canvasElement) {
        document.exitPointerLock();
      }

      pressedKeys.clear();
    },
  };
}
