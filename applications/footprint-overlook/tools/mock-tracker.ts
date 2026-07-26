// Dependency-free mock of footprint-tracker, so the dashboard can be developed without deploying
// the worker or waiting for real traffic to reach the Iceberg table.
//
//   run:      node tools/mock-tracker.ts        (Node v25+ native TypeScript, port 8788)
//   browser:  localStorage.setItem('footprint:tracker', 'http://127.0.0.1:8788')
//
// THE rule for this file: where it differs from workers/footprint-tracker-worker, the difference
// is a bug. A mock that is merely "close enough" is worse than none — it trains the viewer against
// behavior that does not exist, and the divergence only surfaces after deployment. The behaviours
// mirrored deliberately, each of which the obvious mock implementation gets wrong:
//   - the catalog is built exactly as the worker builds its own (a CATALOG array plus an
//     include_owner descriptor appended programmatically), and GET /queries strips only the
//     row-producing function — the same shape listQueries() serves;
//   - parameters are validated by ONE generic routine driven by those descriptors, not per query,
//     because the worker's validateParameters() is generic too and per-query validation is exactly
//     how a mock drifts;
//   - out-of-range integers are CLAMPED, not rejected (validateParameters in queries.ts), so
//     ?limit=9999 answers 200 with the maximum rather than 400;
//   - integers must be plain decimal (/^-?\d+$/), so '1e2' and '0x1f' are rejected even though
//     Number() would happily accept them;
//   - the limit ceiling differs per query: 100 for recent-footprints, 50 for every top-* one;
//   - include_owner accepts EXACTLY 'true' or 'false'; anything else is a 400, never a guess;
//   - error texts are the worker's own strings, because the viewer displays them verbatim, and the
//     fault split is the worker's too: a bad parameter is 400 (ParameterError) while a malformed
//     OWNER_UUIDS entry is the operator's mistake and answers 502 (ConfigurationError);
//   - CORS headers appear ONLY on /queries and /queries/*, only for an origin that matches the
//     allowlist EXACTLY, and Vary: Origin is always sent. A wildcard here (the usual mock
//     shortcut) would hide exactly the misconfiguration the setup card's probe exists to catch;
//   - /, /help, /health, HEAD and OPTIONS exist and behave as the worker's do.
//
// The data itself is seeded and therefore deterministic: the same day always yields the same
// numbers, so a screenshot or a failing render can be reproduced. Roughly 90 days of small-blog
// traffic with a weekly rhythm and some zero days, which is what exercises the viewer's zero-fill.
// Every dimension the v2 dashboard draws has a catalog below WITH its null bucket populated
// (referrer, country, platform, colour scheme, language, screen width), because "null" is a real
// answer from the worker — json_get_* returns it for any absent JSON path — and a mock without
// nulls lets the string "null" reach the DOM unnoticed.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { isBotUserAgent } from '../scripts/tools/bot-detection.ts';
import { enumerateDays, formatUTCDate, parseUTCDate } from '../scripts/tools/date-ranges.ts';

const PORT = 8788;

// Bind address. The default is loopback on purpose — a mock server should not appear on the local
// network unless someone asks for it — but testing the viewer from another device (a phone, a
// second machine) needs a reachable address, so HOST=0.0.0.0 opts in. Note that the viewer's
// origin changes with it (http://<lan-ip>:5173), which must then be present in VIEWER_ORIGINS
// below or every request is CORS-blocked.
const HOST = process.env.HOST ?? '127.0.0.1';

// The origin of the tracked site — i.e. the value the collector reads from the Origin header.
const SITE_ORIGIN = 'https://gignac-cha.github.io';

// Origins allowed to READ this mock, mirroring the worker's VIEWER_ORIGINS var (comma-separated).
// The two vite dev-server addresses by default; override to match a different dev port.
const VIEWER_ORIGINS = (process.env.VIEWER_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

// Every method this mock answers, served as Allow on OPTIONS and on every 405 (RFC 9110 §15.5.6
// requires the header on a 405). See https://www.rfc-editor.org/rfc/rfc9110.html#name-405-method-not-allowed
const ALLOWED_METHODS = 'GET, HEAD, OPTIONS';

// ----------------------------------------------------------------------------
// Seeded randomness — a string seed always reproduces the same values.
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
    // Linear congruential generator: tiny, and identical across platforms and Node versions.
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

// One draw from a fixed seed string — for the many places that need a single stable number rather
// than a stream.
function seededValue(seed: string): number {
  return createSeededRandom(hashString(seed))();
}

// ----------------------------------------------------------------------------
// Catalogs — every dimension the dashboard groups by, with the share of traffic each value gets.
//
// These are GROUP BY results on the wire, so a value may appear at most once per query: a catalog
// with a repeated key would draw several bars for one label, which the real tracker can never do.
// The weights matter as much as the values — real analytics are dominated by one or two buckets
// with a long tail, and a mock with an even spread makes every ranked panel look wrong-but-pretty.
// ----------------------------------------------------------------------------
interface DistributionEntry {
  // The grouped value exactly as the worker would return it, including null for "no value" — see
  // the null-bucket note in the file header.
  name: string | null;
  // Relative share; 1 when omitted.
  weight?: number;
}

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

// What the `origin` column can actually hold.
//
// It is the Origin HEADER of the collecting request, so it names the site that sent the footprint
// — never a referrer, which lives in payload.document.referrer and has its own catalog below. In
// practice that means the tracked site for almost everything, occasionally a local preview of it,
// and null for clients that send no Origin header (bots, curl, anything server-side). Filling this
// list with search engines and social networks, as a referrer-shaped mock would, invents a
// dimension this column does not have.
const ORIGIN_DISTRIBUTION: DistributionEntry[] = [
  { name: SITE_ORIGIN, weight: 12 },
  { name: 'http://localhost:4173', weight: 1 },
  { name: null, weight: 3 },
];

// payload.document.referrer, which has TWO empty-ish values with different meanings and both must
// be here: '' is what the browser reports for a direct visit (typed URL, bookmark, or a referrer
// the source suppressed), while null is a row whose payload predates the field. The viewer folds
// them into one 직접 유입·미상 bucket, but it can only be trusted to do so if the mock actually
// sends both. See https://developer.mozilla.org/en-US/docs/Web/API/Document/referrer
const REFERRER_DISTRIBUTION: DistributionEntry[] = [
  { name: '', weight: 10 },
  { name: 'https://www.google.com/', weight: 6 },
  { name: 'https://github.com/', weight: 3 },
  { name: 'https://news.ycombinator.com/', weight: 2 },
  { name: 'https://x.com/', weight: 1 },
  { name: null, weight: 2 },
];

// cf.country — Cloudflare's edge geolocation (ISO 3166-1 alpha-2), null when the request carried
// no cf metadata at all. Heavily KR because that is what a Korean personal site looks like; the
// point of the tail is to prove the viewer's Intl.DisplayNames mapping runs on more than one code.
const COUNTRY_DISTRIBUTION: DistributionEntry[] = [
  { name: 'KR', weight: 14 },
  { name: 'US', weight: 4 },
  { name: 'JP', weight: 2 },
  { name: 'DE', weight: 1 },
  { name: 'SG', weight: 1 },
  { name: null, weight: 2 },
];

interface PlatformEntry extends DistributionEntry {
  // json_get_bool(payload, 'navigator', 'userAgentHints', 'mobile') — null travels with a null
  // platform, because a browser without navigator.userAgentData reports neither.
  mobile: boolean | null;
}

// payload.navigator.userAgentHints.{platform,mobile}, the low-entropy User-Agent Client Hints. The
// null row is not padding: Safari and Firefox do not implement navigator.userAgentData at all, so
// on a real site the "did not report" bucket is one of the largest.
// See https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData
const PLATFORM_DISTRIBUTION: PlatformEntry[] = [
  { name: 'macOS', mobile: false, weight: 6 },
  { name: 'Windows', mobile: false, weight: 5 },
  { name: 'Android', mobile: true, weight: 4 },
  { name: 'Linux', mobile: false, weight: 1 },
  { name: null, mobile: null, weight: 5 },
];

// payload.colorScheme — the resolved prefers-color-scheme media query, or null for a client that
// could not answer it (a non-browser collector, an older payload).
const COLOR_SCHEME_DISTRIBUTION: DistributionEntry[] = [
  { name: 'dark', weight: 6 },
  { name: 'light', weight: 4 },
  { name: null, weight: 1 },
];

// payload.navigator.language — the single preferred BCP 47 tag, not the languages array.
const LANGUAGE_DISTRIBUTION: DistributionEntry[] = [
  { name: 'ko-KR', weight: 14 },
  { name: 'en-US', weight: 4 },
  { name: 'ko', weight: 2 },
  { name: 'ja-JP', weight: 1 },
  { name: 'en-GB', weight: 1 },
  { name: null, weight: 1 },
];

// The width buckets the worker's CASE WHEN assigns — stable identifiers, never display strings
// (the Korean labels live in the viewer's dimension-labels.ts). The null bucket is what a payload
// with no screen.width produces, since a CASE with no matching branch evaluates to NULL.
const WIDTH_BUCKET_DISTRIBUTION: DistributionEntry[] = [
  { name: 'under-600', weight: 4 },
  { name: '600-to-1023', weight: 2 },
  { name: '1024-to-1439', weight: 5 },
  { name: '1440-to-1919', weight: 6 },
  { name: '1920-and-above', weight: 3 },
  { name: null, weight: 1 },
];

const USER_AGENTS: (string | null)[] = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  // Bot User-Agents, one per family the shared heuristic knows, so the table's bot tags and the
  // bot-ratio card are actually exercised.
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36',
  'curl/8.7.1',
  'python-requests/2.32.3',
  // A request that carried no User-Agent header at all: the collector stores null.
  null,
];

