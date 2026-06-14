// Prompt API/WebGPU 가용성에 따라 경고 카드 또는 3차원 방 캔버스를 보여주는 방 카드 계층입니다.
// 가용 시 renderings 의 방 장면을 시작하고, 방 목록/플레이어 이동을 미니맵과 HUD 칩에 배선합니다.

import { findRoomCoordinateFromWorldPosition } from '../tools/room-grid.ts';
import type { RoomSummary } from '../tools/room-grid.ts';
import { generateRoomTheme } from '../languages/language-models.ts';
import { createRoomScene } from '../renderings/room-scene.ts';
import type { FurnitureFocus, GenerationPoolCounts, RoomSceneHandle } from '../renderings/room-scene.ts';
import { createLoadingScreen } from './loading-screens.ts';
import { createMinimapPanel } from './minimap.ts';
import { buildWarningCardContent } from './warning-card.ts';

// 메인 생성 풀의 최대 동시성입니다(슬롯 도트 개수). room-scene 의 MAIN_POOL_CONCURRENCY 와 일치합니다.
const MAIN_POOL_CONCURRENCY = 8;

// 자동 생성 토글 상태를 영속화하는 localStorage 키입니다. 기본값은 OFF 입니다.
const AUTO_GENERATE_STORAGE_KEY = 'infinity-rooms-auto-generate';
// 수동 생성 단축키입니다(이동 키 WASD/방향키와 충돌하지 않음).
const MANUAL_GENERATION_KEY = 'KeyG';
// 캔버스 전체화면 토글 단축키입니다.
const FULLSCREEN_KEY = 'KeyF';
// 포커스된 가구의 디테일 패널 토글 단축키입니다.
const DETAIL_PANEL_KEY = 'KeyE';
// 시점 줌 단축키입니다. Z 는 누르는 동안만(홀드), Shift+Z 는 토글로 동작합니다.
const ZOOM_KEY = 'KeyZ';
// 시점 중앙에 포커스된 발광 가구의 조명을 켜고 끄는 단축키입니다.
const LAMP_TOGGLE_KEY = 'KeyQ';

// 가구 영문 이름을 디테일 패널에 표시할 한국어 이름으로 매핑합니다(23종).
const FURNITURE_KOREAN_NAMES: Record<string, string> = {
  desk: '책상',
  chair: '의자',
  sofa: '소파',
  lamp: '램프',
  rug: '러그',
  bookshelf: '책장',
  'wall-frame': '벽 액자',
  'ceiling-light': '천장등',
  bed: '침대',
  cabinet: '수납장',
  stool: '스툴',
  armchair: '안락의자',
  piano: '피아노',
  plant: '화분',
  vase: '꽃병',
  sculpture: '조각',
  aquarium: '수조',
  'ceiling-fan': '천장팬',
  mirror: '거울',
  'wall-clock': '벽시계',
  curtains: '커튼',
  sconce: '벽 조명',
  chandelier: '샹들리에',
};

// 영문 가구 이름을 한국어로 옮깁니다. 알 수 없는 이름은 원문을 그대로 보여 줍니다.
function findFurnitureKoreanName(name: string): string {
  return FURNITURE_KOREAN_NAMES[name] ?? name;
}

// 저장된 자동 생성 설정을 읽습니다. 값이 없거나 읽기 실패 시 기본값 OFF(false)를 사용합니다.
function loadAutoGeneratePreference(): boolean {
  try {
    const storedValue = window.localStorage.getItem(AUTO_GENERATE_STORAGE_KEY);
    if (storedValue === null) {
      return false;
    }
    return storedValue === 'true';
  } catch (error: unknown) {
    console.error('자동 생성 설정을 불러오지 못해 기본값(OFF)을 사용합니다.', error);
    return false;
  }
}

// 자동 생성 설정을 저장합니다. 저장 실패는 기능 동작에 영향이 없으므로 한국어 오류만 남깁니다.
function saveAutoGeneratePreference(isEnabled: boolean): void {
  try {
    window.localStorage.setItem(AUTO_GENERATE_STORAGE_KEY, String(isEnabled));
  } catch (error: unknown) {
    console.error('자동 생성 설정을 저장하지 못했습니다.', error);
  }
}

