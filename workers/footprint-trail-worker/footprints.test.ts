import { describe, expect, it } from 'vitest';
import streamSchema from './stream-schema.json';
import { buildFootprint, buildHeaders, parsePayload, toRecord } from './footprints.ts';

const ORIGIN = 'https://gignac-cha.github.io';
const HREF = `${ORIGIN}/cardioid`;
const REFERRER = 'https://news.example/post';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0';
const SEC_CH_UA = '"Chromium";v="141", "Not?A_Brand";v="24"';

// One realistic request, shaped like the live rows the column split was measured against: four
// header names get their own column and two do not, cf carries the four objects that are lifted
// out of it plus scalars that stay behind, and the payload carries all five lifted keys plus
// nested leftovers (screen, colorScheme).
const REQUEST_HEADERS = {
  origin: ORIGIN,
  referer: HREF,
  'user-agent': USER_AGENT,
  'sec-ch-ua': SEC_CH_UA,
  'accept-language': 'ko-KR,ko;q=0.9',
  'content-type': 'text/plain;charset=UTF-8',
};

const CF = {
  country: 'KR',
  colo: 'ICN',
  asn: 3786,
  tlsClientAuth: { certIssuerDN: '', certVerified: 'NONE' },
  tlsExportedAuthenticator: { clientFinished: 'ab', clientHandshake: 'cd', serverHandshake: 'ef', serverFinished: '01' },
  edgeL4: { deliveryRate: 12345 },
  requestHeaderNames: {},
};

const PAYLOAD = {
  uuid: 'u-1',
  arguments: ['cta-click', { plan: 'pro' }],
  location: { href: HREF, pathname: '/cardioid', search: '?utm_source=x', hash: '' },
  document: { referrer: REFERRER, visibilityState: 'visible', characterSet: 'UTF-8' },
  navigator: {
    userAgent: USER_AGENT,
    userAgentHints: { platform: 'macOS', mobile: false },
    language: 'ko',
    languages: ['ko', 'en'],
  },
  screen: { width: 1920, height: 1080 },
  colorScheme: 'dark',
};

const context = { receivedAt: '2026-08-27T00:00:00.000Z', headers: REQUEST_HEADERS, cf: CF };

// The wide schema, spelled out by hand: the columns queries are written against and the order the
// stream schema declares them in. Everything else in this file compares against THIS list, and
// the 'stream-schema.json declares exactly the record columns' test below compares the list
// against the schema file — so a column renamed in footprints.ts alone, or in the schema alone,
// fails here instead of silently sending events Pipelines discards for not matching the stream.
const RECORD_COLUMNS = [
  'received_at',
  'headers',
  'headers_remains',
  'headers__origin',
  'headers__referer',
  'headers__user_agent',
  'headers__sec_ch_ua',
  'cf',
  'cf_remains',
  'cf__tlsClientAuth',
  'cf__tlsExportedAuthenticator',
  'cf__edgeL4',
  'cf__requestHeaderNames',
  'payload',
  'payload_remains',
  'payload__uuid',
  'payload__arguments',
  'payload__location',
  'payload__location__href',
  'payload__document',
  'payload__document__referrer',
  'payload__navigator',
  'payload__navigator__userAgent',
  'payload__navigator__userAgentHints',
];

describe('parsePayload', () => {
  it('parses a JSON object body', () => {
    expect(parsePayload('{"uuid":"u-1","arguments":[]}')).toEqual({ uuid: 'u-1', arguments: [] });
  });

  it('rejects a JSON array', () => {
    expect(parsePayload('[1,2,3]')).toBeUndefined();
  });

  it('rejects JSON primitives', () => {
    expect(parsePayload('42')).toBeUndefined();
    expect(parsePayload('"footprint"')).toBeUndefined();
    expect(parsePayload('null')).toBeUndefined();
  });

  it('rejects invalid JSON', () => {
    expect(parsePayload('{broken')).toBeUndefined();
  });

  it('rejects an empty body', () => {
    expect(parsePayload('')).toBeUndefined();
  });
});