// cf.verifiedBotCategory as Cloudflare spells it. Only bots Cloudflare has VERIFIED get one, which
// is why the category is a much stronger signal than a User-Agent substring and why the worker ORs
// the two. See https://developers.cloudflare.com/bots/concepts/bot/#verified-bots
const VERIFIED_BOT_CATEGORY_DISTRIBUTION: DistributionEntry[] = [
  { name: 'Search Engine Crawler', weight: 8 },
  { name: 'Monitoring & Analytics', weight: 3 },
  { name: 'Feed Fetcher', weight: 2 },
  { name: 'AI Crawler', weight: 2 },
  { name: 'Advertising & Marketing', weight: 1 },
];

// `arguments` as the trail worker stores it: the JSON array string of a footprint(...arguments_)
// call. The empty array is deliberately ABSENT — top-events filters `arguments != '[]'` server
// side, so an empty row could never come back from that query.
const EVENT_DISTRIBUTION: DistributionEntry[] = [
  { name: JSON.stringify(['click', 'nav-home']), weight: 6 },
  { name: JSON.stringify(['scroll-depth', '75%']), weight: 4 },
  { name: JSON.stringify(['search', 'typescript']), weight: 3 },
  { name: JSON.stringify(['share', 'twitter']), weight: 2 },
  { name: JSON.stringify(['theme', 'dark']), weight: 2 },
  { name: JSON.stringify(['download', 'resume.pdf']), weight: 1 },
];

// Everything a recent row may carry as `arguments`, which unlike the catalog above DOES include
// the empty array: a plain page view is the common case there.
const ARGUMENT_SAMPLES: string[] = ['[]', ...EVENT_DISTRIBUTION.map((entry) => entry.name as string)];

// Relative traffic per UTC hour. The shape is the whole point: the audience is Korean (UTC+9), so
// the local evening peak (20:00 KST) lands at 11:00 UTC and the Korean night sits at 18–23 UTC.
// A flat curve would let an hour-of-day panel look correct while proving nothing, and it would
// hide the one mistake this panel exists to catch — a viewer that quietly re-buckets into local
// time and shifts the peak by nine hours.
const HOUR_WEIGHTS = [
  // 00–05 UTC = 09–14 KST: the working morning, ramping up.
  3, 4, 5, 6, 7, 6,
  // 06–11 UTC = 15–20 KST: afternoon into the evening peak.
  7, 8, 9, 10, 12, 11,
  // 12–17 UTC = 21–02 KST: the evening tail, falling into the night.
  9, 7, 5, 3, 2, 1,
  // 18–23 UTC = 03–08 KST: the Korean night floor, lifted a little by other time zones.
  1, 1, 2, 2, 3, 3,
];

// ----------------------------------------------------------------------------
// Deterministic per-day numbers
// ----------------------------------------------------------------------------
// The site owner's own visits for one day. They exist only when OWNER_UUIDS is configured, and
// they are ADDED on top of the public numbers rather than carved out of them: the default answer
// (owner excluded) must be the plain seeded dataset, so turning the feature on in the mock changes
// nothing until a caller asks for include_owner=true — exactly the direction the worker behaves in.
function dayOwnerFootprints(day: string): number {
  return Math.round(4 * seededValue(`owner:${day}`));
}

function dayFootprints(day: string, withOwner: boolean): number {
  const random = createSeededRandom(hashString(`footprints:${day}`));
  // UTC weekday, matching the UTC day keys the tracker returns.
  const weekday = parseUTCDate(day).getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const weekendFactor = weekday === 0 || weekday === 6 ? 0.6 : 1;

  const base = 8 + 34 * random(); // 8..42
  const noisy = base * weekendFactor + (random() - 0.5) * 12;
  const rounded = Math.max(0, Math.round(noisy));
  const owner = withOwner ? dayOwnerFootprints(day) : 0;

  // ~8% of days have no footprints at all, so the by-day responses contain gaps and the viewer's
  // zero-fill is exercised rather than assumed.
  if (random() < 0.08) {
    return owner;
  }
  return Math.min(50, rounded) + owner;
}

function dayVisitors(day: string, footprints: number): number {
  if (footprints === 0) {
    return 0;
  }
  const random = createSeededRandom(hashString(`visitors:${day}`));
  const ratio = 0.45 + 0.3 * random(); // uniques are 45-75% of footprints
  return Math.max(1, Math.min(footprints, Math.round(footprints * ratio)));
}

// Bots the User-Agent heuristic catches: 10-28% of a day's total.
function dayHeuristicBotFootprints(day: string, footprints: number): number {
  if (footprints === 0) {
    return 0;
  }
  return Math.min(footprints, Math.round(footprints * (0.1 + 0.18 * seededValue(`bots:${day}`))));
}

