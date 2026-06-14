---
name: Infinity Rooms
concept: Calm Light (단순·차분한 라이트)
colors:
  background: "#f5f4f1"
  surface: "#ffffff"
  surfaceSunken: "#f0eee9"
  border: "#e6e3dd"
  borderStrong: "#d3cfc6"
  textPrimary: "#1c1a17"
  textSecondary: "#5f594f"
  textMuted: "#8b857a"
  link: "#2563eb"
  accent: "#2563eb"
  accentSoft: "rgba(37, 99, 235, 0.10)"
  ready: "#15803d / surface #dcfce7 / border #bbf7d0"
  pending: "#b45309 / surface #fef3c7 / border #fde68a"
  error: "#b91c1c / surface #fee2e2 / border #fecaca"
spacing:
  scale: "4 / 8 / 12 / 16 / 24 / 32"
  radius: "6 / 12 / 16"
  pillRadius: "999px"
  columnWidth: "960px"
shadow:
  weak: "0 1px 2px rgba(0,0,0,.06)"
  hover: "0 4px 12px rgba(0,0,0,.10)"
---

# Infinity Rooms 디자인 시스템 — Calm Light (단순·차분한 라이트)

이 문서는 무한의 방 페이지 디자인의 단일 진실 공급원입니다. 색상 리터럴(hex/rgba)은
`styles/_variables.scss` 에만 존재하며, 다른 모든 파셜은 그 변수만 참조합니다. 이 문서와
`_variables.scss` 가 어긋나면 `_variables.scss` 를 기준으로 본 문서를 갱신합니다.

---

## 1. 디자인 철학

이 페이지는 **사람이 손으로 정리한 듯한, 단순하고 차분한 라이트 UI** 를 지향합니다.
이전 디자인("Spatial Dark": 딥 네이비 + 시안 + 인디고→블루 그라디언트 + 글래스블러 +
✦반짝이)은 전형적인 "AI 제품 룩"이라 식상하다는 피드백을 받아, 다음 원칙으로 다시 썼습니다.

1. **AI 클리셰 제거** — 그라디언트(특히 인디고→블루), backdrop-filter/블러/글래스모피즘,
   ✦반짝이, 시안 테크 액센트, 코너 라디얼 글로우, 네온/글로우 그림자, 둥둥 뜨는 과한
   호버 lift 를 **전부 없앴습니다**.
2. **깊이는 보더 + 옅은 그림자로** — 깔끔한 화이트 카드를 따뜻한 오프화이트 배경 위에 올리고,
   `1px` 보더 + 절제된 옅은 그림자(`$shadow-weak`)로만 깊이를 만듭니다.
3. **단일 평면 액센트** — 모든 상호작용·강조는 단색 블루 `$color-accent` 하나로 통일합니다.
   더 이상 "AI = 그라디언트" 같은 시각 시맨틱을 쓰지 않습니다.
4. **명확한 타이포 위계** — 따뜻한 중립 회색 3단(primary/secondary/muted)으로 글의 위계를
   잡고, 색이 아니라 굵기·크기로 강조합니다.

캔버스 내부 3D 방은 **콘텐츠**이므로 다크 그대로 둡니다(3D 머티리얼 색은 AI/스켈레톤이
결정하는 WebGL 색으로, 이 토큰 체계 밖입니다). 페이지 크롬(UI)만 라이트로 정리했고,
캔버스(다크) 위에 떠 있는 HUD 칩·로딩 스크림은 가독성을 위해 불투명 화이트 표면 +
어두운 텍스트 + 옅은 보더·그림자로 처리합니다(블러 없음).

---

## 2. 색상 시스템 (`_variables.scss` 변수와 1:1)

### 표면 (Surfaces)

| 역할 | 변수 | 값 |
|---|---|---|
| 페이지 배경 | `$color-background` | `#f5f4f1` (따뜻한 오프화이트) |
| 카드 표면 | `$color-surface` | `#ffffff` |
| 떠오른 표면 | `$color-surface-raised` | `#ffffff` (툴팁 화살표 등) |
| 가라앉은 표면 | `$color-surface-sunken` | `#f0eee9` (코드 칩·캔버스 대기 배경) |
| 미니맵 SVG 배경 | `$minimap-surface` | `#faf9f7` |

