// Page entry point. It resolves the tracker endpoint from browser storage and renders either the
// setup card (no endpoint stored) or the dashboard — the family rule that endpoints are never
// hardcoded is what makes this a runtime branch rather than a build-time constant.

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

// No endpoint stored: header plus the centred setup card.
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
        // Write, then read back rather than reusing rawUrl: the dashboard must run against the
        // exact value that was stored (normalized, and absent entirely if storage is blocked),
        // not against what the user typed.
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

// Endpoint available: header, dashboard, footer.
function renderDashboard(root: HTMLElement, endpoint: string): void {
  clearElement(root);
  root.classList.remove('is-setup-mode');
  root.appendChild(createPageHeader());
  root.appendChild(
    createDashboard({
      endpoint,
      // "변경" returns to the setup card with the current value prefilled.
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

// Last-resort renderer: an unhandled failure during initialization would otherwise leave a blank
// page with the reason visible only in the console.
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
    console.error('Footprint Overlook 페이지 초기화에 실패했습니다.', error);
    renderInitializationError(error);
  }
});
