# Footprint Overlook

**footprint** 가 수집한 페이지 접근 데이터를 분석하는 정적 대시보드입니다.
데이터는 별도의 쿼리 워커(**footprint-tracker**)가 제공하고, 이 앱은 그 결과를 읽어 **손수 그린 SVG·CSS**로 시각화합니다.

> 이름에 대하여 — `footprint`(수집 라이브러리) · `footprint-trail`(수집 워커) · `footprint-tracker`(쿼리 워커) ·
> `footprint-overlook`(이 뷰어)는 "발자국을 남기고 내려다본다"는 계열 테마를 그대로 씁니다. 시스템·워커·쿼리·저장소 키
> 이름은 그 테마를 유지하고, **화면에 보이는 문구만** 일반적인 분석 용어(페이지 뷰·방문자·조회)를 씁니다.

- Vite + TypeScript, **런타임 의존성 0** (차트/날짜 라이브러리 없이 순수 SVG·CSS·`Intl`·`Date`)
- 라이트/다크 테마(자동·라이트·다크 토글 및 `prefers-color-scheme`), Pretendard Variable, 한국어 UI
- SWR 캐싱, 2단계 파동 로딩, 스켈레톤 상태, 반응형 Step 차트 ViewBox (720/1080/1440), 키보드/터치 탐색
- 27개 쿼리와 21개 분석 섹션 (유입 분류·UTM·방문자 깊이/리텐션·여정·경험 품질·준실시간 등)
- 모든 데이터 가공은 순수 함수로 분리해 vitest 로 검증

## 무엇을 보여 주나

### 요약 카드 5장

| 카드 | 값 | 출처 & 기능 |
|---|---|---|
| 총 페이지 뷰 | 기간 내 전체 조회 수 | `period-summary.views` (▲▼% 전 기간 대비 증감률, 미니 스파크라인 포함) |
| 방문자 | 기간 전체 **고유** 방문자 수 | `period-summary.visitors` (▲▼% 전 기간 대비 증감률, 미니 스파크라인 포함) |
| 오늘 페이지 뷰 | 오늘(UTC) 조회 수 | `footprints-by-day` 의 오늘 값 |
| 방문자당 페이지 뷰 | `views / visitors` (소수 첫째 자리, 방문자 0 이면 `—`) | `period-summary` |
| 봇 비율 | `sum(bot_footprints) / sum(footprints)` | `bots-by-day` |

- **방문자는 일별 값의 합이 아닙니다.** 여러 날에 걸쳐 다시 온 사람을 중복 집계하지 않도록, 기간 전체를 한 번에 세는 `period-summary` (`COUNT(DISTINCT uuid)`)를 따로 씁니다.
- **봇 비율**은 0 으로 나눔을 방어하고(`—`), 서브라인에 원시 카운트(예: `174 / 632`)를 노출합니다. `bots-by-day` 미지원(404) 시 "미지원"으로 정중히 비활성화합니다.

### 분석 패널

