// CORS 는 순수 함수로만 다룹니다. 허용 목록 파싱과, 오리진 하나에 대한 응답 헤더 계산이 전부입니다.

// VIEWER_ORIGINS 는 쉼표로 구분한 오리진 문자열입니다. 공백을 다듬고 빈 항목은 버립니다.
export const parseAllowlist = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

// /queries 응답은 Origin 에 따라 내용(CORS 헤더)이 달라지므로, 일치 여부와 무관하게 항상 Vary: Origin 을 내려
// 공유 캐시가 서로 다른 오리진의 응답을 섞어 내보내지 않게 합니다.
// Access-Control-Allow-Origin 은 요청 오리진이 허용 목록과 "정확히" 일치할 때만 반사합니다.
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
  return { Vary: 'Origin' };
};
