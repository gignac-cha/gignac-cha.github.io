// footprint 트래커를 초기화합니다. 워커 엔드포인트를 브라우저 저장소에 심은 뒤 패키지를 불러오면,
// 로드 시점에 자동으로 한 번 발자국(pageview)을 남깁니다.
//
// 정적 import 는 호이스팅되어 엔드포인트 주입보다 먼저 실행되므로, "주입 후 실행" 순서를 보장하기 위해
// 동적 import 를 사용합니다. 또한 트래킹이 페이지 렌더링을 막지 않도록 await 하지 않습니다.

const FOOTPRINT_ENDPOINT = 'https://footprint-trail.tes-cha.workers.dev/';

// 스토리지가 차단된 환경(일부 프라이버시 모드/봇)에서도 import 까지는 도달하도록 조용히 넘어갑니다.
try {
  localStorage.setItem('footprint:endpoint', FOOTPRINT_ENDPOINT);
} catch {}

void import('@tes.cha/footprint');
