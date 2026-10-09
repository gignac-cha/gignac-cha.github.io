import './dock.scss';
import { clamp, onDrag } from './drag.ts';
import { load, save } from './storage.ts';

type Dock = 'top' | 'bottom' | 'floating';

interface DockState {
  dock: Dock;
  x: number | null;
  y: number | null;
}

const fallback: DockState = { dock: 'bottom', x: null, y: null };
const floatingWidth = 720;
const margin = 12;

const icons: Record<Dock, string> = {
  top: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14M12 20V9M7 13l5-5 5 5" /></svg>',
  bottom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20h14M12 4v11M7 11l5 5 5-5" /></svg>',
  // 띄우기: 창 밖으로 나가는 화살표.
  floating: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" /><path d="M14 4h6v6" /><path d="M20 4l-9 9" /></svg>',
};
const labels: Record<Dock, string> = { top: '위쪽에 고정', bottom: '아래쪽에 고정', floating: '띄우기' };

// 재생 바 자리: 아래(기본)·위에 붙이거나, 떼어내 화면 위에 띄운다. 띄운 상태에서는 머리 부분을 잡고 끌어 옮긴다.
export const setupTimelineDock = (panel: HTMLElement, top: HTMLElement, bottom: HTMLElement) => {
  const state = load<DockState>('timeline', fallback);
  const controls = document.createElement('div');
  controls.className = 'dock-controls timeline-dock';
  panel.append(controls);
  const buttons = (Object.keys(icons) as Dock[]).map((dock) => {
    const button = document.createElement('button');
    button.className = 'dock-button';
    button.innerHTML = icons[dock];
    button.title = labels[dock];
    button.setAttribute('aria-label', labels[dock]);
    button.addEventListener('click', () => {
      state.dock = dock;
      apply();
      save('timeline', state);
    });
    controls.append(button);
    return { dock, button };
  });

  const place = () => {
    const width = Math.min(floatingWidth, window.innerWidth - margin * 2);
    const height = panel.offsetHeight > 0 ? panel.offsetHeight : 72;
    const x = clamp(state.x ?? (window.innerWidth - width) / 2, margin, window.innerWidth - width - margin);
    const y = clamp(state.y ?? window.innerHeight - height - 32, margin, window.innerHeight - height - margin);
    return { x, y, width };
  };

  const apply = () => {
    const floating = state.dock === 'floating';
    panel.classList.toggle('floating', floating);
    if (floating) {
      if (panel.parentElement !== document.body) {
        document.body.append(panel);
      }
      const { x, y, width } = place();
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      panel.style.width = `${width}px`;
    } else {
      const slot = state.dock === 'top' ? top : bottom;
      if (panel.parentElement !== slot) {
        slot.append(panel);
      }
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('width');
    }
    for (const { dock, button } of buttons) {
      button.hidden = dock === state.dock;
    }
    // 위·아래 자리가 바뀌면 레이아웃 높이가 달라지므로 다른 모듈이 다시 계산하도록 알린다.
    window.dispatchEvent(new Event('resize'));
  };
  apply();
  window.addEventListener('resize', () => {
    if (state.dock === 'floating') {
      const { x, y, width } = place();
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      panel.style.width = `${width}px`;
    }
  });

  let origin = { x: 0, y: 0 };
  onDrag(panel, {
    start: (event) => {
      if (state.dock !== 'floating' || (event.target as Element).closest('.timeline-track')) {
        return false;
      }
      origin = place();
    },
    move: (_, dx, dy) => {
      state.x = origin.x + dx;
      state.y = origin.y + dy;
      const { x, y } = place();
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    },
    end: () => save('timeline', state),
  });
};
