# Footprint Overlook

**footprint** 가 수집한 페이지 접근 데이터를 분석하는 정적 대시보드입니다.
데이터는 별도의 쿼리 워커(**footprint-tracker**)가 제공하고, 이 앱은 그 결과를 읽어 **손수 그린 SVG·CSS**로 시각화합니다.

> 이름에 대하여 — `footprint`(수집 라이브러리) · `footprint-trail`(수집 워커) · `footprint-tracker`(쿼리 워커) ·
> `footprint-overlook`(이 뷰어)는 "발자국을 남기고 내려다본다"는 계열 테마를 그대로 씁니다. 시스템·워커·쿼리·저장소 키
> 이름은 그 테마를 유지하고, **화면에 보이는 문구만** 일반적인 분석 용어(페이지 뷰·방문자·조회)를 씁니다.

- Vite + TypeScript, **런타임 의존성 0** (차트/날짜 라이브러리 없이 순수 SVG·CSS·`Intl`·`Date`)
- 라이트/다크 테마(`prefers-color-scheme`), Pretendard Variable, 한국어 UI
- 모든 데이터 가공(날짜 범위·zero-fill·차트 지오메트리·라벨·포맷·API URL/에러)은 순수 함수로 분리해 vitest 로 검증

## 무엇을 보여 주나

### 요약 카드 5장

| 카드 | 값 | 출처 |
|---|---|---|
| 총 페이지 뷰 | 기간 내 전체 조회 수 | `period-summary.views` |
| 방문자 | 기간 전체 **고유** 방문자 수 | `period-summary.visitors` |
| 오늘 페이지 뷰 | 오늘(UTC) 조회 수 | `footprints-by-day` 의 오늘 값 |
| 방문자당 페이지 뷰 | `views / visitors` (소수 첫째 자리, 방문자 0 이면 `—`) | `period-summary` |
| 봇 비율 | `sum(bot_footprints) / sum(footprints)` | `bots-by-day` |

- **방문자는 일별 값의 합이 아닙니다.** 여러 날에 걸쳐 다시 온 사람을 중복 집계하지 않도록, 기간 전체를 한 번에
  세는 `period-summary`(`COUNT(DISTINCT uuid)`)를 따로 씁니다. 일별 값의 합은 항상 이보다 큽니다.
- **봇 비율**은 0 으로 나눔을 방어하고(`—`), 서브라인에 원시 카운트(예: `174 / 632`)를 노출합니다.
  `bots-by-day` 미지원(404) 시 "미지원"으로 정중히 비활성화합니다.

### 패널

- **일별 추이** (라인/영역 차트) — 페이지 뷰 · 방문자 · 봇 세 시리즈. 봇은 **뮤트 앰버 파선**으로 구분(라이트/다크 모두).
  빈 날(0)은 자동으로 채우고, 간단한 hover 툴팁을 제공합니다. (UTC 기준)
- **상위 페이지** / **유입 경로** — `referrer` 가 `null` 이거나 빈 문자열이면 `직접 유입·미상` 한 버킷으로 묶고,
  나머지는 URL 을 축약해 보여 줍니다.
- **국가별 방문** / **시간대 분포 (UTC)** — 국가 코드는 `Intl.DisplayNames('ko', { type: 'region' })` 로 한국어 이름을
  붙이고(실패하면 코드 그대로), `null` 은 `미상`. 시간대는 24 칸을 0 으로 채운 세로 막대입니다.
- **플랫폼·기기** / **방문 환경** — 플랫폼이 `null` 이면 `미보고`, `mobile === true` 면 라벨 뒤에 ` · 모바일`.
  방문 환경 패널은 **색 구성표 · 상위 언어 · 화면 폭** 세 그룹을 한 패널에 담습니다.
- **이벤트** / **봇 분류** — 이벤트는 `arguments` JSON 배열을 요약해 보여 주고(빈 상태 "수집된 이벤트가 없습니다."),
  봇 분류는 Cloudflare 가 **검증한** 봇 카테고리 목록입니다(빈 상태 "검증된 봇 트래픽이 없습니다.").
