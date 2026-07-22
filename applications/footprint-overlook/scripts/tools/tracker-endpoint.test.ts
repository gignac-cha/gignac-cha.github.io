import { describe, expect, it } from 'vitest';

import { isValidTrackerEndpoint, normalizeTrackerEndpoint } from './tracker-endpoint.ts';

// read/write 는 localStorage(브라우저 전용)를 만지므로 여기서는 순수한 normalize/validate 만 검증합니다.

describe('normalizeTrackerEndpoint', () => {
  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeTrackerEndpoint('  http://127.0.0.1:8788  ')).toBe('http://127.0.0.1:8788');
  });

  it('뒤따르는 슬래시를 제거한다', () => {
    expect(normalizeTrackerEndpoint('http://127.0.0.1:8788/')).toBe('http://127.0.0.1:8788');
    expect(normalizeTrackerEndpoint('http://127.0.0.1:8788///')).toBe('http://127.0.0.1:8788');
  });

  it('경로가 있으면 경로는 보존하고 끝 슬래시만 뗀다', () => {
    expect(normalizeTrackerEndpoint('https://tracker.example.com/api/')).toBe('https://tracker.example.com/api');
  });
});

describe('isValidTrackerEndpoint', () => {
  it('http/https 절대 URL 을 허용한다', () => {
    expect(isValidTrackerEndpoint('http://127.0.0.1:8788')).toBe(true);
    expect(isValidTrackerEndpoint('https://tracker.example.com')).toBe(true);
  });

  it('빈 값·스킴 없는 값·다른 스킴은 거부한다', () => {
    expect(isValidTrackerEndpoint('')).toBe(false);
    expect(isValidTrackerEndpoint('   ')).toBe(false);
    expect(isValidTrackerEndpoint('127.0.0.1:8788')).toBe(false);
    expect(isValidTrackerEndpoint('ftp://example.com')).toBe(false);
    expect(isValidTrackerEndpoint('not a url')).toBe(false);
  });
});
