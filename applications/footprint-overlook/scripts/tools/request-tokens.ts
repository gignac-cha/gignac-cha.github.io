// 빠른 연속 요청에서 "가장 최근 요청"만 화면에 반영하기 위한 토큰 가드입니다.
// DOM 의존이 없는 순수 계층이라 vitest 로 경합 시나리오를 결정적으로 검증할 수 있습니다.

export interface RequestTokenGuard {
  issue(): number;
  isCurrent(token: number): boolean;
}

export function createRequestTokenGuard(): RequestTokenGuard {
  let activeToken = 0;
  return {
    issue: () => (activeToken += 1),
    isCurrent: (token) => token === activeToken,
  };
}