// 입력 필드에 포커스가 있는 동안에는 단축키를 무시하기 위한 판정입니다(방어적 처리).
function isEditableElementFocused(): boolean {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }
  const tagName = activeElement.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || activeElement.isContentEditable;
}

export interface RoomCard {
  element: HTMLElement;
  minimapElement: HTMLElement;
  setPromptAPIAvailability(isAvailable: boolean): void;
  setWebGPUAvailability(isAvailable: boolean): void;
  destroy(): void;
}

// 캔버스 좌하단에 띄우는 테마 칩(라벨 + 테마명)을 만듭니다.
function createThemeChip(): { element: HTMLDivElement; nameElement: HTMLSpanElement } {
  const chip = document.createElement('div');
  chip.className = 'hud-chip theme-chip';

  const label = document.createElement('span');
  label.className = 'theme-label';
  label.textContent = 'AI 테마';
  chip.appendChild(label);

  const nameElement = document.createElement('span');
  nameElement.className = 'theme-name';
  chip.appendChild(nameElement);

  return { element: chip, nameElement };
}

// 캔버스 중앙에 띄우는 방 생성 칩(스피너 + 문구 + 진행 바)을 만듭니다.
function createGeneratingChip(): HTMLDivElement {
  const chip = document.createElement('div');
  chip.className = 'hud-chip generating-chip';
  chip.setAttribute('role', 'status');

  const row = document.createElement('div');
  row.className = 'generating-row';

  const spinner = document.createElement('span');
  spinner.className = 'generating-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  row.appendChild(spinner);

  row.appendChild(document.createTextNode('방 생성 중...'));
  chip.appendChild(row);

  const bar = document.createElement('div');
  bar.className = 'generating-bar';
  bar.setAttribute('aria-hidden', 'true');
  chip.appendChild(bar);

  return chip;
}

// 캔버스 하단 중앙에 띄우는 생성 실패 칩(문구 + 재시도 버튼 + 안내)을 만듭니다.
// 현재 방의 테마 생성이 실패했을 때만 표시하며, 재시도 버튼은 현재 방을 다시 생성합니다.
function createFailureChip(): { element: HTMLDivElement; retryButton: HTMLButtonElement } {
  const chip = document.createElement('div');
  chip.className = 'hud-chip failure-chip';
  chip.setAttribute('role', 'alert');

  const row = document.createElement('div');
  row.className = 'failure-row';

  const message = document.createElement('span');
  message.className = 'failure-message';
  message.textContent = '방 생성 실패';
  row.appendChild(message);

  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'failure-retry-button';
  retryButton.textContent = '재시도';
  retryButton.title = '현재 방의 생성을 다시 시도합니다 (단축키 G)';
  row.appendChild(retryButton);

  chip.appendChild(row);

  const hint = document.createElement('span');
  hint.className = 'failure-hint';
  hint.textContent = 'G 로도 재시도할 수 있습니다.';
  chip.appendChild(hint);

  return { element: chip, retryButton };
}

