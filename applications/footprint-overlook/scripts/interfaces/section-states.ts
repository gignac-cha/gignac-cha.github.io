// Shared section states — loading, skeleton, error, empty — as DOM helpers. Every section can fail
// on its own (the dashboard fires its queries with allSettled and renders each result where it
// belongs), so these states exist per section rather than once for the page.

// Removes all children. Never innerHTML: the strings rendered here include upstream error text,
// and assigning that as markup would make any content the tracker echoes back an injection point.
// See https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML#security_considerations
export function clearElement(element: Element): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

// Loading state: a spinner plus a message. The spinner is aria-hidden because it carries no
// information the adjacent text does not already give.
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

// Error state, showing the upstream text verbatim. role="alert" because it replaces content that
// was loading, which a screen reader would otherwise never hear about.
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

// Empty state — a successful response with nothing in it, which is not an error. Every call site
// passes a message naming its own panel; the default is only the safety net.
export function createEmptyIndicator(messageText = '아직 데이터가 없습니다.'): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'section-state section-empty';

  const label = document.createElement('span');
  label.className = 'section-state-text';
  label.textContent = messageText;
  wrapper.appendChild(label);

  return wrapper;
}

// Which shape the placeholder should take. A skeleton exists to hold the space its content will
// need; one generic three-bar block cannot do that when the panels differ by 300px in height, so
// the page visibly jumped as each response landed and pushed the panels below it down. Each
// variant approximates the real content: the chart panel reserves the svg's height, a table
// reserves a header and a body of rows, the KPI row reserves five cards.
export type SkeletonVariant = 'text' | 'chart' | 'table' | 'kpi';

const SKELETON_TABLE_ROW_COUNT = 6;
const SKELETON_KPI_CARD_COUNT = 5;
const CHART_SKELETON_HEIGHT_PIXELS = 300;
const KPI_SKELETON_CARD_HEIGHT_PIXELS = 112;
const TABLE_SKELETON_ROW_HEIGHT_PIXELS = 22;

function createSkeletonBlock(extraClassName?: string): HTMLElement {
  const block = document.createElement('div');
  block.className = extraClassName === undefined ? 'skeleton-block' : `skeleton-block ${extraClassName}`;
  return block;
}

// Sizes are set here rather than in the stylesheet because they are measurements of the content
// this placeholder stands in for (the chart's own height, one table row, one KPI card), not a
// visual theme; the classes are still emitted so the stylesheet can refine them per breakpoint.
export function createSkeletonIndicator(variant: SkeletonVariant = 'text'): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `panel-skeleton is-${variant}`;

  // The bars say "loading" only to someone who can see them. One visually hidden line says the
  // same thing to a screen reader, which would otherwise be given a panel full of empty divs.
  // It is absolutely positioned by .visually-hidden, so it takes no space in the flex/grid layout.
  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.textContent = '불러오는 중…';
  wrapper.appendChild(status);

  if (variant === 'chart') {
    const legend = createSkeletonBlock('skeleton-short');
    wrapper.appendChild(legend);

    const plot = createSkeletonBlock('skeleton-chart-plot');
    plot.style.height = `${CHART_SKELETON_HEIGHT_PIXELS}px`;
    wrapper.appendChild(plot);
    return wrapper;
  }

  if (variant === 'table') {
    wrapper.appendChild(createSkeletonBlock('skeleton-header'));
    for (let index = 0; index < SKELETON_TABLE_ROW_COUNT; index += 1) {
      const rowBlock = createSkeletonBlock('skeleton-table-row');
      rowBlock.style.height = `${TABLE_SKELETON_ROW_HEIGHT_PIXELS}px`;
      wrapper.appendChild(rowBlock);
    }
    return wrapper;
  }

  if (variant === 'kpi') {
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = 'repeat(auto-fit, minmax(160px, 1fr))';
    for (let index = 0; index < SKELETON_KPI_CARD_COUNT; index += 1) {
      const cardBlock = createSkeletonBlock('skeleton-kpi-card');
      cardBlock.style.height = `${KPI_SKELETON_CARD_HEIGHT_PIXELS}px`;
      wrapper.appendChild(cardBlock);
    }
    return wrapper;
  }

  wrapper.appendChild(createSkeletonBlock('skeleton-header'));
  wrapper.appendChild(createSkeletonBlock());
  wrapper.appendChild(createSkeletonBlock('skeleton-short'));
  return wrapper;
}

// A section card (title plus a body mount point) together with its state transitions.
export interface SectionHandle {
  element: HTMLElement;
  bodyElement: HTMLElement;
  showLoading(messageText?: string): void;
  showSkeleton(variant?: SkeletonVariant): void;
  showError(messageText: string): void;
  showEmpty(messageText?: string): void;
  showContent(node: Node): void;
  // 'refreshing' (default) while a background refetch is in flight; 'failed' when that refetch
  // died and the panel intentionally keeps showing the cached rows — the badge is then the only
  // place the reader learns the numbers are old, so it must say so rather than disappear.
  setRefreshing(badgeText: string | null, state?: 'refreshing' | 'failed'): void;
}

// A panel's own class already says what shape its content has, so the section picks the matching
// placeholder itself. Callers can still override per call, but they do not have to remember to:
// the point of the variants is that no panel jumps when its response lands, and a default that has
// to be passed at 20 call sites is a default that will be missed at one of them.
function toDefaultSkeletonVariant(className: string | undefined): SkeletonVariant {
  if (className === undefined) {
    return 'text';
  }
  if (className.includes('chart-panel')) {
    return 'chart';
  }
  if (className.includes('recent-panel')) {
    return 'table';
  }
  return 'text';
}

// Builds a titled card whose body can be swapped between the states above and real content.
export function createSection(options: { title: string; subtitle?: string; className?: string }): SectionHandle {
  const element = document.createElement('section');
  element.className = options.className ? `panel ${options.className}` : 'panel';
  const defaultSkeletonVariant = toDefaultSkeletonVariant(options.className);

  const header = document.createElement('div');
  header.className = 'panel-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'panel-header-title-row';

  const title = document.createElement('h2');
  title.className = 'panel-title';
  title.textContent = options.title;
  titleRow.appendChild(title);

  const refreshBadge = document.createElement('span');
  refreshBadge.className = 'refresh-badge';
  // Toggled through style.display, not the hidden attribute: .refresh-badge declares
  // `display: inline-flex` in the stylesheet, and an author display declaration beats the user
  // agent's `[hidden] { display: none }`, so the attribute alone would leave the badge on screen.
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden
  refreshBadge.style.display = 'none';
  titleRow.appendChild(refreshBadge);

  header.appendChild(titleRow);

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
    showSkeleton: (variant) => mount(createSkeletonIndicator(variant ?? defaultSkeletonVariant)),
    showError: (messageText) => mount(createErrorIndicator(messageText)),
    showEmpty: (messageText) => mount(createEmptyIndicator(messageText)),
    showContent: (node) => mount(node),
    setRefreshing: (badgeText, state) => {
      if (badgeText !== null && badgeText.length > 0) {
        refreshBadge.textContent = `${badgeText} 기준 · ${state === 'failed' ? '갱신 실패' : '갱신 중'}`;
        refreshBadge.style.display = 'inline-flex';
      } else {
        refreshBadge.style.display = 'none';
      }
    },
  };
}
