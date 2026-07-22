// 실제 워커(footprint-tracker) 없이 대시보드를 개발하기 위한 무의존성 목 서버입니다.
//
//   실행:  node tools/mock-tracker.ts       (Node v25+ 네이티브 TypeScript 실행, 포트 8788)
//   브라우저 콘솔:  localStorage.setItem('footprint:tracker', 'http://127.0.0.1:8788')
//
// API 규약을 그대로 구현하며, 시드 기반 결정적(pseudo-random) 데이터(~90일치 개인 블로그 트래픽,
// 0~50/일 + 주간 리듬 + 일부 0인 날로 GAP 생성)를 돌려줍니다. CORS 는 모든 오리진 허용입니다.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { enumerateDays, parseLocalDate } from '../scripts/tools/date-ranges.ts';

const PORT = 8788;
const SITE_ORIGIN = 'https://gignac-cha.github.io';

// ----------------------------------------------------------------------------
// 결정적 난수 — 문자열 시드로 같은 값을 재현합니다.
// ----------------------------------------------------------------------------
function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    // 선형 합동 생성기(LCG).
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

// ----------------------------------------------------------------------------
// 카탈로그 — 상위 페이지/출처/UA 후보
// ----------------------------------------------------------------------------
const HREF_PATHS = [
  '/',
  '/about',
  '/blog',
  '/blog/hello-world',
  '/blog/typescript-tips',
  '/blog/on-device-ai',
  '/projects',
  '/projects/footprint',
  '/resume',
  '/contact',
  '/tags/web',
  '/tags/ai',
];

const REFERRER_ORIGINS = [
  SITE_ORIGIN,
  'https://www.google.com',
  'https://github.com',
  'https://news.ycombinator.com',
  'https://x.com',
  'https://www.reddit.com',
  'direct',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  // 봇 UA 도 섞어 테이블의 🤖 태그(클라이언트 측 휴리스틱)를 실제로 보이게 합니다.
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36',
];

const ARGUMENT_SAMPLES: string[][] = [
  [],
  ['click', 'nav-home'],
  ['scroll-depth', '75%'],
  ['search', 'typescript'],
  ['share', 'twitter'],
  ['theme', 'dark'],
];

// ----------------------------------------------------------------------------
// 일자별 결정적 수치
// ----------------------------------------------------------------------------
function dayFootprints(day: string): number {
  const random = createSeededRandom(hashString(`footprints:${day}`));
  const weekday = parseLocalDate(day).getDay(); // 0=일 .. 6=토
  const weekendFactor = weekday === 0 || weekday === 6 ? 0.6 : 1;

  const base = 8 + 34 * random(); // 8~42
  const noisy = base * weekendFactor + (random() - 0.5) * 12;
  const rounded = Math.max(0, Math.round(noisy));

  // 약 8% 날은 발자국 0 → by-day 응답에서 생략되어 GAP 이 생깁니다(뷰어의 zero-fill 검증).
  if (random() < 0.08) {
    return 0;
  }
  return Math.min(50, rounded);
}

function dayVisitors(day: string, footprints: number): number {
  if (footprints === 0) {
    return 0;
  }
  const random = createSeededRandom(hashString(`visitors:${day}`));
  const ratio = 0.45 + 0.3 * random(); // 고유 방문자는 발자국의 45~75%
  return Math.max(1, Math.min(footprints, Math.round(footprints * ratio)));
}

// [from, to) 구간의 총 발자국 수(상위 목록 분배의 기준).
function sumFootprintsInRange(from: string, to: string): number {
  return enumerateDays(from, to).reduce((total, day) => total + dayFootprints(day), 0);
}

// 카탈로그에 총량을 시드 가중치로 분배해 상위 목록을 만듭니다.
function distributeTop(
  catalog: ReadonlyArray<string>,
  from: string,
  to: string,
  seedPrefix: string,
  limit: number,
): { name: string; footprints: number }[] {
  const total = sumFootprintsInRange(from, to);
  const weighted = catalog.map((name) => ({
    name,
    weight: createSeededRandom(hashString(`${seedPrefix}:${from}:${to}:${name}`))(),
  }));
  const weightSum = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;

  return weighted
    .map((item) => ({ name: item.name, footprints: Math.round((total * item.weight) / weightSum) }))
    .filter((row) => row.footprints > 0)
    .sort((a, b) => b.footprints - a.footprints)
    .slice(0, limit);
}

