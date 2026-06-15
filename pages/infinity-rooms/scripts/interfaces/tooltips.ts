// 상태 알약(pill)에 부착되는 popover 툴팁 한 벌입니다.
// 위치 계산(알약 아래 8px, 가로 중앙), hovered(통과 클릭)/pinned(포커스 + 바깥 클릭 닫기)/closed 상태를 담당합니다.
import { createStateMachineStore } from '../tools/state-machines.ts';

export type TooltipVisibility = 'closed' | 'hovered' | 'pinned';

export interface TooltipStateMachineState {
  // 진단이 끝나 툴팁에 보여줄 콘텐츠가 준비되었는지 여부입니다. 준비 전에는 열리지 않습니다.
  isContentReady: boolean;
  visibility: TooltipVisibility;
}

export type TooltipStateMachineEvent =
  | { type: 'CONTENT_READY' }
  | { type: 'MOUSE_ENTER' }
  | { type: 'MOUSE_LEAVE' }
  | { type: 'CLICK' }
  | { type: 'OPEN' }
  | { type: 'OUTSIDE_CLICK' };

export const initialTooltipStateMachineState: TooltipStateMachineState = {
  isContentReady: false,
  visibility: 'closed',
};

// 순수 전이 함수입니다. 변화가 없으면 동일 참조를 반환해 구독 알림을 생략하게 합니다.
export function transitionTooltip(state: TooltipStateMachineState, event: TooltipStateMachineEvent): TooltipStateMachineState {
  switch (event.type) {
    case 'CONTENT_READY': {
      // 재진단으로 콘텐츠가 갱신되면 열려 있던 툴팁을 닫고 다시 열 수 있는 상태로 만듭니다.
      if (state.isContentReady && state.visibility === 'closed') {
        return state;
      }
      return { isContentReady: true, visibility: 'closed' };
    }
    case 'MOUSE_ENTER': {
      if (!state.isContentReady) {
        return state;
      }
      if (state.visibility === 'closed') {
        return { ...state, visibility: 'hovered' };
      }
      return state;
    }
    case 'MOUSE_LEAVE': {
      if (state.visibility === 'hovered') {
        return { ...state, visibility: 'closed' };
      }
      return state;
    }
    case 'CLICK': {
      if (!state.isContentReady) {
        return state;
      }
      if (state.visibility === 'pinned') {
        return { ...state, visibility: 'closed' };
      }
      return { ...state, visibility: 'pinned' };
    }
    case 'OPEN': {
      // 외부(경고 카드의 '해결 방법 보기')에서 호출하는 멱등 열기입니다. 토글하지 않고 항상 pinned 로 수렴합니다.
      if (!state.isContentReady) {
        return state;
      }
      if (state.visibility === 'pinned') {
        return state;
      }
      return { ...state, visibility: 'pinned' };
    }
    case 'OUTSIDE_CLICK': {
      if (state.visibility === 'pinned') {
        return { ...state, visibility: 'closed' };
      }
      return state;
    }
  }
}

// Popover API 미지원 환경을 대비한 구조적 타입 가드입니다.
interface PopoverElement {
  showPopover(): void;
  hidePopover(): void;
}

function isPopoverElement(element: unknown): element is PopoverElement {
  return typeof element === 'object' && element !== null && 'showPopover' in element && 'hidePopover' in element;
}

// 상태 톤입니다. 툴팁 제목(도트 + 텍스트)의 색을 결정합니다.
export type StatusTone = 'ready' | 'pending' | 'error';

export interface StatusTooltip {
  element: HTMLDivElement;
  // 콘텐츠를 교체하고 툴팁을 열 수 있는 상태로 표시합니다.
  setContent(titleText: string, contentNode: Node, rawMessage: string, tone: StatusTone): void;
  // 콘텐츠가 준비되어 있으면 툴팁을 pinned 로 엽니다(이미 열려 있으면 무시). 외부 진입점에서 사용합니다.
  open(): void;
}

