import './dock.scss';
import { load, save } from './storage.ts';

type Side = 'right' | 'left';

interface DockState {
  side: Side;
  autoHide: boolean;
}

const fallback: DockState = { side: 'right', autoHide: false };
const closeDelay = 350;

const icons = {
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>',
  // 자동 숨김: 점선 테두리 안에서 가장자리로 접혀 들어가는 화살표.
  autoHide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" stroke-dasharray="3 3" /><path d="M10 9l3 3-3 3" /></svg>',
};

// 장면 목록 자리: 오른쪽(기본)·왼쪽에 고정하거나, 자동 숨김으로 둔다.
// 자동 숨김이면 목록은 그쪽 가장자리로 접혀 얇은 탭만 남고, 탭에 마우스를 올리면 미끄러져 나왔다가 벗어나면 들어간다.
export const setupIndexDock = (panel: HTMLElement, layout: HTMLElement) => {
  const stored = load<Partial<DockState> & { dock?: string }>('index', fallback);
  // 예전에 '띄우기'로 저장한 상태는 자동 숨김으로 옮긴다.
  const state: DockState = {
    side: stored.dock === 'left' ? 'left' : stored.side ?? 'right',
    autoHide: Boolean(stored.autoHide) || stored.dock === 'floating',
  };

  const label = panel.querySelector<HTMLElement>('.panel-label')!;
  const controls = document.createElement('div');
  controls.className = 'dock-controls';
  label.append(controls);
  const button = (icon: string, text: string, onClick: () => void) => {
    const element = document.createElement('button');
    element.className = 'dock-button';
    element.innerHTML = icon;
    element.title = text;
    element.setAttribute('aria-label', text);
    element.addEventListener('click', onClick);
    controls.append(element);
    return element;
  };
  const pinLeft = button(icons.left, '왼쪽에 고정', () => change({ side: 'left', autoHide: false }));
  const pinRight = button(icons.right, '오른쪽에 고정', () => change({ side: 'right', autoHide: false }));
  const autoHide = button(icons.autoHide, '자동 숨김', () => change({ side: state.side, autoHide: true }));

  // 자동 숨김일 때 가장자리에 남는 탭.
  const handle = document.createElement('button');
  handle.className = 'index-handle';
  handle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg><span>장면 목록</span>';
  handle.setAttribute('aria-label', '장면 목록 열기');
  document.body.append(handle);

  let closeTimer: number | undefined;
  const reveal = (open: boolean) => {
    window.clearTimeout(closeTimer);
    panel.classList.toggle('revealed', open);
    handle.classList.toggle('hidden', open);
  };
  const closeLater = () => {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => reveal(false), closeDelay);
  };
  handle.addEventListener('pointerenter', () => state.autoHide && reveal(true));
  handle.addEventListener('click', () => state.autoHide && reveal(true));
  handle.addEventListener('pointerleave', () => state.autoHide && closeLater());
  panel.addEventListener('pointerenter', () => window.clearTimeout(closeTimer));
  panel.addEventListener('pointerleave', () => state.autoHide && closeLater());
  panel.addEventListener('focusin', () => state.autoHide && reveal(true));
  panel.addEventListener('focusout', (event) => {
    if (state.autoHide && !panel.contains(event.relatedTarget as Node)) {
      closeLater();
    }
  });

  // 자동 숨김일 때 목록은 레이아웃 영역 높이에 맞춰 가장자리에 붙는다.
  const place = () => {
    if (!state.autoHide) {
      panel.style.removeProperty('top');
      panel.style.removeProperty('height');
      return;
    }
    const area = layout.getBoundingClientRect();
    const top = area.top + 16;
    const height = area.height - 32;
    panel.style.top = `${top}px`;
    panel.style.height = `${height}px`;
    handle.style.top = `${top + height / 2}px`;
  };

  const apply = () => {
    document.body.classList.toggle('index-left', state.side === 'left');
    document.body.classList.toggle('index-autohide', state.autoHide);
    pinLeft.hidden = !state.autoHide && state.side === 'left';
    pinRight.hidden = !state.autoHide && state.side === 'right';
    autoHide.hidden = state.autoHide;
    reveal(false);
    // 칸 배치가 바뀌므로 경계 조절 등 다른 모듈이 다시 계산하도록 알린다.
    window.dispatchEvent(new Event('resize'));
    place();
  };
  const change = (next: DockState) => {
    state.side = next.side;
    state.autoHide = next.autoHide;
    apply();
    save('index', state);
  };
  apply();
  window.addEventListener('resize', place);
};