// Bots the heuristic MISSES but Cloudflare has verified. Modelled as disjoint from the heuristic
// slice on purpose: a well-behaved verified crawler can carry a perfectly ordinary User-Agent, and
// that gap is the entire reason the worker ORs cf.verifiedBotCategory into the bot CASE instead of
// trusting the substring list alone. Because it is disjoint, the same number is what
// verified-bot-categories distributes over its categories — so the two panels always agree.
function dayVerifiedBotFootprints(day: string, footprints: number): number {
  if (footprints === 0) {
    return 0;
  }
  return Math.round(footprints * (0.03 + 0.09 * seededValue(`verified-bots:${day}`)));
}

function dayBotFootprints(day: string, footprints: number): number {
  return Math.min(
    footprints,
    dayHeuristicBotFootprints(day, footprints) + dayVerifiedBotFootprints(day, footprints),
  );
}

// Total footprints in [from, to) — the pool every dimensional list is distributed from.
function sumFootprintsInRange(from: string, to: string, withOwner: boolean): number {
  return enumerateDays(from, to).reduce((total, day) => total + dayFootprints(day, withOwner), 0);
}

// Views and distinct visitors for a whole [from, to) period, using the SAME formula period-summary
// answers with: views is a plain sum of daily footprints, but visitors is deliberately SMALLER than
// the sum of the daily distinct counts (~55-75% of it), because a visitor who returns on three days
// counts once in a period total and three times across the days. Any other query that needs a
// period-wide visitor figure (visit-depth's bucket total, for one) MUST reuse this exact function
// rather than re-deriving its own estimate, or the two panels would report different visitor counts
// for the same range and disagree about a number that has exactly one correct answer. Views is 0 in
// an empty range and visitors follows it to 0 too — no floor, because a period with no traffic has
// no visitors, ghost or otherwise.
function computePeriodVisitors(
  from: string,
  to: string,
  withOwner: boolean,
): { views: number; visitors: number } {
  const days = enumerateDays(from, to);
  const views = days.reduce((total, day) => total + dayFootprints(day, withOwner), 0);
  const dailyVisitorSum = days.reduce(
    (total, day) => total + dayVisitors(day, dayFootprints(day, withOwner)),
    0,
  );
  const visitors =
    views === 0
      ? 0
      : Math.max(1, Math.min(views, Math.round(dailyVisitorSum * (0.55 + 0.2 * seededValue(`period:${from}:${to}`)))));
  return { views, visitors };
}

// Splits an integer total across weights so the parts sum to EXACTLY the total (largest remainder
// method: floor every ideal share, then hand the leftover units to the largest fractional parts).
// Rounding each bucket independently — the obvious implementation — drifts by up to one unit per
// bucket, so a 24-bin hour histogram could claim ~594 views in a period that only has 577, and the
// real GROUP BY queries this mock stands in for can never do that: they partition actual rows.
// Every dimensional query below allocates through this so the mock reconciles like the worker.
// See https://en.wikipedia.org/wiki/Largest_remainder_method
function allocateExactly(weights: ReadonlyArray<number>, total: number): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0 || total <= 0) {
    return weights.map(() => 0);
  }
  const idealShares = weights.map((weight) => (total * weight) / weightSum);
  const counts = idealShares.map((share) => Math.floor(share));
  let leftover = total - counts.reduce((sum, count) => sum + count, 0);
  const byFraction = idealShares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((left, right) => right.fraction - left.fraction);
  for (const { index } of byFraction) {
    if (leftover <= 0) {
      break;
    }
    counts[index] += 1;
    leftover -= 1;
  }
  return counts;
}

// Distributes a period total over a catalog using seeded weights, highest first. An optional
// per-entry weight biases the share; the jitter is multiplicative and bounded to 0.35..1.35 rather
// than the bare 0..1 of the generator, because with a full-range factor a heavily weighted entry
// can still be drawn near zero — the dominant bucket would then sometimes rank below the rare ones
// and the mock would contradict itself between a ranking and the recent table. Bounded jitter
// keeps the order stable while leaving unweighted catalogs (the pages) a visible ~4x spread.
// Allocation goes through allocateExactly(), so before the LIMIT is applied the bucket counts sum
// to exactly `total` — dropping buckets past the limit may then show less than the total, which is
// precisely what the worker's ORDER BY ... LIMIT does too.
function distributeTotal<Entry extends DistributionEntry>(
  catalog: ReadonlyArray<Entry>,
  total: number,
  seed: string,
  limit: number,
): (Entry & { count: number })[] {
  const weighted = catalog.map((entry) => ({
    entry,
    weight: (0.35 + seededValue(`${seed}:${String(entry.name)}`)) * (entry.weight ?? 1),
  }));
  const counts = allocateExactly(weighted.map((item) => item.weight), total);

  return weighted
    .map((item, index) => ({ ...item.entry, count: counts[index] }))
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}

// Distinct visitors behind a given view count, for the dimensional queries that report both.
// Always <= views, and never 0 while views > 0 — a bucket with traffic had at least one visitor.
function visitorsForViews(views: number, seed: string): number {
  if (views === 0) {
    return 0;
  }
  return Math.max(1, Math.min(views, Math.round(views * (0.45 + 0.3 * seededValue(seed)))));
}

// Roulette-wheel pick over a weighted catalog, for the row-level queries: the recent table and the
// ranked lists must tell the same story, so both draw from the same distributions.
function pickWeighted<Entry extends DistributionEntry>(
  catalog: ReadonlyArray<Entry>,
  sample: number,
): Entry {
  const totalWeight = catalog.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  let cursor = sample * totalWeight;
  for (const entry of catalog) {
    cursor -= entry.weight ?? 1;
    if (cursor <= 0) {
      return entry;
    }
  }
  return catalog[catalog.length - 1];
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

// A small, fixed pool of visitor uuids for recent-footprints, generated once from ITS OWN seed
// stream (independent of the per-row `random` used while building each row) and then assigned
// cyclically by row index — see the comment at its use site for why a per-row random uuid cannot
// serve the visitor-timeline filter.
const RECENT_UUID_POOL_SIZE = 6;
const RECENT_UUID_POOL: string[] = Array.from({ length: RECENT_UUID_POOL_SIZE }, (_, poolIndex) =>
  makeUuid(createSeededRandom(hashString(`recent-uuid-pool:${poolIndex}`))),
);

// ----------------------------------------------------------------------------
// Parameter model — the worker's ParameterDescriptor, ParameterValues and error classes.
// ----------------------------------------------------------------------------
type ParameterDescriptor =
  | { name: string; type: 'integer'; required: boolean; default: number; minimum: number; maximum: number }
  | { name: string; type: 'date'; required: boolean }
  | { name: string; type: 'boolean'; required: boolean; default: boolean }
  | { name: string; type: 'string'; required: boolean };

// `undefined` belongs in the value type, not just at read sites: validateParameters() below never
// sets a key for an optional parameter the caller omitted (see the 'string' branch), so reading an
// unset key genuinely yields undefined at runtime, and the type must say so or a `!== undefined`
// check downstream becomes a TypeScript error about comparing "impossible" types.
type ParameterValues = Record<string, number | string | boolean | undefined>;

// A caller mistake -> 400. Mirrors ParameterError in queries.ts.
class ParameterError extends Error {}

// An operator mistake (a malformed OWNER_UUIDS entry) -> 502, never 400: the caller did nothing
// wrong. Mirrors ConfigurationError in queries.ts.
class ConfigurationError extends Error {}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Decimal notation only. Number() alone would also accept '1e2' (100) and '0x1f' (31), both of
// which pass Number.isInteger; the worker rejects them, so the mock must too.
const INTEGER_PATTERN = /^-?\d+$/;
// The same allowlist queries.ts applies to OWNER_UUIDS entries: wide enough for the library's
// crypto.randomUUID() values and its short fallback ids, narrow enough that no entry can carry a
// quote or a comment token into SQL.
const OWNER_UUID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Parses the OWNER_UUIDS var (comma-separated visitor uuids to hide by default). In the worker
// this comes from wrangler vars; here it is an environment variable of the mock process, so the
// same dev flow works: OWNER_UUIDS=<my-uuid> node tools/mock-tracker.ts. A malformed entry throws
// rather than being skipped, because skipping would leak exactly the footprints the operator asked
// to hide.
function parseOwnerUUIDs(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      if (!OWNER_UUID_PATTERN.test(entry)) {
        throw new ConfigurationError(`invalid owner uuid: ${JSON.stringify(entry)}`);
      }
      return entry;
    });
}

