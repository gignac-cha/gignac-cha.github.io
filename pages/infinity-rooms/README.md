# 무한의 방 (Infinity Rooms)

Chrome 내장 AI(**Prompt API / Gemini Nano**)가 방 테마를 즉석에서 생성하고, **Three.js WebGPU**가 끝없이 이어지는 3D 공간을 그리는 온디바이스 데모입니다. 모든 추론은 서버 없이 **브라우저 안**에서만 일어납니다.

이 문서는 프로젝트에서 **사용한 기술과 기법**을 정리합니다.

---

## 1. Chrome 내장 AI — Prompt API (Gemini Nano)

브라우저에 내장된 온디바이스 LLM을 직접 호출합니다. (Chrome 148부터 웹에서 정식 지원, secure context 필요)

- **가용성 진단**: `LanguageModel.availability()` 로 `available`/`downloadable`/`downloading`/`no-api`/`no-model` 상태를 구분하고, `availability`가 `available`이어도 실제 정책 차단을 잡으려 시험 세션을 생성해 봅니다.
- **구조화 출력(structured output)**: `session.prompt(text, { responseConstraint: <JSON Schema> })` 로 **제약 디코딩**을 걸어 출력이 항상 유효한 JSON 스키마를 따르도록 강제합니다 → 파싱 실패를 구조적으로 줄임.
- **시스템 프롬프트**: `create({ initialPrompts: [{ role: 'system', ... }] })` 로 인테리어 디자이너 역할을 부여.
- **모델 다운로드 모니터링**: `create({ monitor })` 의 `downloadprogress` 이벤트로 Gemini Nano 다운로드 진행률(%/MB)을 실시간 표시.
- **생성 다양성 기법**: 소형 온디바이스 모델의 mode collapse를 줄이려 매 생성마다 영감 테마(50종)를 무작위 주입하고, 인접 방의 팔레트를 시드로 넘겨 색 연속성을 부여.
- **폴백 없는 검증**: 응답 JSON을 hex 색상·가구 타입·좌표 범위까지 검증하고, 실패 시 기본값으로 대체하지 않고 스켈레톤 상태를 유지(에러 가시화 + 재시도).

## 2. Three.js — WebGPU 렌더링

`three/webgpu`의 `WebGPURenderer`를 사용합니다.

- **순수 WebGPU 강제**: 렌더러 백엔드가 WebGL로 폴백되면 명시적으로 거부.
- **절차적 지오메트리**: 가구 23종을 각 3변형으로 코드 생성(Box/Cylinder/Cone/Sphere/Torus·EdgesGeometry 조합), AI가 정한 색을 머티리얼에 주입. 바닥/벽 부착/천장 매달림 등 배치 부류별 처리.
- **레이캐스팅 포커스**: 화면 중앙(NDC 0,0)에서 광선을 쏴 일정 거리 이내의 가구를 감지하고, `Box3`로 월드 경계 상자를 구해 외곽선으로 강조.
- **카메라/조명**: `PerspectiveCamera` FOV 보간으로 시점 줌, `PointLight`·앰비언트 조명, 발광(emissive) 가구 on/off.
- **메모리 관리**: 방 전환·해제 시 지오메트리·머티리얼을 재귀 `dispose`.

## 3. 절차적 무한 공간

- **좌표 격자 + 간격**: 방을 격자 좌표에 배치(`Math.round(pos / ROOM_PITCH)`), 방 사이 `ROOM_GAP` 간격과 도어웨이 커넥터(통로) 기하.
- **스켈레톤 방**: 미생성 방은 반투명 점선 와이어프레임으로 표시, 생성 완료 시 실제 테마 방으로 교체.
- **인접 프리페치 + 생성 풀**: 현재 방 기준 한 칸 이웃을 선생성(연쇄 없음). 동시성 제한 큐(요청 풀: 첫 방 전용 1-슬롯 + 그 외 8-슬롯 병렬)로 온디바이스 모델 과부하를 방지.
- **충돌 해소**: 반복 완화 알고리즘으로 가구가 서로/벽/문 통로와 겹치지 않게 배치.

## 4. D3.js — 미니맵

