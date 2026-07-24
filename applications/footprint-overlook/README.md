# Footprint Overlook (발자국 조망대)

개인 페이지 추적 시스템 **footprint** 이 남긴 발자국 흔적을 한눈에 내려다보는 정적 분석 대시보드입니다.
데이터는 별도의 쿼리 워커(**footprint-tracker**)가 제공하고, 이 앱은 그 결과를 읽어 **손수 그린 SVG**로 시각화합니다.

- Vite + TypeScript, **런타임 의존성 0** (차트/날짜 라이브러리 없이 순수 SVG·`Intl`·`Date`)
- 라이트/다크 테마(`prefers-color-scheme`), Pretendard Variable, 한국어 UI
- 모든 데이터 가공(날짜 범위·zero-fill·차트 지오메트리·포맷·API URL/에러)은 순수 함수로 분리해 vitest 로 검증

## 무엇을 보여 주나

- **요약 카드 5장** — 기간 총 발자국 수 / 일별 고유 방문자 합 / 오늘 발자국 / 활성 페이지 수 / **봇 비율**
  - "고유 방문자"는 일별 값을 단순 합산하면 교차일 방문자를 중복 집계하므로, 라벨을 **"일별 고유 방문자 합"**으로 정직하게 표기합니다.
  - **봇 비율** = `sum(bot_footprints) / sum(footprints)` (bots-by-day 기준). 0으로 나눔은 방어하고("—"), 서브라인에 원시 카운트(예: `174 / 632`)를 노출합니다. bots-by-day 미지원(404) 시 "미지원"으로 정중히 비활성화합니다.
- **일별 추이 라인/영역 차트** — 발자국 by-day + 고유 방문자 by-day + **봇 발자국 by-day** 세 시리즈. 봇은 **뮤트 앰버 파선**으로 구분(라이트/다크 모두). 빈 날(0)은 자동으로 채웁니다. 간단한 hover 툴팁 제공.
- **상위 페이지 / 상위 출처** — 라벨 + 수치 + 비례 막대.
- **최근 발자국 테이블** — 시각 / UUID(축약) / href / arguments(요약). user_agent 가 봇 패턴(`bot|crawler|spider|headless`)이면 행에 **🤖 bot** 태그(클라이언트 측 힌트).
- 상태 처리 — 로딩 스피너, 섹션별 에러(상단 스트림 원문 노출), 빈 상태, **섹션별 실패 격리**(한 쿼리가 죽어도 나머지는 정상 렌더).

## 엔드포인트 해석 (footprint 가족 철학: 엔드포인트 하드코딩 금지)

트래커 주소는 코드가 아니라 **브라우저 저장소**에서 읽습니다.

- `localStorage['footprint:tracker']` 에 쿼리 워커의 base URL 을 둡니다.
  - (추적 라이브러리가 발자국을 *쓰는* `footprint:endpoint` 와는 다른, *읽기* 전용 키입니다.)
- 값이 없으면 중앙 정렬 **설정 카드**(입력 + 저장 버튼)가 뜹니다. 저장하면 위 키에 기록하고 대시보드를 엽니다.
- 상단의 슬림한 엔드포인트 바가 현재 주소를 보여 주고, **변경** 버튼으로 언제든 다시 설정할 수 있습니다.

## 트래커 API 규약 (읽는 쪽 계약)

- `GET {base}/queries` → `{ queries: [{ name, description, parameters }] }`
- `GET {base}/queries/{name}?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N`
  - 200 → `{ name, rows }` · 에러 400/404/502 → `{ error }`
- 6개 쿼리: `recent-footprints`, `footprints-by-day`, `unique-visitors-by-day`, `bots-by-day`, `top-pages`, `top-origins`
  - `bots-by-day` → rows `{ day, footprints, bot_footprints }` (`bot_footprints <= footprints`). 다른 by-day 와 동일한 GAP/zero-fill 의미.
- **주의**: by-day rows 는 값이 0 인 날을 생략(GAP)하므로, 뷰어가 `[from, to)` 전 구간을 0 으로 채웁니다. `to` 는 **배타적**입니다.

## 개발 흐름 (목 서버로 워커 없이)