// The one gate every user-supplied value passes, driven by the descriptors rather than by the
// query name — the same generic routine as validateParameters() in queries.ts, down to the two
// deliberate softness choices: an empty string counts as missing (URLSearchParams yields '' for
// `?limit=`), and out-of-range integers are CLAMPED rather than rejected.
function validateParameters(
  parameters: ReadonlyArray<ParameterDescriptor>,
  searchParameters: URLSearchParams,
): ParameterValues {
  const values: ParameterValues = {};

  for (const parameter of parameters) {
    const raw = searchParameters.get(parameter.name);
    const isMissing = raw === null || raw === '';

    if (parameter.type === 'string') {
      if (isMissing) {
        if (parameter.required) {
          throw new ParameterError(`missing required parameter: ${parameter.name}`);
        }
        continue;
      }
      values[parameter.name] = raw;
      continue;
    }

    if (parameter.type === 'integer') {
      if (isMissing) {
        if (parameter.required) {
          throw new ParameterError(`missing required parameter: ${parameter.name}`);
        }
        values[parameter.name] = parameter.default;
        continue;
      }
      if (!INTEGER_PATTERN.test(raw)) {
        throw new ParameterError(`parameter ${parameter.name} must be an integer`);
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed)) {
        throw new ParameterError(`parameter ${parameter.name} must be an integer`);
      }
      values[parameter.name] = Math.min(parameter.maximum, Math.max(parameter.minimum, parsed));
      continue;
    }

    if (parameter.type === 'boolean') {
      if (isMissing) {
        if (parameter.required) {
          throw new ParameterError(`missing required parameter: ${parameter.name}`);
        }
        values[parameter.name] = parameter.default;
        continue;
      }
      // Exactly the two lowercase spellings — not the permissive '1'/'yes'/'on' family, and not
      // "any non-empty string is true". A typo like include_owner=ture must be a loud 400, because
      // guessing it as false would silently give the caller the opposite of what they asked for.
      if (raw !== 'true' && raw !== 'false') {
        throw new ParameterError(`parameter ${parameter.name} must be true or false`);
      }
      values[parameter.name] = raw === 'true';
      continue;
    }

    if (isMissing) {
      if (parameter.required) {
        throw new ParameterError(`missing required parameter: ${parameter.name}`);
      }
      continue;
    }
    if (!DATE_PATTERN.test(raw)) {
      throw new ParameterError(`parameter ${parameter.name} must be a date (YYYY-MM-DD)`);
    }
    values[parameter.name] = raw;
  }

  return values;
}

// Typed reads of an already-validated value; the shape is guaranteed by the descriptor that
// produced it, so these narrow rather than re-check.
const dateOf = (values: ParameterValues, name: string): string => String(values[name]);
const limitOf = (values: ParameterValues): number => Number(values.limit);
// True only when the caller opted in AND the operator configured owner uuids at all — with no
// OWNER_UUIDS there is nothing to include, exactly as ownerExclusion() in queries.ts short-circuits.
const withOwnerOf = (values: ParameterValues, ownerUUIDs: string[]): boolean =>
  values.include_owner === true && ownerUUIDs.length > 0;

// ----------------------------------------------------------------------------
// ISO week helpers — used only by weekly-retention's cohorts below. Kept local to this file rather
// than added to date-ranges.ts because no other query or panel in this viewer groups by week; the
// tracker contract's cohort_week is 'YYYY-Www' and this is the one place that derives it.
// ----------------------------------------------------------------------------
// Monday (UTC midnight) of the ISO 8601 week containing `date`. ISO weeks start on Monday, so
// getUTCDay() (Sunday = 0) is rotated to Monday = 0 before subtracting.
function mondayOfISOWeek(date: Date): Date {
  const dayNumber = (date.getUTCDay() + 6) % 7; // Monday = 0 .. Sunday = 6
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - dayNumber);
  return monday;
}

// ISO 8601 week-numbering label ('YYYY-Www') for the week whose Monday is `monday`, via the
// standard nearest-Thursday method: ISO 8601 defines a year's week 1 as the week containing that
// year's first Thursday (equivalently, the week containing 4 January), so a week's label takes its
// year from whichever calendar year owns its Thursday — the reason the label can differ from the
// Monday's own calendar year at the turn of a year.
// See https://en.wikipedia.org/wiki/ISO_week_date#Calculating_the_week_number_from_a_month_and_day
function isoWeekLabel(monday: Date): string {
  const thursday = new Date(monday.getTime());
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = mondayOfISOWeek(new Date(Date.UTC(isoYear, 0, 4)));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3);
  const weekNumber = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// Query catalog — names, descriptions, parameter bounds and row shapes copied from CATALOG in
// workers/footprint-tracker-worker/queries.ts, in the same order the worker serves them.
// ----------------------------------------------------------------------------
interface QueryDefinition {
  name: string;
  description: string;
  parameters: ParameterDescriptor[];
  rows: (values: ParameterValues, ownerUUIDs: string[]) => Record<string, unknown>[];
}