describe('buildHeaders', () => {
  it('lowercases header names', () => {
    const headers = buildHeaders(new Headers({ 'User-Agent': USER_AGENT, 'Sec-CH-UA': SEC_CH_UA }));
    expect(Object.keys(headers).sort()).toEqual(['sec-ch-ua', 'user-agent']);
    expect(headers['user-agent']).toBe(USER_AGENT);
  });

  it('drops the cookie and authorization headers and keeps everything else', () => {
    const headers = buildHeaders(
      new Headers({
        Cookie: 'session=secret-session-value',
        Authorization: 'Bearer secret-token-value',
        Origin: ORIGIN,
        'Accept-Language': 'ko-KR',
      }),
    );
    expect(headers).toEqual({ origin: ORIGIN, 'accept-language': 'ko-KR' });
  });
});

describe('buildFootprint', () => {
  it('carries the request context and the payload through untouched', () => {
    const footprint = buildFootprint(PAYLOAD, context);
    expect(footprint.receivedAt).toBe('2026-08-27T00:00:00.000Z');
    expect(footprint.headers).toBe(REQUEST_HEADERS);
    expect(footprint.cf).toBe(CF);
    // Identity, not equality: the archive column must serialize the body that arrived, so nothing
    // between parsing and toRecord() is allowed to copy or rewrite it.
    expect(footprint.payload).toBe(PAYLOAD);
  });
});