export function createStatusTooltip(options: { tooltipElementId: string; pillElement: HTMLElement }): StatusTooltip {
  const { tooltipElementId, pillElement } = options;

  const tooltipElement = document.createElement('div');
  tooltipElement.id = tooltipElementId;
  tooltipElement.className = 'status-tooltip';
  tooltipElement.setAttribute('popover', 'auto');
  tooltipElement.setAttribute('tabindex', '-1');

  const store = createStateMachineStore(initialTooltipStateMachineState, transitionTooltip);

  // 알약 아래 8px, 가로 중앙에 배치하되 뷰포트 밖으로 나가지 않게 16px 여백 안으로 고정합니다.
  // 고정으로 중심이 어긋난 만큼 화살표(--tooltip-arrow-left)가 알약을 계속 가리키도록 보정합니다.
  const positionTooltip = () => {
    const horizontalMargin = 16;
    const pillRectangle = pillElement.getBoundingClientRect();
    const tooltipRectangle = tooltipElement.getBoundingClientRect();

    const top = window.scrollY + pillRectangle.bottom + 8;
    const pillCenter = window.scrollX + pillRectangle.left + pillRectangle.width / 2;
    const centeredLeft = pillCenter - tooltipRectangle.width / 2;

    const minimumLeft = window.scrollX + horizontalMargin;
    const maximumLeft = window.scrollX + document.documentElement.clientWidth - tooltipRectangle.width - horizontalMargin;
    const clampedLeft = Math.min(Math.max(centeredLeft, minimumLeft), Math.max(minimumLeft, maximumLeft));

    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.left = `${clampedLeft}px`;
    tooltipElement.style.setProperty('--tooltip-arrow-left', `${pillCenter - clampedLeft}px`);
  };

  const handleOutsideClick = (event: MouseEvent) => {
    const target = event.target;
    if (target instanceof Node && !tooltipElement.contains(target) && !pillElement.contains(target)) {
      store.dispatch({ type: 'OUTSIDE_CLICK' });
    }
  };

  store.subscribe((previousState, nextState) => {
    if (previousState.visibility === nextState.visibility) {
      return;
    }

    try {
      if (nextState.visibility === 'closed') {
        tooltipElement.style.pointerEvents = '';
        if (isPopoverElement(tooltipElement)) {
          tooltipElement.hidePopover();
        }
        document.removeEventListener('click', handleOutsideClick);
      } else if (nextState.visibility === 'hovered') {
        tooltipElement.style.pointerEvents = 'none';
        if (isPopoverElement(tooltipElement)) {
          tooltipElement.showPopover();
        }
        positionTooltip();
      } else {
        tooltipElement.style.pointerEvents = 'auto';
        if (isPopoverElement(tooltipElement)) {
          tooltipElement.showPopover();
        }
        positionTooltip();
        tooltipElement.focus();
        document.addEventListener('click', handleOutsideClick);
      }
    } catch (error) {
      console.error('툴팁 popover 제어에 실패했습니다:', error);
    }
  });

  pillElement.addEventListener('mouseenter', () => store.dispatch({ type: 'MOUSE_ENTER' }));
  pillElement.addEventListener('mouseleave', () => store.dispatch({ type: 'MOUSE_LEAVE' }));
  pillElement.addEventListener('click', (event) => {
    event.stopPropagation();
    store.dispatch({ type: 'CLICK' });
  });

  return {
    element: tooltipElement,
    setContent(titleText, contentNode, rawMessage, tone) {
      tooltipElement.replaceChildren(buildTooltipFragment(titleText, contentNode, rawMessage, tone));
      store.dispatch({ type: 'CONTENT_READY' });
    },
    open() {
      store.dispatch({ type: 'OPEN' });
    },
  };
}

/* ============================================================================
   툴팁 콘텐츠 빌더 (innerHTML 미사용, createElement 기반)
   ============================================================================ */