// 생성 풀 상태 칩: 8-슬롯 메인 풀의 활성·대기 수를 텍스트 라벨 + 슬롯 도트(생성 중 펄스)로 보여줍니다.
// (첫 방 전용 1-슬롯 풀은 표시하지 않습니다.)
function createPoolStatusChip(): {
  element: HTMLDivElement;
  update(counts: GenerationPoolCounts): void;
} {
  const chip = document.createElement('div');
  chip.className = 'hud-chip pool-status-chip';
  chip.setAttribute('role', 'status');
  chip.setAttribute('aria-live', 'polite');

  // 메인 풀 행: "생성" 라벨 + 활성/최대 슬롯 도트 + 활성/최대 · 대기 텍스트.
  const poolRow = document.createElement('div');
  poolRow.className = 'pool-row';

  const poolLabel = document.createElement('span');
  poolLabel.className = 'pool-label';
  poolLabel.textContent = '생성';
  poolRow.appendChild(poolLabel);

  const poolDots = document.createElement('span');
  poolDots.className = 'pool-dots';
  poolDots.setAttribute('aria-hidden', 'true');
  // 메인 풀 슬롯 도트를 동시성 수만큼 미리 만듭니다(활성 수에 따라 펄스 클래스를 토글).
  const poolDotElements: HTMLSpanElement[] = [];
  for (let slotIndex = 0; slotIndex < MAIN_POOL_CONCURRENCY; slotIndex += 1) {
    const dot = document.createElement('span');
    dot.className = 'pool-dot';
    poolDots.appendChild(dot);
    poolDotElements.push(dot);
  }
  poolRow.appendChild(poolDots);

  const poolText = document.createElement('span');
  poolText.className = 'pool-text';
  poolRow.appendChild(poolText);

  chip.appendChild(poolRow);

  return {
    element: chip,
    update(counts) {
      // 슬롯 도트: 인덱스가 활성 수보다 작으면 펄스(활성), 그 외에는 비활성.
      poolDotElements.forEach((dot, slotIndex) => {
        dot.classList.toggle('is-active', slotIndex < counts.active);
      });
      poolText.textContent = `${counts.active}/${MAIN_POOL_CONCURRENCY} · 대기 ${counts.queued}`;

      // 풀이 완전히 idle 이면(활성·대기 0) 칩을 숨겨 잡음을 줄입니다.
      const isIdle = counts.active === 0 && counts.queued === 0;
      chip.classList.toggle('is-visible', !isIdle);
    },
  };
}

// 캔버스 좌상단 컨트롤 영역: "자동 생성" 토글 + "생성" 버튼.
function createGenerationControls(initialAutoGenerate: boolean): {
  element: HTMLDivElement;
  toggleInput: HTMLInputElement;
  generateButton: HTMLButtonElement;
} {
  const controls = document.createElement('div');
  controls.className = 'hud-chip generation-controls';

  // 자동 생성 토글 — 텍스트 라벨을 함께 두어 색 외 상태 단서를 유지합니다.
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'auto-generate-toggle';

  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.className = 'auto-generate-checkbox';
  toggleInput.checked = initialAutoGenerate;
  toggleLabel.appendChild(toggleInput);

  const toggleTrack = document.createElement('span');
  toggleTrack.className = 'auto-generate-track';
  toggleTrack.setAttribute('aria-hidden', 'true');
  toggleLabel.appendChild(toggleTrack);

  const toggleText = document.createElement('span');
  toggleText.className = 'auto-generate-text';
  toggleText.textContent = '자동 생성';
  toggleLabel.appendChild(toggleText);

  controls.appendChild(toggleLabel);

  // 수동 생성 버튼 — G 키와 동일하게 현재 방을 즉시 생성합니다.
  const generateButton = document.createElement('button');
  generateButton.type = 'button';
  generateButton.className = 'generate-button';
  generateButton.textContent = '생성';
  generateButton.title = '현재 방을 즉시 생성합니다 (단축키 G)';
  controls.appendChild(generateButton);

  return { element: controls, toggleInput, generateButton };
}

// 캔버스 중앙에 항상 떠 있는 조준점(레티클)을 만듭니다. 포커스가 있으면 is-focused 로 강조합니다.
function createReticle(): { element: HTMLDivElement; setFocused(isFocused: boolean): void } {
  const reticle = document.createElement('div');
  reticle.className = 'focus-reticle';
  reticle.setAttribute('aria-hidden', 'true');

  const dot = document.createElement('span');
  dot.className = 'focus-reticle-dot';
  reticle.appendChild(dot);

  return {
    element: reticle,
    setFocused(isFocused) {
      reticle.classList.toggle('is-focused', isFocused);
    },
  };
}

