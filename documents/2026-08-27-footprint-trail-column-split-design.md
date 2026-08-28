# footprint trail 컬럼 분리(광폭 테이블) 설계

2026-08-27. 이 문서 하나로 구현 가능해야 한다 — 모든 수치는 라이브 테이블 280행 실측값이다.

## 1. 배경 — 왜 하는가

- R2 SQL 의 `json_get_*()` 는 입력 컬럼 값이 **2000바이트를 넘으면 쿼리 전체를 실패**시킨다
  (에러 40004, "argument 1 exceeds the maximum byte length of 2000"). 2026-08-27 재실측으로
  여전히 유효함을 확인했다(2032B 입력도 실패). **미문서 하드 리밋이며 설정으로 완화 불가.**
- 현재 `payload` 컬럼은 평균 1933B / 최대 2153B — **280행 중 225행(80%)이 한계 초과**라
  referrer·언어·화면·색상 등 payload 내부를 읽는 모든 지표가 NULL("미보고")로 떨어진다.
- `cf` 컬럼은 평균 1568B / 최대 1849B 로 여유가 151B뿐 — Cloudflare 가 필드를 늘리면
  국가·봇 지표가 같은 방식으로 무너진다.
- 데이터 자체는 무손실이다. `SELECT payload` 원본 조회는 정상 동작하며 JSON 파싱도 온전함을
  실측했다. 문제는 **SQL 안에서의 추출만** 막혀 있다는 것.

## 2. 불변 원칙 (절대 규칙)

1. **원본 무손상**: `payload` 와 `cf` 는 받은 그대로(JSON 직렬화만) 저장한다. 어떤 필드도
   제거·절단하지 않는다. 이 두 컬럼은 보관·백필용이며 `json_get_*` 조회 대상이 아니다.
2. **조회는 분리 컬럼으로만**: 대시보드/쿼리가 읽는 값은 전부 2000B 한계 아래의 분리 컬럼에서
   읽는다.
3. **`cookie` 헤더는 어떤 컬럼에도 저장하지 않는다** (`authorization` 도 동일). 방문자 uuid 와
   중복이고, 타 사이트 수집 시 세션 토큰이 섞일 수 있다.
4. **API 응답 형태 불변**: tracker `/queries` 카탈로그의 쿼리 이름·파라미터·응답 행의 필드명은
   바이트 단위로 지금과 동일해야 한다(SQL 에서 `AS uuid` 등으로 별칭). overlook 은 무변경이
   전제다.

## 3. 명명 규칙

- `__`(밑줄 2개) = JSON 경로 하강. 원본 키의 camelCase 를 그대로 유지한다
  (`payload__navigator__userAgentHints`). 헤더 이름은 소문자화 후 `-` → `_`
  (`sec-ch-ua` → `headers__sec_ch_ua`).
- `_remains`(밑줄 1개 접미사) = "그 루트에서 분리된 것들을 뺀 나머지". **최상위 3종
  (headers/cf/payload)에만 존재한다** — 원본 컬럼과 이름이 경쟁하는 곳이 거기뿐이라서다.
- 하위 컨테이너(`payload__navigator` 등)는 원본 사본이 없으므로 접미사 없이 그 이름 자체가
  "더 깊이 분리된 것을 뺀 나머지"를 뜻한다.
- 스칼라 분리 컬럼(`payload__uuid`, `payload__location__href`, `payload__document__referrer`,
  `payload__navigator__userAgent`, `headers__*`)은 **JSON 인용 없이 원시 문자열**로 저장한다 —
  `WHERE payload__uuid = '...'` 직접 비교가 성립해야 한다. 컨테이너/배열 컬럼은 JSON 문자열.

## 4. 최종 스키마 — 24컬럼 (스트림/테이블 공통, 전부 string 타입)

required 는 `received_at` 과 `payload` 둘뿐이다(그 외 전부 nullable — Pipelines 는 스키마
불일치 이벤트를 **조용히 폐기**하므로 required 는 최소화한다).

