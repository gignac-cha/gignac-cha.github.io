import { buildFootprint, parsePayload, toRecord } from './footprints.ts';

// sendBeacon 은 큐 총량을 64KiB 로 제한하므로, 정상적인 footprint 는 이보다 클 수 없습니다.
const MAXIMUM_BODY_BYTES = 64 * 1024;

// footprint 는 text/plain 본문의 CORS-simple 요청으로 도착하므로 CORS 헤더는 일절 필요 없습니다.
// 응답은 클라이언트(sendBeacon/keepalive fetch)가 읽지 않으므로 본문 없는 상태 코드만 돌려줍니다.
// 수신한 발자국은 Pipelines 스트림으로 흘려보내고, 파이프라인이 R2 에 Parquet 로 적재합니다.
export default {
  async fetch(request, environment, context): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/healthz') {
      return new Response('ok');
    }
    if (request.method !== 'POST') {
      return new Response(null, { status: 405 });
    }

    const bodyText = await request.text();
    if (bodyText.length > MAXIMUM_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }
    const payload = parsePayload(bodyText);
    if (!payload) {
      return new Response(null, { status: 400 });
    }

    const footprint = buildFootprint(payload, {
      receivedAt: new Date().toISOString(),
      origin: request.headers.get('Origin') ?? undefined,
      userAgent: request.headers.get('User-Agent') ?? undefined,
      cf: request.cf as Record<string, unknown> | undefined,
    });
    context.waitUntil(environment.STREAM.send([toRecord(footprint)]));

    return new Response(null, { status: 204 });
  },
} satisfies ExportedHandler<Env>;