// 포커스된 가구의 디테일 패널(캔버스 코너 오버레이)을 만듭니다.
// 종류(한국어)·변형·색상 팔레트를 보여 주며, 좌표·방 테마명은 표시하지 않습니다.
function createDetailPanel(): {
  element: HTMLDivElement;
  setOpen(isOpen: boolean): void;
  isOpen(): boolean;
  render(focus: FurnitureFocus): void;
  onClose(callback: () => void): void;
} {
  const panel = document.createElement('div');
  panel.className = 'furniture-detail-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '가구 상세 정보');

  // 헤더: 가구 한국어 이름 + 닫기 버튼.
  const header = document.createElement('div');
  header.className = 'detail-header';

  const nameElement = document.createElement('div');
  nameElement.className = 'detail-name';
  header.appendChild(nameElement);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'detail-close';
  closeButton.setAttribute('aria-label', '닫기');
  closeButton.textContent = '×';
  header.appendChild(closeButton);

  panel.appendChild(header);

  // 변형 라벨.
  const variantElement = document.createElement('div');
  variantElement.className = 'detail-variant';
  panel.appendChild(variantElement);

  // 색상 팔레트 목록(스와치 + 라벨 + hex).
  const paletteElement = document.createElement('div');
  paletteElement.className = 'detail-palette';
  panel.appendChild(paletteElement);

  const closeCallbacks: Array<() => void> = [];
  closeButton.addEventListener('click', () => {
    closeCallbacks.forEach((callback) => callback());
  });

  return {
    element: panel,
    setOpen(isOpen) {
      panel.classList.toggle('is-open', isOpen);
    },
    isOpen() {
      return panel.classList.contains('is-open');
    },
    render(focus) {
      nameElement.textContent = findFurnitureKoreanName(focus.name);
      variantElement.textContent = `변형 ${focus.variant}`;

      // 색상 팔레트를 매번 새로 그립니다(createElement 만 사용, innerHTML 금지).
      while (paletteElement.firstChild) {
        paletteElement.removeChild(paletteElement.firstChild);
      }
      Object.entries(focus.colors).forEach(([fieldName, hex]) => {
        const row = document.createElement('div');
        row.className = 'detail-color-row';

        const swatch = document.createElement('span');
        swatch.className = 'detail-color-swatch';
        // 스와치 배경은 동적 콘텐츠 색이므로 인라인 스타일로 칠합니다(테마 토큰 대상 아님).
        swatch.style.backgroundColor = hex;
        row.appendChild(swatch);

        const label = document.createElement('span');
        label.className = 'detail-color-label';
        label.textContent = fieldName;
        row.appendChild(label);

        const value = document.createElement('span');
        value.className = 'detail-color-hex';
        value.textContent = hex;
        row.appendChild(value);

        paletteElement.appendChild(row);
      });
    },
    onClose(callback) {
      closeCallbacks.push(callback);
    },
  };
}

