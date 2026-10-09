import { clamp, onDrag } from './drag.ts';
import { load, save } from './storage.ts';

// YouTube 임베드는 200×200 보다 작으면 안 되므로 16:9 영상 높이가 200 이 되는 폭에 패널 테두리를 더한 360px 를 최소로 둔다.
const videoMinimum = 360;
const sceneMinimum = 360;
const fallback = { ratio: .3 };

// 영상과 장면 사이 경계. 영상 칸의 폭을 레이아웃 폭의 비율로 정하고, 영상은 그 폭에 맞춰 16:9 로 줄어든다.
export const setupSplitter = (layout: HTMLElement, splitter: HTMLElement) => {
  let { ratio } = load('splitter', fallback);

  const contentWidth = () => {
    const style = getComputedStyle(layout);
    return layout.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  };
  // 장면 칸이 너무 좁아지지 않도록: 경계 16px, 고정된 장면 목록 336px + 여백 16px 를 뺀 나머지에서 장면 최소 폭을 남긴다.
  const indexWidth = () => (document.body.classList.contains('index-autohide') ? 0 : 352);
  const maximum = () => (contentWidth() - 16 - indexWidth() - sceneMinimum) / contentWidth();
  const minimum = () => videoMinimum / contentWidth();
  const apply = () => layout.style.setProperty('--video-width', `${(clamp(ratio, minimum(), maximum()) * 100).toFixed(2)}%`);
  apply();
  window.addEventListener('resize', apply);

  splitter.setAttribute('role', 'separator');
  splitter.setAttribute('aria-orientation', 'vertical');
  splitter.setAttribute('aria-label', '영상·장면 크기 조절');
  splitter.tabIndex = 0;

  let from = ratio;
  onDrag(splitter, {
    start: () => {
      from = clamp(ratio, minimum(), maximum());
    },
    move: (_, dx) => {
      ratio = clamp(from + dx / contentWidth(), minimum(), maximum());
      apply();
    },
    end: () => save('splitter', { ratio }),
  });
  splitter.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      ratio = clamp(ratio + (event.key === 'ArrowLeft' ? -.02 : .02), minimum(), maximum());
      apply();
      save('splitter', { ratio });
    }
  });
  // 두 번 누르면 기본 비율로.
  splitter.addEventListener('dblclick', () => {
    ratio = fallback.ratio;
    apply();
    save('splitter', { ratio });
  });
};
