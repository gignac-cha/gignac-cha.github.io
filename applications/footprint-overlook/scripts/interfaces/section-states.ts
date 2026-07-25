// Shared section states — loading, error, empty — as DOM helpers. Every section can fail on its
// own (the dashboard loads all fifteen queries with allSettled), so these three states exist per
// section rather than once for the page.

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

// A section card (title plus a body mount point) together with its state transitions.
export interface SectionHandle {
  element: HTMLElement;
  bodyElement: HTMLElement;
  showLoading(messageText?: string): void;
  showError(messageText: string): void;
  showEmpty(messageText?: string): void;
  showContent(node: Node): void;
}

// Builds a titled card whose body can be swapped between the states above and real content.
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