// 굵게/코드/상태 배지 등 인라인 서식을 createElement 로 표현하기 위한 조각 타입입니다.
export type TooltipInlinePart = string | { bold: string } | { code: string } | { badgeClassName: string; badgeText: string };

function appendInlineParts(parent: HTMLElement, parts: TooltipInlinePart[]): void {
  for (const part of parts) {
    if (typeof part === 'string') {
      parent.appendChild(document.createTextNode(part));
    } else if ('bold' in part) {
      const strongElement = document.createElement('strong');
      strongElement.textContent = part.bold;
      parent.appendChild(strongElement);
    } else if ('code' in part) {
      const codeElement = document.createElement('code');
      codeElement.textContent = part.code;
      parent.appendChild(codeElement);
    } else {
      const badgeElement = document.createElement('span');
      badgeElement.className = part.badgeClassName;
      badgeElement.textContent = part.badgeText;
      parent.appendChild(badgeElement);
    }
  }
}

// 해결 조치 가이드 목록 항목입니다. link 가 있으면 크롬 내부 페이지 링크 한 줄로 렌더링합니다.
interface GuideItem {
  parts?: TooltipInlinePart[];
  link?: string;
  subItems?: GuideItem[];
}

function buildGuideList(items: GuideItem[]): HTMLUListElement {
  const listElement = document.createElement('ul');

  for (const item of items) {
    const listItemElement = document.createElement('li');

    if (item.link !== undefined) {
      const anchorElement = document.createElement('a');
      anchorElement.className = 'flag-link';
      anchorElement.href = item.link;
      anchorElement.textContent = item.link;
      listItemElement.appendChild(anchorElement);
    } else if (item.parts !== undefined) {
      appendInlineParts(listItemElement, item.parts);
    }

    if (item.subItems !== undefined && item.subItems.length > 0) {
      listItemElement.appendChild(buildGuideList(item.subItems));
    }

    listElement.appendChild(listItemElement);
  }

  return listElement;
}

// 사용자 에이전트 문자열에서 크롬 전체 버전 문자열을 추출합니다.
function getChromeVersion(): string {
  const match = navigator.userAgent.match(/Chrome\/([0-9.]+)/);
  return match ? match[1] : '알 수 없음';
}

// 사용자 에이전트 문자열에서 크롬 메이저 버전 숫자를 추출합니다.
function getChromeMajorVersion(): number | null {
  const match = navigator.userAgent.match(/Chrome\/([0-9]+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

// 다운로드 진행 모니터에 대한 구조적 타입입니다.
interface DownloadProgressEvent {
  loaded: number;
  total?: number;
}

interface DownloadMonitor {
  addEventListener(type: 'downloadprogress', listener: (event: DownloadProgressEvent) => void): void;
}

// 모델 다운로드 트리거가 사용하는 레거시 window.ai 인터페이스에 대한 구조적 타입입니다.
type WindowWithLegacyAI = Window & {
  ai?: {
    languageModel?: {
      create(options: object): Promise<{ destroy?: () => void }>;
    };
  };
};

function buildDownloadButton(buttonText: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'download-button';
  button.textContent = buttonText;

  const handleDownloadClick = async () => {
    button.disabled = true;
    button.textContent = '다운로드 요청 중...';

    const existingError = button.parentNode?.querySelector('.download-error-message');
    if (existingError) {
      existingError.remove();
    }

    const monitorOptions = {
      outputLanguage: 'en',
      expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
      monitor(monitor: DownloadMonitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          if (event.total) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            button.textContent = `다운로드 중... (${percentage}%)`;
          } else {
            const loadedMegabytes = (event.loaded / (1024 * 1024)).toFixed(1);
            button.textContent = `다운로드 중... (${loadedMegabytes}MB)`;
          }
        });
      },
    };

    try {
      const windowWithLegacyAI = window as WindowWithLegacyAI;
      if (!windowWithLegacyAI.ai?.languageModel) {
        throw new Error('크롬 브라우저에서 window.ai.languageModel 인터페이스를 찾을 수 없습니다.');
      }
      const session = await windowWithLegacyAI.ai.languageModel.create(monitorOptions);
      if (session && typeof session.destroy === 'function') {
        try {
          session.destroy();
        } catch {
          // 세션 정리 실패는 다운로드 트리거 결과에 영향을 주지 않으므로 무시합니다.
        }
      }
      button.textContent = '다운로드 완료';
    } catch (error: unknown) {
      button.textContent = buttonText;
      button.disabled = false;
      console.error('모델 다운로드 트리거에 실패했습니다:', error);

      const errorDivision = document.createElement('div');
      errorDivision.className = 'download-error-message';
      errorDivision.textContent = error instanceof Error ? error.message : 'Unknown error';
      button.parentNode?.appendChild(errorDivision);
    }
  };

  button.addEventListener('click', () => {
    handleDownloadClick().catch((error) => {
      console.error('모델 다운로드 처리 중 예기치 못한 오류가 발생했습니다:', error);
    });
  });

  return button;
}