- **최근 조회 테이블** — 시각(UTC) / UUID(축약) / href / arguments(요약). 봇 태그는 `verified_bot_category` 가 있으면
  그것을(툴팁에 카테고리), 없으면 `user_agent` 휴리스틱을 근거로 답니다.
- 상태 처리 — 로딩 스피너, 섹션별 에러(상단 스트림 원문 노출), 빈 상태, **섹션별 실패 격리**(한 쿼리가 죽어도 나머지는
  정상 렌더). 범위를 바꿀 때마다 10개 이상의 쿼리가 병렬로 나가고, 늦게 도착한 이전 범위의 응답은 요청 토큰으로 버립니다.

## 데이터 의미 (오해하기 쉬운 세 가지)

### `origin` 은 referrer 가 아닙니다

수집기(**footprint-trail**)는 `origin` 컬럼을 **요청의 `Origin` 헤더**로 채웁니다. 즉 데이터를 *보낸 사이트*이지,
방문자가 *어디서 왔는지*가 아닙니다. 추적 대상 사이트가 하나뿐이면 사실상 값이 한두 개뿐이라, 뷰어는 **상위 오리진 패널을
그리지 않습니다**(쿼리 `top-origins` 자체는 워커에 그대로 남아 있습니다).

유입 경로는 별도로 수집합니다: 브라우저가 알려 주는 `document.referrer` 가 `payload.document.referrer` 로 저장되고,
`top-referrers` 쿼리가 그것을 집계합니다. 직접 방문은 `''`, 필드가 없던 시절의 행은 `null` 이라 **두 값 모두** 나올 수
있으며, 뷰어는 이를 한 버킷(`직접 유입·미상`)으로 묶습니다.

### 시간축은 전부 UTC 입니다

수집기가 `received_at` 을 UTC(`toISOString()`)로 찍고, 트래커가 `substr(received_at, 1, 10)` 으로 **UTC 날짜**를,
`substr(received_at, 12, 2)` 로 **UTC 시각**을 버킷합니다.
따라서 뷰어도 범위(`from`/`to`)와 "오늘"을 **UTC 기준**으로 계산하고, 표의 시각과 시간대 분포도 변환 없이 UTC 로
표기합니다(열 제목·캡션에 명시). 로컬(KST) 기준으로 계산하면 하루 경계가 9시간 어긋나 "오늘 페이지 뷰"가 오전 내내
0 으로 보입니다.

### `null` 은 결측이 아니라 값입니다

`uuid` · `origin` · `href` · `user_agent` 는 값이 없으면 **null 로 저장**되고(컬럼 집합을 안정적으로 유지하려는 수집기 설계),
JSON 컬럼(`cf` · `payload`)에서 꺼내는 값들(referrer · country · platform · colorScheme · language · screen.width)도
경로가 없으면 `json_get_*` 가 **null 을 돌려줍니다**. 즉 `GROUP BY` 결과에 **키가 null 인 버킷이 정상적으로 존재**합니다.
뷰어는 이를 버리지 않고 `미상`(알 수 없음) 또는 `미보고`(브라우저가 알려 주지 않음)로 라벨을 붙여 그립니다.
예외는 두 쿼리뿐입니다 — `verified-bot-categories` 는 null/빈 카테고리를, `top-events` 는 `'[]'` 를 서버에서 제외합니다.

## 엔드포인트 해석 (footprint 가족 철학: 엔드포인트 하드코딩 금지)

트래커 주소는 코드가 아니라 **브라우저 저장소**에서 읽습니다.

- `localStorage['footprint:tracker']` 에 쿼리 워커의 base URL 을 둡니다.
  - (추적 라이브러리가 데이터를 *쓰는* `footprint:endpoint` 와는 다른, *읽기* 전용 키입니다.)
- 값이 없으면 중앙 정렬 **설정 카드**(입력 + 저장 버튼)가 뜹니다.
- **저장 전에 연결을 확인합니다**: `GET {base}/queries` 를 한 번 호출해 주소 오타와 **CORS 미허용**을 즉시 잡습니다.
  (`/health` 는 CORS 헤더가 없어 크로스오리진에서 못 읽으므로 프로브 대상이 될 수 없습니다.)
  실패해도 안내만 하고, 한 번 더 누르면 **무시하고 저장**합니다(트래커가 잠깐 죽었을 수도 있으므로).