| # | 컬럼 | 실측 avg/max (B) | 내용 |
|---|---|---|---|
| 1 | `received_at` | 24 | 서버 시계 ISO 문자열 (기존 유지) |
| 2 | `headers` | ~600 | **원본**: 모든 요청 헤더(cookie·authorization 제외) JSON |
| 3 | `headers_remains` | ~400 | headers 에서 4·5·6·7번을 뺀 나머지 |
| 4 | `headers__origin` | 43 | `Origin` 헤더 (원시 문자열) |
| 5 | `headers__referer` | 가변 | `Referer` 헤더 — URL이라 무제한, 격리 목적 |
| 6 | `headers__user_agent` | 112/140 | `User-Agent` 헤더 |
| 7 | `headers__sec_ch_ua` | ~75 | `Sec-CH-UA` 헤더 |
| 8 | `cf` | 1568/1849 | **원본**: request.cf 전체 JSON (기존 유지) |
| 9 | `cf_remains` | 780/837 | cf 에서 10~13번 객체 4개를 뺀 나머지(country·verifiedBotCategory·timezone·colo·asn 등 24 스칼라) |
| 10 | `cf__tlsClientAuth` | 457/457 | 인증서 21필드 (19개 영구 빈 값) |
| 11 | `cf__tlsExportedAuthenticator` | 447/467 | 핸드셰이크 해시 4개 (152/280행에만 존재 → 부재 시 null) |
| 12 | `cf__edgeL4` | 22/25 | deliveryRate |
| 13 | `cf__requestHeaderNames` | 2/2 | 항상 빈 객체 |
| 14 | `payload` | 1933/2153 | **원본**: 브라우저 본문 전체 JSON (기존 유지) |
| 15 | `payload_remains` | 857/947 | payload 에서 uuid·arguments·location·document·navigator 5개 키를 뺀 나머지. screen·window·intl·memory·gpu·battery·connection·storage·colorScheme·reducedMotion 등 **중첩 구조 그대로** |
| 16 | `payload__uuid` | 37/38 | 방문자 id (원시 문자열) |
| 17 | `payload__arguments` | 38/119 | step() 인자 배열 JSON — 개발자 임의 값이라 격리 |
| 18 | `payload__location` | 45/58 | location 에서 href 를 뺀 나머지(search·hash·protocol 등) JSON |
| 19 | `payload__location__href` | 51/54 | 방문 URL (원시 문자열) — URL 무제한 격리 |
| 20 | `payload__document` | 52/52 | document 에서 referrer 를 뺀 나머지(visibilityState·characterSet) JSON |
| 21 | `payload__document__referrer` | 37/46 | document.referrer (원시 문자열) — URL 무제한 격리 |
| 22 | `payload__navigator` | 234/246 | navigator 에서 userAgent·userAgentHints 를 뺀 나머지(language·languages·vendor·deviceMemory·webdriver 등) JSON |
| 23 | `payload__navigator__userAgent` | 119/142 | navigator.userAgent (원시 문자열) |
| 24 | `payload__navigator__userAgentHints` | 395/420 | UA-CH 서브트리(platform·mobile·brands·fullVersionList) JSON |

기존 컬럼 중 `uuid`·`origin`·`href`·`user_agent`·`arguments` 는 **새 이름으로 대체**된다
(각각 16·4·19·6·17번). 값 의미는 동일하되 출처가 이름에 드러난다.

## 5. trail 워커 분해 로직 (footprints.ts)

```ts
// payload 분해 — 원본은 그대로 두고 사본을 구조 분해
const { uuid, arguments: arguments_, location, document, navigator, ...payloadRemains } = payload;
const { href, ...locationRest } = location ?? {};
const { referrer, ...documentRest } = document ?? {};
const { userAgent, userAgentHints, ...navigatorRest } = navigator ?? {};
// cf 분해
const { tlsClientAuth, tlsExportedAuthenticator, edgeL4, requestHeaderNames, ...cfRemains } = cf ?? {};
// headers: request.headers 전체 순회, cookie/authorization 제외, 소문자 키 JSON 객체로.
// headers_remains = 그중 origin/referer/user-agent/sec-ch-ua 4개를 뺀 것.
```

- 부재 소스(예: cf 가 null 인 로컬 재생, referrer 미존재)는 해당 컬럼 null.
- 스칼라 컬럼은 `typeof === 'string'` 검증 후 원시 문자열로(기존 stringOrUndefined 패턴 유지),
  컨테이너는 `JSON.stringify`.
- 하나의 소스 객체에서 모든 컬럼을 한 번에 생성한다(드리프트 구조적 방지). `stream-schema.json`
  ↔ `FootprintRecord` 타입 ↔ `toRecord()` 3자는 잠금 상태를 유지하고 테스트로 핀한다.

## 6. tracker 쿼리 매핑 (queries.ts — 27개 전수)

