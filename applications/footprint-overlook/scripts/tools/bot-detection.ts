// Client-side bot classification for the 최근 조회 table: it decides nothing about the data, only
// whether a row gets the 🤖 tag and what that tag says.
//
// TWO SIGNALS, IN THIS ORDER, because they are not the same kind of statement:
//
//   1. cf.verifiedBotCategory — Cloudflare's own verdict, stored on the row at collection time. It
//      is set only for bots Cloudflare has VERIFIED (a reverse-DNS / IP-range check against the
//      operator's published ranges, not a string match), and it names the category ('Search Engine
//      Crawler', 'Monitoring & Analytics', 'AI Crawler', …). When present it is authoritative and
//      unspoofable by the client, so it wins.
//      See https://developers.cloudflare.com/bots/concepts/bot/verified-bots/
//   2. the User-Agent hint list — a substring heuristic over a header anyone can set. It is the
//      fallback, and it has to exist: it is the only signal for unverified bots (a scraper, curl,
//      a headless browser) and for rows collected before verified_bot_category was selected at all,
//      which come back null and must not be read as "certainly human".
//
// The hint list below is a MIRROR of BOT_USER_AGENT_HINTS in
// workers/footprint-tracker-worker/queries.ts and must be kept in lockstep with it. The two run
// on the same column from opposite ends: the tracker applies its list server-side inside
// bots-by-day (SUM(CASE WHEN verified category non-empty OR user_agent ILIKE '%hint%' ... )), which
// is what the bot-ratio summary card shows, while this function applies it row by row in the
// browser. When the lists drift, one screen contradicts the other — the card counts a curl request
// as a bot while its row in the table below carries no tag — and the discrepancy looks like a data
// bug rather than a stale constant. Growing the heuristic therefore means editing BOTH lists (the
// server side is retroactive on the next query, this side on the next render). The verified-category
// signal is likewise part of the server's CASE WHEN, which is what keeps the card and the tags
// agreeing about the same two signals.
//
// Matching mirrors ILIKE '%hint%' exactly: a case-insensitive SUBSTRING test, done by lowercasing
// once and using includes() rather than a regular expression, because hints such as
// 'python-requests' contain characters a hand-built pattern would have to escape.
// See https://developers.cloudflare.com/r2-sql/sql-reference/ for the upstream operator.
// Pinned by 'covers every hint the tracker uses' in bot-detection.test.ts.
const BOT_USER_AGENT_HINTS = [
  'bot',
  'crawler',
  'spider',
  'headless',
  'scraper',
  'python-requests',
  'curl',
  'wget',
] as const;

// True when the User-Agent matches any hint. A missing or non-string user_agent is NOT a bot:
// the trail collector stores null when the header is absent (see toRecord in
// footprint-trail-worker/footprints.ts), and that is exactly the ELSE 0 branch the tracker's
// CASE WHEN takes for a NULL column — so both sides agree on "unknown is not a bot".
// Pinned by 'treats an absent user_agent as not a bot' in bot-detection.test.ts.
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (typeof userAgent !== 'string' || userAgent.length === 0) {
    return false;
  }
  const lowercased = userAgent.toLowerCase();
  return BOT_USER_AGENT_HINTS.some((hint) => lowercased.includes(hint));
}

// Which signal flagged a row, so the tag can say how confident it is.
// - 'verified': Cloudflare verified the bot and named the category.
// - 'user-agent': the heuristic matched; the category is unknown.
// - 'none': neither signal fired.
export type BotEvidenceSource = 'verified' | 'user-agent' | 'none';

export interface BotEvidence {
  isBot: boolean;
  source: BotEvidenceSource;
  // The verified category, present only for source === 'verified'. Kept separate from the boolean
  // so the table can put it in the tooltip without re-reading the row.
  category: string | null;
}

// Resolves the two signals into one verdict for a recent-footprints row.
//
// An empty-or-blank verified category counts as absent, not as a category: the column is a string
// coming out of json_get_str, and '' would otherwise produce a tag whose tooltip names nothing.
// Pinned by the 'detectBotEvidence' suite in bot-detection.test.ts.
export function detectBotEvidence(
  verifiedBotCategory: string | null | undefined,
  userAgent: string | null | undefined,
): BotEvidence {
  if (typeof verifiedBotCategory === 'string' && verifiedBotCategory.trim().length > 0) {
    return { isBot: true, source: 'verified', category: verifiedBotCategory.trim() };
  }
  if (isBotUserAgent(userAgent)) {
    return { isBot: true, source: 'user-agent', category: null };
  }
  return { isBot: false, source: 'none', category: null };
}