const CATALOG: QueryDefinition[] = [
  {
    name: 'recent-footprints',
    description: 'Most recent footprints, newest first.',
    parameters: [
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 100 },
      { name: 'uuid', type: 'string', required: false },
    ],
    rows: (values, ownerUUIDs) => {
      const limit = limitOf(values);
      const targetUuid = values.uuid !== undefined ? String(values.uuid) : undefined;
      const withOwner = withOwnerOf(values, ownerUUIDs);
      const rows: Record<string, unknown>[] = [];
      // Candidates are drawn newest-first and owner rows are skipped when excluded, so the answer
      // still holds `limit` rows — the worker's WHERE reaches further back for the same reason.
      // The upper bound on `index` keeps a pathological OWNER_UUIDS from spinning forever.
      for (let index = 0; rows.length < limit && index < limit * 10 + 100; index += 1) {
        const random = createSeededRandom(hashString(`recent:${index}`));
        const receivedAt = new Date(Date.now() - index * 37 * 60 * 1000).toISOString(); // ~37 min apart
        const path = HREF_PATHS[Math.floor(random() * HREF_PATHS.length)];
        const origin = pickWeighted(ORIGIN_DISTRIBUTION, random()).name;
        const userAgent = USER_AGENTS[Math.floor(random() * USER_AGENTS.length)];
        const arguments_ = ARGUMENT_SAMPLES[Math.floor(random() * ARGUMENT_SAMPLES.length)];
        // Every nullable column is null in some rows, because that is what the real table contains:
        // the collector stores null whenever the payload or the request did not supply a value, and
        // a mock without nulls lets "null" reach the DOM unnoticed.
        const hasUuid = random() > 0.1;
        const hasHref = random() > 0.05;
        const isOwnerRow = ownerUUIDs.length > 0 && random() < 0.15;
        if (isOwnerRow && !withOwner) {
          continue;
        }
        // A caller filtering by uuid (the visitor timeline highlight) needs SEVERAL rows back for
        // the same visitor, which a fresh random uuid per row could never produce — real repeat
        // visits are exactly what that filter exists to show. RECENT_UUID_POOL is assigned
        // CYCLICALLY by row `index` rather than drawn from this row's `random`, so every other draw
        // this stream makes (path/origin/user-agent/arguments_/hasUuid/hasHref/isOwnerRow and
        // verifiedBotCategory below) keeps its existing call site; the only change is that the
        // stream no longer spends makeUuid()'s draws when hasUuid is true.
        const rowUuid = isOwnerRow
          ? ownerUUIDs[0]
          : hasUuid
            ? RECENT_UUID_POOL[index % RECENT_UUID_POOL.length]
            : null;
        if (targetUuid !== undefined && rowUuid !== targetUuid) {
          continue;
        }
        // Mirrors the distribution MEASURED on the live table, not a guess: Cloudflare always sets
        // cf.verifiedBotCategory and leaves it the EMPTY STRING for ordinary, unverified traffic —
        // that is the common "no verdict" case, and it is drawn far more often below. Null appears
        // only when the whole cf column itself is absent (a non-Cloudflare replay) or on rows
        // collected before this field existed, so it stays the rare branch, never the default. Both
        // mean "no verdict" to detectBotEvidence() (see the RecentFootprintRow comment in
        // scripts/tools/tracker-client.ts), which is why getting this ratio backwards would still
        // "work" yet train the viewer against a shape the real table never produces.
        const verifiedBotCategory =
          random() < (isBotUserAgent(userAgent) ? 0.5 : 0.05)
            ? pickWeighted(VERIFIED_BOT_CATEGORY_DISTRIBUTION, random()).name
            : random() < 0.08
              ? null
              : '';
        rows.push({
          received_at: receivedAt,
          uuid: rowUuid,
          origin,
          href: hasHref ? `${SITE_ORIGIN}${path}` : null,
          user_agent: userAgent,
          arguments: arguments_,
          verified_bot_category: verifiedBotCategory,
        });
      }
      return rows;
    },
  },
  {
    name: 'footprints-by-day',
    description: 'Footprint count per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const withOwner = withOwnerOf(values, ownerUUIDs);
      // Days with no footprints are omitted, exactly as a GROUP BY does.
      return enumerateDays(dateOf(values, 'from'), dateOf(values, 'to'))
        .map((day) => ({ day, footprints: dayFootprints(day, withOwner) }))
        .filter((row) => row.footprints > 0);
    },
  },
  {
    name: 'unique-visitors-by-day',
    description: 'Distinct visitor (uuid) count per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const withOwner = withOwnerOf(values, ownerUUIDs);
      return enumerateDays(dateOf(values, 'from'), dateOf(values, 'to'))
        .map((day) => ({ day, visitors: dayVisitors(day, dayFootprints(day, withOwner)) }))
        .filter((row) => row.visitors > 0);
    },
  },
  {
    name: 'top-pages',
    description: 'Most visited pages (by href) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      return distributeTotal(
        HREF_PATHS.map((path) => ({ name: path })),
        total,
        `top-pages:${from}:${to}`,
        limitOf(values),
      ).map((row) => ({ href: `${SITE_ORIGIN}${row.name}`, footprints: row.count }));
    },
  },
  {
    name: 'top-origins',
    description: 'Most active origins within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      // Kept even though the v2 dashboard no longer draws an origins panel: the query is still
      // part of the worker's API, and a mock that answers 404 for it would misreport the contract.
      return distributeTotal(ORIGIN_DISTRIBUTION, total, `top-origins:${from}:${to}`, limitOf(values)).map(
        (row) => ({ origin: row.name, footprints: row.count }),
      );
    },
  },
  {
    name: 'bots-by-day',
    description:
      'Total vs. bot footprint count per day (Cloudflare verified-bot category OR User-Agent heuristic).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const withOwner = withOwnerOf(values, ownerUUIDs);
      // The output columns stay footprints / bot_footprints even though the dashboard now labels
      // them 페이지 뷰 / 봇: the row shape is the API contract, the relabelling is UI copy only.
      return enumerateDays(dateOf(values, 'from'), dateOf(values, 'to'))
        .map((day) => {
          const footprints = dayFootprints(day, withOwner);
          return { day, footprints, bot_footprints: dayBotFootprints(day, footprints) };
        })
        .filter((row) => row.footprints > 0);
    },
  },
  {
    name: 'period-summary',
    description: 'Total views and distinct visitors for the whole date range (single row).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const withOwner = withOwnerOf(values, ownerUUIDs);
      // Always one row, even when the period is empty — see computePeriodVisitors() for why
      // `visitors` is not simply the sum of the daily distinct counts, and why that gap is the
      // entire reason this query exists rather than the daily sum being reused here.
      const { views, visitors } = computePeriodVisitors(from, to, withOwner);
      return [{ views, visitors }];
    },
  },
  {
    name: 'top-referrers',
    description: 'Most common referrers (payload.document.referrer) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      return distributeTotal(REFERRER_DISTRIBUTION, total, `top-referrers:${from}:${to}`, limitOf(values)).map(
        (row) => ({ referrer: row.name, views: row.count }),
      );
    },
  },
  {
    name: 'views-by-country',
    description: 'Views and distinct visitors per country (cf.country) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      return distributeTotal(COUNTRY_DISTRIBUTION, total, `views-by-country:${from}:${to}`, limitOf(values)).map(
        (row) => ({
          country: row.name,
          views: row.count,
          visitors: visitorsForViews(row.count, `country-visitors:${from}:${to}:${String(row.name)}`),
        }),
      );
    },
  },
  {
    name: 'views-by-hour',
    description: 'Views per hour of day (UTC) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      // Allocated with allocateExactly() so the 24 bins sum to exactly the period total — the
      // real GROUP BY partitions rows and can never sum to more views than exist.
      const jitteredWeights = HOUR_WEIGHTS.map(
        (weight, hour) => weight * (0.75 + 0.5 * seededValue(`hour:${from}:${to}:${hour}`)),
      );
      const counts = allocateExactly(jitteredWeights, total);
      // Sparse and ascending, like the worker's GROUP BY hour ORDER BY hour: hours with no traffic
      // are simply absent from the wire and the viewer zero-fills all 24 bins itself.
      return counts
        .map((views, hour) => ({ hour: String(hour).padStart(2, '0'), views }))
        .filter((row) => row.views > 0);
    },
  },
  {
    name: 'top-platforms',
    description: 'Views per platform and mobile flag (User-Agent Client Hints) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      // Two grouped columns, so the null bucket is null in BOTH: a browser without
      // navigator.userAgentData reports neither the platform nor the mobile flag.
      return distributeTotal(PLATFORM_DISTRIBUTION, total, `top-platforms:${from}:${to}`, limitOf(values)).map(
        (row) => ({ platform: row.name, mobile: row.mobile, views: row.count }),
      );
    },
  },
  {
    name: 'views-by-color-scheme',
    description: 'Views per preferred color scheme (payload.colorScheme) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      // No limit parameter on this query, so the whole catalog is returned — the ceiling is the
      // catalog itself, not a caller-supplied number.
      return distributeTotal(
        COLOR_SCHEME_DISTRIBUTION,
        total,
        `views-by-color-scheme:${from}:${to}`,
        COLOR_SCHEME_DISTRIBUTION.length,
      ).map((row) => ({ color_scheme: row.name, views: row.count }));
    },
  },
  {
    name: 'top-languages',
    description: 'Most common browser languages (payload.navigator.language) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      return distributeTotal(LANGUAGE_DISTRIBUTION, total, `top-languages:${from}:${to}`, limitOf(values)).map(
        (row) => ({ language: row.name, views: row.count }),
      );
    },
  },
  {
    name: 'views-by-screen-width',
    description: 'Views per screen-width bucket (payload.screen.width) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      return distributeTotal(
        WIDTH_BUCKET_DISTRIBUTION,
        total,
        `views-by-screen-width:${from}:${to}`,
        WIDTH_BUCKET_DISTRIBUTION.length,
      ).map((row) => ({ width_bucket: row.name, views: row.count }));
    },
  },
  {
    name: 'top-events',
    description: 'Most common custom event argument lists within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      // Events are a SLICE of the traffic, not all of it: the worker's WHERE arguments != '[]'
      // drops every plain page view, and on a real site those are the overwhelming majority. A
      // mock that distributed the full period total here would make the event panel outrank the
      // page views it is a subset of.
      return distributeTotal(
        EVENT_DISTRIBUTION,
        Math.round(total * 0.18),
        `top-events:${from}:${to}`,
        limitOf(values),
      ).map((row) => ({ arguments: row.name, views: row.count }));
    },
  },
  {
    name: 'verified-bot-categories',
    description: 'Views per Cloudflare verified-bot category (cf.verifiedBotCategory) within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const withOwner = withOwnerOf(values, ownerUUIDs);
      // Exactly the verified slice bots-by-day adds to its bot count, so the two panels can never
      // disagree about how much verified-bot traffic the period saw.
      const verifiedTotal = enumerateDays(from, to).reduce(
        (total, day) => total + dayVerifiedBotFootprints(day, dayFootprints(day, withOwner)),
        0,
      );
      // The one query whose null bucket is filtered away server side, so every row here has a
      // non-null category string — the catalog holds no null entry for that reason.
      return distributeTotal(
        VERIFIED_BOT_CATEGORY_DISTRIBUTION,
        verifiedTotal,
        `verified-bot-categories:${from}:${to}`,
        VERIFIED_BOT_CATEGORY_DISTRIBUTION.length,
      ).map((row) => ({ category: row.name, views: row.count }));
    },
  },
  {
    name: 'utm-breakdown',
    description: 'Views broken down by UTM parameters (source, medium, campaign).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      const utmCatalog: DistributionEntry[] = [
        { name: 'google:cpc:summer-sale', weight: 4 },
        { name: 'newsletter:email:weekly-28', weight: 3 },
        { name: 'github:social:readme', weight: 2 },
        { name: 'twitter:social:launch', weight: 1 },
        { name: null, weight: 10 },
      ];
      return distributeTotal(utmCatalog, total, `utm-breakdown:${from}:${to}`, utmCatalog.length).map((row) => {
        if (row.name === null) {
          return { source: null, medium: null, campaign: null, views: row.count };
        }
        const [source, medium, campaign] = row.name.split(':');
        return { source: source ?? null, medium: medium ?? null, campaign: campaign ?? null, views: row.count };
      });
    },
  },
  {
    name: 'new-vs-returning-by-day',
    description: 'New vs. returning visitors per day within a date range.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const withOwner = withOwnerOf(values, ownerUUIDs);
      return enumerateDays(dateOf(values, 'from'), dateOf(values, 'to'))
        .map((day) => {
          const totalVisitors = dayVisitors(day, dayFootprints(day, withOwner));
          const newRatio = 0.4 + 0.3 * seededValue(`new-visitors:${day}`);
          const newVisitors = Math.round(totalVisitors * newRatio);
          const returningVisitors = totalVisitors - newVisitors;
          return { day, new_visitors: newVisitors, returning_visitors: returningVisitors };
        })
        .filter((row) => row.new_visitors > 0 || row.returning_visitors > 0);
    },
  },
  {
    name: 'visit-depth',
    description: 'Visitors grouped by number of page views in a session/period.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      // The bucket counts below must sum to exactly the same visitor figure period-summary answers
      // with for this range — computePeriodVisitors() is the one place that number is computed,
      // and it is 0 (no floor) for an empty range rather than a ghost single visitor.
      const { visitors: periodVisitors } = computePeriodVisitors(from, to, withOwnerOf(values, ownerUUIDs));
      const depthCatalog: DistributionEntry[] = [
        { name: '1', weight: 10 },
        { name: '2', weight: 5 },
        { name: '3-5', weight: 3 },
        { name: '6-10', weight: 1 },
        { name: '11-plus', weight: 1 },
      ];
      return distributeTotal(depthCatalog, periodVisitors, `visit-depth:${from}:${to}`, depthCatalog.length).map(
        (row) => ({ depth_bucket: row.name as '1' | '2' | '3-5' | '6-10' | '11-plus', visitors: row.count }),
      );
    },
  },
  {
    name: 'weekly-retention',
    description: 'Weekly cohort retention matrix.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    // `from` plays no part below: cohorts are derived from `to` alone (the last 4 ISO weeks ending
    // there), exactly as a rolling retention view would report regardless of how far back the
    // caller's range starts.
    rows: (values, ownerUUIDs) => {
      const to = dateOf(values, 'to');
      const withOwner = withOwnerOf(values, ownerUUIDs);
      // `to` is exclusive, so the last day actually IN the range is one day before it; the ISO
      // week containing that day is "now" for retention purposes. Nothing past it may be reported
      // as an observation, or a cohort could claim retention data from a week that has not
      // happened yet.
      const lastObservedDay = parseUTCDate(to);
      lastObservedDay.setUTCDate(lastObservedDay.getUTCDate() - 1);
      const currentWeekMonday = mondayOfISOWeek(lastObservedDay);

      const cohortWeeksCount = 4;
      const rows: Record<string, unknown>[] = [];
      for (let weeksBack = cohortWeeksCount - 1; weeksBack >= 0; weeksBack -= 1) {
        const cohortMonday = new Date(currentWeekMonday.getTime());
        cohortMonday.setUTCDate(cohortMonday.getUTCDate() - weeksBack * 7);
        const cohortLabel = isoWeekLabel(cohortMonday);

        // A cohort's week-0 baseline is the visitors first seen across its OWN 7 UTC days, scaled
        // down from the site's daily model exactly like new-vs-returning-by-day does — a retention
        // cohort is a slice of one week's visitors, never a flat three-digit constant unrelated to
        // how much traffic the site actually gets (daily footprints cap at 50).
        const cohortSunday = new Date(cohortMonday.getTime());
        cohortSunday.setUTCDate(cohortSunday.getUTCDate() + 7);
        const cohortDays = enumerateDays(formatUTCDate(cohortMonday), formatUTCDate(cohortSunday));
        const weeklyVisitors = cohortDays.reduce(
          (total, day) => total + dayVisitors(day, dayFootprints(day, withOwner)),
          0,
        );
        const baseVisitors = Math.round(weeklyVisitors * (0.4 + 0.3 * seededValue(`retention-base:${cohortLabel}`)));
        if (baseVisitors === 0) {
          continue;
        }

        // weeksBack IS the count of completed weeks between this cohort and the current week, so
        // it doubles as the highest offset that has actually happened by `to` — offsets beyond it
        // would be future weeks and are never generated.
        for (let offset = 0; offset <= weeksBack; offset += 1) {
          const decayFactor = offset === 0 ? 1.0 : Math.max(0.05, 0.45 * Math.pow(0.7, offset - 1));
          const visitors = Math.round(
            baseVisitors * decayFactor * (0.8 + 0.4 * seededValue(`retention:${cohortLabel}:${offset}`)),
          );
          rows.push({ cohort_week: cohortLabel, week_offset: offset, visitors });
        }
      }
      return rows;
    },
  },
  {
    name: 'top-landings',
    description: 'Top landing pages by visitor count.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 10, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      // No floor: an empty range has zero landings, not one ghost landing invented to avoid an
      // empty panel.
      const landingsTotal = Math.round(total * 0.6);
      // A null bucket belongs here for the same reason recent-footprints sometimes stores a null
      // href (see hasHref there): the landing page is read from the same nullable href column, and
      // a request that arrived without one groups into a null key exactly as top-pages's would.
      const landingCatalog: DistributionEntry[] = [
        ...HREF_PATHS.map((path) => ({ name: path })),
        { name: null, weight: 1 },
      ];
      return distributeTotal(
        landingCatalog,
        landingsTotal,
        `top-landings:${from}:${to}`,
        limitOf(values),
      ).map((row) => ({ href: row.name === null ? null : `${SITE_ORIGIN}${row.name}`, landings: row.count }));
    },
  },
  {
    name: 'page-transitions',
    description: 'Top page transitions (from page -> to page).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
      { name: 'limit', type: 'integer', required: false, default: 20, minimum: 1, maximum: 50 },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      const transitionPairs: DistributionEntry[] = [
        { name: '/ -> /blog', weight: 8 },
        { name: '/blog -> /blog/typescript-tips', weight: 6 },
        { name: '/ -> /projects', weight: 5 },
        { name: '/projects -> /projects/footprint', weight: 4 },
        { name: '/blog/typescript-tips -> /about', weight: 3 },
        { name: '/blog -> /blog/on-device-ai', weight: 3 },
        { name: '/ -> /about', weight: 2 },
        { name: 'null -> /', weight: 7 },
      ];
      return distributeTotal(transitionPairs, Math.round(total * 0.5), `page-transitions:${from}:${to}`, limitOf(values)).map((row) => {
        const parts = row.name ? row.name.split(' -> ') : ['null', 'null'];
        const fromHref = parts[0] === 'null' ? null : `${SITE_ORIGIN}${parts[0]}`;
        const toHref = parts[1] === 'null' ? null : `${SITE_ORIGIN}${parts[1]}`;
        return { from_href: fromHref, to_href: toHref, transitions: row.count };
      });
    },
  },
  {
    name: 'connection-types',
    description: 'Views per effective connection type (navigator.connection.effectiveType).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      const connectionCatalog: DistributionEntry[] = [
        { name: '4g', weight: 12 },
        { name: '3g', weight: 4 },
        { name: '2g', weight: 1 },
        { name: 'slow-2g', weight: 1 },
        { name: null, weight: 3 },
      ];
      return distributeTotal(connectionCatalog, total, `connection-types:${from}:${to}`, connectionCatalog.length).map((row) => ({
        effective_type: row.name as 'slow-2g' | '2g' | '3g' | '4g' | null,
        views: row.count,
      }));
    },
  },
  {
    name: 'device-capabilities',
    description: 'Views per device memory bucket (navigator.deviceMemory).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      const memoryCatalog: DistributionEntry[] = [
        { name: '8-and-above', weight: 10 },
        { name: '4-to-7', weight: 6 },
        { name: 'under-4', weight: 2 },
        { name: null, weight: 3 },
      ];
      return distributeTotal(memoryCatalog, total, `device-capabilities:${from}:${to}`, memoryCatalog.length).map((row) => ({
        memory_bucket: row.name as 'under-4' | '4-to-7' | '8-and-above' | null,
        views: row.count,
      }));
    },
  },
  {
    name: 'accessibility-signals',
    description: 'Views per accessibility preference (prefers-reduced-motion).',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      const motionCatalog: DistributionEntry[] = [
        { name: 'false', weight: 15 },
        { name: 'true', weight: 3 },
        { name: null, weight: 2 },
      ];
      return distributeTotal(motionCatalog, total, `accessibility-signals:${from}:${to}`, motionCatalog.length).map((row) => ({
        reduced_motion: row.name === null ? null : row.name === 'true',
        views: row.count,
      }));
    },
  },
  {
    name: 'bots-by-hour',
    description: 'Total vs bot views per UTC hour of day.',
    parameters: [
      { name: 'from', type: 'date', required: true },
      { name: 'to', type: 'date', required: true },
    ],
    rows: (values, ownerUUIDs) => {
      const from = dateOf(values, 'from');
      const to = dateOf(values, 'to');
      const total = sumFootprintsInRange(from, to, withOwnerOf(values, ownerUUIDs));
      const jitteredWeights = HOUR_WEIGHTS.map(
        (weight, hour) => weight * (0.75 + 0.5 * seededValue(`hour:${from}:${to}:${hour}`)),
      );
      const counts = allocateExactly(jitteredWeights, total);
      // Same two-part model dayBotFootprints() applies at the day grain — a heuristic slice
      // (10-28%) plus a disjoint Cloudflare-verified slice (3-12%) — so an hour's bot share and the
      // day it belongs to are never modelled by two different formulas. Sparse like views-by-hour:
      // an hour with no traffic is simply absent from the wire, not a zero-filled row the viewer
      // would have to distinguish from "no data yet".
      return counts
        .map((views, hour) => {
          const heuristicRatio = 0.1 + 0.18 * seededValue(`bots-hour:${from}:${to}:${hour}`);
          const verifiedRatio = 0.03 + 0.09 * seededValue(`verified-bots-hour:${from}:${to}:${hour}`);
          const botViews = views === 0 ? 0 : Math.min(views, Math.round(views * (heuristicRatio + verifiedRatio)));
          return { hour: String(hour).padStart(2, '0'), views, bot_views: botViews };
        })
        .filter((row) => row.views > 0);
    },
  },
  {
    name: 'views-by-minute',
    description: 'Views per minute for the last N minutes.',
    parameters: [
      { name: 'minutes', type: 'integer', required: false, default: 30, minimum: 1, maximum: 120 },
    ],
    rows: (values) => {
      // validateParameters() already applies the descriptor's default (30) whenever `minutes` is
      // missing, so a second `?? 30` here would only mask a validation bug rather than handle a
      // real case — this value is never undefined by the time it reaches rows().
      const minutesCount = Number(values.minutes);
      const now = new Date();
      const rows: Record<string, unknown>[] = [];
      for (let index = minutesCount - 1; index >= 0; index -= 1) {
        const minuteDate = new Date(now.getTime() - index * 60 * 1000);
        const minuteIso = minuteDate.toISOString().slice(0, 16);
        const randomValue = seededValue(`minute:${minuteIso}`);
        const views = randomValue > 0.4 ? Math.floor(randomValue * 6) : 0;
        rows.push({ minute: minuteIso, views });
      }
      return rows;
    },
  },
];