describe('toRecord', () => {
  it('produces the full 24-column row from one source object', () => {
    const record = toRecord(buildFootprint(PAYLOAD, context));
    expect(Object.keys(record)).toEqual(RECORD_COLUMNS);
    expect(record).toEqual({
      received_at: '2026-08-27T00:00:00.000Z',
      // The three verbatim archive columns are the SOURCE serialized — asserted against the
      // fixtures themselves, so promoting a value can never quietly remove it from the archive.
      headers: JSON.stringify(REQUEST_HEADERS),
      headers_remains: '{"accept-language":"ko-KR,ko;q=0.9","content-type":"text/plain;charset=UTF-8"}',
      headers__origin: ORIGIN,
      headers__referer: HREF,
      headers__user_agent: USER_AGENT,
      headers__sec_ch_ua: SEC_CH_UA,
      cf: JSON.stringify(CF),
      cf_remains: '{"country":"KR","colo":"ICN","asn":3786}',
      cf__tlsClientAuth: '{"certIssuerDN":"","certVerified":"NONE"}',
      cf__tlsExportedAuthenticator:
        '{"clientFinished":"ab","clientHandshake":"cd","serverHandshake":"ef","serverFinished":"01"}',
      cf__edgeL4: '{"deliveryRate":12345}',
      cf__requestHeaderNames: '{}',
      payload: JSON.stringify(PAYLOAD),
      payload_remains: '{"screen":{"width":1920,"height":1080},"colorScheme":"dark"}',
      payload__uuid: 'u-1',
      payload__arguments: '["cta-click",{"plan":"pro"}]',
      payload__location: '{"pathname":"/cardioid","search":"?utm_source=x","hash":""}',
      payload__location__href: HREF,
      payload__document: '{"visibilityState":"visible","characterSet":"UTF-8"}',
      payload__document__referrer: REFERRER,
      payload__navigator: '{"language":"ko","languages":["ko","en"]}',
      payload__navigator__userAgent: USER_AGENT,
      payload__navigator__userAgentHints: '{"platform":"macOS","mobile":false}',
    });
  });

  // stream-schema.json is what Cloudflare turns into table columns, and Pipelines DISCARDS an
  // event whose fields do not match it — silently, with no error surfacing in the worker. Reading
  // the file here is the only way that mismatch can fail loudly, in CI, instead of as missing
  // rows in production.
  // See https://developers.cloudflare.com/pipelines/streams/schemas/
  it('stream-schema.json declares exactly the record columns, in order', () => {
    const record = toRecord(buildFootprint(PAYLOAD, context));
    expect(streamSchema.fields.map((field) => field.name)).toEqual(RECORD_COLUMNS);
    expect(streamSchema.fields.map((field) => field.name)).toEqual(Object.keys(record));
    expect(streamSchema.fields.every((field) => field.type === 'string')).toBe(true);
    // Only the two columns that are always written are required: a required column that a record
    // may legitimately leave null would cost the whole event.
    expect(streamSchema.fields.filter((field) => field.required).map((field) => field.name)).toEqual([
      'received_at',
      'payload',
    ]);
  });

  it('stores promoted scalars as raw unquoted strings, ready for direct comparison', () => {
    const record = toRecord(buildFootprint(PAYLOAD, context));
    const scalarColumns: [string | null, string][] = [
      [record.payload__uuid, 'u-1'],
      [record.payload__location__href, HREF],
      [record.payload__document__referrer, REFERRER],
      [record.payload__navigator__userAgent, USER_AGENT],
      [record.headers__origin, ORIGIN],
      [record.headers__referer, HREF],
      [record.headers__user_agent, USER_AGENT],
      [record.headers__sec_ch_ua, SEC_CH_UA],
    ];
    for (const [column, source] of scalarColumns) {
      // `WHERE payload__uuid = 'u-1'` only matches when the column holds u-1 — not "u-1" with the
      // JSON quotes still wrapped around it, which is what serializing these like the container
      // columns would have stored. The comparison is against the raw source rather than a
      // "does not start with a quote" check because Sec-CH-UA's own value legally begins with one
      // (`"Chromium";v="141"` — a structured-header list, RFC 9651 §3.1).
      expect(column).toBe(source);
      expect(column).not.toBe(JSON.stringify(source));
    }
  });

  it('drops a non-string scalar to null instead of storing it quoted', () => {
    const record = toRecord(
      buildFootprint({ uuid: 42, location: { href: 5 }, document: { referrer: null } }, context),
    );
    expect(record.payload__uuid).toBeNull();
    expect(record.payload__location__href).toBeNull();
    expect(record.payload__document__referrer).toBeNull();
    // …and the verbatim archive column still carries what was actually sent.
    expect(JSON.parse(record.payload)).toEqual({ uuid: 42, location: { href: 5 }, document: { referrer: null } });
  });

  it('leaves out of each _remains column exactly the keys that were lifted from it', () => {
    const record = toRecord(buildFootprint(PAYLOAD, context));
    expect(Object.keys(JSON.parse(record.headers_remains))).toEqual(['accept-language', 'content-type']);
    expect(Object.keys(JSON.parse(record.cf_remains as string))).toEqual(['country', 'colo', 'asn']);
    expect(Object.keys(JSON.parse(record.payload_remains))).toEqual(['screen', 'colorScheme']);
    expect(Object.keys(JSON.parse(record.payload__location as string))).toEqual(['pathname', 'search', 'hash']);
    expect(Object.keys(JSON.parse(record.payload__document as string))).toEqual([
      'visibilityState',
      'characterSet',
    ]);
    expect(Object.keys(JSON.parse(record.payload__navigator as string))).toEqual(['language', 'languages']);
  });

  // The split is only safe if it is reversible: this is what makes "the promoted columns are a
  // VIEW of the payload, never a second version of it" a checked fact rather than an intention,
  // and what a backfill out of the old table would rely on.
  it('reassembles the original payload from payload_remains and the lifted columns', () => {
    const record = toRecord(buildFootprint(PAYLOAD, context));
    const reassembled = {
      ...JSON.parse(record.payload_remains),
      uuid: record.payload__uuid,
      arguments: JSON.parse(record.payload__arguments as string),
      location: { href: record.payload__location__href, ...JSON.parse(record.payload__location as string) },
      document: {
        referrer: record.payload__document__referrer,
        ...JSON.parse(record.payload__document as string),
      },
      navigator: {
        userAgent: record.payload__navigator__userAgent,
        userAgentHints: JSON.parse(record.payload__navigator__userAgentHints as string),
        ...JSON.parse(record.payload__navigator as string),
      },
    };
    expect(reassembled).toEqual(PAYLOAD);
    expect(reassembled).toEqual(JSON.parse(record.payload));
  });

  it('reassembles the original headers and cf from their split columns', () => {
    const record = toRecord(buildFootprint(PAYLOAD, context));
    expect({
      ...JSON.parse(record.headers_remains),
      origin: record.headers__origin,
      referer: record.headers__referer,
      'user-agent': record.headers__user_agent,
      'sec-ch-ua': record.headers__sec_ch_ua,
    }).toEqual(REQUEST_HEADERS);
    expect({
      ...JSON.parse(record.cf_remains as string),
      tlsClientAuth: JSON.parse(record.cf__tlsClientAuth as string),
      tlsExportedAuthenticator: JSON.parse(record.cf__tlsExportedAuthenticator as string),
      edgeL4: JSON.parse(record.cf__edgeL4 as string),
      requestHeaderNames: JSON.parse(record.cf__requestHeaderNames as string),
    }).toEqual(CF);
  });

  it('never stores the cookie or authorization header in any column', () => {
    const record = toRecord(
      buildFootprint(PAYLOAD, {
        receivedAt: context.receivedAt,
        headers: buildHeaders(
          new Headers({
            Cookie: 'session=secret-session-value',
            Authorization: 'Bearer secret-token-value',
            Origin: ORIGIN,
          }),
        ),
        cf: CF,
      }),
    );
    const everyColumn = Object.values(record).join('\n').toLowerCase();
    expect(everyColumn).not.toContain('cookie');
    expect(everyColumn).not.toContain('authorization');
    expect(everyColumn).not.toContain('secret-session-value');
    expect(everyColumn).not.toContain('secret-token-value');
    // The rest of the request still made it through — the filter is targeted, not a blanket drop.
    expect(record.headers__origin).toBe(ORIGIN);
  });

  it('leaves all six cf columns null when the request carries no cf (local replay)', () => {
    const record = toRecord(
      buildFootprint(PAYLOAD, { receivedAt: context.receivedAt, headers: REQUEST_HEADERS, cf: undefined }),
    );
    expect(record).toMatchObject({
      cf: null,
      cf_remains: null,
      cf__tlsClientAuth: null,
      cf__tlsExportedAuthenticator: null,
      cf__edgeL4: null,
      cf__requestHeaderNames: null,
    });
    // The payload half of the row is unaffected — a replayed request is still a real footprint.
    expect(record.payload__uuid).toBe('u-1');
  });

  it('leaves cf__tlsExportedAuthenticator null when the handshake did not carry one', () => {
    const { tlsExportedAuthenticator: _omitted, ...cfWithoutAuthenticator } = CF;
    const record = toRecord(
      buildFootprint(PAYLOAD, {
        receivedAt: context.receivedAt,
        headers: REQUEST_HEADERS,
        cf: cfWithoutAuthenticator,
      }),
    );
    expect(record.cf__tlsExportedAuthenticator).toBeNull();
    // Its neighbours are unaffected, and cf_remains still excludes the key that WAS lifted.
    expect(record.cf__tlsClientAuth).toBe('{"certIssuerDN":"","certVerified":"NONE"}');
    expect(Object.keys(JSON.parse(record.cf_remains as string))).toEqual(['country', 'colo', 'asn']);
  });

  it('keeps a malformed container whole instead of dropping it', () => {
    const record = toRecord(
      buildFootprint({ location: 'https://x/', navigator: ['first'], document: null }, context),
    );
    // Nothing can be lifted out of a string or an array, so the value is stored as it arrived and
    // the scalar column below it stays null rather than holding a fragment.
    expect(record.payload__location).toBe('"https://x/"');
    expect(record.payload__location__href).toBeNull();
    expect(record.payload__navigator).toBe('["first"]');
    expect(record.payload__navigator__userAgent).toBeNull();
    // An explicit null is an ABSENT source, not a value to store: the column is null, so
    // `<column> IS NULL` stays the single test a query needs.
    expect(record.payload__document).toBeNull();
  });

  it('maps every absent source to null so the record schema stays stable', () => {
    const record = toRecord(
      buildFootprint({}, { receivedAt: context.receivedAt, headers: {}, cf: undefined }),
    );
    expect(Object.keys(record)).toEqual(RECORD_COLUMNS);
    expect(record).toEqual({
      received_at: context.receivedAt,
      headers: '{}',
      headers_remains: '{}',
      headers__origin: null,
      headers__referer: null,
      headers__user_agent: null,
      headers__sec_ch_ua: null,
      cf: null,
      cf_remains: null,
      cf__tlsClientAuth: null,
      cf__tlsExportedAuthenticator: null,
      cf__edgeL4: null,
      cf__requestHeaderNames: null,
      payload: '{}',
      payload_remains: '{}',
      payload__uuid: null,
      payload__arguments: null,
      payload__location: null,
      payload__location__href: null,
      payload__document: null,
      payload__document__referrer: null,
      payload__navigator: null,
      payload__navigator__userAgent: null,
      payload__navigator__userAgentHints: null,
    });
  });
});
