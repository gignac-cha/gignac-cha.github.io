import { clamp, onDrag } from './drag';
import { load, save } from './storage';

// YouTube 임베드 플레이어는 200×200 보다 작으면 안 되므로, 16:9 영상 높이가 200 이 되는 폭에 패널 테두리를 더한 값을 최소로 둔다.
const minimumWidth = 360;
const labelHeight = 38;
const margin = 12;

interface PipState {
  on: boolean;
  x: number | null;
  y: number | null;
  width: number;
}

const fallback: PipState = { on: false, x: null, y: null, width: 420 };

// 영상 띄우기. iframe 을 다른 곳으로 옮기면 플레이어가 새로 로드되므로, 자리는 그대로 두고 CSS(position: fixed)로만 띄운다.
// 패널 라벨을 잡고 끌어 옮기고, 왼쪽 아래 모서리를 끌어 크기를 바꾼다.
export const setupPip = (toggle: HTMLButtonElement, panel: HTMLElement) => {
  const state = load<PipState>('pip', fallback);
  const handle = panel.querySelector<HTMLElement>('.panel-label')!;
  const resizer = document.createElement('div');
  resizer.className = 'pip-resize';
  resizer.setAttribute('aria-hidden', 'true');
  panel.append(resizer);

  const size = () => {
    const width = clamp(state.width, minimumWidth, window.innerWidth * .6);
    return { width, height: (width * 9) / 16 + labelHeight };
  };
  // 기본 자리: 오른쪽 아래, 아래쪽 재생 바 위.
  const place = () => {
    const { width, height } = size();
    const x = clamp(state.x ?? window.innerWidth - width - 24, margin, window.innerWidth - width - margin);
    const y = clamp(state.y ?? window.innerHeight - height - 120, margin, window.innerHeight - height - margin);
    return { x, y, width, height };
  };

  const apply = () => {
    document.body.classList.toggle('pip', state.on);
    toggle.setAttribute('aria-pressed', String(state.on));
    toggle.querySelector('span')!.textContent = state.on ? '띄우기 해제' : '영상 띄우기';
    if (state.on) {
      const { x, y, width } = place();
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      panel.style.width = `${width}px`;
    } else {
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('width');
    }
  };
  apply();
  window.addEventListener('resize', apply);

  toggle.addEventListener('click', () => {
    state.on = !state.on;
    apply();
    save('pip', state);
  });

  let origin = { x: 0, y: 0, width: 0 };
  onDrag(handle, {
    start: () => {
      if (!state.on) {
        return false;
      }
      origin = place();
    },
    move: (_, dx, dy) => {
      state.x = origin.x + dx;
      state.y = origin.y + dy;
      apply();
    },
    end: () => save('pip', state),
  });
  // 왼쪽 아래 모서리: 왼쪽으로 끌면 커진다. 오른쪽 위 모서리는 제자리에 둔다.
  onDrag(resizer, {
    start: () => {
      origin = place();
    },
    move: (_, dx) => {
      const width = clamp(origin.width - dx, minimumWidth, window.innerWidth * .6);
      state.width = width;
      state.x = origin.x + origin.width - width;
      state.y = origin.y;
      apply();
    },
    end: () => save('pip', state),
  });
};