- 상단의 슬림한 엔드포인트 바가 현재 주소를 보여 주고, **변경** 버튼으로 언제든 다시 설정할 수 있습니다.

## 트래커 API 규약 (읽는 쪽 계약)

| 요청 | 응답 |
|---|---|
| `GET {base}/queries` | `200` `{ queries: [{ name, description, parameters }] }` |
| `GET {base}/queries/{name}?from&to&limit&include_owner` | `200` `{ name, rows }` |
| 파라미터 오류 | `400` `{ error }` |
| 없는 쿼리 이름·없는 경로 | `404` `{ error }` |
| `GET`/`OPTIONS` 외 메서드 | `405` (본문 없음, `Allow` 헤더) |
| upstream(R2 SQL) 실패·워커 설정 오류 | `502` `{ error }` |
| `GET {base}/` · `GET {base}/help` | `200` 자기소개 문서(같은 본문, 리다이렉션 아님) |
| `GET {base}/health` | `200` `ok` |
| `HEAD` | GET 과 동일하되 본문 없음 |
| `OPTIONS` | `204` + `Allow` (`/queries*` 에서는 CORS 프리플라이트 응답) |

### 쿼리 16개

| 이름 | 파라미터 | rows |
|---|---|---|
| `recent-footprints` | `limit` (기본 20, 1..100) | `{ received_at, uuid, origin, href, user_agent, arguments, verified_bot_category }` |
| `footprints-by-day` | `from`, `to` | `{ day, footprints }` |
| `unique-visitors-by-day` | `from`, `to` | `{ day, visitors }` |
| `top-pages` | `from`, `to`, `limit` (기본 10, 1..50) | `{ href, footprints }` |
| `top-origins` | `from`, `to`, `limit` (기본 10, 1..50) | `{ origin, footprints }` — 뷰어는 그리지 않음 |
| `bots-by-day` | `from`, `to` | `{ day, footprints, bot_footprints }` (`bot_footprints <= footprints`) |
| `period-summary` | `from`, `to` | `{ views, visitors }` — **항상 한 행** |
| `top-referrers` | `from`, `to`, `limit` (기본 10, 1..50) | `{ referrer, views }` (`referrer`: `null` \| `''` \| URL) |
| `views-by-country` | `from`, `to`, `limit` (기본 10, 1..50) | `{ country, views, visitors }` (ISO 3166-1 alpha-2 \| `null`) |
| `views-by-hour` | `from`, `to` | `{ hour, views }` (`'00'`..`'23'` UTC, **빈 시각은 생략**) |
| `top-platforms` | `from`, `to`, `limit` (기본 10, 1..50) | `{ platform, mobile, views }` (둘 다 `null` 가능) |
| `views-by-color-scheme` | `from`, `to` | `{ color_scheme, views }` (`'dark'` \| `'light'` \| `null`) |
| `top-languages` | `from`, `to`, `limit` (기본 10, 1..50) | `{ language, views }` (BCP 47 \| `null`) |
| `views-by-screen-width` | `from`, `to` | `{ width_bucket, views }` (`under-600` / `600-to-1023` / `1024-to-1439` / `1440-to-1919` / `1920-and-above` / `null`) |
| `top-events` | `from`, `to`, `limit` (기본 10, 1..50) | `{ arguments, views }` (`'[]'` 는 서버에서 제외) |
| `verified-bot-categories` | `from`, `to` | `{ category, views }` (null·빈 카테고리는 서버에서 제외) |

- **`to` 는 배타적**이며, by-day/by-hour rows 는 값이 0 인 버킷을 생략(GAP)하므로 뷰어가 `[from, to)` 전 구간과
  24 시각을 0 으로 채웁니다.
- **`limit` 범위 밖 값은 거부가 아니라 클램프**됩니다. 상한은 쿼리마다 다릅니다 — `recent-footprints` 는 1..100,
  나머지 `top-*` 는 1..50. `limit` 이 없는 쿼리(`views-by-*`, `*-by-day`, `period-summary`, `verified-bot-categories`)는
  버킷 수가 원래 유한합니다.
