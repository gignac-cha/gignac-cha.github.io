// 렌더러·방 저장소·플레이어 컨트롤러를 조립해 무한의 방 장면의 공개 계약을 제공하는 계층입니다.

import * as THREE from 'three';
import { EYE_HEIGHT } from '../tools/constants.ts';
import { createRequestPool } from '../tools/request-pools.ts';
import type { RequestPool } from '../tools/request-pools.ts';
import { findRoomCenter, findRoomCoordinateFromWorldPosition, listAdjacentRoomCoordinates } from '../tools/room-grid.ts';
import type { RoomCoordinate, RoomSummary } from '../tools/room-grid.ts';
import type { RoomThemeData } from '../languages/room-themes.ts';
import { createPlayerController } from './player.ts';
import type { PlayerController } from './player.ts';
import { createRenderingRuntime, disposeObjectTree } from './renderers.ts';
import type { RenderingRuntime } from './renderers.ts';
import { createEnvironmentGroup, createRoomStore, createSceneLighting, createShowroomGroup } from './rooms.ts';
import type { RoomStore, SceneLighting } from './rooms.ts';

const CAMERA_FIELD_OF_VIEW = 72;
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 80;
const SCENE_BACKGROUND_COLOR = 0x111827;

// 시작 시 플레이어가 방 중심보다 약간 뒤에 서도록 하는 초기 Z 위치입니다.
const INITIAL_CAMERA_Z = 4.0;

// 시점 줌(Z 홀드 / Shift+Z 토글)에서 사용하는 좁은 시야각과 FOV 보간 속도입니다.
const ZOOMED_FIELD_OF_VIEW = 32;
const ZOOM_LERP_SPEED = 12;

// 첫 방(0,0)의 자동 생성만 전용 1-슬롯 풀로 직렬 처리하고, 그 외 모든 요청은 8-슬롯 풀에서 병렬 처리합니다.
const INITIAL_AUTO_POOL_CONCURRENCY = 1;
const MAIN_POOL_CONCURRENCY = 8;

// 생성 풀의 활성/대기 수 묶음입니다.
export interface GenerationPoolCounts {
  active: number;
  queued: number;
}

// 시점 중앙(NDC 0,0)에서 광선을 쏴 맞춘 가구의 메타데이터입니다. 없으면 null 로 통지됩니다.
export interface FurnitureFocus {
  name: string;
  variant: number;
  colors: Record<string, string>;
}

// 중앙 포커스 raycast 를 N 프레임마다 수행하는 간격입니다(광선 1개, 활성 방 가구로 한정).
const FOCUS_RAYCAST_FRAME_INTERVAL = 4;

// 시점 중앙에 가구가 잡혀도 이 거리(월드 단위)보다 멀면 포커스하지 않습니다("가까이 있을 때만").
const FOCUS_DISTANCE = 3.5;
// 포커스된 가구를 감싸는 외곽선 색(액센트)입니다.
const FOCUS_OUTLINE_COLOR = 0x2563eb;

export interface RoomSceneOptions {
  container: HTMLElement;
  // 미생성 방에 들어갈 때 호출되는 테마 생성 요청입니다. 실패 시 해당 방은 스켈레톤으로 유지됩니다.
  // neighborThemeData 가 있으면 인접 방 팔레트를 시드로 넘겨 색 연속성을 부여합니다.
  requestRoomTheme: (coordinate: RoomCoordinate, neighborThemeData: RoomThemeData | null) => Promise<RoomThemeData>;
}