SVG 기반 미니맵을 D3 스케일로 그립니다. 방 격자 ↔ 화면 좌표 투영, 플레이어 위치·방향선·시야 원뿔, 상태별(현재/탐험/생성 중/미생성) 형태 코딩.

## 5. 웹 플랫폼 API

- **Fullscreen API** — 캔버스 전체화면.
- **Pointer Lock API** — 1인칭 마우스 시점(미잠금 시 드래그 회전 폴백).
- **Popover API** (`popover` 속성) — 상태 카드 툴팁의 hover/pinned/light-dismiss.
- **CSS `:has()`** — 방 카드가 경고 상태일 때 레이아웃 전환.
- **`prefers-color-scheme`/`prefers-reduced-motion`**, **localStorage**(설정 영속), **ResizeObserver**(렌더러 리사이즈) 활용.

## 6. 아키텍처 / 엔지니어링

- **순수 로직 ↔ 사이드이펙트 분리**: 그리드 수학·클램프·상태머신·요청 풀을 DOM/Three.js 의존 없는 순수 함수(`scripts/tools/`)로 빼 **단위 테스트**(Vitest) 가능하게 함.
- **제네릭 상태머신 스토어** + **팩토리 패턴**(createXxx)로 상태 카드·툴팁·씬을 구성.
- **의존성 역전**: 씬은 테마 생성 함수를 주입받고(`requestRoomTheme`), UI는 콜백으로 느슨하게 연결.

## 7. 빌드 · 툴체인

- **TypeScript** (strict, `.ts` import 확장자 명시, 약어 금지 컨벤션).
- **Vite + Vitest**, **Turborepo + pnpm workspace** 모노레포.
- **배포용 언번들 ESM 빌드**(`build-page.mjs`): esbuild로 파일별 트랜스파일(번들·압축 없음) + 상대 `.ts`→`.js` 재작성, `three`/`d3`는 **importmap(CDN)** 으로 외부화, `style.scss`는 dart-sass로 컴파일 → 소스 구조 그대로 ESM 모듈 트리 배포.

## 8. 접근성 · 디자인 시스템

- WCAG AA 대비, 상태를 색뿐 아니라 **형태·텍스트 라벨**로도 구분(색맹 대응), `:focus-visible` 포커스 링.
- 색 토큰은 `styles/_variables.scss` 한 곳에만(디자인 시스템은 [`DESIGN.md`](./DESIGN.md), 코딩 컨벤션은 [`AGENTS.md`](./AGENTS.md) 참고).

## 공식 문서 & 미지원 트러블슈팅 (페이지 내장 진단)

상태 카드(알약)는 공식 문서로 바로 연결되고, 미지원 시 해결 가이드를 팝오버 툴팁으로 제공합니다.

### 공식 문서 링크 (상태 카드)
- **Prompt API** → [The Prompt API · Chrome for Developers](https://developer.chrome.com/docs/ai/prompt-api)
- **WebGPU** → [WebGPU API · MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

### 상태별 안내 (툴팁에 내장)
- **Prompt API 미지원(no-api)** — 브라우저 버전 안내 + 실험 플래그 활성화:
  `chrome://flags/#prompt-api-for-gemini-nano`, `chrome://flags/#optimization-guide-on-device-model`
- **모델 부재(no-model)** — 하드웨어·디스크 요건은 충족하나 로컬 모델 미설치 → 다운로드 유도
- **다운로드 가능/중(downloadable/downloading)** — 다운로드 버튼 + 실시간 진행률(%/MB)
- **오류(error)** — 원문 진단에 따라 분기: **디스크 용량 부족** / **모델 프로세스 반복 크래시** 등
- **WebGPU 미지원(no-api)** — 크롬 최신 버전(113+) 확인 · 그래픽 가속 설정 · GPU 드라이버 업데이트

> ⚠️ **secure context 필요**: 두 API 모두 HTTPS 또는 `localhost`에서만 노출됩니다. 평문 LAN IP(`http://192.168.x.x`)로 접속하면 `navigator.gpu`·`LanguageModel`이 `undefined`라 "미지원"으로 표시됩니다. (GitHub Pages는 HTTPS라 무관)

---

> 🤖 Generated with [Claude Code](https://claude.com/claude-code)
