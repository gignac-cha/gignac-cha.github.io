// Korean labels for the dimension columns the tracker groups by (referrer, country, platform,
// colour scheme, screen-width bucket), as PURE functions with no DOM access so every mapping rule
// unit-tests in plain node (dimension-labels.test.ts).
//
// The rule these all share: a null key is DATA, not an error. Every dimension column is read out of
// the stored JSON (or out of Cloudflare's cf object) with json_get_str, which returns null whenever
// the path is absent — an older payload shape, a client that sends no Client Hints, a request whose
// country Cloudflare could not resolve — so each GROUP BY comes back with one bucket keyed null
// holding a genuine share of the traffic. Rendering it as an empty label would leave an unexplained
// bar, and dropping it would quietly understate the total. Each function therefore maps null to a
// named bucket, and the wording distinguishes WHY it is missing: 미상 for "the value exists in the
// world but we could not determine it" (country), 미보고 for "the client never reported it"
// (platform, colour scheme, screen width), and 직접 유입·미상 for the referrer, where an empty
// referrer genuinely conflates a direct visit with a referrer the browser suppressed.

import { shortenHref } from './formatting.ts';

// The bucket names above, exported so the interface layer can reuse the exact same strings for
// tooltips instead of re-typing them.
export const UNKNOWN_LABEL = '미상';
export const UNREPORTED_LABEL = '미보고';
export const DIRECT_REFERRER_LABEL = '직접 유입·미상';

// Korean region names, resolved once. Intl.DisplayNames is constructed lazily and cached because a
// constructor call per row would rebuild the locale data 10 times per render for no benefit.
// The whole lookup is wrapped in try/catch twice over — construction and `of()` — because both can
// throw: an environment without the region type at all, and a code that is not a well-formed
// region subtag (of() throws RangeError for those rather than returning undefined).
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/of
let regionDisplayNames: Intl.DisplayNames | null | undefined;

function findRegionDisplayNames(): Intl.DisplayNames | null {
  if (regionDisplayNames === undefined) {
    try {
      regionDisplayNames = new Intl.DisplayNames('ko', { type: 'region' });
    } catch {
      regionDisplayNames = null;
    }
  }
  return regionDisplayNames;
}