// include_owner is bolted onto every definition here instead of being repeated sixteen times in
// CATALOG above, exactly as QUERY_DEFINITIONS does it in queries.ts: the owner filter is a
// cross-cutting rule, and a per-query parameter list is what a new query forgets to copy.
const INCLUDE_OWNER_PARAMETER: ParameterDescriptor = {
  name: 'include_owner',
  type: 'boolean',
  required: false,
  default: false,
};

const QUERY_DEFINITIONS: QueryDefinition[] = CATALOG.map((definition) => ({
  ...definition,
  parameters: [...definition.parameters, INCLUDE_OWNER_PARAMETER],
}));

const findQuery = (name: string): QueryDefinition | undefined =>
  QUERY_DEFINITIONS.find((definition) => definition.name === name);

// The catalog as served by GET /queries: descriptors only, with the row-producing function
// stripped — the same projection listQueries() applies to buildSQL.
const listQueries = (): Array<Omit<QueryDefinition, 'rows'>> =>
  QUERY_DEFINITIONS.map(({ name, description, parameters }) => ({ name, description, parameters }));

// Served verbatim at both GET / and GET /help, like the worker's HELP document.
const HELP = {
  name: 'footprint-tracker (mock)',
  description: 'Read-only JSON query API over collected footprints (seeded mock data).',
  endpoints: [
    { method: 'GET', path: '/', description: 'This document.' },
    { method: 'GET', path: '/help', description: 'This document.' },
    { method: 'GET', path: '/health', description: 'Health check ("ok").' },
    { method: 'GET', path: '/queries', description: 'Catalog of available queries and their parameters.' },
    { method: 'GET', path: '/queries/{name}', description: 'Run a query; parameters via the query string.' },
  ],
};

