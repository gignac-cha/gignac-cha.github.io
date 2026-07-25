import { describe, expect, it } from 'vitest';

import { detectBotEvidence, isBotUserAgent } from './bot-detection.ts';

describe('isBotUserAgent', () => {
  it('covers every hint the tracker uses', () => {
    // One case per entry of BOT_USER_AGENT_HINTS in footprint-tracker-worker/queries.ts. If the
    // server list grows and this one does not, the bot-ratio card and the 🤖 tags disagree — so
    // this test is the lockstep alarm, not a redundancy.
    expect(isBotUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
    expect(isBotUserAgent('some CRAWLER agent')).toBe(true);
    expect(isBotUserAgent('YandexSpider')).toBe(true);
    expect(isBotUserAgent('HeadlessChrome/120.0')).toBe(true);
    expect(isBotUserAgent('SomeScraper/1.0')).toBe(true);
    expect(isBotUserAgent('python-requests/2.32.3')).toBe(true);
    expect(isBotUserAgent('curl/8.7.1')).toBe(true);
    expect(isBotUserAgent('Wget/1.21.4')).toBe(true);
  });

  it('matches case-insensitively as a substring, like ILIKE %hint%', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true);
    expect(isBotUserAgent('PYTHON-REQUESTS/2.0')).toBe(true);
    expect(isBotUserAgent('CURL/8.0')).toBe(true);
  });

  it('does not flag ordinary browser User-Agents', () => {
    expect(
      isBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'),
    ).toBe(false);
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile Safari/604.1')).toBe(false);
  });

  it('treats an absent user_agent as not a bot', () => {
    // The collector writes null when the request carried no User-Agent header, which is the same
    // row the tracker's CASE WHEN scores as ELSE 0.
    expect(isBotUserAgent('')).toBe(false);
    expect(isBotUserAgent(null)).toBe(false);
    expect(isBotUserAgent(undefined)).toBe(false);
  });
});

describe('detectBotEvidence', () => {
  it('prefers the verified category over the User-Agent heuristic', () => {
    // Cloudflare's verdict is an IP/reverse-DNS check against the operator's published ranges, so
    // it outranks a substring match on a header the client controls — and it names the category,
    // which the heuristic never can.
    expect(detectBotEvidence('Search Engine Crawler', 'Googlebot/2.1')).toEqual({
      isBot: true,
      source: 'verified',
      category: 'Search Engine Crawler',
    });
  });

  it('flags a verified bot even when its User-Agent looks human', () => {
    // A verified bot may present an ordinary browser User-Agent (headless rendering crawlers do);
    // without the first signal the row would carry no tag at all.
    expect(
      detectBotEvidence(
        'Monitoring & Analytics',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
      ),
    ).toEqual({ isBot: true, source: 'verified', category: 'Monitoring & Analytics' });
  });

  it('falls back to the heuristic when no category is stored', () => {
    // Null covers both an ordinary visitor AND a row collected before verified_bot_category was
    // selected at all, so it must not be read as "certainly human".
    expect(detectBotEvidence(null, 'curl/8.7.1')).toEqual({
      isBot: true,
      source: 'user-agent',
      category: null,
    });
    expect(detectBotEvidence(undefined, 'python-requests/2.32.3')).toEqual({
      isBot: true,
      source: 'user-agent',
      category: null,
    });
  });

  it('treats a blank category as absent rather than as a category', () => {
    // json_get_str can yield '' as well as null; a tag whose tooltip names nothing is worse than
    // falling through to the heuristic.
    expect(detectBotEvidence('', 'curl/8.7.1').source).toBe('user-agent');
    expect(detectBotEvidence('   ', 'Mozilla/5.0 Chrome/126.0')).toEqual({
      isBot: false,
      source: 'none',
      category: null,
    });
  });

  it('trims the stored category so the tooltip has no stray whitespace', () => {
    expect(detectBotEvidence('  AI Crawler  ', null).category).toBe('AI Crawler');
  });

  it('reports no evidence for an ordinary visit', () => {
    expect(
      detectBotEvidence(null, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile Safari/604.1'),
    ).toEqual({ isBot: false, source: 'none', category: null });
    expect(detectBotEvidence(null, null)).toEqual({ isBot: false, source: 'none', category: null });
  });
});
