import { describe, expect, it } from 'vitest';
import { buildFootprint, parsePayload, toRecord } from './footprints.ts';

const context = {
  receivedAt: '2026-07-17T00:00:00.000Z',
  origin: 'https://gignac-cha.github.io',
  userAgent: 'test-agent',
  cf: { country: 'KR' },
};

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

describe('buildFootprint', () => {
  it('extracts uuid, href and arguments from the payload', () => {
    const footprint = buildFootprint(
      {
        uuid: 'u-1',
        arguments: ['cta-click', { plan: 'pro' }],
        location: { href: 'https://gignac-cha.github.io/cardioid' },
      },
      context,
    );
    expect(footprint.uuid).toBe('u-1');
    expect(footprint.href).toBe('https://gignac-cha.github.io/cardioid');
    expect(footprint.arguments_).toEqual(['cta-click', { plan: 'pro' }]);
  });

  it('copies the request context verbatim', () => {
    const footprint = buildFootprint({}, context);
    expect(footprint.receivedAt).toBe('2026-07-17T00:00:00.000Z');
    expect(footprint.origin).toBe('https://gignac-cha.github.io');
    expect(footprint.userAgent).toBe('test-agent');
    expect(footprint.cf).toEqual({ country: 'KR' });
  });

  it('keeps the entire payload for storage', () => {
    const payload = { uuid: 'u-1', navigator: { language: 'ko' }, colorScheme: 'dark' };
    expect(buildFootprint(payload, context).payload).toBe(payload);
  });

  it('ignores a non-string uuid', () => {
    expect(buildFootprint({ uuid: 42 }, context).uuid).toBeUndefined();
  });

  it('defaults arguments to an empty array when absent or malformed', () => {
    expect(buildFootprint({}, context).arguments_).toEqual([]);
    expect(buildFootprint({ arguments: 'not-an-array' }, context).arguments_).toEqual([]);
  });

  it('leaves href undefined when location is absent or malformed', () => {
    expect(buildFootprint({}, context).href).toBeUndefined();
    expect(buildFootprint({ location: 'https://x/' }, context).href).toBeUndefined();
    expect(buildFootprint({ location: { pathname: '/' } }, context).href).toBeUndefined();
  });
});

describe('toRecord', () => {
  it('flattens a footprint into a stream record with JSON-string columns', () => {
    const payload = { uuid: 'u-1', arguments: ['cta-click', 1], location: { href: 'https://x/' } };
    const record = toRecord(buildFootprint(payload, context));
    expect(record).toMatchObject({
      received_at: '2026-07-17T00:00:00.000Z',
      uuid: 'u-1',
      origin: 'https://gignac-cha.github.io',
      href: 'https://x/',
      user_agent: 'test-agent',
    });
    expect(JSON.parse(record.arguments)).toEqual(['cta-click', 1]);
    expect(JSON.parse(record.cf as string)).toEqual({ country: 'KR' });
    expect(JSON.parse(record.payload)).toEqual(payload);
  });

  it('maps missing optional fields to null so the record schema stays stable', () => {
    const record = toRecord(
      buildFootprint({}, { receivedAt: context.receivedAt, origin: undefined, userAgent: undefined, cf: undefined }),
    );
    expect(record).toMatchObject({ uuid: null, origin: null, href: null, user_agent: null, cf: null });
    expect(record.arguments).toBe('[]');
    expect(record.payload).toBe('{}');
  });
});