과거 글래스/글로우 토큰은 라이트 테마에서 무력화했습니다: `$color-glass` / `$color-glass-fallback`
은 `#ffffff` (블러 없음), `$glow-indigo` / `$glow-cyan` 은 `transparent` (배경 라디얼 글로우 제거).

### 보더 (Borders)

| 역할 | 변수 | 값 |
|---|---|---|
| 기본 보더 | `$color-border` | `#e6e3dd` |
| 강조 보더 | `$color-border-strong` | `#d3cfc6` (호버·HUD 칩) |

### 텍스트 (Text)

| 역할 | 변수 | 값 |
|---|---|---|
| 본문 | `$color-text-primary` | `#1c1a17` |
| 보조 | `$color-text-secondary` | `#5f594f` |
| 뮤트 | `$color-text-muted` | `#8b857a` |
| 인버스 | `$color-text-inverse` | `#ffffff` (단색 액센트 버튼 위) |
| 링크 | `$color-link` | `#2563eb` |

라이트 배경 위 본문/보조/뮤트는 모두 WCAG AA 대비를 만족합니다.

### 액센트 (단일 평면 블루)

| 역할 | 변수 | 값 | 적용처 |
|---|---|---|---|
| 단일 액센트 | `$color-accent` | `#2563eb` | 링크·CTA·포커스 링·스피너·진행 바·미니맵 현재 방·플레이어 도트·헤더 'Gemini Nano' 강조 |
| 액센트 소프트 | `$color-accent-soft` | `rgba(37,99,235,.10)` | 현재 방 채움·범례 스와치 |

그라디언트는 없습니다. 강조가 필요한 곳은 단색 액센트 + 굵기로 처리합니다.

### 상태색 (ready / pending / error) — 라이트 pill 톤

공식: 옅은 채움 배경 + 짙은 텍스트 + 옅은 보더.

| 상태 | 텍스트 | 배경 | 보더 |
|---|---|---|---|
| ready | `$color-ready` `#15803d` | `$color-ready-surface` `#dcfce7` | `$color-ready-border` `#bbf7d0` |
| pending | `$color-pending` `#b45309` | `$color-pending-surface` `#fef3c7` | `$color-pending-border` `#fde68a` |
| error | `$color-error` `#b91c1c` | `$color-error-surface` `#fee2e2` | `$color-error-border` `#fecaca` |

경고 카드도 같은 error 라이트 톤을 씁니다(`$color-error-border-soft` `#fecaca`,
오류 원문 텍스트 `$color-error-detail-text` `#b91c1c`). 상태는 색 + 텍스트 라벨을 병행해
색맹 접근성을 유지합니다.

### 중립 칩 / 트랙 / 미니맵 도형 (라이트)

코드 칩·키캡(`$color-chip-surface` / `$color-keycap-surface` `#f0eee9`), 진행 바·스피너
트랙(`$color-track-surface` / `$color-spinner-track` `#e6e3dd`). 미니맵 도형은 범례 스와치와
같은 토큰을 공유합니다: 탐험 방 `$minimap-room-explored-surface` `#ecebe6` /
`...-border` `#c8c4bb`, 미생성 점선 `$minimap-room-pending-border` `#d3cfc6`, 생성 중
방 `$minimap-room-generating-border` `#b45309` + `...-surface` `#fef3c7` (pending 톤),
시야 원뿔 `$minimap-vision-cone-surface/border` (accent 계열).

화면 중앙 포커스 레티클은 기본 `$color-reticle` `rgba(255,255,255,.7)` + `$color-reticle-outline`
`rgba(0,0,0,.45)`(어두운 캔버스 위 가독용 외곽), 가구를 조준했을 때 `$color-reticle-focused`(=accent).

### 그림자

| 역할 | 변수 | 값 |
|---|---|---|
| 약한 그림자 | `$shadow-weak` | `0 1px 2px rgba(0,0,0,.06)` (카드·HUD 칩·미니맵 기본) |
| 호버 그림자 | `$shadow-hover` | `0 4px 12px rgba(0,0,0,.10)` (상태 카드 호버) |
| 카드(떠오름) | `$shadow-card` | `0 4px 12px rgba(0,0,0,.10)` (툴팁) |
| 무대(캔버스) | `$shadow-stage` | `0 1px 2px rgba(0,0,0,.06)` (글로우 없는 평범한 옅은 그림자) |

---

## 3. 타이포그래피

- **본문 폰트**: Pretendard Variable → `$font-sans`.
- **기술 데이터 폰트**: `ui-monospace` 스택 → `$font-mono`.

