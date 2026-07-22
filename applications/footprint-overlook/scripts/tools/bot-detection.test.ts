import { describe, expect, it } from 'vitest';

import { isBotUserAgent } from './bot-detection.ts';

describe('isBotUserAgent', () => {
  it('bot/crawler/spider/headless 를 대소문자 무시로 잡는다', () => {
    expect(isBotUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true);
    expect(isBotUserAgent('some CRAWLER agent')).toBe(true);
    expect(isBotUserAgent('YandexSpider')).toBe(true);
    expect(isBotUserAgent('HeadlessChrome/120.0')).toBe(true);
  });

  it('일반 브라우저 UA 는 봇이 아니다', () => {
    expect(
      isBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'),
    ).toBe(false);
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile Safari/604.1')).toBe(false);
  });

  it('빈 값·비문자열은 봇이 아니다', () => {
    expect(isBotUserAgent('')).toBe(false);
    expect(isBotUserAgent(undefined as unknown as string)).toBe(false);
  });
});