export function createRoomCard(): RoomCard {
  const card = document.createElement('div');
  card.className = 'new-card';

  const messageElement = document.createElement('div');
  messageElement.className = 'new-card-message';
  messageElement.textContent = '가용성 확인 중...';
  card.appendChild(messageElement);

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'webgpu-canvas-container';
  card.appendChild(canvasContainer);

  // 캔버스 위 HUD 칩 3종: AI 테마 / 방 좌표 / 생성 중
  const themeChip = createThemeChip();
  canvasContainer.appendChild(themeChip.element);

  const coordinateChip = document.createElement('div');
  coordinateChip.className = 'hud-chip coordinate-chip';
  coordinateChip.textContent = 'ROOM (0, 0)';
  canvasContainer.appendChild(coordinateChip);

  const generatingChip = createGeneratingChip();
  canvasContainer.appendChild(generatingChip);

  // 생성 실패 칩: 현재 방의 테마 생성이 실패하고 생성 중이 아닐 때만 표시합니다.
  const failureChip = createFailureChip();
  canvasContainer.appendChild(failureChip.element);

  // 생성 풀 상태 칩(수동/자동 활성·대기 수 + 슬롯 도트). 좌상단 컨트롤 아래에 둡니다.
  const poolStatusChip = createPoolStatusChip();
  canvasContainer.appendChild(poolStatusChip.element);

  // 자동 생성 토글 + 수동 생성 버튼 컨트롤 영역(캔버스 가용 시에만 의미가 있습니다).
  const isAutoGenerateEnabled = loadAutoGeneratePreference();
  const generationControls = createGenerationControls(isAutoGenerateEnabled);
  canvasContainer.appendChild(generationControls.element);

  // 캔버스 중앙 조준점(레티클)과 포커스된 가구의 디테일 패널입니다.
  const reticle = createReticle();
  canvasContainer.appendChild(reticle.element);

  const detailPanel = createDetailPanel();
  canvasContainer.appendChild(detailPanel.element);

  // 장면 시작(WebGPU 초기화) 동안 캔버스 위에 표시하는 한국어 로딩 오버레이입니다.
  const loadingScreen = createLoadingScreen();

  const minimapPanel = createMinimapPanel();

  // 진단 결과가 아직 도착하지 않은 상태는 null 로 구분합니다.
  const availability = {
    isPromptAPIAvailable: null as boolean | null,
    isWebGPUAvailable: null as boolean | null,
  };

  const latest = {
    rooms: [] as RoomSummary[],
    player: { x: 0, z: 0, rotationY: 0 },
    // 현재 시점 중앙에 잡힌 가구 포커스입니다(없으면 null).
    focus: null as FurnitureFocus | null,
  };

  const sceneState = {
    handle: null as RoomSceneHandle | null,
    hasStartFailed: false,
    // 생성 풀 구독 해제 함수입니다(장면 생성 시 등록, dispose 시 해제).
    unsubscribePools: null as (() => void) | null,
  };

  const findActiveCoordinate = () => findRoomCoordinateFromWorldPosition(latest.player.x, latest.player.z);

  const updateMinimap = () => {
    const activeCoordinate = findActiveCoordinate();
    minimapPanel.update(latest.player.x, latest.player.z, latest.player.rotationY, latest.rooms, activeCoordinate.roomX, activeCoordinate.roomZ);
  };

  // 좌표 칩과 AI 테마 칩을 현재 방 기준으로 갱신합니다.
  const updateHeadsUpChips = () => {
    const activeCoordinate = findActiveCoordinate();
    coordinateChip.textContent = `ROOM (${activeCoordinate.roomX}, ${activeCoordinate.roomZ})`;

    const activeRoom = latest.rooms.find((room) => room.roomX === activeCoordinate.roomX && room.roomZ === activeCoordinate.roomZ);
    const themeName = activeRoom?.themeName ?? null;
    themeChip.nameElement.textContent = themeName ?? '';
    themeChip.element.classList.toggle('is-visible', themeName !== null);
  };

  // 생성 중 칩은 "현재 플레이어가 있는 방"이 생성 중일 때만 표시합니다.
  // (다른 방이 백그라운드로 생성 중이어도 현재 방이 아니면 표시하지 않습니다.)
  const updateGeneratingChip = () => {
    const activeCoordinate = findActiveCoordinate();
    const activeRoom = latest.rooms.find((room) => room.roomX === activeCoordinate.roomX && room.roomZ === activeCoordinate.roomZ);
    const isActiveRoomGenerating = activeRoom?.isGenerating ?? false;
    generatingChip.classList.toggle('is-visible', isActiveRoomGenerating);
  };

  // 생성 실패 칩은 "현재 플레이어가 있는 방"이 실패 상태이고 생성 중이 아닐 때만 표시합니다.
  // (생성이 시작되거나 완료되면 isFailed 가 클리어되어 자동으로 숨겨집니다.)
  const updateFailureChip = () => {
    const activeCoordinate = findActiveCoordinate();
    const activeRoom = latest.rooms.find((room) => room.roomX === activeCoordinate.roomX && room.roomZ === activeCoordinate.roomZ);
    const isActiveRoomFailed = (activeRoom?.isFailed ?? false) && !(activeRoom?.isGenerating ?? false);
    failureChip.element.classList.toggle('is-visible', isActiveRoomFailed);
  };

  // 포커스 변화 처리: 레티클 강조를 토글하고, 패널이 열려 있으면 새 포커스로 내용을 갱신합니다.
  // 포커스가 사라지면 패널을 닫습니다.
  const handleFocusChange = (focus: FurnitureFocus | null) => {
    latest.focus = focus;
    reticle.setFocused(focus !== null);

    if (focus === null) {
      detailPanel.setOpen(false);
      return;
    }
    if (detailPanel.isOpen()) {
      detailPanel.render(focus);
    }
  };

  // E 키/닫기 버튼 토글: 포커스가 있으면 패널을 열고(내용 갱신)/닫습니다. 포커스가 없으면 무시합니다.
  const toggleDetailPanel = () => {
    if (latest.focus === null) {
      detailPanel.setOpen(false);
      return;
    }
    if (detailPanel.isOpen()) {
      detailPanel.setOpen(false);
      return;
    }
    detailPanel.render(latest.focus);
    detailPanel.setOpen(true);
  };

  detailPanel.onClose(() => {
    detailPanel.setOpen(false);
  });

  const disposeScene = () => {
    if (sceneState.unsubscribePools) {
      sceneState.unsubscribePools();
      sceneState.unsubscribePools = null;
    }
    if (sceneState.handle) {
      sceneState.handle.dispose();
      sceneState.handle = null;
    }
    loadingScreen.hide();
  };

  // 수동 생성을 요청합니다(생성/생성중인 방은 장면 측에서 무시됩니다).
  const triggerManualGeneration = () => {
    sceneState.handle?.triggerGeneration();
  };

  // 토글 변경: 설정을 영속화하고 장면에 전달합니다.
  generationControls.toggleInput.addEventListener('change', () => {
    const isEnabled = generationControls.toggleInput.checked;
    saveAutoGeneratePreference(isEnabled);
    sceneState.handle?.setAutoGenerate(isEnabled);
  });

  // 생성 버튼: 토글과 무관하게 현재 방을 즉시 생성합니다.
  generationControls.generateButton.addEventListener('click', () => {
    triggerManualGeneration();
  });

  // 재시도 버튼: 생성에 실패한 현재 방을 다시 생성합니다(G 키와 동일 동작).
  failureChip.retryButton.addEventListener('click', () => {
    triggerManualGeneration();
  });

  // G 키: 현재 방을 즉시 생성합니다. 입력 필드 포커스 시·수정 키 동반 시·캔버스 비활성 시에는 무시합니다.
  const handleManualGenerationKey = (event: KeyboardEvent) => {
    if (event.code !== MANUAL_GENERATION_KEY) {
      return;
    }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (!sceneState.handle || isEditableElementFocused()) {
      return;
    }
    event.preventDefault();
    triggerManualGeneration();
  };
  document.addEventListener('keydown', handleManualGenerationKey);

  // 캔버스 전체화면을 토글합니다. 미진입 시 컨테이너를 전체화면으로, 진입 중이면 해제합니다(Esc 해제는 브라우저 기본).
  const toggleCanvasFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch((error: unknown) => {
        console.error('전체화면을 해제하지 못했습니다.', error);
      });
      return;
    }
    void canvasContainer.requestFullscreen().catch((error: unknown) => {
      console.error('전체화면으로 전환하지 못했습니다.', error);
    });
  };

  // F 키: 캔버스 전체화면 토글. 캔버스가 활성(.is-active)일 때만 동작합니다.
  // E 키: 포커스된 가구의 디테일 패널 토글.
  // Q 키: 포커스된 발광 가구의 조명 on/off 토글. 모두 입력 필드 포커스·수정 키 동반·repeat 시 무시합니다.
  const handleViewerShortcutKey = (event: KeyboardEvent) => {
    if (event.code !== FULLSCREEN_KEY && event.code !== DETAIL_PANEL_KEY && event.code !== LAMP_TOGGLE_KEY) {
      return;
    }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (isEditableElementFocused()) {
      return;
    }
    // 캔버스가 활성 상태가 아니면(경고/대기) 단축키를 모두 무시합니다.
    if (!card.classList.contains('is-active')) {
      return;
    }

    if (event.code === FULLSCREEN_KEY) {
      event.preventDefault();
      toggleCanvasFullscreen();
      return;
    }
    if (event.code === LAMP_TOGGLE_KEY) {
      event.preventDefault();
      // 포커스가 없거나 조명이 없는 가구면 핸들 쪽에서 no-op 처리됩니다.
      sceneState.handle?.toggleFocusedLight();
      return;
    }
    event.preventDefault();
    toggleDetailPanel();
  };
  document.addEventListener('keydown', handleViewerShortcutKey);

  // 시점 줌: 유효 줌 = "홀드(Z 누름)" 또는 "토글(Shift+Z)". 둘 중 하나라도 켜져 있으면 확대합니다.
  const zoomState = { holdActive: false, toggleOn: false };
  const applyZoom = () => {
    sceneState.handle?.setZoomed(zoomState.holdActive || zoomState.toggleOn);
  };
  const handleZoomKeyDown = (event: KeyboardEvent) => {
    if (event.code !== ZOOM_KEY) {
      return;
    }
    // 수정 키(Ctrl/Meta/Alt)는 제외하되 Shift 는 토글용으로 허용합니다.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (!card.classList.contains('is-active') || isEditableElementFocused()) {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    if (event.shiftKey) {
      zoomState.toggleOn = !zoomState.toggleOn;
    } else {
      zoomState.holdActive = true;
    }
    applyZoom();
  };
  const handleZoomKeyUp = (event: KeyboardEvent) => {
    if (event.code !== ZOOM_KEY || !zoomState.holdActive) {
      return;
    }
    zoomState.holdActive = false;
    applyZoom();
  };
  document.addEventListener('keydown', handleZoomKeyDown);
  document.addEventListener('keyup', handleZoomKeyUp);

  // 전체화면은 캔버스 컨테이너만 보여주므로, 캔버스 밖에 있는 미니맵이 가려집니다.
  // 전체화면 동안에는 미니맵을 캔버스 위 오버레이로 옮기고, 해제되면 원래 자리로 되돌립니다.
  const fullscreenState = { savedMinimapParent: null as HTMLElement | null };
  const handleFullscreenChange = () => {
    const isCanvasFullscreen = document.fullscreenElement === canvasContainer;
    if (isCanvasFullscreen) {
      fullscreenState.savedMinimapParent = minimapPanel.element.parentElement;
      minimapPanel.element.classList.add('is-canvas-overlay');
      canvasContainer.appendChild(minimapPanel.element);
    } else if (fullscreenState.savedMinimapParent) {
      minimapPanel.element.classList.remove('is-canvas-overlay');
      fullscreenState.savedMinimapParent.appendChild(minimapPanel.element);
      fullscreenState.savedMinimapParent = null;
    }
  };
  document.addEventListener('fullscreenchange', handleFullscreenChange);

  const showWarning = (titleText: string, descriptionText: string) => {
    // 가용성 상실로 인한 경고는 장면을 정지(stop)만 해 자원을 보존하고, 재가용 시 재개할 수 있게 둡니다.
    // 시작 실패(hasStartFailed) 경고는 장면이 손상된 상태이므로 호출부에서 별도로 dispose 합니다.
    if (sceneState.handle && !sceneState.hasStartFailed) {
      sceneState.handle.stop();
      loadingScreen.hide();
    }
    card.classList.remove('is-active');
    card.classList.add('is-warning');

    // 이전 경고 본문이 있으면 제거하고 새 본문으로 교체합니다.
    card.querySelector('.warning-card-content')?.remove();
    card.appendChild(buildWarningCardContent({ titleText, descriptionText, hasResolutionAction: true }));
  };

  // 장면 시작(또는 재개)을 수행합니다. 이미 동작 중이면 무시하고, 정지(stop)된 상태면 재개합니다.
  const startOrResumeScene = () => {
    // 이미 핸들이 있으면: 동작 중이면 무시, 정지 상태면 재개합니다(자원 보존된 stop 의 짝).
    if (sceneState.handle) {
      if (!sceneState.handle.isRunning()) {
        sceneState.handle.start().catch((error: unknown) => {
          console.error('정지된 WebGPU 방 장면을 재개하지 못했습니다.', error);
          sceneState.hasStartFailed = true;
          showWarning('3D 방 장면을 재개하지 못했습니다', '새로고침 후에도 반복되면 브라우저 콘솔의 오류를 확인해 주세요.');
        });
      }
      return;
    }

    const sceneHandle = createRoomScene({
      container: canvasContainer,
      // 이웃 시드 주입: 인접 방 팔레트를 시드로 넘겨 색 연속성을 부여합니다.
      requestRoomTheme: (coordinate, neighborThemeData) => generateRoomTheme(coordinate, neighborThemeData),
    });
    sceneState.handle = sceneHandle;

    // 저장된 자동 생성 설정을 장면 시작 전에 적용합니다(시작 방 자동 생성 게이트에 반영되도록).
    sceneHandle.setAutoGenerate(generationControls.toggleInput.checked);

    sceneHandle.onRoomsChanged((rooms) => {
      latest.rooms = rooms;
      updateGeneratingChip();
      updateFailureChip();
      updateHeadsUpChips();
      updateMinimap();
    });
    sceneHandle.onPlayerMoved((position) => {
      latest.player = position;
      updateGeneratingChip();
      updateFailureChip();
      updateHeadsUpChips();
      updateMinimap();
    });

    // 시점 중앙 포커스 변화를 구독해 레티클 강조·디테일 패널을 갱신합니다.
    sceneHandle.onFocusChange((focus) => {
      handleFocusChange(focus);
    });

    // 8-슬롯 메인 풀 상태를 구독해 풀 상태 칩을 갱신합니다(등록 즉시 1회 통지).
    sceneState.unsubscribePools = sceneHandle.subscribeGenerationPool((counts) => {
      poolStatusChip.update(counts);
    });

    // WebGPU 초기화 동안 한국어 로딩 오버레이를 캔버스 위에 표시하고, 시작 완료/실패 시 제거합니다.
    canvasContainer.appendChild(loadingScreen.element);
    loadingScreen.show();

    sceneHandle
      .start()
      .then(() => {
        loadingScreen.hide();
      })
      .catch((error: unknown) => {
        // 시작 실패는 조용히 삼키지 않고 경고 카드 상태로 수렴시킵니다.
        console.error('WebGPU 방 장면 시작에 실패했습니다.', error);
        sceneState.hasStartFailed = true;
        // 손상된 장면은 재개할 수 없으므로 완전히 해제합니다(로딩 오버레이도 함께 제거).
        disposeScene();
        showWarning('3D 방 장면을 시작하지 못했습니다', '새로고침 후에도 반복되면 브라우저 콘솔의 오류를 확인해 주세요.');
      });
  };

  const updateLayout = () => {
    // 장면 시작 실패 경고는 이후 상태 변화로 덮어쓰지 않습니다.
    if (sceneState.hasStartFailed) {
      return;
    }

    const { isPromptAPIAvailable, isWebGPUAvailable } = availability;

    if (isPromptAPIAvailable === false && isWebGPUAvailable === false) {
      showWarning('3D 공간을 시작할 수 없습니다', 'Prompt API와 WebGPU 모두 사용 불가 상태입니다. 설정을 활성화해 주세요.');
      return;
    }
    if (isPromptAPIAvailable === false) {
      showWarning('3D 공간을 시작할 수 없습니다', 'Prompt API가 활성화되지 않아 WebGPU 3D 공간을 구동할 수 없습니다. 크롬 Built-in AI 설정을 확인해 주세요.');
      return;
    }
    if (isWebGPUAvailable === false) {
      showWarning('3D 공간을 시작할 수 없습니다', '이 기기/브라우저에서 WebGPU가 지원되지 않습니다. 하드웨어 가속 설정을 확인해 주세요.');
      return;
    }

    if (isPromptAPIAvailable === true && isWebGPUAvailable === true) {
      card.classList.remove('is-warning');
      card.querySelector('.warning-card-content')?.remove();
      // 캔버스 컨테이너가 보이는 상태에서 렌더러 크기가 계산되도록 활성 클래스를 먼저 적용합니다.
      card.classList.add('is-active');
      // 최초 시작이거나, 가용성 상실로 정지(stop)된 장면을 재개합니다(자원 보존된 재시작).
      startOrResumeScene();
    }
  };

  return {
    element: card,
    minimapElement: minimapPanel.element,
    setPromptAPIAvailability(isAvailable: boolean) {
      availability.isPromptAPIAvailable = isAvailable;
      updateLayout();
    },
    setWebGPUAvailability(isAvailable: boolean) {
      availability.isWebGPUAvailable = isAvailable;
      updateLayout();
    },
    destroy() {
      document.removeEventListener('keydown', handleManualGenerationKey);
      document.removeEventListener('keydown', handleViewerShortcutKey);
      document.removeEventListener('keydown', handleZoomKeyDown);
      document.removeEventListener('keyup', handleZoomKeyUp);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      disposeScene();
      minimapPanel.destroy();
      card.remove();
    },
  };
}