- 정수 파라미터는 **10진 표기만** 허용합니다(`1e2`, `0x1f` 는 400).
- 날짜는 `YYYY-MM-DD` 형태만 통과하며, 달력상 존재 여부는 보지 않습니다(`2026-13-45` 는 400 이 아니라 "0건").

### `include_owner` 와 `OWNER_UUIDS` (본인 방문 제외)

- 워커의 `OWNER_UUIDS` 변수(쉼표 구분 uuid 목록, **빈 값이면 기능 꺼짐**)에 들어 있는 방문자의 기록은
  **모든 쿼리에서 기본적으로 제외**됩니다. 사이트 주인이 자기 사이트를 보는 것 때문에 지표가 부풀지 않게 하기 위함입니다.
- 되돌리려면 **모든 쿼리에 붙는** 선택 파라미터 `include_owner=true` 를 보냅니다. 없으면 `false`,
  `'true'`/`'false'` 외의 값은 **`400 parameter include_owner must be true or false`** — 조용히 반대로 해석하지 않습니다.
- **뷰어는 `include_owner` 를 보내지 않습니다**(항상 제외된 숫자를 봅니다).
- `OWNER_UUIDS` 항목이 형식(`/^[A-Za-z0-9_-]{1,128}$/`)에 맞지 않으면 그것은 *운영자*의 실수이므로 400 이 아니라
  **502** 입니다. 자기 uuid 는 사이트를 연 뒤 localStorage 의 `footprint` 키 값에서 확인할 수 있습니다.

### 에러 문구 (뷰어가 원문 그대로 노출)

```
missing required parameter: to
parameter limit must be an integer
parameter from must be a date (YYYY-MM-DD)
parameter include_owner must be true or false
unknown query: {name}
```

- **CORS 는 `/queries` 와 `/queries/*` 에만** 붙고, 트래커의 `VIEWER_ORIGINS` 허용 목록과 **정확히 일치**하는 오리진만
  반사됩니다. 에러 응답에도 CORS 가 붙어 브라우저가 400/502 를 읽을 수 있습니다.

### 배포 시 반드시 맞춰야 하는 것 (CORS)

이 뷰어의 오리진이 트래커 워커의 `VIEWER_ORIGINS` 에 들어 있어야 합니다. 현재 워커 설정값은
`http://localhost:5173`, `http://127.0.0.1:5173`, `https://footprint-overlook.pages.dev` 입니다. 따라서:

- vite dev 서버 포트가 **5173** 이 아니면 실제 트래커에 붙을 수 없습니다(설정 카드 프로브가 잡아 줍니다).
- Cloudflare Pages 프로젝트 이름이 반드시 **`footprint-overlook`** 여야 위 도메인이 맞습니다.
- 프리뷰 배포(`<hash>.footprint-overlook.pages.dev`)는 **허용 목록에 없어 동작하지 않습니다**. 필요하면 워커
  `VIEWER_ORIGINS` 에 해당 오리진을 추가하고 재배포해야 합니다(와일드카드는 지원하지 않습니다 — 정확 일치만).

## 개발 흐름 (목 서버로 워커 없이)

배포된 워커 없이도 개발할 수 있도록 무의존성 목 서버를 포함합니다.

```bash
# 1) 목 트래커 실행 (Node v25+ 네이티브 TypeScript 실행, 포트 8788)
node tools/mock-tracker.ts

# 2) 브라우저 콘솔에서 엔드포인트 지정 (또는 설정 카드에 입력)
localStorage.setItem('footprint:tracker', 'http://127.0.0.1:8788')

# 3) 개발 서버
pnpm dev
```

목 서버는 시드 기반 **결정적** 데이터(~90일치, 0~50/일 + 주간 리듬 + 일부 0인 날로 GAP 생성)를 돌려주며,
**실제 워커와 동작이 다르면 그건 목의 버그**라는 원칙으로 다음을 그대로 흉내 냅니다.

- **쿼리 16개 전부**와, 워커의 `listQueries()` 와 **동일한 `/queries` 디스크립터 목록**(순서·설명·범위·`include_owner` 포함)
- 파라미터 검증은 워커처럼 **디스크립터 기반의 단일 루틴** — 클램프(`limit=9999` → 400 이 아니라 상한),
  10진 정수만 허용, 쿼리별 limit 상한(100 / 50), `include_owner` 는 `'true'`/`'false'` 만
