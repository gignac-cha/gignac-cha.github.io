// 무한의 방 페이지 진입점입니다. 페이지 헤더/상태 카드/스테이지(방 카드 + 미니맵)/조작법/푸터를 조립하고,
// 초기화 실패 시 빈 화면 대신 한국어 경고 카드를 표시합니다.

import { createControlsHintRow, createPageFooter, createPageHeader } from './scripts/interfaces/page-shells.ts';
import { createRoomCard } from './scripts/interfaces/room-card.ts';
import { createPromptAPIStatusPanel, createStatusCardsContainer, createWebGPUStatusPanel } from './scripts/interfaces/status-panels.ts';
import { buildWarningCardContent } from './scripts/interfaces/warning-card.ts';
import { diagnoseLanguageModelAvailability } from './scripts/languages/language-models.ts';

function findOrCreateRootElement(): HTMLElement {
  const existingRoot = document.querySelector<HTMLElement>('#root');
  if (existingRoot) {
    return existingRoot;
  }

  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  return newRoot;
}

// 초기화 실패 원인을 경고 카드 형태로 화면에 표시합니다.
function renderInitializationError(error: unknown): void {
  const root = findOrCreateRootElement();
  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }

  const reasonText = error instanceof Error ? error.message : String(error);

  const errorCard = document.createElement('div');
  errorCard.className = 'new-card is-warning';
  errorCard.appendChild(
    buildWarningCardContent({
      titleText: '페이지 초기화에 실패했습니다',
      descriptionText: reasonText,
      hasResolutionAction: false,
    }),
  );

  root.appendChild(errorCard);
}

function initialize(): void {
  const root = findOrCreateRootElement();

  root.appendChild(createPageHeader());

  const promptAPIStatusPanel = createPromptAPIStatusPanel(diagnoseLanguageModelAvailability);
  const webGPUStatusPanel = createWebGPUStatusPanel();
  root.appendChild(createStatusCardsContainer([promptAPIStatusPanel.element, webGPUStatusPanel.element]));

  // 스테이지: 캔버스가 주인공인 방 카드와 미니맵 HUD 패널을 한 그리드로 묶습니다.
  // 경고 카드의 '해결 방법 보기'는 미지원 상태 카드를 화면에 띄우고 해결 가이드 툴팁을 직접 엽니다.
  const roomCard = createRoomCard({
    onResolvePromptAPI: () => promptAPIStatusPanel.openTroubleshooting(),
    onResolveWebGPU: () => webGPUStatusPanel.openTroubleshooting(),
  });
  const stage = document.createElement('section');
  stage.className = 'stage';
  stage.setAttribute('aria-label', '3D 방 탐험');
  stage.appendChild(roomCard.element);
  stage.appendChild(roomCard.minimapElement);
  root.appendChild(stage);

  root.appendChild(createControlsHintRow());
  root.appendChild(createPageFooter());

  // Prompt API/WebGPU 진단 결과에 따라 방 카드를 활성/경고 상태로 전환합니다.
  promptAPIStatusPanel.onStatusChange((status) => {
    roomCard.setPromptAPIAvailability(status === 'available');
  });
  webGPUStatusPanel.onStatusChange((status) => {
    roomCard.setWebGPUAvailability(status === 'available');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    initialize();
  } catch (error) {
    console.error('무한의 방 페이지 초기화에 실패했습니다.', error);
    renderInitializationError(error);
  }
});