스케일:

| 요소 | 크기 / 굵기 |
|---|---|
| H1 한국어 '무한의 방' (주) | 28px / 700 |
| 라틴 'Infinity Rooms' (보조) | 20px / 500, `$color-text-secondary` |
| 본문·설명 | 13~14px / 1.6 |
| 카드 제목 | 15px / 600 |
| eyebrow·메타·범례·키캡 | 11~12px |

모노 적용처: eyebrow(11px, tracking .18em), 알약, RAW 상태 코드, 방 좌표 `ROOM (0, 0)`,
미니맵 좌표, 키캡. **한국어 우선 위계**: H1 은 '무한의 방'이 본체, 'Infinity Rooms'는 보조 표기.

---

## 4. 간격 · 라운딩

- **간격**: 4px 기반 6단 — `$spacing-1`(4) … `$spacing-8`(32).
- **라운딩 3단**: `$radius-small`(6, 칩·키캡·코드) / `$radius-medium`(12, 카드·툴팁·미니맵) /
  `$radius-large`(16, 캔버스·경고 카드) + `$radius-pill`(999).
- **레이아웃**: 중앙 칼럼 `$column-width` 960px. 스테이지 그리드 `1fr + $minimap-column-width(224px)`.

---

## 5. 컴포넌트별 스펙

### ① 페이지 헤더
모노 eyebrow "Chrome Built-in AI × WebGPU" + H1(한국어 주도) + 설명문. 'Gemini Nano' 강조는
**평면 단색 액센트 + 굵게**(그라디언트 텍스트 아님).

### ② 상태 카드
화이트 카드(`$shadow-weak`) + 1px 보더. 제목 + 알약이 첫 행, 문서 링크는 짧은 메타로 아래.
좁은 카드에서 제목이 줄어들고 알약은 `flex-shrink: 0`. 호버 시 보더 강조 + `$shadow-hover`(lift 없음).
알약에 상태 도트(진단 중·pending 펄스), `:focus-visible` 액센트 링.

### ③ 캔버스 = 주인공
`.new-card.is-active` 는 패딩 0, 장면이 곧 카드. `$shadow-stage`(글로우 없는 옅은 그림자).
캔버스(다크) 위 HUD 칩 3종은 **불투명 화이트 표면 + 어두운 텍스트 + 강조 보더 + `$shadow-weak`**
(블러 없음):
- **테마 칩** (`.theme-chip`, 좌하단): "AI 테마" 라벨 + 방 테마명(`RoomSummary.themeName`).
  ✦반짝이 요소(`.theme-spark`)는 제거했습니다.
- **좌표 칩** (`.coordinate-chip`, 우상단): 모노 `ROOM (x, z)`.
- **생성 칩** (`.generating-chip`, 하단 중앙): 스피너 + "방 생성 중..." + **단색 액센트 미정형
  진행 슬라이더**(`indeterminate-slide`, 그라디언트 시머 아님).

좌상단 컨트롤 칩: "자동 생성" 토글(OFF 트랙=중립, ON 트랙=액센트, 노브=화이트) + "생성" 버튼.
그 아래 풀 상태 칩(활성/대기 슬롯 도트).
- **포커스 레티클** (`.focus-reticle`, 화면 중앙): 작은 점(`.focus-reticle-dot`). 기본은 흐린 흰 점,
  가까이 둔 가구를 조준하면 `.is-focused` 로 accent 강조(색상 토큰은 §2 참조).
- **디테일 패널** (`.furniture-detail-panel`): 포커스된 가구의 정보를 보여주는 화이트 오버레이.
  `.detail-header`(제목 `.detail-name` + 닫기 `.detail-close`) + `.detail-variant` + `.detail-palette`
  (색 스와치 `.detail-color-swatch` + 라벨 + hex). 외형은 카드와 동일 토큰계(화이트·보더·`$shadow-card`).
- **생성 실패 칩** (`.failure-chip`, 하단 중앙): error 라이트 톤. "방 생성 실패" + 재시도 버튼
  (`.failure-retry-button`). 다른 HUD 칩과 동일하게 불투명 화이트 표면 기반.