export function buildPromptAPIAvailableContent(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(document.createTextNode('Gemini Nano 모델이 준비되어 온디바이스 AI를 즉시 사용할 수 있습니다.'));
  return fragment;
}

export function buildPromptAPIDownloadableContent(): DocumentFragment {
  const fragment = document.createDocumentFragment();

  fragment.appendChild(document.createTextNode('기기 디스크 및 하드웨어 요건을 만족하지만 로컬 모델이 부재한 상태입니다.'));

  const descriptionDivision = document.createElement('div');
  descriptionDivision.className = 'tooltip-description';
  descriptionDivision.textContent =
    '아래 다운로드 시작 버튼을 눌러 크롬 브라우저에 Gemini Nano AI 컴포넌트 다운로드를 지시할 수 있습니다. (사용자 클릭 제스처 필요)';
  fragment.appendChild(descriptionDivision);

  fragment.appendChild(buildDownloadButton('모델 다운로드 시작'));
  return fragment;
}

export function buildPromptAPIDownloadingContent(): DocumentFragment {
  const fragment = document.createDocumentFragment();

  fragment.appendChild(document.createTextNode('Chrome 브라우저가 온디바이스 Gemini Nano AI 컴포넌트를 백그라운드에서 다운로드하고 있습니다.'));

  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';

  const progressBarBackground = document.createElement('div');
  progressBarBackground.className = 'progress-bar-background';

  const progressBarFill = document.createElement('div');
  progressBarFill.className = 'progress-bar-fill';
  progressBarFill.style.width = '100%';
  progressBarBackground.appendChild(progressBarFill);

  progressContainer.appendChild(progressBarBackground);
  fragment.appendChild(progressContainer);

  fragment.appendChild(
    buildGuideList([
      {
        parts: ['다운로드 상황 및 진척도는 아래 내부 모니터링 페이지에서 실시간 확인이 가능합니다:'],
        subItems: [{ link: 'chrome://on-device-internals' }],
      },
    ]),
  );
  return fragment;
}