1. **일별 추이** (라인/영역 차트) — 페이지 뷰 · 방문자 · 봇 세 시리즈. 범례 클릭으로 시리즈 숨김/표시, 키보드 좌우 화살표 탐색, 반응형 ViewBox (720/1080/1440), 스크린 리더용 숨김 테이블 제공.
2. **상위 페이지** / **유입 경로** — `referrer` 가 `null` 이거나 빈 문자열이면 `직접 유입·미상` 한 버킷으로 묶고, 미보고 항목 각주 접기 기능 제공.
3. **국가별 방문** / **시간대 분포** — 국가 코드는 `Intl.DisplayNames('ko', { type: 'region' })` 한국어 표기, 시간대 분포 패널은 **UTC/KST (+9)** 전환 토글 제공.
4. **플랫폼·기기** / **방문 환경** — 색 구성표 · 상위 언어 · 화면 폭 세 그룹 통합 패널.
5. **이벤트** / **봇 분류** — 수집 인자 요약 및 Cloudflare 검증 봇 카테고리.
6. **유입 분류 & UTM 파라미터** — Direct/Search/Social/AI/Other 유입 자동 분류 및 UTM Source/Medium/Campaign 브레이크다운.
7. **신규 vs 재방문 & 방문 깊이** — 신규 vs 재방문 집계 및 세션당 페이지 뷰 깊이 구간별 분포.
8. **주별 리텐션 매트릭스** — 주차별 코호트 잔존율(% 및 방문자 수) 매트릭스.
9. **상위 랜딩 & 페이지 이동 경로** — 유입 랜딩 페이지 및 페이지 간 이동 흐름 (from ➔ to).
10. **경험 품질** — Connection Type (4g/3g/2g), Device Memory, Accessibility Signal (Reduced Motion) 통합 측정.
11. **봇 시간대 분포** — 시간대별 전체 대비 봇 활동 히스토그램.
12. **준실시간 활동** — 최근 30분 분당 페이지 뷰 (문서 활성 상태 시 60초 간격 자동 갱신, 1~2분 수집 지연 안내 명시).
13. **최근 조회 테이블** — 헤더 클릭 컬럼 정렬, "더 보기" 버튼 (100건 확대), 방문자 UUID 클릭 강조 및 "이 방문자만 보기" 필터 모드 ("표시 중인 N건 내 필터"), 강조된 방문자 타임라인 패널 제공.

## 데이터 의미론

트래커가 보내는 값을 있는 그대로 읽기 위해 알아 둬야 할 규칙입니다.

- **`null` 은 구멍이 아니라 값입니다.** `recent-footprints`·두 `top-*`·차원 쿼리(국가·플랫폼·색 구성표·언어·화면 폭 등)는 payload JSON 경로에서 값을 읽어 채우므로, 값이 없으면 `null` 이 그대로 돌아옵니다 — 구버전 페이로드, non-browser 클라이언트, Cloudflare 가 해석하지 못한 헤더 등 "모른다"는 정직한 데이터입니다. 뷰어는 이를 버리지 않고 미상/미보고로 표시합니다. 예외는 서버가 이미 걸러낸 두 쿼리뿐입니다: `verified-bot-categories`(null/빈 카테고리 제외), `top-events`(`arguments != '[]'`).
- **직접 유입 vs 미상.** `referrer` 가 빈 문자열(`''`)이면 브라우저가 보고한 진짜 직접 방문(주소창 직접 입력, 북마크, 리퍼러 억제)이고, `null` 이면 그 필드 자체가 없던 구버전 페이로드입니다. 뷰어는 이 둘을 `직접 유입·미상` 한 버킷으로 합쳐서 보여 줍니다.
- **봇 판정.** `verified_bot_category` 는 Cloudflare 가 검증한 봇에게만 채워집니다. 사람 트래픽은 빈 문자열(`''`)이고, `null` 은 `cf` 컬럼 자체가 없거나(비-Cloudflare 재생) 이 컬럼을 추가하기 전에 수집된 행입니다 — 빈 문자열과 `null` 모두 "판정 없음"을 뜻하며, 이때는 User-Agent 휴리스틱으로 넘어갑니다.
- **소유자 트래픽 제외.** 워커는 `include_owner` 파라미터로 운영자 자신의 방문 포함 여부를 제어하지만, 이 뷰어는 그 파라미터를 절대 보내지 않습니다. 다른 사람의 트래픽을 읽는 것이 뷰어의 존재 이유이므로, 매 호출부가 습관적으로 지켜야 할 규칙이 아니라 클라이언트 자체의 속성으로 만들었습니다.
- **파라미터 클램프.** 범위를 벗어난 정수 파라미터는 거부 대신 클램프됩니다 — `recent-footprints` 의 `limit` 은 1..100, 나머지 순위 쿼리(`top-pages`·`top-referrers`·`views-by-country`·`top-platforms`·`top-languages`·`top-events`·`top-landings`·`page-transitions` 등)는 1..50. 지나치게 큰 `limit` 도 200 으로 응답하되 행 수만 줄어듭니다.
- **`recent-footprints` 의 `uuid` 파라미터**로 한 방문자의 기록만 서버에서 걸러 받을 수 있습니다 — 강조된 방문자의 타임라인 패널이 이 방식으로 조회합니다.

