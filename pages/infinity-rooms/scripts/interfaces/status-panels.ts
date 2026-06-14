// 진단 상태 카드(알약 + 문서 링크 + popover 툴팁) 제네릭 팩토리와 Prompt API/WebGPU 구체 카드입니다.
import { createStateMachineStore } from '../tools/state-machines.ts';
import {
  buildPromptAPIAvailableContent,
  buildPromptAPIDownloadableContent,
  buildPromptAPIDownloadingContent,
  buildPromptAPIErrorContent,
  buildPromptAPINoAPIContent,
  buildPromptAPINoModelContent,
  buildWebGPUAvailableContent,
  buildWebGPUNoAPIContent,
  createStatusTooltip,
} from './tooltips.ts';
import type { StatusTone } from './tooltips.ts';
import { checkWebGPUAvailability, WebGPUAvailabilityStatus } from './webgpu-availability.ts';

export interface StatusPanelDescription {
  pillText: string;
  pillClassName: string;
  // 알약/툴팁 제목이 공유하는 상태 톤(ready/pending/error)입니다.
  tone: StatusTone;
  tooltipTitle: string;
  buildTooltipContent: () => Node;
}

export interface StatusPanelOptions<Status extends string> {
  title: string;
  documentTitle: string;
  documentURL: string;
  pillElementId: string;
  tooltipElementId: string;
  diagnose: () => Promise<{ status: Status; rawMessage: string }>;
  describe: (status: Status, rawMessage: string) => StatusPanelDescription;
}

export interface StatusPanel<Status extends string> {
  element: HTMLElement;
  onStatusChange(callback: (status: Status) => void): void;
}

// 진단 진행 상태 머신입니다. diagnose 의 rejection 도 failed 상태로 수렴합니다.
type DiagnosisState<Status extends string> =
  | { phase: 'diagnosing' }
  | { phase: 'diagnosed'; status: Status; rawMessage: string }
  | { phase: 'failed'; rawMessage: string };

type DiagnosisEvent<Status extends string> =
  | { type: 'DIAGNOSE_SUCCESS'; status: Status; rawMessage: string }
  | { type: 'DIAGNOSE_FAILURE'; rawMessage: string };

function transitionDiagnosis<Status extends string>(state: DiagnosisState<Status>, event: DiagnosisEvent<Status>): DiagnosisState<Status> {
  switch (event.type) {
    case 'DIAGNOSE_SUCCESS': {
      if (state.phase === 'diagnosed' && state.status === event.status && state.rawMessage === event.rawMessage) {
        return state;
      }
      return { phase: 'diagnosed', status: event.status, rawMessage: event.rawMessage };
    }
    case 'DIAGNOSE_FAILURE': {
      if (state.phase === 'failed' && state.rawMessage === event.rawMessage) {
        return state;
      }
      return { phase: 'failed', rawMessage: event.rawMessage };
    }
  }
}

// 진단 함수 자체가 거부(rejection)되었을 때 보여줄 일반 오류 본문입니다.
function buildDiagnoseFailureContent(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(
    document.createTextNode('진단 함수 실행이 거부되어 상태를 확인하지 못했습니다. 새로고침 후에도 반복되면 브라우저 콘솔의 오류를 확인해 주세요.'),
  );
  return fragment;
}

export function createStatusPanel<Status extends string>(options: StatusPanelOptions<Status>): StatusPanel<Status> {
  const { title, documentTitle, documentURL, pillElementId, tooltipElementId, diagnose, describe } = options;

  const panel = document.createElement('div');
  panel.className = 'card-panel';

  const titleElement = document.createElement('span');
  titleElement.className = 'panel-title';
  titleElement.textContent = title;

  // 알약은 상태 도트 + 라벨 두 부분으로 구성됩니다. 상태 갱신 시 라벨 텍스트만 바꿉니다.
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.id = pillElementId;
  pill.className = 'status-pill';

  const pillDot = document.createElement('span');
  pillDot.className = 'pill-dot';
  pillDot.setAttribute('aria-hidden', 'true');
  pill.appendChild(pillDot);

  const pillLabel = document.createElement('span');
  pillLabel.className = 'pill-label';
  pillLabel.textContent = '진단 중...';
  pill.appendChild(pillLabel);

  // 제목 행(제목 좌측 + 알약 우측)이 먼저 오고, 문서 링크는 짧은 메타로 아래에 둡니다.
  const titleRow = document.createElement('div');
  titleRow.className = 'panel-title-row';
  titleRow.appendChild(titleElement);
  titleRow.appendChild(pill);

  const documentLink = document.createElement('a');
  documentLink.className = 'panel-document-link';
  documentLink.href = documentURL;
  documentLink.target = '_blank';
  documentLink.rel = 'noopener noreferrer';
  documentLink.textContent = `${documentTitle} ↗`;
  documentLink.title = `${documentTitle} (${documentURL})`;

  const statusTooltip = createStatusTooltip({ tooltipElementId, pillElement: pill });

  panel.appendChild(titleRow);
  panel.appendChild(documentLink);
  panel.appendChild(statusTooltip.element);

  const statusChangeCallbacks: ((status: Status) => void)[] = [];

  const diagnosisStore = createStateMachineStore<DiagnosisState<Status>, DiagnosisEvent<Status>>({ phase: 'diagnosing' }, transitionDiagnosis);

  diagnosisStore.subscribe((_previousState, nextState) => {
    if (nextState.phase === 'diagnosed') {
      const description = describe(nextState.status, nextState.rawMessage);
      pillLabel.textContent = description.pillText;
      pill.className = description.pillClassName;
      statusTooltip.setContent(description.tooltipTitle, description.buildTooltipContent(), nextState.rawMessage, description.tone);
      for (const callback of statusChangeCallbacks) {
        callback(nextState.status);
      }
    } else if (nextState.phase === 'failed') {
      pillLabel.textContent = '오류';
      pill.className = 'status-pill is-disabled';
      statusTooltip.setContent('진단 오류', buildDiagnoseFailureContent(), nextState.rawMessage, 'error');
    }
  });

  diagnose()
    .then((result) => {
      diagnosisStore.dispatch({ type: 'DIAGNOSE_SUCCESS', status: result.status, rawMessage: result.rawMessage });
    })
    .catch((error: unknown) => {
      // 진단 함수의 rejection 도 반드시 오류 상태로 수렴시킵니다.
      const rawMessage = error instanceof Error ? error.message : String(error);
      diagnosisStore.dispatch({ type: 'DIAGNOSE_FAILURE', rawMessage });
    });

  return {
    element: panel,
    onStatusChange(callback) {
      statusChangeCallbacks.push(callback);
      const state = diagnosisStore.getState();
      if (state.phase === 'diagnosed') {
        callback(state.status);
      }
    },
  };
}

