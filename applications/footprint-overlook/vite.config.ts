// test 키(vitest 설정)의 타입 오류를 피하기 위해 defineConfig 를 vitest/config 에서 가져옵니다.
// (infinity-rooms 페이지와 동일한 vite.config 스타일을 따릅니다.)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 빌드 산출물은 저장소 컨벤션대로 outputs/ 에 둡니다.
  build: {
    outDir: 'outputs',
  },
  // 순수 모듈 옆에 콜로케이션한 *.test.ts 만 vitest 대상으로 삼습니다.
  test: {
    include: ['**/*.test.ts'],
    // DOM 라이브러리 없이 순수 함수만 검증합니다(DOM 을 만지는 코드는 얇게 유지하고 단위 테스트 대상에서 제외).
    environment: 'node',
  },
});