export interface RoomSceneHandle {
  start(): Promise<void>;
  // 렌더 루프를 멈춥니다. 자원 일부를 보존해 start() 로 재개할 수 있습니다.
  stop(): void;
  // 렌더 루프가 동작 중인지 여부입니다.
  isRunning(): boolean;
  dispose(): void;
  onRoomsChanged(callback: (rooms: RoomSummary[]) => void): void;
  onPlayerMoved(callback: (position: { x: number; z: number; rotationY: number }) => void): void;
  // 시점 중앙에 잡힌 가구가 바뀔 때만 통지받습니다(매 프레임 중복 통지 없음). 포커스가 없으면 null.
  onFocusChange(callback: (focus: FurnitureFocus | null) => void): void;
  // 자동 생성 ON/OFF 를 전환합니다. OFF 면 미생성 방 진입 시 자동 테마 요청을 하지 않습니다.
  setAutoGenerate(enabled: boolean): void;
  // 토글과 무관하게 현재 플레이어가 있는 방의 테마 생성을 즉시 요청합니다(수동 트리거).
  triggerGeneration(): void;
  // 시점 중앙에 포커스된 발광 가구의 조명(PointLight·emissive)을 켜고 끕니다. 포커스가 없으면 아무 동작도 하지 않습니다.
  toggleFocusedLight(): void;
  // 시점 줌 ON/OFF 를 설정합니다. ON 이면 카메라 FOV 를 좁혀 화면 중앙을 확대합니다.
  setZoomed(zoomed: boolean): void;
  // 8-슬롯 메인 풀의 활성·대기 수 변화를 통지받습니다. 등록 즉시 1회 통지하고 해제 함수를 반환합니다.
  // (첫 방 전용 1-슬롯 풀은 표시 대상이 아니므로 제외합니다.)
  subscribeGenerationPool(listener: (counts: GenerationPoolCounts) => void): () => void;
}

// emissiveIntensity 속성을 가진 머티리얼의 발광을 켜고 끕니다.
// base emissiveIntensity > 0 인 머티리얼만 대상이며, base 를 material.userData 에 1회 저장한 뒤 0 ↔ base 로 토글합니다.
function toggleMaterialEmissive(material: THREE.Material, isOn: boolean): void {
  // emissiveIntensity 는 MeshStandardMaterial 등 일부 머티리얼에만 있으므로 존재 여부를 동적으로 확인합니다.
  const emissiveMaterial = material as THREE.Material & { emissiveIntensity?: number };
  if (typeof emissiveMaterial.emissiveIntensity !== 'number') {
    return;
  }

  // base emissiveIntensity 를 1회 저장합니다. 저장값이 0 이하이면 발광 가구가 아니므로 토글 대상에서 제외합니다.
  if (typeof material.userData.baseEmissiveIntensity !== 'number') {
    material.userData.baseEmissiveIntensity = emissiveMaterial.emissiveIntensity;
  }
  const baseEmissiveIntensity = material.userData.baseEmissiveIntensity as number;
  if (baseEmissiveIntensity <= 0) {
    return;
  }

  emissiveMaterial.emissiveIntensity = isOn ? baseEmissiveIntensity : 0;
}

