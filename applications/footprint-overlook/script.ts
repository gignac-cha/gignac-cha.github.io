// 발자국 조망대(Footprint Overlook) 페이지 진입점입니다.
// 트래커 엔드포인트를 브라우저 저장소에서 해석해, 없으면 설정 카드를, 있으면 대시보드를 렌더링합니다.

import { createDashboard } from './scripts/interfaces/dashboard.ts';
import { createPageFooter, createPageHeader } from './scripts/interfaces/page-shells.ts';
import { createSetupCard } from './scripts/interfaces/setup-card.ts';
import { readTrackerEndpoint, writeTrackerEndpoint } from './scripts/tools/tracker-endpoint.ts';

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

function clearElement(element: Element): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

// 엔드포인트가 없을 때: 헤더 + 중앙 정렬 설정 카드를 그립니다.
function renderSetup(root: HTMLElement, initialValue?: string): void {
  clearElement(root);
  root.classList.add('is-setup-mode');
  root.appendChild(createPageHeader());

  const setupWrap = document.createElement('div');
  setupWrap.className = 'setup-wrap';
  setupWrap.appendChild(
    createSetupCard({
      initialValue,
      onSave: (rawUrl) => {
        writeTrackerEndpoint(rawUrl);
        const savedEndpoint = readTrackerEndpoint();
        if (savedEndpoint !== undefined) {
          renderDashboard(root, savedEndpoint);
        }
      },
    }),
  );
  root.appendChild(setupWrap);
}

// 엔드포인트가 있을 때: 헤더 + 대시보드 + 푸터를 그립니다.
function renderDashboard(root: HTMLElement, endpoint: string): void {
  clearElement(root);
  root.classList.remove('is-setup-mode');
  root.appendChild(createPageHeader());
  root.appendChild(
    createDashboard({
      endpoint,
      // '변경' 클릭 시 현재 값을 미리 채운 설정 카드로 되돌아갑니다.
      onChangeEndpoint: () => renderSetup(root, endpoint),
    }),
  );
  root.appendChild(createPageFooter());
}

function initialize(): void {
  const root = findOrCreateRootElement();
  const endpoint = readTrackerEndpoint();
  if (endpoint === undefined) {
    renderSetup(root);
  } else {
    renderDashboard(root, endpoint);
  }
}

// 초기화 실패 시 빈 화면 대신 최소한의 한국어 안내를 남깁니다.
function renderInitializationError(error: unknown): void {
  const root = findOrCreateRootElement();
  clearElement(root);
  const reasonText = error instanceof Error ? error.message : String(error);
  const card = document.createElement('section');
  card.className = 'panel';
  const message = document.createElement('p');
  message.className = 'section-state section-error';
  message.textContent = `페이지 초기화에 실패했습니다: ${reasonText}`;
  card.appendChild(message);
  root.appendChild(card);
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    initialize();
  } catch (error) {
    console.error('발자국 조망대 페이지 초기화에 실패했습니다.', error);
    renderInitializationError(error);
  }
});
