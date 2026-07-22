// 트래커(쿼리 워커) 엔드포인트를 브라우저 저장소에서 읽고 쓰는 계층입니다.
//
// footprint 가족 철학: 엔드포인트는 절대 하드코딩하지 않고 브라우저 저장소에서 읽습니다.
// 이 대시보드가 데이터를 "읽는" 쿼리 워커의 base URL 은 localStorage['footprint:tracker'] 에 둡니다.
// (추적 라이브러리가 발자국을 "쓰는" localStorage['footprint:endpoint'] 와는 다른 키입니다.)
//
// normalize/validate 는 순수 함수라 단위 테스트가 되고, read/write 만 저장소를 만집니다(얇게 유지).

export const TRACKER_STORAGE_KEY = 'footprint:tracker';

// 사용자가 입력한 URL 을 정규화합니다: 앞뒤 공백 제거 + 뒤따르는 슬래시 제거.
// (요청 조립 시 `${base}/queries` 처럼 이어 붙이므로 뒤 슬래시를 없애 이중 슬래시를 막습니다.)
export function normalizeTrackerEndpoint(rawUrl: string): string {
  if (typeof rawUrl !== 'string') {
    return '';
  }
  return rawUrl.trim().replace(/\/+$/, '');
}

// 트래커 엔드포인트로 쓸 수 있는 http(s) 절대 URL 인지 검사합니다.
export function isValidTrackerEndpoint(rawUrl: string): boolean {
  const normalized = normalizeTrackerEndpoint(rawUrl);
  if (normalized.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// 저장된 트래커 엔드포인트를 읽습니다. 없거나 저장소 접근 실패 시 undefined.
export function readTrackerEndpoint(): string | undefined {
  try {
    const stored = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (stored === null) {
      return undefined;
    }
    const normalized = normalizeTrackerEndpoint(stored);
    return normalized.length > 0 ? normalized : undefined;
  } catch {
    return undefined;
  }
}

// 트래커 엔드포인트를 저장합니다(정규화 후 기록).
export function writeTrackerEndpoint(rawUrl: string): void {
  try {
    localStorage.setItem(TRACKER_STORAGE_KEY, normalizeTrackerEndpoint(rawUrl));
  } catch {
    // 저장소 접근이 막혀도(예: 프라이빗 모드) 페이지가 죽지 않도록 조용히 무시합니다.
  }
}