export function buildPromptAPIErrorContent(rawMessage: string): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const spaceErrorMessages = ['Not enough space for downloading the model.', 'Failed to create model path or not enough space for downloading.'];
  const crashErrorMessages = ['The model process crashed too many times for this version.', 'The model execution process crashed.'];

  const isSpaceError = spaceErrorMessages.includes(rawMessage);
  const isCrashError = crashErrorMessages.includes(rawMessage);

  const titleDivision = document.createElement('div');
  titleDivision.className = 'tooltip-error-title';
  if (isSpaceError) {
    titleDivision.textContent = '기기 디스크 용량이 부족하여 로컬 모델을 다운로드할 수 없습니다.';
  } else if (isCrashError) {
    titleDivision.textContent = '로컬 모델 프로세스가 반복해서 강제 종료(크래시)되었습니다.';
  } else {
    titleDivision.textContent = 'Prompt API 구동 오류가 발생했습니다.';
  }
  fragment.appendChild(titleDivision);

  const errorDetailElement = document.createElement('pre');
  errorDetailElement.className = 'tooltip-error-detail';
  errorDetailElement.textContent = rawMessage;
  fragment.appendChild(errorDetailElement);

  const guideItems: GuideItem[] = [];
  if (isSpaceError) {
    guideItems.push(
      { parts: ['크롬 프로필 볼륨의 여유 공간을 ', { bold: '최소 22GB 이상 확보' }, '해 주세요.'] },
      {
        parts: ['여유 공간 확보 후 아래 내부 진단 콘솔에서 실시간 다운로드 재시도 로그를 모니터링해 보세요:'],
        subItems: [{ link: 'chrome://on-device-internals' }],
      },
    );
  } else if (isCrashError) {
    guideItems.push(
      { parts: ['크롬 브라우저 프로세스를 완전히 종료한 뒤 ', { bold: '재시작(Relaunch)' }, '해 주세요.'] },
      {
        parts: ['components 아래 경로에서 ', { bold: 'Optimization Guide' }, ' 업데이트를 재시도해 보세요:'],
        subItems: [{ link: 'chrome://components' }],
      },
      { parts: ['크롬 브라우저를 ', { bold: '최신 안정 버전으로 업데이트' }, '하여 실행 모델 결함을 해결해 보세요.'] },
    );
  } else {
    guideItems.push(
      { parts: ['크롬 최신 버전 및 브라우저 Relaunch 여부 재점검'] },
      {
        parts: ['실험 플래그 설정 상태 재확인:'],
        subItems: [{ link: 'chrome://flags/#prompt-api-for-gemini-nano' }, { link: 'chrome://flags/#optimization-guide-on-device-model' }],
      },
    );
  }

  fragment.appendChild(buildGuideList(guideItems));

  const descriptionDivision = document.createElement('div');
  descriptionDivision.className = 'tooltip-description is-spaced';
  descriptionDivision.textContent = '조치 완료 후 아래 버튼을 클릭하여 모델 다운로드를 다시 시도해볼 수 있습니다. (사용자 클릭 제스처 필요)';
  fragment.appendChild(descriptionDivision);

  fragment.appendChild(buildDownloadButton('모델 다운로드 재시도'));
  return fragment;
}

export function buildPromptAPINoAPIContent(): DocumentFragment {
  const fragment = document.createDocumentFragment();

  fragment.appendChild(document.createTextNode('크롬 브라우저에 Prompt API 인터페이스가 로드되지 않았습니다.'));

  const currentVersion = getChromeVersion();
  const majorVersion = getChromeMajorVersion();

  const getVersionStatusParts = (major: number | null, current: string): TooltipInlinePart[] => {
    if (major === null) {
      return ['현재 브라우저 버전: ', { bold: current }, ' (최소 요구사항: ', { bold: 'Chrome 127+' }, ')'];
    }
    if (major < 127) {
      return [
        '현재 브라우저 버전: ',
        { bold: current },
        ' (',
        { badgeClassName: 'version-error', badgeText: '❌ 요구 사양 미달' },
        ' - 최소 ',
        { bold: 'Chrome 127+' },
        ' 필요, 브라우저를 업데이트해 주세요.)',
      ];
    }
    if (major === 127) {
      return [
        '현재 브라우저 버전: ',
        { bold: current },
        ' (',
        { badgeClassName: 'version-warning', badgeText: '⚠️ 최소 사양 충족' },
        ' - 안정 구동을 위해 ',
        { bold: 'Chrome 128+' },
        ' 업그레이드를 추천합니다.)',
      ];
    }
    return ['현재 브라우저 버전: ', { bold: current }, ' (', { badgeClassName: 'version-success', badgeText: ' 정상' }, ' - 127+ 요건 충족)'];
  };

  fragment.appendChild(
    buildGuideList([
      {
        parts: ['아래 실험 플래그를 Enabled(활성화)로 설정해 주세요:'],
        subItems: [{ link: 'chrome://flags/#prompt-api-for-gemini-nano' }],
      },
      {
        parts: ['데스크톱 환경의 최신 Google Chrome 브라우저인지 확인'],
        subItems: [{ parts: getVersionStatusParts(majorVersion, currentVersion) }],
      },
    ]),
  );
  return fragment;
}