export type PromptAPIDiagnosisStatus = 'available' | 'downloadable' | 'downloading' | 'no-api' | 'no-model' | 'error';

export function createPromptAPIStatusPanel(
  diagnose: () => Promise<{ status: PromptAPIDiagnosisStatus; rawMessage: string }>,
): StatusPanel<PromptAPIDiagnosisStatus> {
  return createStatusPanel<PromptAPIDiagnosisStatus>({
    title: 'Prompt API',
    // MDN에는 아직 Prompt API 문서가 없어 Chrome 공식 문서로 연결합니다.
    // 표시는 짧은 메타 한 줄(문서명 · 출처)이고, 전체 URL 은 title 속성으로만 제공합니다.
    documentURL: 'https://developer.chrome.com/docs/ai/prompt-api',
    documentTitle: 'The Prompt API · Chrome for Developers',
    pillElementId: 'api-status-pill',
    tooltipElementId: 'api-status-tooltip',
    diagnose,
    // 툴팁 제목은 한국어 단독으로 두고, 영문 원문은 RAW 모노 칩이 담당합니다.
    describe: (status, rawMessage) => {
      switch (status) {
        case 'available': {
          return {
            pillText: '사용 가능',
            pillClassName: 'status-pill is-ready',
            tone: 'ready',
            tooltipTitle: '사용 가능',
            buildTooltipContent: buildPromptAPIAvailableContent,
          };
        }
        case 'downloadable': {
          return {
            pillText: '다운로드 가능',
            pillClassName: 'status-pill is-pending',
            tone: 'pending',
            tooltipTitle: '다운로드 가능',
            buildTooltipContent: buildPromptAPIDownloadableContent,
          };
        }
        case 'downloading': {
          return {
            pillText: '다운로드 중',
            pillClassName: 'status-pill is-pending',
            tone: 'pending',
            tooltipTitle: '다운로드 중',
            buildTooltipContent: buildPromptAPIDownloadingContent,
          };
        }
        case 'error': {
          return {
            pillText: '오류',
            pillClassName: 'status-pill is-disabled',
            tone: 'error',
            tooltipTitle: '진단 오류',
            buildTooltipContent: () => buildPromptAPIErrorContent(rawMessage),
          };
        }
        case 'no-api': {
          return {
            pillText: '미지원',
            pillClassName: 'status-pill is-disabled',
            tone: 'error',
            tooltipTitle: '인터페이스 미지원',
            buildTooltipContent: buildPromptAPINoAPIContent,
          };
        }
        case 'no-model': {
          return {
            pillText: '미지원',
            pillClassName: 'status-pill is-disabled',
            tone: 'error',
            tooltipTitle: '로컬 모델 미지원',
            buildTooltipContent: buildPromptAPINoModelContent,
          };
        }
      }
    },
  });
}

export function createWebGPUStatusPanel(): StatusPanel<WebGPUAvailabilityStatus> {
  return createStatusPanel<WebGPUAvailabilityStatus>({
    title: 'WebGPU',
    // 표시는 짧은 메타 한 줄(문서명 · 출처)이고, 전체 URL 은 title 속성으로만 제공합니다.
    documentURL: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API',
    documentTitle: 'WebGPU API · MDN',
    pillElementId: 'webgpu-status-pill',
    tooltipElementId: 'webgpu-status-tooltip',
    diagnose: checkWebGPUAvailability,
    describe: (status) => {
      switch (status) {
        case 'available': {
          return {
            pillText: '사용 가능',
            pillClassName: 'status-pill is-ready',
            tone: 'ready',
            tooltipTitle: '사용 가능',
            buildTooltipContent: buildWebGPUAvailableContent,
          };
        }
        case 'no-api': {
          return {
            pillText: '미지원',
            pillClassName: 'status-pill is-disabled',
            tone: 'error',
            tooltipTitle: '지원되지 않음',
            buildTooltipContent: buildWebGPUNoAPIContent,
          };
        }
      }
    },
  });
}

// 두 상태 카드를 담는 2열 그리드 컨테이너를 만듭니다.
export function createStatusCardsContainer(panelElements: HTMLElement[]): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'status-cards-container';
  container.className = 'status-cards-container';
  for (const panelElement of panelElements) {
    container.appendChild(panelElement);
  }
  return container;
}
