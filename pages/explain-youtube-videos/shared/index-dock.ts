import './dock.scss';
import { clamp, onDrag } from './drag';
import { load, save } from './storage';

type Dock = 'right' | 'left' | 'floating';

interface DockState {
  dock: Dock;
  x: number | null;
  y: number | null;
  width: number;
  height: number | null;
}

const fallback: DockState = { dock: 'right', x: null, y: null, width: 336, height: null };
const margin = 12;

const icons: Record<Dock, string> = {
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>',
  // 떼어내기: 창 밖으로 나가는 화살표.
  floating: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" /><path d="M14 4h6v6" /><path d="M20 4l-9 9" /></svg>',
};
const labels: Record<Dock, string> = { left: '왼쪽에 붙이기', right: '오른쪽에 붙이기', floating: '떼어내기' };

// 장면 인덱스 자리: 오른쪽(기본)·왼쪽에 붙이거나, 떼어내 화면 위에 띄운다.
// 띄운 상태에서는 머리를 잡고 옮기고, 오른쪽 아래 모서리(CSS resize)로 크기를 바꾼다.
export const setupIndexDock = (panel: HTMLElement) => {
  const state = load<DockState>('index', fallback);
  const label = panel.querySelector<HTMLElement>('.panel-label')!;
  const controls = document.createElement('div');
  controls.className = 'dock-controls';
  label.append(controls);
  const buttons = (Object.keys(icons) as Dock[]).map((dock) => {
    const button = document.createElement('button');
    button.className = 'dock-button';
    button.innerHTML = icons[dock];
    button.title = labels[dock];
    button.setAttribute('aria-label', labels[dock]);
    button.addEventListener('click', () => {
      state.dock = dock;
      apply();
      save('index', state);
    });
    controls.append(button);
    return { dock, button };
  });

  const place = () => {
    const width = clamp(state.width, 280, window.innerWidth - margin * 2);
    const height = clamp(state.height ?? Math.min(640, window.innerHeight - 200), 240, window.innerHeight - margin * 2);
    const x = clamp(state.x ?? window.innerWidth - width - 24, margin, window.innerWidth - width - margin);
    const y = clamp(state.y ?? 96, margin, window.innerHeight - height - margin);
    return { x, y, width, height };
  };
  const position = () => {
    const { x, y, width, height } = place();
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
  };

  const apply = () => {
    document.body.classList.toggle('index-left', state.dock === 'left');
    document.body.classList.toggle('index-floating', state.dock === 'floating');
    if (state.dock === 'floating') {
      position();
    } else {
      for (const property of ['left', 'top', 'width', 'height']) {
        panel.style.removeProperty(property);
      }
    }
    for (const { dock, button } of buttons) {
      button.hidden = dock === state.dock;
    }
    // 칸 배치가 바뀌므로 경계 조절 등 다른 모듈이 다시 계산하도록 알린다.
    window.dispatchEvent(new Event('resize'));
  };
  apply();
  window.addEventListener('resize', () => {
    if (state.dock === 'floating') {
      position();
    }
  });

  // 모서리로 크기를 바꾸면 기억해 둔다.
  new ResizeObserver(() => {
    if (state.dock !== 'floating') {
      return;
    }
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    if (width !== state.width || height !== state.height) {
      state.width = width;
      state.height = height;
      save('index', state);
    }
  }).observe(panel);

  let origin = { x: 0, y: 0 };
  onDrag(label, {
    start: () => {
      if (state.dock !== 'floating') {
        return false;
      }
      origin = place();
    },
    move: (_, dx, dy) => {
      state.x = origin.x + dx;
      state.y = origin.y + dy;
      position();
    },
    end: () => save('index', state),
  });
};