// ----------------------------------------------------------------------------
// Response helpers
// ----------------------------------------------------------------------------
// Reflected CORS, matching cors.ts in the worker: an exact allowlist match is reflected, anything
// else gets no Access-Control-Allow-Origin, and Vary: Origin is sent either way so a shared cache
// cannot replay one origin's variant to another.
function corsHeaders(requestOrigin: string | undefined): Record<string, string> {
  if (requestOrigin !== undefined && VIEWER_ORIGINS.includes(requestOrigin)) {
    return { 'access-control-allow-origin': requestOrigin, vary: 'Origin' };
  }
  return { vary: 'Origin' };
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string>,
  isHead: boolean,
): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  // HEAD is GET without the content (RFC 9110 §9.3.2): the headers are identical, only the body
  // is withheld. See https://www.rfc-editor.org/rfc/rfc9110.html#name-head
  response.end(isHead ? undefined : payload);
}

function sendText(
  response: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string>,
  isHead: boolean,
): void {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers });
  response.end(isHead ? undefined : body);
}

// ----------------------------------------------------------------------------
// Routing
// ----------------------------------------------------------------------------
function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  // One line per request, including the Origin. When the viewer runs on another device, the two
  // failure modes look identical in the browser (an opaque "Failed to fetch"), and only this log
  // separates them: no line at all means the request never arrived — usually a loopback address
  // typed into the setup card — while a line without a reflected origin means the allowlist
  // rejected it.
  response.on('finish', () => {
    console.log(
      `[mock-tracker] ${request.method} ${request.url} -> ${response.statusCode}` +
        ` (origin: ${request.headers.origin ?? 'none'})`,
    );
  });

  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;
  const requestOrigin = request.headers.origin;
  const isHead = request.method === 'HEAD';
  const method = isHead ? 'GET' : (request.method ?? 'GET');

  // CORS applies to /queries and /queries/* only — the one surface a browser reads cross-origin.
  const isQueriesPath = pathname === '/queries' || pathname.startsWith('/queries/');
  const cors = isQueriesPath ? corsHeaders(requestOrigin) : {};

  if (method === 'OPTIONS') {
    // A real preflight answer on /queries*, plain method discovery everywhere else.
    if (isQueriesPath) {
      response.writeHead(204, { ...cors, allow: ALLOWED_METHODS, 'access-control-allow-methods': 'GET' });
    } else {
      response.writeHead(204, { allow: ALLOWED_METHODS });
    }
    response.end();
    return;
  }

  if (method !== 'GET') {
    response.writeHead(405, { ...cors, allow: ALLOWED_METHODS });
    response.end();
    return;
  }

  if (pathname === '/health') {
    sendText(response, 200, 'ok', {}, isHead);
    return;
  }

  // The help document is served AT both paths, not redirected between them.
  if (pathname === '/' || pathname === '/help') {
    sendJson(response, 200, HELP, {}, isHead);
    return;
  }

  if (pathname === '/queries') {
    sendJson(response, 200, { queries: listQueries() }, cors, isHead);
    return;
  }

  const queryMatch = pathname.match(/^\/queries\/([^/]+)$/);
  if (queryMatch) {
    let queryName: string;
    try {
      queryName = decodeURIComponent(queryMatch[1]);
    } catch {
      // Malformed percent-encoding cannot name a real query, so it is a 404 like any other
      // unknown name — never an exception.
      sendJson(response, 404, { error: `unknown query: ${queryMatch[1]}` }, cors, isHead);
      return;
    }

    const definition = findQuery(queryName);
    if (definition === undefined) {
      sendJson(response, 404, { error: `unknown query: ${queryName}` }, cors, isHead);
      return;
    }

    try {
      const values = validateParameters(definition.parameters, url.searchParams);
      const ownerUUIDs = parseOwnerUUIDs(process.env.OWNER_UUIDS);
      sendJson(response, 200, { name: queryName, rows: definition.rows(values, ownerUUIDs) }, cors, isHead);
      return;
    } catch (error) {
      // The worker's fault split, and the worker's own texts, because the viewer displays them
      // verbatim: a bad parameter value is the caller's mistake (400), while a poisoned
      // OWNER_UUIDS is the operator's and answers 502 alongside upstream failures — never 400.
      const message = error instanceof Error ? error.message : 'invalid parameter';
      sendJson(response, error instanceof ParameterError ? 400 : 502, { error: message }, cors, isHead);
      return;
    }
  }

  sendJson(response, 404, { error: 'not found' }, cors, isHead);
}

const server = createServer(handleRequest);
server.listen(PORT, HOST, () => {
  console.log(`[mock-tracker] listening on http://${HOST}:${PORT}`);
  console.log(`[mock-tracker] CORS allowlist: ${VIEWER_ORIGINS.join(', ')}`);
  console.log('[mock-tracker]   (override with VIEWER_ORIGINS=... if the dev server uses another port)');
  console.log(`[mock-tracker] queries: ${QUERY_DEFINITIONS.length}`);
  console.log('[mock-tracker] set the endpoint in the browser console:');
  console.log(`  localStorage.setItem('footprint:tracker', 'http://127.0.0.1:${PORT}')`);
});
