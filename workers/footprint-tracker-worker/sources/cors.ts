// CORS 는 순수 함수로만 다룹니다. 허용 목록 파싱과, 오리진 하나에 대한 응답 헤더 계산이 전부입니다.

// VIEWER_ORIGINS 는 쉼표로 구분한 오리진 문자열입니다. 공백을 다듬고 빈 항목은 버립니다.
export const parseAllowlist = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

// 요청 오리진이 허용 목록과 "정확히" 일치할 때만 CORS 헤더를 돌려줍니다.
// 일치하지 않으면 빈 객체 → 호출부는 CORS 헤더를 붙이지 않습니다(공개 읽기 API라 요청 자체는 계속 처리).
export const corsHeaders = (
  origin: string | null,
  allowlist: string[],
): Record<string, string> => {
  if (origin !== null && allowlist.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    };
  }
  return {};
};