### ④ 미니맵 (페이지 크롬 = 라이트)
화이트 패널(`$shadow-weak`) + 1px 보더. SVG 배경은 `$minimap-surface` `#faf9f7`. 범례 4종
(현재 방=accent-soft 채움 + accent 보더 / 탐험 방=실선 / 생성 중=pending 톤 / 미생성=점선). 형태
코딩으로 색 비의존 접근성 확보. 플레이어 도트·시야 원뿔은 accent. `< 1200px` 에서 캔버스 아래로,
`≤ 768px` 에서 다시 세로 스택. 전체화면 시에는 미니맵이 캔버스 위 우하단 오버레이
(`.minimap-card.is-canvas-overlay`)로 이동해 계속 보입니다.

### ⑤ 조작법 행
W/A/S/D 키캡 + "마우스 드래그" + "문을 통과하면 AI가 새 방을 생성합니다". 키보드/마우스 그룹은
`@media (pointer: coarse)` 터치 기기에서 숨김.

### ⑥ 경고 카드
아이콘 + 제목 + 본문 + 단색 액센트 CTA("해결 방법 보기") + 힌트가 있는 빈 상태. error 라이트 톤
보더. CTA 는 상태 카드 스트립으로 `scrollIntoView`. 방 카드가 경고면 `:has(.is-warning)` 가 빈
미니맵을 숨기고 카드를 전체 폭으로 펼칩니다. 초기화 실패 카드(`script.ts`)도 같은
`buildWarningCardContent` 본문을 공유합니다.

### 툴팁 (popover)
화이트 라이트 패널(`$shadow-card`) + 강조 보더 + 위를 가리키는 화살표(`--tooltip-arrow-left`).
블러 없음. 한국어 제목 단독(상태 톤 색) + RAW 모노 칩. 다운로드 버튼·진행 바는 **단색 액센트**
(그라디언트·시머 없음, width 만 JS 가 갱신하는 결정형 진행). `::backdrop` 은 딤/가림 끔.

---

## 6. 모션

- **진입**: 섹션별 fade + 6px rise 0.4s, 0.06s 스태거 (`@keyframes rise-in`).
- **진행 표시**: 스피너 0.9s 회전 + 단색 액센트 미정형 슬라이더(`indeterminate-slide` 1.8s).
- **pending 도트**: 1.6s 펄스.
- **호버**: 보더 강조 + 옅은 그림자 전환만 (`transform: lift` 없음).
- `@media (prefers-reduced-motion: reduce)`: 진입·스피너·진행 슬라이더·펄스·툴팁 트랜지션 비활성화.

---

## 7. 규칙 (불변)

1. 색 리터럴(hex/rgba)은 `_variables.scss` 에만. 다른 파셜·TS 에는 금지(3D 씬·언어 모델 색은 예외 — 토큰 체계 밖).
2. **금지 패턴**: `gradient` / `backdrop-filter` / `blur(` / `spark` 가 styles·scripts 에서 0 이어야 합니다.
3. `innerHTML` 금지(createElement 유지). 주석·문구는 한국어.
4. 상태는 색 + 텍스트 라벨 병행. WCAG AA 대비 유지.
5. 캔버스 내부 3D 방은 다크 콘텐츠로 그대로 둡니다(`scripts/renderings/*`).

---

## 8. 파일 맵

| 파일 | 역할 |
|---|---|
| `styles/_variables.scss` | 모든 색/간격/타이포/라운딩/그림자 토큰 (hex 유일 위치) |
| `styles/_global.scss` | 배경·칼럼·진입 모션·헤더·조작법·푸터 |
| `styles/_card.scss` | 상태 카드·스테이지·캔버스·HUD 칩·경고 카드·미니맵 |
| `styles/_pill.scss` | 상태 알약 (도트·펄스·ready/pending/error 톤) |
| `styles/_tooltip.scss` | popover 툴팁 (화살표·RAW 칩·다운로드 진행 바) |
| `scripts/interfaces/page-shells.ts` | 헤더·조작법·푸터 팩토리 |
| `scripts/interfaces/status-panels.ts` | 상태 카드 팩토리 + Prompt API/WebGPU 패널 |
| `scripts/interfaces/room-card.ts` | 방 카드(캔버스/경고 전환 + HUD 칩 배선) |
| `scripts/interfaces/minimap.ts` | D3 미니맵 패널 |
| `scripts/interfaces/loading-screens.ts` | 캔버스 로딩 오버레이 |
| `scripts/interfaces/warning-card.ts` | 경고 본문 빌더 (방 카드·초기화 실패 공유) |
