import { describe, expect, it } from 'vitest';

import { classifyReferrer, groupReferrersByCategory } from './referrer-classification.ts';

describe('classifyReferrer', () => {
  it('classifies null or empty as Direct', () => {
    expect(classifyReferrer(null)).toBe('Direct');
    expect(classifyReferrer('')).toBe('Direct');
    expect(classifyReferrer('   ')).toBe('Direct');
  });

  it('classifies AI referrers', () => {
    expect(classifyReferrer('https://chatgpt.com/')).toBe('AI');
    expect(classifyReferrer('https://perplexity.ai/search')).toBe('AI');
    expect(classifyReferrer('https://gemini.google.com/app')).toBe('AI');
    expect(classifyReferrer('https://claude.ai/chat')).toBe('AI');
    expect(classifyReferrer('https://copilot.microsoft.com/')).toBe('AI');
  });

  it('classifies gemini.google.com as AI, not Search, despite being a google.com subdomain', () => {
    expect(classifyReferrer('https://gemini.google.com/app')).toBe('AI');
    expect(classifyReferrer('https://www.google.com/search?q=x')).toBe('Search');
  });

  it('classifies Search referrers', () => {
    expect(classifyReferrer('https://www.google.com/')).toBe('Search');
    expect(classifyReferrer('https://search.naver.com/')).toBe('Search');
  });

  it('classifies Social referrers', () => {
    expect(classifyReferrer('https://github.com/')).toBe('Social');
    expect(classifyReferrer('https://x.com/')).toBe('Social');
    expect(classifyReferrer('https://news.ycombinator.com/')).toBe('Social');
  });

  it('classifies unknown referrer as Other', () => {
    expect(classifyReferrer('https://random-tech-blog.org/article')).toBe('Other');
  });

  it('does not match a hostname that merely contains a dictionary domain as a substring (max.com vs x.com)', () => {
    expect(classifyReferrer('https://max.com/')).toBe('Other');
  });

  it('does not match a dictionary domain appearing in the URL path, only the hostname', () => {
    // A Wikipedia article about the company "X.com" -- not a referral from x.com.
    expect(classifyReferrer('https://en.wikipedia.org/wiki/X.com')).toBe('Other');
  });

  it('does not match a hostname that merely ends with a dictionary domain\'s letters, not a real subdomain', () => {
    expect(classifyReferrer('https://mygoogle.company.com/')).toBe('Other');
  });

  it('does not classify a dictionary domain appearing only in the query string as a match', () => {
    expect(classifyReferrer('https://example.com/?ref=chatgpt.com')).toBe('Other');
    // A referrer that is only a query string (no scheme/host at all) falls back to treating the
    // whole string as the hostname candidate, which also does not equal or end with 'chatgpt.com'.
    expect(classifyReferrer('?ref=chatgpt.com')).toBe('Other');
  });

  it('classifies case-insensitively', () => {
    expect(classifyReferrer('HTTPS://CHATGPT.COM/')).toBe('AI');
    expect(classifyReferrer('HTTPS://WWW.GOOGLE.COM/')).toBe('Search');
  });

  it('falls back to treating a schemeless referrer as a bare hostname', () => {
    expect(classifyReferrer('chatgpt.com')).toBe('AI');
  });
});

describe('groupReferrersByCategory', () => {
  it('groups referrers by category and sums views', () => {
    const rows = [
      { referrer: null, views: 10 },
      { referrer: '', views: 5 },
      { referrer: 'https://chatgpt.com/', views: 8 },
      { referrer: 'https://www.google.com/', views: 20 },
    ];

    expect(groupReferrersByCategory(rows)).toEqual([
      { category: 'Direct', views: 15 },
      { category: 'Search', views: 20 },
      { category: 'Social', views: 0 },
      { category: 'AI', views: 8 },
      { category: 'Other', views: 0 },
    ]);
  });

  it('keeps zero-view categories instead of dropping them (honest zero)', () => {
    const rows = [{ referrer: null, views: 3 }];

    expect(groupReferrersByCategory(rows)).toEqual([
      { category: 'Direct', views: 3 },
      { category: 'Search', views: 0 },
      { category: 'Social', views: 0 },
      { category: 'AI', views: 0 },
      { category: 'Other', views: 0 },
    ]);
  });
});
