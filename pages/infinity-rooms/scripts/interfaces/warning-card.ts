// 경고 카드 본문(아이콘 + 제목 + 설명 + 해결 액션) 빌더입니다.
// 방 카드의 비가용 상태와 페이지 초기화 실패 카드가 같은 구조를 공유합니다.

export interface WarningCardContentOptions {
  titleText: string;
  descriptionText: string;
  // true 이면 상단 상태 카드로 안내하는 '해결 방법 보기' 버튼과 힌트를 보여줍니다.
  hasResolutionAction: boolean;
}

// 상태 카드 스트립으로 부드럽게 스크롤합니다. 모션 감소 환경에서는 즉시 이동합니다.
function scrollToStatusCards(): void {
  const statusCardsContainer = document.querySelector('#status-cards-container');
  if (!statusCardsContainer) {
    return;
  }
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  statusCardsContainer.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
}

export function buildWarningCardContent(options: WarningCardContentOptions): HTMLDivElement {
  const { titleText, descriptionText, hasResolutionAction } = options;

  const content = document.createElement('div');
  content.className = 'warning-card-content';

  const icon = document.createElement('div');
  icon.className = 'warning-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '!';
  content.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'warning-body';

  const title = document.createElement('h2');
  title.className = 'warning-title';
  title.textContent = titleText;
  body.appendChild(title);

  const description = document.createElement('p');
  description.className = 'warning-description';
  description.textContent = descriptionText;
  body.appendChild(description);

  if (hasResolutionAction) {
    const actions = document.createElement('div');
    actions.className = 'warning-actions';

    const resolutionButton = document.createElement('button');
    resolutionButton.type = 'button';
    resolutionButton.className = 'button-ai';
    resolutionButton.textContent = '해결 방법 보기';
    resolutionButton.addEventListener('click', scrollToStatusCards);
    actions.appendChild(resolutionButton);

    const hint = document.createElement('span');
    hint.className = 'warning-hint';
    hint.textContent = '상단 상태 카드의 배지를 누르면 자세한 해결 가이드가 열립니다.';
    actions.appendChild(hint);

    body.appendChild(actions);
  }

  content.appendChild(body);
  return content;
}