## 트래커 API 규약 (읽는 쪽 계약)

| 이름 | 파라미터 | rows |
|---|---|---|
| `recent-footprints` | `limit`, `uuid` (선택) | `{ received_at, uuid, origin, href, user_agent, arguments, verified_bot_category }` |
| `footprints-by-day` | `from`, `to` | `{ day, footprints }` |
| `unique-visitors-by-day` | `from`, `to` | `{ day, visitors }` |
| `top-pages` | `from`, `to`, `limit` | `{ href, footprints }` |
| `top-origins` | `from`, `to`, `limit` | `{ origin, footprints }` — 뷰어는 그리지 않음 |
| `bots-by-day` | `from`, `to` | `{ day, footprints, bot_footprints }` |
| `period-summary` | `from`, `to` | `{ views, visitors }` — **항상 한 행** |
| `top-referrers` | `from`, `to`, `limit` | `{ referrer, views }` |
| `views-by-country` | `from`, `to`, `limit` | `{ country, views, visitors }` |
| `views-by-hour` | `from`, `to` | `{ hour, views }` |
| `top-platforms` | `from`, `to`, `limit` | `{ platform, mobile, views }` |
| `views-by-color-scheme` | `from`, `to` | `{ color_scheme, views }` |
| `top-languages` | `from`, `to`, `limit` | `{ language, views }` |
| `views-by-screen-width` | `from`, `to` | `{ width_bucket, views }` |
| `top-events` | `from`, `to`, `limit` | `{ arguments, views }` |
| `verified-bot-categories` | `from`, `to` | `{ category, views }` |
| `utm-breakdown` | `from`, `to` | `{ source, medium, campaign, views }` |
| `new-vs-returning-by-day` | `from`, `to` | `{ day, new_visitors, returning_visitors }` |
| `visit-depth` | `from`, `to` | `{ depth_bucket, visitors }` |
| `weekly-retention` | `from`, `to` | `{ cohort_week, week_offset, visitors }` |
| `top-landings` | `from`, `to`, `limit` | `{ href, landings }` |
| `page-transitions` | `from`, `to`, `limit` | `{ from_href, to_href, transitions }` |
| `connection-types` | `from`, `to` | `{ effective_type, views }` |
| `device-capabilities` | `from`, `to` | `{ memory_bucket, views }` |
| `accessibility-signals` | `from`, `to` | `{ reduced_motion, views }` |
| `bots-by-hour` | `from`, `to` | `{ hour, views, bot_views }` |
| `views-by-minute` | `minutes` | `{ minute, views }` |

## 엔드포인트 결정

트래커 엔드포인트는 하드코딩하지 않습니다.

- `localStorage['footprint:tracker']` 에 저장된 URL 을 읽어 씁니다. 수집 라이브러리가 쓰는 `localStorage['footprint:endpoint']` 와는 별개의 키입니다 — 한 페이지가 수집(footprint-trail)과 조회(footprint-tracker) 중 하나만 설정하거나, 둘 다, 혹은 둘 다 설정하지 않을 수 있습니다.
- 저장 전에 정규화합니다: 앞뒤 공백과 끝 슬래시(들)를 제거합니다. 요청 URL 은 문자열 결합(`${base}/queries`)으로 만들어지므로, 끝 슬래시가 남으면 이중 슬래시가 되어 워커 라우터가 다른 경로(404)로 취급합니다.
- 유효성 검사는 `http`/`https` 절대 URL 만 통과시킵니다. `new URL()` 만으로는 `mailto:`/`data:`/`javascript:` 같은 스킴도 통과하므로 스킴을 명시적으로 검사합니다.
- 도달성 확인은 `GET /queries` 로 합니다 (`/health`, `/help` 가 아닙니다). 워커는 `/queries` 와 `/queries/*` 에만 CORS 헤더를 붙이므로, 브라우저가 교차 출처로 읽을 수 있는 유일한 표면이 `/queries` 입니다. 엔드포인트가 없거나, 형식이 유효하지 않거나, 이 프로브가 실패하면 설정 카드가 뜹니다.

