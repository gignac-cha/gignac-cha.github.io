// Classification dictionary for grouping traffic referrers into categories:
// Direct (null / empty), Search, Social, AI, Other.

export type TrafficCategory = 'Direct' | 'Search' | 'Social' | 'AI' | 'Other';

const AI_DOMAINS = ['chatgpt.com', 'perplexity.ai', 'gemini.google.com', 'claude.ai', 'copilot.microsoft.com'];

const SEARCH_DOMAINS = [
  'google.com',
  'google.co.kr',
  'bing.com',
  'search.naver.com',
  'naver.com',
  'daum.net',
  'search.daum.net',
  'yahoo.com',
  'duckduckgo.com',
  'ecosia.org',
];

const SOCIAL_DOMAINS = [
  'twitter.com',
  'x.com',
  't.co',
  'github.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'reddit.com',
  'news.ycombinator.com',
  'threads.net',
  'bsky.app',
];

// Extracts the hostname to match against the domain dictionaries below. `new URL()` is required
// (rather than substring matching on the raw referrer string) because a referrer like
// 'https://max.com/' must never match the 'x.com' dictionary entry just because the text "x.com"
// happens to appear inside "max.com", and 'https://en.wikipedia.org/wiki/X.com' (a Wikipedia
// article about the company X, not a referral from it) must not match on its path either. See
// https://developer.mozilla.org/en-US/docs/Web/API/URL/hostname
// When the referrer is not a well-formed absolute URL (some browsers/extensions report a bare
// hostname with no scheme), the raw trimmed, lowercased string is used as the hostname candidate
// instead of silently discarding the referrer as unclassifiable Direct traffic.
function extractHostname(referrer: string): string {
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return referrer.trim().toLowerCase();
  }
}

// A hostname matches a dictionary domain only on an exact match or a proper subdomain match
// (hostname ends with '.' + domain). This is what keeps 'mygoogle.company.com' out of the Search
// bucket even though it shares a label with 'google.com', while still classifying
// 'search.naver.com' under its own dictionary entry.
function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function classifyReferrer(referrer: string | null): TrafficCategory {
  if (referrer === null || referrer.trim().length === 0) {
    return 'Direct';
  }

  const hostname = extractHostname(referrer);

  // AI must be checked before Search: gemini.google.com is a proper subdomain of google.com, so
  // it would otherwise always be caught by the Search dictionary's 'google.com' entry first.
  for (const domain of AI_DOMAINS) {
    if (hostnameMatchesDomain(hostname, domain)) {
      return 'AI';
    }
  }

  for (const domain of SEARCH_DOMAINS) {
    if (hostnameMatchesDomain(hostname, domain)) {
      return 'Search';
    }
  }

  for (const domain of SOCIAL_DOMAINS) {
    if (hostnameMatchesDomain(hostname, domain)) {
      return 'Social';
    }
  }

  return 'Other';
}

export function groupReferrersByCategory<Row extends { referrer: string | null; views: number }>(
  rows: ReadonlyArray<Row>,
): Array<{ category: TrafficCategory; views: number }> {
  const categoryTotals = new Map<TrafficCategory, number>();

  for (const row of rows) {
    const category = classifyReferrer(row.referrer);
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + row.views);
  }

  // Every category is always present in the result, including ones with zero views: silently
  // dropping a category when it happened to receive no traffic in this range would read as "this
  // dashboard doesn't track that category" rather than the honest "zero, this time."
  const categoryOrder: TrafficCategory[] = ['Direct', 'Search', 'Social', 'AI', 'Other'];
  return categoryOrder.map((category) => ({
    category,
    views: categoryTotals.get(category) ?? 0,
  }));
}