export function buildPromptAPINoModelContent(): DocumentFragment {
  const fragment = document.createDocumentFragment();

  fragment.appendChild(document.createTextNode('Prompt API 객체는 존재하지만 로컬 실행 모델(Gemini Nano)이 작동하지 않습니다.'));

  fragment.appendChild(
    buildGuideList([
      {
        parts: ['아래 실험 플래그를 ', { bold: 'Enabled BypassPerfRequirement' }, '(또는 Enabled)로 설정해 주세요 (기기 하드웨어 기준 우회):'],
        subItems: [{ link: 'chrome://flags/#optimization-guide-on-device-model' }],
      },
      { parts: ['크롬 프로필 볼륨의 여유 공간이 ', { bold: '최소 22GB 이상' }, '인지 확인'] },
      { parts: ['components(chrome://components)에서 Optimization Guide의 업데이트 상태 및 다운로드 여부 확인'] },
      {
        parts: ['내부 AI 진단 및 상세 오류 로그 페이지에서 실패 원인을 실시간 확인해 보세요:'],
        subItems: [{ link: 'chrome://on-device-internals' }],
      },
    ]),
  );
  return fragment;
}

export function buildWebGPUAvailableContent(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(document.createTextNode('WebGPU API가 정상 작동 중입니다. 하드웨어 가속 3D 그래픽 및 병렬 연산 기능을 즉시 사용할 수 있습니다.'));
  return fragment;
}

export function buildWebGPUNoAPIContent(): DocumentFragment {
  const fragment = document.createDocumentFragment();

  fragment.appendChild(document.createTextNode('현재 브라우저 또는 그래픽 카드 장치에서 WebGPU를 사용할 수 없습니다.'));
  fragment.appendChild(document.createElement('br'));

  const strongElement = document.createElement('strong');
  strongElement.textContent = '해결 조치 가이드:';
  fragment.appendChild(strongElement);

  fragment.appendChild(
    buildGuideList([
      { parts: ['크롬 브라우저 최신 버전(Chrome 113 이상)인지 확인'] },
      {
        parts: ['설정(', { code: 'chrome://settings/system' }, ')에서 ', { bold: "'가능한 경우 그래픽 가속 사용'" }, '이 켜져 있는지 확인'],
      },
      { parts: ['사용 중인 그래픽 카드 드라이버를 최신 버전으로 업데이트'] },
    ]),
  );
  return fragment;
}

// 제목(도트 + 한국어 텍스트) + 본문 + 원시 진단 메시지(RAW 모노 칩)를 표준 레이아웃으로 합칩니다.
export function buildTooltipFragment(titleText: string, contentNode: Node, rawMessage: string, tone: StatusTone): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const titleElement = document.createElement('p');
  titleElement.className = `tooltip-title is-tone-${tone}`;

  const titleDot = document.createElement('span');
  titleDot.className = 'tooltip-title-dot';
  titleDot.setAttribute('aria-hidden', 'true');
  titleElement.appendChild(titleDot);

  titleElement.appendChild(document.createTextNode(titleText));
  fragment.appendChild(titleElement);

  fragment.appendChild(contentNode);

  const rawRow = document.createElement('div');
  rawRow.className = 'tooltip-raw';

  const rawLabel = document.createElement('span');
  rawLabel.className = 'tooltip-raw-label';
  rawLabel.textContent = 'RAW';
  rawRow.appendChild(rawLabel);

  const rawCode = document.createElement('code');
  rawCode.textContent = rawMessage;
  rawRow.appendChild(rawCode);

  fragment.appendChild(rawRow);
  return fragment;
}