export function createRoomScene(options: RoomSceneOptions): RoomSceneHandle {
  // 첫 방(0,0) 자동 생성 전용 1-슬롯 풀과, 그 외 모든 요청을 병렬 처리하는 8-슬롯 메인 풀입니다.
  const initialAutoPool: RequestPool = createRequestPool(INITIAL_AUTO_POOL_CONCURRENCY);
  const mainPool: RequestPool = createRequestPool(MAIN_POOL_CONCURRENCY);

  const state = {
    isStarted: false,
    isRunning: false,
    isDisposed: false,
    // 자동 생성 토글 상태입니다. 기본값 ON(true) — OFF 면 미생성 방 진입 시 자동 요청을 건너뜁니다.
    isAutoGenerateEnabled: true,
    // (0,0) 방에 가구 견본 쇼룸이 떠 있는 동안 true 입니다. (0,0) 생성이 완료되면 false 가 됩니다.
    isShowroomActive: false,
    runtime: null as RenderingRuntime | null,
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    store: null as RoomStore | null,
    lighting: null as SceneLighting | null,
    playerController: null as PlayerController | null,
    worldGroup: null as THREE.Group | null,
    showroomGroup: null as THREE.Group | null,
    activeCoordinate: { roomX: 0, roomZ: 0 } as RoomCoordinate,
    // 중앙 포커스 검사를 N 프레임마다 하기 위한 프레임 카운터입니다.
    focusFrameCounter: 0,
    // 시점 줌의 목표 시야각입니다. 매 프레임 카메라 FOV 를 이 값으로 부드럽게 보간합니다.
    zoomTargetFov: CAMERA_FIELD_OF_VIEW,
    // 직전에 통지한 포커스 대상 그룹입니다. 동일 그룹이면 재통지하지 않습니다(정체성 비교).
    focusedGroup: null as THREE.Object3D | null,
  };

  const roomsChangedCallbacks: Array<(rooms: RoomSummary[]) => void> = [];
  const playerMovedCallbacks: Array<(position: { x: number; z: number; rotationY: number }) => void> = [];
  const focusChangedCallbacks: Array<(focus: FurnitureFocus | null) => void> = [];

  // 중앙(NDC 0,0)에서 쏘는 광선용 raycaster 와 화면 중심 좌표입니다(매번 새로 만들지 않고 재사용).
  const focusRaycaster = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0);

  // 포커스된 가구를 감싸는 외곽선(액센트색 박스)과 크기 계산용 임시 객체입니다. 포커스가 없으면 숨깁니다.
  const focusOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: FOCUS_OUTLINE_COLOR, transparent: true, opacity: 0.9 }),
  );
  focusOutline.visible = false;
  focusOutline.renderOrder = 999;
  const focusBox = new THREE.Box3();
  const focusBoxSize = new THREE.Vector3();
  const focusBoxCenter = new THREE.Vector3();

  const emitRoomsChanged = () => {
    if (state.isDisposed || !state.store) {
      return;
    }
    const roomSummaries = state.store.listRoomSummaries();
    roomsChangedCallbacks.forEach((callback) => callback(roomSummaries));
  };

  const emitPlayerMoved = () => {
    if (state.isDisposed || !state.playerController) {
      return;
    }
    const playerState = state.playerController.findPlayerState();
    playerMovedCallbacks.forEach((callback) => callback(playerState));
  };

  // 한 객체에서 부모를 거슬러 올라가 userData.furniture 를 가진 가구 그룹을 찾습니다. 없으면 null.
  const findFurnitureGroup = (object: THREE.Object3D): THREE.Object3D | null => {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.furniture) {
        return current;
      }
      current = current.parent;
    }
    return null;
  };

  // 시점 중앙(NDC 0,0)에서 광선을 쏴 현재 활성 방 가구와의 교차로 포커스를 갱신합니다.
  // 포커스 그룹의 "정체성"이 바뀔 때만 통지합니다(직전 그룹 참조와 비교, 매 프레임 중복 통지 금지).
  const updateCenterFocus = () => {
    const camera = state.camera;
    const store = state.store;
    if (!camera || !store) {
      return;
    }

    // 교차 대상은 현재 보이는(활성) 방 그룹으로 한정해 광선 비용을 낮춥니다.
    const activeRoomGroup = store.findRoomState(state.activeCoordinate)?.group ?? null;

    let nextGroup: THREE.Object3D | null = null;
    if (activeRoomGroup) {
      focusRaycaster.setFromCamera(screenCenter, camera);
      const intersections = focusRaycaster.intersectObject(activeRoomGroup, true);
      // 시점 중앙에서 "가장 가까이" 맞은 것이 가구이고, 그 거리가 FOCUS_DISTANCE 이내일 때만 포커스합니다.
      // (벽·바닥 같은 다른 표면이 더 가까우면 가구가 가려진 것이므로 포커스하지 않습니다.)
      const nearest = intersections[0] ?? null;
      if (nearest && nearest.distance <= FOCUS_DISTANCE) {
        nextGroup = findFurnitureGroup(nearest.object);
      }
    }

    // 같은 그룹이면(또는 둘 다 없음이면) 재통지하지 않습니다.
    if (nextGroup === state.focusedGroup) {
      return;
    }
    state.focusedGroup = nextGroup;

    // 포커스된 가구를 감싸도록 외곽선을 그 가구의 월드 경계 상자에 맞춰 배치/표시합니다.
    if (nextGroup) {
      focusBox.setFromObject(nextGroup);
      focusBox.getSize(focusBoxSize);
      focusBox.getCenter(focusBoxCenter);
      focusOutline.position.copy(focusBoxCenter);
      focusOutline.scale.set(
        Math.max(focusBoxSize.x, 0.05) * 1.06,
        Math.max(focusBoxSize.y, 0.05) * 1.06,
        Math.max(focusBoxSize.z, 0.05) * 1.06,
      );
      focusOutline.visible = true;
    } else {
      focusOutline.visible = false;
    }

    const focus = nextGroup ? (nextGroup.userData.furniture as FurnitureFocus) : null;
    focusChangedCallbacks.forEach((callback) => callback(focus));
  };

  // (0,0) 미생성 방 위에 가구 견본 쇼룸을 띄웁니다. 이미 떠 있거나 자원이 없으면 무시합니다.
  const attachShowroom = () => {
    if (state.isShowroomActive || !state.worldGroup) {
      return;
    }
    const showroomGroup = createShowroomGroup();
    const roomCenter = findRoomCenter({ roomX: 0, roomZ: 0 });
    showroomGroup.position.set(roomCenter.x, 0, roomCenter.z);
    state.worldGroup.add(showroomGroup);
    state.showroomGroup = showroomGroup;
    state.isShowroomActive = true;
  };

  // 쇼룸을 제거하고 자원을 해제합니다. (0,0) 이 실제 테마 방으로 대체될 때 호출합니다.
  const removeShowroom = () => {
    if (!state.showroomGroup) {
      return;
    }
    state.showroomGroup.parent?.remove(state.showroomGroup);
    disposeObjectTree(state.showroomGroup);
    state.showroomGroup = null;
    state.isShowroomActive = false;
  };

  // 미생성 방의 테마 생성을 요청합니다. 실패하면 폴백 테마 없이 스켈레톤 상태를 유지합니다.
  // useInitialAutoPool 이 true 면 첫 방(0,0) 자동 생성 전용 1-슬롯 풀, false 면 8-슬롯 메인 풀을 사용합니다.
  const requestThemeForRoom = (coordinate: RoomCoordinate, useInitialAutoPool: boolean) => {
    const store = state.store;
    if (!store) {
      return;
    }

    const roomState = store.findRoomState(coordinate);
    if (!roomState || roomState.isGenerated || roomState.isGenerating) {
      return;
    }

    // (0,0) 생성이 시작되는 즉시 가구 견본 쇼룸을 제거합니다(생성 완료까지 기다리지 않음).
    if (coordinate.roomX === 0 && coordinate.roomZ === 0) {
      removeShowroom();
    }

    // 요청 시작 시 생성 중 표시를 켜고, 직전 실패 표시는 지웁니다(setRoomGenerating(true) 가 isFailed 를 함께 클리어).
    store.setRoomGenerating(coordinate, true);
    emitRoomsChanged();

    // 이미 생성된 인접 방의 테마를 시드로 찾습니다(없으면 null). 색·스타일 연속성에 사용됩니다.
    const neighborThemeData = store.findGeneratedNeighborTheme(coordinate);

    const task = () =>
      options
        .requestRoomTheme(coordinate, neighborThemeData)
        .then((themeData) => {
          if (state.isDisposed || !state.store) {
            return;
          }
          state.store.applyRoomTheme(coordinate, themeData);
          state.store.ensureAdjacentSkeletonRooms(coordinate);
          // 방금 생성 완료된 방이 "현재 방"일 때만 그 이웃을 프리페치합니다(이웃→이웃 연쇄 방지).
          const isActiveRoom = coordinate.roomX === state.activeCoordinate.roomX && coordinate.roomZ === state.activeCoordinate.roomZ;
          if (state.isAutoGenerateEnabled && isActiveRoom) {
            prefetchActiveRoomNeighbors(coordinate);
          }
        })
        .catch((error: unknown) => {
          console.error(`(${coordinate.roomX}, ${coordinate.roomZ}) 방의 테마 생성 요청이 실패하여 해당 방을 스켈레톤 상태로 유지합니다.`, error);
          // 실패를 시각적으로 표시할 수 있도록 해당 방에 실패 표시를 남깁니다(재시도 시 클리어됩니다).
          if (!state.isDisposed && state.store) {
            state.store.setRoomFailed(coordinate, true);
            emitRoomsChanged();
          }
        })
        .finally(() => {
          if (state.isDisposed || !state.store) {
            return;
          }
          state.store.setRoomGenerating(coordinate, false);
          emitRoomsChanged();
        });

    // 첫 방(0,0) 자동 생성만 전용 1-슬롯 풀로, 그 외 모든 요청은 8-슬롯 메인 풀에서 병렬 처리합니다.
    const pool = useInitialAutoPool ? initialAutoPool : mainPool;
    pool.run(task);
  };

  // 자동 생성 ON 일 때, 현재 방의 동서남북 스켈레톤을 자동 생성(프리페치)합니다.
  // 현재 방의 이웃 한 칸만 프리페치하며, 이웃의 이웃으로 연쇄하지 않습니다.
  const prefetchActiveRoomNeighbors = (coordinate: RoomCoordinate) => {
    const store = state.store;
    if (!store || !state.isAutoGenerateEnabled) {
      return;
    }
    listAdjacentRoomCoordinates(coordinate).forEach((neighbor) => {
      const neighborState = store.findRoomState(neighbor);
      if (neighborState && !neighborState.isGenerated && !neighborState.isGenerating) {
        requestThemeForRoom(neighbor, false);
      }
    });
  };

  // 플레이어가 다른 방으로 넘어갔을 때 호출됩니다.
  const handleRoomTransition = (coordinate: RoomCoordinate) => {
    const store = state.store;
    if (!store) {
      return;
    }

    state.activeCoordinate = coordinate;

    // 방 진입 시 현재 방의 스켈레톤만 보장합니다(만들어지는 즉시 씬에 붙고 항상 유지됩니다).
    // 인접 방 스켈레톤은 어떤 방이 생성 완료된 직후에만 만듭니다(진입 시점에는 만들지 않음).
    store.ensureSkeletonRoom(coordinate);

    const roomCenter = findRoomCenter(coordinate);
    state.lighting?.setActiveRoomCenter(roomCenter.x, roomCenter.z);

    // 자동 생성 ON 일 때: 미생성 방이면 자동 생성하고, 이미 생성된 방이면 그 방의 이웃을 프리페치합니다.
    // 어느 경우든 현재 방 기준 한 칸만 다루며, 이웃의 이웃으로 연쇄하지 않습니다.
    const roomState = store.findRoomState(coordinate);
    if (state.isAutoGenerateEnabled && roomState) {
      if (!roomState.isGenerated) {
        requestThemeForRoom(coordinate, false);
      } else {
        store.ensureAdjacentSkeletonRooms(coordinate);
        prefetchActiveRoomNeighbors(coordinate);
      }
    }

    emitRoomsChanged();
  };

  const handleFrame = (deltaSeconds: number) => {
    // 정지 상태에서는 플레이어 갱신을 건너뜁니다. 렌더 루프 자체는 렌더러가 유지합니다.
    if (!state.isRunning) {
      return;
    }

    const playerController = state.playerController;
    if (!playerController) {
      return;
    }

    const hasMoved = playerController.update(deltaSeconds);

    // 중앙 포커스 raycast: 이동·회전과 무관하게 N 프레임마다 검사합니다(시점만 돌려도 포커스가 갱신되도록).
    state.focusFrameCounter += 1;
    if (state.focusFrameCounter >= FOCUS_RAYCAST_FRAME_INTERVAL) {
      state.focusFrameCounter = 0;
      updateCenterFocus();
    }

    // 시점 줌: 카메라 FOV 를 목표값으로 부드럽게 보간합니다(이동·회전과 무관하게 매 프레임 실행).
    if (state.camera && state.camera.fov !== state.zoomTargetFov) {
      const fovDifference = state.zoomTargetFov - state.camera.fov;
      if (Math.abs(fovDifference) <= 0.05) {
        state.camera.fov = state.zoomTargetFov;
      } else {
        state.camera.fov += fovDifference * Math.min(1, deltaSeconds * ZOOM_LERP_SPEED);
      }
      state.camera.updateProjectionMatrix();
    }

    if (!hasMoved) {
      return;
    }

    const playerState = playerController.findPlayerState();
    const coordinate = findRoomCoordinateFromWorldPosition(playerState.x, playerState.z);
    if (coordinate.roomX !== state.activeCoordinate.roomX || coordinate.roomZ !== state.activeCoordinate.roomZ) {
      handleRoomTransition(coordinate);
    }

    emitPlayerMoved();
  };

  return {
    async start() {
      if (state.isDisposed) {
        throw new Error('이미 해제된 방 장면은 다시 시작할 수 없습니다.');
      }
      // 이미 동작 중이면 무시합니다. stop() 이후 재호출이면 렌더 루프만 재개합니다.
      if (state.isStarted) {
        state.isRunning = true;
        return;
      }
      state.isStarted = true;
      state.isRunning = true;

      const runtime = await createRenderingRuntime(options.container);

      // 렌더러 초기화를 기다리는 동안 해제됐다면 즉시 정리하고 종료합니다.
      if (state.isDisposed) {
        runtime.dispose();
        return;
      }
      state.runtime = runtime;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
      scene.add(focusOutline);
      state.scene = scene;

      const camera = new THREE.PerspectiveCamera(CAMERA_FIELD_OF_VIEW, 1, CAMERA_NEAR, CAMERA_FAR);
      camera.position.set(0, EYE_HEIGHT, INITIAL_CAMERA_Z);
      state.camera = camera;

      const lighting = createSceneLighting();
      scene.add(lighting.group);
      state.lighting = lighting;

      scene.add(createEnvironmentGroup());

      const worldGroup = new THREE.Group();
      scene.add(worldGroup);
      state.worldGroup = worldGroup;

      const store = createRoomStore(worldGroup);
      state.store = store;

      const startCoordinate: RoomCoordinate = { roomX: 0, roomZ: 0 };
      state.activeCoordinate = startCoordinate;
      // 시작 시점에는 (0,0) 방의 스켈레톤만 만듭니다. 인접 방 스켈레톤은 (0,0)이 생성 완료된 뒤에 만들어집니다.
      store.ensureSkeletonRoom(startCoordinate);

      // (0,0) 이 아직 미생성이면 가구 견본 쇼룸을 전시합니다. 생성 완료 시 제거됩니다.
      const startRoomState = store.findRoomState(startCoordinate);
      if (!startRoomState || !startRoomState.isGenerated) {
        attachShowroom();
      }

      const playerController = createPlayerController({
        canvasElement: runtime.canvasElement,
        camera,
        findDoorStates: (coordinate) => store.findDoorStates(coordinate),
        onViewRotated: () => {
          emitPlayerMoved();
        },
      });
      state.playerController = playerController;

      emitRoomsChanged();
      emitPlayerMoved();

      // 첫 방(0,0)의 자동 생성만 전용 1-슬롯 풀로 처리합니다(상태 표시 대상 아님). 단, 자동 생성이 ON 일 때만 실행합니다.
      // (0,0) 완료 시 .then 에서 현재 방의 이웃을 8-슬롯 메인 풀로 프리페치합니다.
      if (state.isAutoGenerateEnabled) {
        requestThemeForRoom(startCoordinate, true);
      }

      runtime.start({ scene, camera, onFrame: handleFrame });
    },

    stop() {
      // 렌더 루프 갱신만 멈춥니다. 자원은 보존되어 start() 로 재개할 수 있습니다.
      state.isRunning = false;
    },

    isRunning() {
      return state.isRunning;
    },

    dispose() {
      if (state.isDisposed) {
        return;
      }
      state.isDisposed = true;
      state.isRunning = false;

      state.playerController?.dispose();
      state.playerController = null;

      removeShowroom();

      state.store?.disposeAll();
      state.store = null;
      state.worldGroup = null;
      state.camera = null;
      state.focusedGroup = null;

      if (state.scene) {
        disposeObjectTree(state.scene);
        state.scene = null;
      }
      state.lighting = null;

      state.runtime?.dispose();
      state.runtime = null;

      roomsChangedCallbacks.length = 0;
      playerMovedCallbacks.length = 0;
      focusChangedCallbacks.length = 0;
    },

    onRoomsChanged(callback) {
      roomsChangedCallbacks.push(callback);
      // 이미 시작된 상태라면 현재 방 목록을 즉시 전달합니다.
      if (state.store && !state.isDisposed) {
        callback(state.store.listRoomSummaries());
      }
    },

    onPlayerMoved(callback) {
      playerMovedCallbacks.push(callback);
      // 이미 시작된 상태라면 현재 플레이어 위치를 즉시 전달합니다.
      if (state.playerController && !state.isDisposed) {
        callback(state.playerController.findPlayerState());
      }
    },

    onFocusChange(callback) {
      focusChangedCallbacks.push(callback);
      // 이미 포커스가 잡혀 있으면 현재 포커스를 즉시 전달합니다(없으면 통지하지 않음).
      if (state.focusedGroup && !state.isDisposed) {
        callback(state.focusedGroup.userData.furniture as FurnitureFocus);
      }
    },

    setAutoGenerate(enabled) {
      state.isAutoGenerateEnabled = enabled;
    },

    setZoomed(zoomed) {
      state.zoomTargetFov = zoomed ? ZOOMED_FIELD_OF_VIEW : CAMERA_FIELD_OF_VIEW;
    },

    triggerGeneration() {
      if (state.isDisposed) {
        return;
      }
      // 토글과 무관하게 현재 플레이어가 있는 방을 8-슬롯 메인 풀로 요청합니다(수동도 병렬 풀 사용).
      // requestThemeForRoom 이 이미 생성/생성중 방을 걸러내므로 중복 요청은 발생하지 않습니다.
      requestThemeForRoom(state.activeCoordinate, false);
    },

    toggleFocusedLight() {
      if (state.isDisposed) {
        return;
      }
      // 시점 중앙에 포커스된 가구 그룹이 없으면 아무 동작도 하지 않습니다(no-op).
      const focusedGroup = state.focusedGroup;
      if (!focusedGroup) {
        return;
      }

      // 그룹의 on/off 상태를 userData.lightOn(기본 true)로 보관하고 토글합니다.
      const isCurrentlyOn = (focusedGroup.userData.lightOn as boolean | undefined) ?? true;
      const nextOn = !isCurrentlyOn;
      focusedGroup.userData.lightOn = nextOn;

      focusedGroup.traverse((object) => {
        // 모든 PointLight: base 세기를 1회 저장 후 off 면 0, on 이면 base 로 복원합니다.
        if (object instanceof THREE.PointLight) {
          if (typeof object.userData.baseIntensity !== 'number') {
            object.userData.baseIntensity = object.intensity;
          }
          const baseIntensity = object.userData.baseIntensity as number;
          object.intensity = nextOn ? baseIntensity : 0;
        }

        // emissiveIntensity 를 가진 머티리얼 중 base emissiveIntensity > 0 인 것만 0 ↔ base 로 토글합니다.
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            toggleMaterialEmissive(material, nextOn);
          });
        }
      });
    },

    subscribeGenerationPool(listener) {
      // 8-슬롯 메인 풀만 구독해 통지합니다. 첫 방 전용 1-슬롯 풀은 표시 대상이 아니므로 제외합니다.
      // 풀의 subscribe 는 등록 즉시 1회 통지하므로 계약대로 즉시 한 번 호출됩니다.
      return mainPool.subscribe((activeCount, queuedCount) => {
        listener({ active: activeCount, queued: queuedCount });
      });
    },
  };
}