- 워커와 동일한 에러 문구와 **동일한 책임 분리** — 파라미터 오류는 400, 잘못된 `OWNER_UUIDS` 는 502
- `/`, `/help`, `/health`, `HEAD`, `OPTIONS`(+`Allow`)
- **CORS 허용 목록 방식**(와일드카드 아님): 기본 `http://localhost:5173,http://127.0.0.1:5173`, `/queries*` 에만 부여,
  `Vary: Origin` 항상 전송
  - 다른 포트를 쓴다면 `VIEWER_ORIGINS=http://localhost:1234 node tools/mock-tracker.ts`
  - 다른 기기에서 열어 보려면 `HOST=0.0.0.0 node tools/mock-tracker.ts` (기본은 루프백)
  - 본인 방문 제외를 시험하려면 `OWNER_UUIDS=<uuid> node tools/mock-tracker.ts`
- **모든 패널을 실제로 채우는 시드 데이터**: 유입 경로(구글/직접/GitHub/`null`), 국가(KR 우세 + US·JP·DE·SG + `null`),
  플랫폼(macOS·Windows·Android(모바일)·Linux·`null`), 색 구성표, 언어(ko-KR 우세), 화면 폭 5구간 + `null`,
  UTC 시간대 곡선(KST 저녁 = UTC 11시 부근이 정점), 이벤트 6종, 검증된 봇 카테고리 5종
- **null 을 반드시 섞습니다** — `uuid`/`href`/`user_agent` 는 물론 모든 차원 쿼리의 null 버킷까지. 뷰어의 null 처리는
  이걸로만 실제 검증됩니다.
- 봇 숫자는 서로 모순되지 않습니다: `bots-by-day` 의 봇 수 = (User-Agent 휴리스틱이 잡는 몫) + (Cloudflare 가 검증한 몫)이고,
  뒤쪽 몫이 그대로 `verified-bot-categories` 의 합이 됩니다.

## 배포 전 확인 (Cloudflare Pages 적용 전)

**핵심 트릭: 포트를 5173 으로 고정**합니다. 트래커의 `VIEWER_ORIGINS` 에 `http://localhost:5173` 이 들어 있으므로,
이 포트로 띄우면 배포 후와 **동일한 CORS 경로**를 그대로 통과시킬 수 있습니다(4173 같은 기본 preview 포트는 차단됩니다).

### 1단계 — 목 데이터로 화면 검증 (워커 불필요)

```bash
node tools/mock-tracker.ts &        # 허용목록 기본값에 5173 포함
pnpm dev                            # vite 개발 서버 = localhost:5173
```

### 2단계 — 프로덕션 빌드를 Pages 런타임으로 검증 (배포 아님)

`vite preview` 대신 **wrangler 의 Pages 로컬 런타임(workerd)** 으로 서빙하면, 실제 Pages 가 정적 산출물을
다루는 방식 그대로 확인할 수 있습니다.

```bash
pnpm build
npx wrangler pages dev outputs --port 5173 --compatibility-date 2026-07-01
```

### 3단계 — 실제 트래커 워커에 붙여 검증 (배포 아님)

트래커는 바인딩이 없고 시크릿을 `.dev.vars` 에서 읽으므로, **로그인·배포 없이** 로컬에서 뜨고
**실제 R2 SQL 까지 도달**합니다. 즉 배포 전에 진짜 읽기 경로를 그대로 확인할 수 있습니다.

```bash
cd ../../workers/footprint-tracker-worker && npx wrangler dev --port 8787
# 뷰어(5173)에서: localStorage.setItem('footprint:tracker', 'http://127.0.0.1:8787')
```

확인 포인트:

