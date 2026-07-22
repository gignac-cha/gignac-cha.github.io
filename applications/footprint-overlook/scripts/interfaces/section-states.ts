// 각 대시보드 섹션이 공유하는 상태 표시(로딩 스피너·에러·빈 상태) DOM 헬퍼입니다.
// 표시 전용이라 단위 테스트 대상에서 제외합니다(스타일 계약은 styles/_states.scss).

// 자식 요소를 모두 비웁니다(innerHTML 미사용 규칙 준수).
export function clearElement(element: Element): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

// 회전 스피너 + 안내 문구로 구성한 로딩 표시입니다.
export function createLoadingIndicator(messageText = '불러오는 중…'): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'section-state section-loading';

  const spinner = document.createElement('span');
  spinner.className = 'section-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(spinner);

  const label = document.createElement('span');
  label.className = 'section-state-text';
  label.textContent = messageText;
  wrapper.appendChild(label);

  return wrapper;
}

// 상단 스트림 오류 원문을 그대로 보여 주는 에러 표시입니다.
export function createErrorIndicator(messageText: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'section-state section-error';
  wrapper.setAttribute('role', 'alert');

  const icon = document.createElement('span');
  icon.className = 'section-error-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '!';
  wrapper.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'section-state-text';
  label.textContent = messageText;
  wrapper.appendChild(label);

  return wrapper;
}

// "아직 발자국이 없습니다" 같은 빈 상태 표시입니다.
export function createEmptyIndicator(messageText = '아직 발자국이 없습니다.'): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'section-state section-empty';

  const label = document.createElement('span');
  label.className = 'section-state-text';
  label.textContent = messageText;
  wrapper.appendChild(label);

  return wrapper;
}

// 섹션 카드(제목 + 본문 마운트 지점)와 상태 전환 메서드를 함께 돌려주는 핸들입니다.
export interface SectionHandle {
  element: HTMLElement;
  bodyElement: HTMLElement;
  showLoading(messageText?: string): void;
  showError(messageText: string): void;
  showEmpty(messageText?: string): void;
  showContent(node: Node): void;
}

// 제목·부제를 가진 카드 섹션을 만들고, 본문 영역을 상태별로 갈아 끼울 수 있게 합니다.
export function createSection(options: { title: string; subtitle?: string; className?: string }): SectionHandle {
  const element = document.createElement('section');
  element.className = options.className ? `panel ${options.className}` : 'panel';

  const header = document.createElement('div');
  header.className = 'panel-header';

  const title = document.createElement('h2');
  title.className = 'panel-title';
  title.textContent = options.title;
  header.appendChild(title);

  if (options.subtitle !== undefined) {
    const subtitle = document.createElement('p');
    subtitle.className = 'panel-subtitle';
    subtitle.textContent = options.subtitle;
    header.appendChild(subtitle);
  }

  element.appendChild(header);

  const bodyElement = document.createElement('div');
  bodyElement.className = 'panel-body';
  element.appendChild(bodyElement);

  const mount = (node: Node): void => {
    clearElement(bodyElement);
    bodyElement.appendChild(node);
  };

  return {
    element,
    bodyElement,
    showLoading: (messageText) => mount(createLoadingIndicator(messageText)),
    showError: (messageText) => mount(createErrorIndicator(messageText)),
    showEmpty: (messageText) => mount(createEmptyIndicator(messageText)),
    showContent: (node) => mount(node),
  };
}