| 구 표현 | 신 표현 |
|---|---|
| `uuid` (컬럼 참조·GROUP BY·ownerExclusion) | `payload__uuid` (+ 응답엔 `AS uuid`) |
| `origin` | `headers__origin` (+ `AS origin`) |
| `href` | `payload__location__href` (+ `AS href`) |
| `user_agent` (봇 ILIKE 포함) | `headers__user_agent` (+ `AS user_agent`) |
| `arguments` | `payload__arguments` (+ `AS arguments`) |
| `json_get_str(payload,'document','referrer')` | `payload__document__referrer` 직접 참조 (json_get 불필요) |
| `json_get_str(payload,'location','search')` (UTM) | `json_get_str(payload__location,'search')` |
| `json_get_str(payload,'navigator','userAgentHints',...)` | `json_get_*(payload__navigator__userAgentHints, ...)` (경로에서 navigator·userAgentHints 제거) |
| `json_get_str(payload,'navigator','language')` 등 | `json_get_str(payload__navigator,'language')` |
| `json_get_int(payload,'screen','width')` 등 remains 계열 | `json_get_int(payload_remains,'screen','width')` |
| `json_get_str(payload,'colorScheme')` 등 | `json_get_str(payload_remains,'colorScheme')` |
| `json_get_str(cf,'country')` / verifiedBotCategory | `json_get_str(cf_remains, ...)` |

- **가드 유지**: 모든 `json_get_*` 는 지금처럼 `CASE WHEN octet_length(<컬럼>) <= 2000 THEN … END`
  로 감싼다. 분리 컬럼도 예외 없음 — 현재는 발동하지 않지만(최대 947B) 가변 필드가 자라는 날
  쿼리 사망 대신 미보고로 강등시키는 보험이며 비용이 0이다.
- 스칼라 컬럼 직접 참조(uuid·href·referrer·userAgent)에는 가드·json_get 이 필요 없다.
- `TABLE_NAME` 은 `footprint.trail_wide` 로 변경(wrangler.jsonc). TABLE_NAME_PATTERN 통과 확인.
- 카탈로그의 쿼리 이름·파라미터 목록·응답 필드명은 절대 불변(원칙 4).

## 7. 마이그레이션 경로 (운영 단계 — 이번 구현 범위 밖)

Cloudflare Pipelines 는 **스트림 생성 후 스키마 변경을 지원하지 않고**, 기존 Iceberg 테이블에
새 sink 를 붙일 수도 없다(문서 확인). 따라서:

1. 새 스트림 `footprint_trail_wide` (24필드 schema-file) + 새 sink → 새 테이블
   `footprint.trail_wide` 생성
2. trail 워커의 pipelines 바인딩을 새 스트림으로 교체 후 배포 (이때부터 새 테이블에 적재)
3. tracker 배포 (TABLE_NAME=footprint.trail_wide)
4. overlook 은 무변경 (원칙 4 + 능력 게이팅)

구 테이블 `footprint.trail` 은 그대로 남는다(280행, 대부분 본인·시드 트래픽). **신선한 테이블
시작은 시드 오염(HANDOFF 결정 대기 ③)을 겸사겸사 해소**한다. 과거 데이터 백필은 후속 결정
사항: 원본 payload/cf 가 온전하므로 "구 테이블 원본 SELECT → JS 분해 → 새 스트림 재주입"이
언제든 가능하다(received_at 보존).

## 8. 구현 범위

**포함**: `workers/footprint-trail-worker/` (stream-schema.json, footprints.ts, worker.ts,
wrangler.jsonc, 테스트), `workers/footprint-tracker-worker/` (queries.ts, wrangler.jsonc 의
TABLE_NAME, 테스트). 기존 테스트 전부 그린 + 신규 분해·핀 테스트.

**불포함(절대 금지)**: git 쓰기 작업 일체(커밋·푸시·브랜치), 모든 배포(wrangler deploy·pages),
Cloudflare 리소스 생성(스트림·싱크·테이블), `.env`·`.dev.vars` 값 출력.

## 9. 리스크·주의

- 가변 길이 필드: `headers__referer`·`payload__location__href`·`payload__document__referrer`
  (URL 무제한), `payload__arguments` (개발자 임의). 전부 자체 컬럼으로 격리했고 스칼라 참조라
  한계 무관. 컨테이너 쪽 가드는 유지(위 6절).
- `cf__tlsExportedAuthenticator` 는 조건부 존재(HTTP/3 등) — null 처리 필수.
- `isEUCountry` 는 boolean|string 혼합 타입 — cf_remains 안 값이므로 저장은 그대로, 조회 시 주의.
- 테스트의 SQL 핀은 문자 단위 일치다 — 27개 쿼리 SQL 이 전부 바뀌므로 핀 갱신량이 크다.
  핀을 약화(부분 일치화)하지 말 것.