function makeUuid(random: () => number): string {
  const hex = (length: number): string => {
    let out = '';
    for (let index = 0; index < length; index += 1) {
      out += Math.floor(random() * 16).toString(16);
    }
    return out;
  };
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
}

// ----------------------------------------------------------------------------
// 쿼리 구현
// ----------------------------------------------------------------------------
function recentFootprints(limit: number): Record<string, unknown>[] {
  const now = Date.now();
  const rows: Record<string, unknown>[] = [];
  for (let index = 0; index < limit; index += 1) {
    const random = createSeededRandom(hashString(`recent:${index}`));
    const receivedAt = new Date(now - index * 37 * 60 * 1000).toISOString(); // 약 37분 간격으로 과거로
    const path = HREF_PATHS[Math.floor(random() * HREF_PATHS.length)];
    const origin = REFERRER_ORIGINS[Math.floor(random() * REFERRER_ORIGINS.length)];
    const userAgent = USER_AGENTS[Math.floor(random() * USER_AGENTS.length)];
    const args = ARGUMENT_SAMPLES[Math.floor(random() * ARGUMENT_SAMPLES.length)];
    rows.push({
      received_at: receivedAt,
      uuid: makeUuid(random),
      origin,
      href: `${SITE_ORIGIN}${path}`,
      user_agent: userAgent,
      arguments: JSON.stringify(args),
    });
  }
  return rows;
}

function footprintsByDay(from: string, to: string): Record<string, unknown>[] {
  // 0인 날은 생략(GAP)합니다.
  return enumerateDays(from, to)
    .map((day) => ({ day, footprints: dayFootprints(day) }))
    .filter((row) => row.footprints > 0);
}

function uniqueVisitorsByDay(from: string, to: string): Record<string, unknown>[] {
  return enumerateDays(from, to)
    .map((day) => {
      const footprints = dayFootprints(day);
      return { day, visitors: dayVisitors(day, footprints) };
    })
    .filter((row) => row.visitors > 0);
}

// 하루 봇 발자국 — 총 발자국의 15~45% 를 봇으로 보고, 항상 bot_footprints <= footprints 를 보장합니다.
function dayBotFootprints(day: string, footprints: number): number {
  if (footprints === 0) {
    return 0;
  }
  const random = createSeededRandom(hashString(`bots:${day}`));
  const share = 0.15 + 0.3 * random(); // 15%~45%
  return Math.min(footprints, Math.round(footprints * share));
}

function botsByDay(from: string, to: string): Record<string, unknown>[] {
  // footprints-by-day 와 동일하게 0인 날은 생략(GAP)하고, 두 필드를 함께 돌려줍니다.
  return enumerateDays(from, to)
    .map((day) => {
      const footprints = dayFootprints(day);
      return { day, footprints, bot_footprints: dayBotFootprints(day, footprints) };
    })
    .filter((row) => row.footprints > 0);
}

// ----------------------------------------------------------------------------
// 쿼리 메타데이터 (GET /queries)
// ----------------------------------------------------------------------------
const QUERY_DESCRIPTORS = [
  {
    name: 'recent-footprints',
    description: '가장 최근 발자국 목록',
    parameters: [{ name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 100 }],
  },
  {
    name: 'footprints-by-day',
    description: '일자별 발자국 수 (to 는 배타적)',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
  },
  {
    name: 'unique-visitors-by-day',
    description: '일자별 고유 방문자 수 (to 는 배타적)',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
  },
  {
    name: 'bots-by-day',
    description: '일자별 총 발자국과 봇 발자국 (to 는 배타적, bot_footprints <= footprints)',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
  },
  {
    name: 'top-pages',
    description: '기간 내 상위 페이지',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 100 },
    ],
  },
  {
    name: 'top-origins',
    description: '기간 내 상위 출처(referrer)',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 100 },
    ],
  },
];

// ----------------------------------------------------------------------------
// HTTP 응답 헬퍼
// ----------------------------------------------------------------------------
function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': '*',
  });
  response.end(payload);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// from/to 필수 검증 + 형식 검증. 문제가 있으면 에러 메시지를, 없으면 null 을 돌려줍니다.
