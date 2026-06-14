// WebGPU 가용성 진단 모듈입니다. 상태 카드(status-panels)에서 진단 함수로 사용합니다.

export type WebGPUAvailabilityStatus = 'available' | 'no-api';

export interface WebGPUAvailabilityResult {
  status: WebGPUAvailabilityStatus;
  rawMessage: string;
}

// navigator.gpu 는 TypeScript 기본 DOM lib 에 항상 정의되어 있지 않아 구조적 타입으로 안전하게 접근합니다.
type NavigatorWithWebGPU = Navigator & {
  gpu?: {
    requestAdapter(): Promise<object | null>;
  };
};

// GPUAdapter 의 선택적 진단 속성(requestAdapterInfo, name)에 접근하기 위한 구조적 타입입니다.
type AdapterWithInformation = {
  requestAdapterInfo?: () => Promise<{ device?: string }>;
  name?: string;
};

export async function checkWebGPUAvailability(): Promise<WebGPUAvailabilityResult> {
  const navigatorWithWebGPU = navigator as NavigatorWithWebGPU;

  if (!navigatorWithWebGPU.gpu) {
    return {
      status: 'no-api',
      rawMessage: 'WebGPU is not supported on this browser (navigator.gpu is undefined).',
    };
  }

  try {
    const adapter = await navigatorWithWebGPU.gpu.requestAdapter();
    if (!adapter) {
      return {
        status: 'no-api',
        rawMessage: 'Failed to request WebGPU adapter (GPUAdapter is null).',
      };
    }

    const adapterWithInformation = adapter as AdapterWithInformation;
    const adapterInformation =
      typeof adapterWithInformation.requestAdapterInfo === 'function' ? await adapterWithInformation.requestAdapterInfo() : null;

    const adapterName =
      adapterInformation?.device ?? (typeof adapterWithInformation.name === 'string' ? adapterWithInformation.name : 'Unknown WebGPU Adapter');

    return {
      status: 'available',
      rawMessage: `WebGPU is fully available.\nAdapter Device: ${adapterName}\nSupports WebGPU API.`,
    };
  } catch (error: unknown) {
    const errorMessage =
      typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'An unexpected error occurred during WebGPU initialization.';
    return {
      status: 'no-api',
      rawMessage: errorMessage,
    };
  }
}
