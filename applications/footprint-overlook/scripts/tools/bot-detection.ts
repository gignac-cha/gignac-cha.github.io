// user_agent 문자열이 봇/크롤러로 보이는지 판정하는 순수 함수입니다(클라이언트 측 표시 힌트 전용).
// 서버가 주는 집계 지표와 무관하며, 최근 발자국 테이블에 🤖 태그를 붙일지 결정하는 데만 씁니다.

// bot / crawler / spider / headless 를 대소문자 무시로 매칭합니다.
const BOT_USER_AGENT_PATTERN = /bot|crawler|spider|headless/i;

export function isBotUserAgent(userAgent: string): boolean {
  if (typeof userAgent !== 'string' || userAgent.length === 0) {
    return false;
  }
  return BOT_USER_AGENT_PATTERN.test(userAgent);
}