function validateDateRange(from: string | null, to: string | null): string | null {
  if (from === null || to === null) {
    return 'from and to are required (YYYY-MM-DD)';
  }
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return 'from and to must be YYYY-MM-DD';
  }
  return null;
}

// limit 파싱 + 범위 검증. [value, errorMessage] 형태로 돌려줍니다.
function parseLimit(rawLimit: string | null, fallback: number): { value: number; error: string | null } {
  if (rawLimit === null) {
    return { value: fallback, error: null };
  }
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    return { value: fallback, error: 'limit must be an integer between 1 and 100' };
  }
  return { value: parsed, error: null };
}

// ----------------------------------------------------------------------------
// 라우팅
// ----------------------------------------------------------------------------
function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  // CORS preflight.
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': '*',
    });
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '') {
    sendJson(response, 200, { name: 'footprint mock tracker', queries: QUERY_DESCRIPTORS.map((query) => query.name) });
    return;
  }

  if (pathname === '/queries') {
    sendJson(response, 200, { queries: QUERY_DESCRIPTORS });
    return;
  }

  const queryMatch = pathname.match(/^\/queries\/([^/]+)$/);
  if (queryMatch) {
    const queryName = decodeURIComponent(queryMatch[1]);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    switch (queryName) {
      case 'recent-footprints': {
        const limit = parseLimit(url.searchParams.get('limit'), 20);
        if (limit.error !== null) {
          sendJson(response, 400, { error: limit.error });
          return;
        }
        sendJson(response, 200, { name: queryName, rows: recentFootprints(limit.value) });
        return;
      }
      case 'footprints-by-day': {
        const error = validateDateRange(from, to);
        if (error !== null) {
          sendJson(response, 400, { error });
          return;
        }
        sendJson(response, 200, { name: queryName, rows: footprintsByDay(from as string, to as string) });
        return;
      }
      case 'unique-visitors-by-day': {
        const error = validateDateRange(from, to);
        if (error !== null) {
          sendJson(response, 400, { error });
          return;
        }
        sendJson(response, 200, { name: queryName, rows: uniqueVisitorsByDay(from as string, to as string) });
        return;
      }
      case 'bots-by-day': {
        const error = validateDateRange(from, to);
        if (error !== null) {
          sendJson(response, 400, { error });
          return;
        }
        sendJson(response, 200, { name: queryName, rows: botsByDay(from as string, to as string) });
        return;
      }
      case 'top-pages': {
        const error = validateDateRange(from, to);
        if (error !== null) {
          sendJson(response, 400, { error });
          return;
        }
        const limit = parseLimit(url.searchParams.get('limit'), 10);
        if (limit.error !== null) {
          sendJson(response, 400, { error: limit.error });
          return;
        }
        const rows = distributeTop(HREF_PATHS, from as string, to as string, 'top-pages', limit.value).map((row) => ({
          href: `${SITE_ORIGIN}${row.name}`,
          footprints: row.footprints,
        }));
        sendJson(response, 200, { name: queryName, rows });
        return;
      }
      case 'top-origins': {
        const error = validateDateRange(from, to);
        if (error !== null) {
          sendJson(response, 400, { error });
          return;
        }
        const limit = parseLimit(url.searchParams.get('limit'), 10);
        if (limit.error !== null) {
          sendJson(response, 400, { error: limit.error });
          return;
        }
        const rows = distributeTop(REFERRER_ORIGINS, from as string, to as string, 'top-origins', limit.value).map((row) => ({
          origin: row.name,
          footprints: row.footprints,
        }));
        sendJson(response, 200, { name: queryName, rows });
        return;
      }
      default:
        sendJson(response, 404, { error: `unknown query: ${queryName}` });
        return;
    }
  }

  sendJson(response, 404, { error: `not found: ${pathname}` });
}

const server = createServer(handleRequest);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-tracker] listening on http://127.0.0.1:${PORT}`);
  console.log(`[mock-tracker] set endpoint in the browser console:`);
  console.log(`  localStorage.setItem('footprint:tracker', 'http://127.0.0.1:${PORT}')`);
});
