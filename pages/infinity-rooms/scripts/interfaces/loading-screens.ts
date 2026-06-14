// 방 장면 시작(WebGPU 초기화 + 시작 방 생성) 동안 캔버스 위에 띄우는 한국어 로딩 오버레이입니다.
// 캔버스(다크) 위 가독성을 위해 라이트 스크림 + 스피너 + 문구로 표시하고, start 완료 시 hide 로 제거합니다.

export interface LoadingScreen {
  element: HTMLElement;
  // 오버레이를 표시합니다(이미 표시 중이면 무시).
  show(): void;
  // 오버레이를 숨기고 DOM 에서 제거합니다(이미 숨김이면 무시).
  hide(): void;
}

// 캔버스 컨테이너 위에 부착하는 라이트 로딩 오버레이(스피너 + 한국어 문구 + 진행 바)를 만듭니다.
// 색상은 styles 의 로딩 오버레이 클래스가 결정합니다(인라인 리터럴 없음).
export function createLoadingScreen(): LoadingScreen {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');

  const panel = document.createElement('div');
  panel.className = 'loading-panel';
  overlay.appendChild(panel);

  // 회전 스피너 — 생성 칩과 동일한 모션 어휘(spin)를 공유합니다.
  const spinner = document.createElement('span');
  spinner.className = 'loading-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  panel.appendChild(spinner);

  const message = document.createElement('div');
  message.className = 'loading-message';
  message.textContent = '3D 공간을 준비하는 중...';
  panel.appendChild(message);

  const detail = document.createElement('div');
  detail.className = 'loading-detail';
  detail.textContent = 'WebGPU 렌더러를 초기화하고 첫 방을 생성합니다.';
  panel.appendChild(detail);

  // 진행 느낌을 주는 미정형 진행 바(생성 칩의 진행 바와 동일한 어휘).
  const bar = document.createElement('div');
  bar.className = 'loading-bar';
  bar.setAttribute('aria-hidden', 'true');
  panel.appendChild(bar);

  const state = {
    isVisible: false,
  };

  return {
    element: overlay,
    show() {
      if (state.isVisible) {
        return;
      }
      state.isVisible = true;
      overlay.classList.add('is-visible');
    },
    hide() {
      if (!state.isVisible) {
        return;
      }
      state.isVisible = false;
      overlay.classList.remove('is-visible');
      overlay.remove();
    },
  };
}