실제 워커가 아직 없어도 개발할 수 있도록 무의존성 목 서버를 포함합니다.

```bash
# 1) 목 트래커 실행 (Node v25+ 네이티브 TypeScript 실행, 포트 8788)
node tools/mock-tracker.ts

# 2) 브라우저 콘솔에서 엔드포인트 지정
localStorage.setItem('footprint:tracker', 'http://127.0.0.1:8788')

# 3) 개발 서버
pnpm dev
```

목 서버는 시드 기반 **결정적** 데이터(~90일치, 0~50/일 + 주간 리듬 + 일부 0인 날로 GAP 생성)를 돌려주고,
`from`/`to` 누락(400)·잘못된 `limit`(400)·미지의 쿼리(404) 등 에러 경로와 CORS(`Access-Control-Allow-Origin: *`)도 구현합니다.
`bots-by-day` 는 일별 봇 점유율 ~15–45% 로 `bot_footprints <= footprints` 를 보장하며, 최근 발자국에는 봇 UA(Googlebot·bingbot·HeadlessChrome)를 섞어 🤖 태그를 실제로 노출합니다.

## 스크립트

```bash
pnpm dev         # vite 개발 서버
pnpm build       # 프로덕션 빌드 → outputs/
pnpm preview     # 빌드 결과 미리보기
pnpm test        # vitest 1회 실행 (node 환경, 순수 모듈)
pnpm test:watch  # vitest watch
pnpm typecheck   # tsc (7.x), 타입 에러 0
```

## 코드 구조

```
index.html            진입 HTML (Pretendard CDN + style.scss + script.ts)
script.ts             진입점: 엔드포인트 해석 → 설정 카드 / 대시보드 렌더
style.scss            styles/ 파셜 취합
styles/               _variables(라이트·다크 토큰) / _global / _panels / _chart / _ranked / _table / _setup
scripts/
  tools/              순수 함수 계층 (모두 *.test.ts 콜로케이션)
    date-ranges.ts        프리셋 → [from, to) (배타적 to), 일자 나열, 월/연 경계
    zero-filling.ts       by-day GAP 을 0 으로 채움 (단일 필드 + bots 두 필드 fillMissingBotDays)
    chart-geometry.ts     스케일 · polyline/area path · 축 눈금 (빈/단일/전부 0 엣지)
    formatting.ts         수치·UUID 축약·arguments 요약·타임스탬프·href 단축·퍼센트
    summaries.ts          요약 카드 수치 계산 + 봇 비율(computeBotRatio, 0으로 나눔 방어)
    bot-detection.ts      user_agent 봇 휴리스틱 (테이블 🤖 태그용)
    tracker-endpoint.ts   footprint:tracker 읽기/쓰기 + URL 정규화·검증
    tracker-client.ts     쿼리 URL 조립 + 에러 매핑 + fetch 래퍼
  interfaces/         얇은 DOM 팩토리 (단위 테스트 제외)
    page-shells / setup-card / date-range-controls / summary-cards /
    line-chart / ranked-bars / recent-table / section-states / dashboard
tools/
  mock-tracker.ts     무의존성 목 트래커 (node tools/mock-tracker.ts)
```

테스트 철학: **DOM 을 만지는 코드는 얇게 유지**하고, 산수·문자열·URL·에러 매핑 같은 순수 로직만 vitest(node 환경)로 검증합니다.

## 아직 안 된 것 (Not yet done)

- **Cloudflare Pages 배포** — 저장소는 정적 산출물만 만들고, 배포 파이프라인은 아직 없습니다.
- **인증(auth)** — 현재는 공개 읽기 전용을 가정합니다. 트래커가 인증을 추가하면, 엔드포인트 해석과 API 클라이언트에 토큰/헤더 흐름을 얹어야 합니다.
- **UX 다듬기** — hover 툴팁은 최소 구현입니다. 키보드 포커스 기반 데이터 포인트 탐색, 시리즈 토글, 커스텀 날짜 범위, 표 페이지네이션/정렬 등은 후속 과제입니다.
- **자기 추적(self-tracking)** — 이 대시보드는 스스로 발자국을 남기지 않습니다(런타임 의존성 0 유지). 필요하면 `@tes.cha/footprint` 를 곁들일 수 있습니다.