## 오류 계약

- 실패한 요청은 상태 코드를 담은 `TrackerError` 로 던져집니다. 상태 `0` 은 fetch 자체가 실패한 경우를 뜻합니다(오프라인, DNS, 또는 브라우저가 상태 없는 network error 로만 보고하는 CORS 차단).
- 메시지는 워커가 응답 본문에 담아 보낸 `{ error }` 텍스트를 그대로 우선 사용합니다 — 어떤 파라미터가 잘못됐는지, 502 의 upstream 실패 원인 등을 담고 있습니다. 본문에 그 텍스트가 없을 때만(405 는 본문 없이 응답, 혹은 중간 프록시의 비-JSON 오류 페이지) 상태 코드별 한국어 문장으로 대체합니다: 400 파라미터 오류 · 404 쿼리 없음 · 405 메서드 미허용 · 502 upstream 연결 실패.
- **패널 단위로 격리됩니다.** 27개 쿼리는 개별적으로 실행되며, 한 쿼리가 실패해도 그 패널만 오류 카드를 보이고 나머지 패널은 정상적으로 그려집니다 — "데이터 없음"으로 뭉뚱그리지 않습니다.
- **404 는 별도 문구로 구분합니다.** 뷰어는 최신인데 붙어 있는 트래커 배포가 아직 그 쿼리를 모를 때(배포 시차) "트래커가 아직 이 쿼리를 지원하지 않습니다" 카드를 보여, 진짜 장애와 구분합니다.
- 응답이 `200` 이어도 `rows` 배열이 없으면 예외를 던지지 않고 빈 배열로 취급합니다 — 형식이 어긋난 응답 하나가 대시보드 전체를 무너뜨리지 않도록 합니다.

## 로컬 상태

- **SWR 캐시** — `localStorage['footprint:cache:{쿼리명}:{rangeKey}']` 에 `{ version, storedAt, rows }` 봉투로 저장합니다(현재 버전 `v1`). `rangeKey` 는 기본적으로 `{from}:{to}` 이며, 결과가 `limit` 에 좌우되는 `recent-footprints` 같은 쿼리만 `:{limit}` 을 덧붙입니다. 버전 불일치, 손상된 JSON, 비유한수 `storedAt`, 쿼터 초과는 모두 조용히 무시하고 새로 받아옵니다. 캐시가 있으면 즉시 그려서 "갱신 중" 배지를 띄우고, 네트워크 응답이 도착하면 배지를 지우고 값을 교체합니다.
- **URL 해시** — `#range=<일수>` 또는 `#from=<YYYY-MM-DD>&to=<YYYY-MM-DD>` 로 조회 기간을 공유하고, 강조 중인 방문자가 있으면 `&highlight=<uuid>` 를 덧붙입니다. 기본값(30일)은 해시에 남기지 않습니다. **엔드포인트는 보안상 해시에 절대 담지 않습니다.**
- **테마** — `localStorage['footprint:theme']` 에 `auto`/`light`/`dark` 중 하나를 저장합니다(`auto` 는 `prefers-color-scheme` 를 따릅니다).
- **강조 방문자** — `localStorage['footprint:highlight']` 에 마지막으로 강조한 uuid 를 저장해 새로고침 후에도 유지합니다.

## 개발 및 검증

```bash
# 1) 목 트래커 실행 (Node v25+ 네이티브 TypeScript 실행, 포트 8788)
node tools/mock-tracker.ts

# 2) 개발 서버 실행
pnpm dev

# 3) 검증 루프
pnpm test        # vitest 전체 스위트 통과
pnpm typecheck   # tsc 타입 검사 통과
pnpm build       # vite 빌드 성공 (outputs/)
```
