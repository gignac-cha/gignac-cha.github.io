// WebGPU 렌더러 생성·리사이즈·애니메이션 루프·해제를 담당하는 계층입니다.

import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

// 프레임 간 시간 간격의 상한(초)입니다. 탭 비활성화 직후 과도한 이동을 막습니다.
const MAXIMUM_DELTA_SECONDS = 0.05;

export interface RenderingFrameContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  onFrame: (deltaSeconds: number) => void;
}

export interface RenderingRuntime {
  canvasElement: HTMLCanvasElement;
  start(frameContext: RenderingFrameContext): void;
  dispose(): void;
}

// 씬 그래프의 지오메트리·머티리얼 자원을 재귀적으로 해제합니다.
export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

export async function createRenderingRuntime(container: HTMLElement): Promise<RenderingRuntime> {
  const adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
  if (!adapter) {
    throw new Error('WebGPU 하드웨어 가속 기기가 식별되지 않았습니다. WebGPU 를 지원하는 브라우저에서 실행해 주세요.');
  }

  const renderer = new WebGPURenderer({ antialias: true });
  await renderer.init();

  const rendererBackend = renderer.backend as unknown as { type?: string; isWebGLBackend?: boolean } | undefined;
  if (rendererBackend && (rendererBackend.type === 'WebGL' || rendererBackend.type === 'WebGL2' || rendererBackend.isWebGLBackend)) {
    throw new Error('WebGL 우회가 감지되었습니다. 순수 WebGPU 렌더러가 구동되지 않았습니다.');
  }

  const canvasElement = renderer.domElement;
  canvasElement.className = 'room-renderer-canvas';
  canvasElement.setAttribute('aria-label', '1인칭 시점의 무한의 방 3차원 장면');
  canvasElement.style.width = '100%';
  canvasElement.style.height = '100%';
  canvasElement.style.outline = 'none';
  container.appendChild(canvasElement);

  const state = {
    animationFrameIdentifier: null as number | null,
    previousFrameTime: 0,
    activeFrameContext: null as RenderingFrameContext | null,
    isDisposed: false,
  };

  const findContainerSize = () => {
    const rectangle = container.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rectangle.width)),
      height: Math.max(1, Math.floor(rectangle.height)),
    };
  };

  const applySize = () => {
    const { width, height } = findContainerSize();
    renderer.setSize(width, height);

    if (state.activeFrameContext) {
      state.activeFrameContext.camera.aspect = width / height;
      state.activeFrameContext.camera.updateProjectionMatrix();
    }
  };

  const resizeObserver = new ResizeObserver(() => {
    if (!state.isDisposed) {
      applySize();
    }
  });
  resizeObserver.observe(container);

  return {
    canvasElement,

    start(frameContext) {
      if (state.isDisposed || state.activeFrameContext) {
        return;
      }

      state.activeFrameContext = frameContext;
      applySize();
      state.previousFrameTime = performance.now();

      const animate = (frameTime: number) => {
        state.animationFrameIdentifier = requestAnimationFrame(animate);

        const deltaSeconds = Math.min(MAXIMUM_DELTA_SECONDS, (frameTime - state.previousFrameTime) / 1000);
        state.previousFrameTime = frameTime;

        frameContext.onFrame(deltaSeconds);
        renderer.render(frameContext.scene, frameContext.camera);
      };

      state.animationFrameIdentifier = requestAnimationFrame(animate);
    },

    dispose() {
      if (state.isDisposed) {
        return;
      }
      state.isDisposed = true;

      if (state.animationFrameIdentifier !== null) {
        cancelAnimationFrame(state.animationFrameIdentifier);
        state.animationFrameIdentifier = null;
      }

      resizeObserver.disconnect();

      try {
        renderer.dispose();
      } catch (error) {
        console.error('WebGPU 렌더러 해제 중 오류가 발생했습니다.', error);
      }

      canvasElement.remove();
      state.activeFrameContext = null;
    },
  };
}
