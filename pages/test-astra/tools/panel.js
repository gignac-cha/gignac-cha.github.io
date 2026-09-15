import { createIcon } from './ui.js';

let nextId = 0;
export function createPanel({ title: panelTitle, paragraphs, theme = 'dark', indexHref }) {
  if (
    typeof panelTitle !== 'string' ||
    !Array.isArray(paragraphs) ||
    !paragraphs.every((text) => typeof text === 'string')
  ) {
    throw new TypeError('Panel requires a title and text paragraphs.');
  }
  const id = `experiment-info-${++nextId}`;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'experiment-panel-trigger';
  trigger.setAttribute('aria-label', '작품 설명 열기');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.title = '작품 설명';
  const triggerLabel = document.createElement('span');
  triggerLabel.textContent = 'About';
  trigger.append(createIcon('info'), triggerLabel);

  const panel = document.createElement('dialog');
  panel.id = id;
  panel.className = 'experiment-panel';
  panel.dataset.theme = theme;
  panel.lang = 'ko';
  panel.setAttribute('aria-labelledby', `${id}-title`);

  const heading = document.createElement('div');
  heading.className = 'experiment-panel-heading';
  const title = document.createElement('h2');
  title.id = `${id}-title`;
  title.textContent = panelTitle;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'experiment-panel-close';
  close.setAttribute('aria-label', '닫기');
  close.title = '닫기';
  close.appendChild(createIcon('x'));
  heading.append(title, close);

  const content = document.createElement('div');
  content.className = 'experiment-panel-content';
  for (const text of paragraphs) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    content.appendChild(paragraph);
  }
  panel.append(heading, content);
  if (indexHref) {
    const navigation = document.createElement('div');
    navigation.className = 'experiment-panel-navigation';
    const back = document.createElement('a');
    back.href = indexHref;
    back.textContent = '전체 목록';
    navigation.appendChild(back);
    panel.appendChild(navigation);
  }

  function open() {
    if (panel.open) return;
    panel.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    close.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', open);
  close.addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => {
    trigger.setAttribute('aria-expanded', 'false');
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  });
  panel.addEventListener('click', (event) => {
    if (event.target !== panel) return;
    const bounds = panel.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      panel.close();
  });
  // Keep page-level playback shortcuts out of the modal while retaining native Escape.
  panel.addEventListener('keydown', (event) => event.stopPropagation());
  return {
    element: panel,
    trigger,
    open,
    close() {
      panel.close();
    },
    destroy() {
      trigger.remove();
      if (panel.open) panel.close();
      panel.remove();
    },
  };
}