// ISO 3166-1 alpha-2 country code -> Korean country name ('KR' -> '대한민국').
//
// The raw code is the fallback at every failure point, never a blank or a question mark: 'XK' or a
// future code Intl does not know is still more informative to a reader than nothing, and it stays
// greppable against the data. Cloudflare reports the code uppercase; it is normalized anyway so a
// lowercased upstream cannot produce a second bucket for the same country.
// Pinned by the 'toCountryLabel' suite in dimension-labels.test.ts.
export function toCountryLabel(countryCode: string | null | undefined): string {
  if (typeof countryCode !== 'string' || countryCode.trim().length === 0) {
    return UNKNOWN_LABEL;
  }
  const normalized = countryCode.trim().toUpperCase();
  const displayNames = findRegionDisplayNames();
  if (displayNames === null) {
    return normalized;
  }
  try {
    // With the default fallback ('code') an unknown-but-well-formed code comes back as the code
    // itself, which is exactly the fallback wanted here — no extra branch needed for it.
    return displayNames.of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

// document.referrer -> a ranked-bar label.
//
// An empty referrer is the single most common value on a personal site and it means two things at
// once — the visitor typed the address or came from a bookmark, OR the source page sent no referrer
// (a Referrer-Policy of no-referrer, an HTTPS -> HTTP downgrade, an app webview). The label says
// both rather than picking one, because the data cannot tell them apart.
// See https://developer.mozilla.org/en-US/docs/Web/API/Document/referrer
// Pinned by the 'toReferrerLabel' suite in dimension-labels.test.ts.
export function toReferrerLabel(referrer: string | null | undefined): string {
  if (typeof referrer !== 'string' || referrer.trim().length === 0) {
    return DIRECT_REFERRER_LABEL;
  }
  return shortenHref(referrer);
}

// One row of top-referrers, as much of it as this fold needs.
export interface ReferrerRow {
  referrer: string | null;
  views: number;
}

// Folds the referrer rows the tracker groups separately into the buckets the panel draws.
//
// The label above maps BOTH null and '' to the same text, and the tracker returns them as two
// distinct GROUP BY rows — '' for a visit the browser reported as direct, null for a row whose
// payload predates the referrer field. Rendering them straight through therefore draws two bars
// reading '직접 유입·미상', which looks like a rendering bug and, worse, splits the single largest
// bucket on a personal site in half so it no longer ranks where it belongs. They are summed into
// one bucket here, and the list is re-sorted afterwards because that sum can outrank the row the
// tracker put first.
//
// Only the direct bucket can collide: every other key is a distinct URL the GROUP BY already
// deduplicated. Ties keep the tracker's own ordering (Array.prototype.sort has been required to be
// stable since ES2019), so equal counts do not shuffle between renders.
// See https://tc39.es/ecma262/#sec-array.prototype.sort
// Pinned by the 'mergeDirectReferrers' suite in dimension-labels.test.ts.
export function mergeDirectReferrers(rows: ReadonlyArray<ReferrerRow>): ReferrerRow[] {
  const named: ReferrerRow[] = [];
  let directViews = 0;
  let hasDirect = false;

  for (const row of rows) {
    const views = Number.isFinite(row.views) ? row.views : 0;
    if (typeof row.referrer !== 'string' || row.referrer.trim().length === 0) {
      hasDirect = true;
      directViews += views;
      continue;
    }
    named.push({ referrer: row.referrer, views });
  }

  // The merged bucket is keyed null so the caller can keep using toReferrerLabel on it; an empty
  // response stays empty rather than gaining a '직접 유입·미상 0' row.
  const merged = hasDirect ? [...named, { referrer: null, views: directViews }] : named;
  return merged.sort((left, right) => right.views - left.views);
}

// Screen-width bucket key (assigned by the worker's CASE WHEN) -> Korean label.
//
// The keys are ASCII on purpose so the SQL stays readable and greppable; the translation lives
// here, on the display side. An unrecognized key is passed through verbatim rather than folded into
// 미보고: if the worker gains a bucket and this table does not, an honest 'under-400' on screen is a
// visible prompt to update it, while silently relabelling it as "unreported" would hide the drift.
// Pinned by the 'toWidthBucketLabel' suite in dimension-labels.test.ts.
const WIDTH_BUCKET_LABELS: Record<string, string> = {
  'under-600': '600px 미만',
  '600-to-1023': '600–1023px',
  '1024-to-1439': '1024–1439px',
  '1440-to-1919': '1440–1919px',
  '1920-and-above': '1920px 이상',
};

export function toWidthBucketLabel(widthBucket: string | null | undefined): string {
  if (typeof widthBucket !== 'string' || widthBucket.trim().length === 0) {
    return UNREPORTED_LABEL;
  }
  return WIDTH_BUCKET_LABELS[widthBucket] ?? widthBucket;
}

// Sort order for the width buckets: narrowest to widest, with the unreported bucket last.
//
// A distribution over an ORDERED dimension must be drawn in that order — sorted by count (the way
// every other ranked list here is) would scramble the axis and destroy the only thing this panel
// says, namely where the readers' screens sit on the narrow..wide line.
// Pinned by 'orders the buckets narrow to wide' in dimension-labels.test.ts.
const WIDTH_BUCKET_ORDER: readonly string[] = [
  'under-600',
  '600-to-1023',
  '1024-to-1439',
  '1440-to-1919',
  '1920-and-above',
];

export function compareWidthBuckets(left: string | null | undefined, right: string | null | undefined): number {
  const rank = (bucket: string | null | undefined): number => {
    if (typeof bucket !== 'string') {
      return WIDTH_BUCKET_ORDER.length;
    }
    const index = WIDTH_BUCKET_ORDER.indexOf(bucket);
    return index === -1 ? WIDTH_BUCKET_ORDER.length : index;
  };
  return rank(left) - rank(right);
}

// navigator.userAgentHints platform (+ its mobile flag) -> a ranked-bar label.
//
// The mobile flag is a SEPARATE grouping key upstream, so 'Android' can appear twice (a phone and a
// tablet or a desktop-mode browser report the same platform with a different flag). Appending the
// suffix keeps those two rows distinguishable instead of showing what looks like a duplicate bar.
// Only true is annotated: false means "reported as not mobile", null means "no Client Hints at
// all", and neither deserves a badge next to the name.
// See https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/mobile
// Pinned by the 'toPlatformLabel' suite in dimension-labels.test.ts.
export function toPlatformLabel(
  platform: string | null | undefined,
  mobile: boolean | null | undefined,
): string {
  const name = typeof platform === 'string' && platform.trim().length > 0 ? platform : UNREPORTED_LABEL;
  return mobile === true ? `${name} · 모바일` : name;
}

// prefers-color-scheme as the page reported it -> Korean label. Anything other than the two known
// values passes through verbatim, for the same reason as the width buckets above.
// Pinned by the 'toColorSchemeLabel' suite in dimension-labels.test.ts.
export function toColorSchemeLabel(colorScheme: string | null | undefined): string {
  if (typeof colorScheme !== 'string' || colorScheme.trim().length === 0) {
    return UNREPORTED_LABEL;
  }
  if (colorScheme === 'dark') {
    return '다크';
  }
  if (colorScheme === 'light') {
    return '라이트';
  }
  return colorScheme;
}

// Browser families for toUserAgentLabel, tried in order. Derivatives must precede their engines:
// every Chromium UA also carries 'Chrome' and 'Safari' tokens (and every UA at all opens with
// 'Mozilla'), so Edge/Opera/Samsung claim their strings before Chrome can, and Chrome before
// Safari. Real Safari is the one family matched through 'Version/N' — no other current browser
// ships that token, while Safari never ships a bare version on its 'Safari/605…' build token.
// See https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent
const BROWSER_FAMILIES: ReadonlyArray<readonly [string, RegExp]> = [
  ['Edge', /\bEdg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /\bOPR\/(\d+)/],
  ['Samsung Internet', /\bSamsungBrowser\/(\d+)/],
  ['Firefox', /\b(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /\b(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /\bVersion\/(\d+).*\bSafari\//],
];

// iPhone/iPad must be tested before the Mac tokens: every iOS UA says 'like Mac OS X', so the
// order IS the disambiguation. Windows goes first only because it is the cheapest common case.
function detectOperatingSystem(userAgent: string): string | null {
  if (/\bWindows NT\b/.test(userAgent)) {
    return 'Windows';
  }
  if (/\b(?:iPhone|iPad|iPod)\b/.test(userAgent)) {
    return 'iOS';
  }
  if (/\bCrOS\b/.test(userAgent)) {
    return 'ChromeOS';
  }
  if (/\bMac OS X\b|\bMacintosh\b/.test(userAgent)) {
    return 'macOS';
  }
  if (/\bAndroid\b/.test(userAgent)) {
    return 'Android';
  }
  if (/\bLinux\b/.test(userAgent)) {
    return 'Linux';
  }
  return null;
}

// User-Agent header -> a compact ranked-bar label ('Chrome 151 · Windows', 'AhrefsBot',
// 'curl 8.0'). The raw header is 100-140 characters of boilerplate and a ranked bar has room for
// a name; the verbatim string still reaches the reader through the bar's fullLabel tooltip. This
// is a DISPLAY heuristic, deliberately not the tracker's bot predicate — the worker classifies,
// this only names, and the two may disagree without either being wrong.
//
// Bots are named first, because a crawler UA often embeds a complete browser signature
// ('… AppleWebKit … bingbot/2.0 … Chrome/136 …') that the family table would otherwise claim as
// Chrome. The token containing bot/crawler/spider is the name crawl operators actually publish
// (AhrefsBot, bingbot, Googlebot-Image), so it is shown as matched, not normalized.
// Pinned by the 'toUserAgentLabel' suite in dimension-labels.test.ts.
export function toUserAgentLabel(userAgent: string | null | undefined): string {
  if (typeof userAgent !== 'string' || userAgent.trim().length === 0) {
    return UNREPORTED_LABEL;
  }
  const raw = userAgent.trim();
  const bot = raw.match(/([A-Za-z0-9._-]*(?:bot|crawler|spider)[A-Za-z0-9._-]*)/i);
  if (bot) {
    return bot[1];
  }
  const operatingSystem = detectOperatingSystem(raw);
  for (const [familyName, pattern] of BROWSER_FAMILIES) {
    const match = raw.match(pattern);
    if (match) {
      return operatingSystem === null ? `${familyName} ${match[1]}` : `${familyName} ${match[1]} · ${operatingSystem}`;
    }
  }
  // No browser signature at all: a tool like 'curl/8.0' or a bare product name like 'node'.
  // Major.minor is kept (unlike the majors above) because tool versions are short already.
  const product = raw.match(/^([A-Za-z0-9._+-]+)(?:\/(\d+(?:\.\d+)?))?/);
  if (product) {
    return product[2] === undefined ? product[1] : `${product[1]} ${product[2]}`;
  }
  return raw.slice(0, 40);
}