- `GET /queries` 에 `Access-Control-Allow-Origin: http://localhost:5173` + `Vary: Origin` 이 붙는지
- 허용되지 않은 Origin 에는 헤더가 없고(응답 자체는 200) `Vary` 만 붙는지
- 잘못된 파라미터가 400 + 원문 메시지로 오는지
- **Iceberg 테이블이 아직 없으면 502 `iceberg table not found` 가 정상**입니다. 이때 뷰어는 카드가 `—`,
  섹션마다 오류 원문을 노출하고 페이지는 살아 있어야 합니다(0 으로 보이면 안 됩니다).

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
styles/               _variables(라이트·다크 토큰) / _global / _panels / _chart / _hours / _ranked / _table / _setup
scripts/
  tools/              순수 함수 계층 (모두 *.test.ts 콜로케이션)
    date-ranges.ts        프리셋 → [from, to) (배타적 to), 일자 나열 — 전부 UTC
    zero-filling.ts       by-day GAP 을 0 으로 채움(단일 필드 + bots 두 필드) + 24 시각 채움(fillMissingHours)
    chart-geometry.ts     스케일 · polyline/area path · 축 눈금 (빈/단일/전부 0 엣지)
    formatting.ts         수치·UUID 축약·arguments 요약·타임스탬프·href 단축·퍼센트·방문자당 페이지 뷰·null 표시
    dimension-labels.ts   차원 값 → 한국어 라벨 (국가·유입 경로·플랫폼·색 구성표·화면 폭 + 폭 버킷 정렬)
    summaries.ts          요약 카드 수치 계산 + 봇 비율(computeBotRatio, 0으로 나눔 방어)
    bot-detection.ts      봇 판정 — verified_bot_category 우선, 없으면 user_agent 휴리스틱
    request-tokens.ts     범위 전환 시 늦게 도착한 이전 응답 폐기
    tracker-endpoint.ts   footprint:tracker 읽기/쓰기 + URL 정규화·검증
    tracker-client.ts     쿼리 URL 조립 + 행 타입 + 에러 매핑 + fetch 래퍼 (+ 설정 카드의 연결 프로브)
  interfaces/         얇은 DOM 팩토리 (단위 테스트 제외)
    page-shells / setup-card / date-range-controls / summary-cards /
    line-chart / ranked-bars / grouped-ranks / hour-bars / recent-table /
    section-states / dashboard
tools/
  mock-tracker.ts     무의존성 목 트래커 (node tools/mock-tracker.ts)
```

테스트 철학: **DOM 을 만지는 코드는 얇게 유지**하고, 산수·문자열·URL·라벨·에러 매핑 같은 순수 로직만 vitest(node 환경)로
검증합니다. 새 패널을 붙일 때도 계산·라벨링은 `tools/` 로 내리고 `interfaces/` 에는 배치만 남깁니다.

> **봇 판정은 두 축을 함께 봅니다.** 서버는 `bots-by-day` 에서 `cf.verifiedBotCategory` **또는**
> `user_agent` 휴리스틱으로 세고, 표의 태그는 행의 `verified_bot_category` 를 우선 보고 없을 때만 휴리스틱을 씁니다.
> `scripts/tools/bot-detection.ts` 의 힌트 목록은 트래커 `queries.ts` 의 `BOT_USER_AGENT_HINTS` 를 미러링하므로,
> 한쪽만 바꾸면 봇 비율 카드(서버 판정)와 표의 태그(클라이언트 판정)가 서로 다른 답을 냅니다.

## 아직 안 된 것 (Not yet done)

- **Cloudflare Pages 배포** — 저장소는 정적 산출물만 만들고, 배포 파이프라인은 아직 없습니다. (프로젝트 이름은 위 CORS 제약 때문에 `footprint-overlook` 이어야 합니다.)
- **인증(auth)** — 현재는 공개 읽기 전용을 가정합니다. 트래커가 인증을 추가하면, 엔드포인트 해석과 API 클라이언트에 토큰/헤더 흐름을 얹어야 합니다.
- **UX 다듬기** — hover 툴팁은 최소 구현입니다. 키보드 포커스 기반 데이터 포인트 탐색, 시리즈 토글, 커스텀 날짜 범위, 표 페이지네이션/정렬 등은 후속 과제입니다.
- **자기 추적(self-tracking)** — 이 대시보드는 스스로 데이터를 남기지 않습니다(런타임 의존성 0 유지). 필요하면 `footprint` 패키지를 곁들일 수 있습니다.
- **본인 방문 제외 UI** — `include_owner` 는 API 에 있지만 화면에 토글은 없습니다. 워커의 `OWNER_UUIDS` 를 채우면 항상 제외됩니다.
