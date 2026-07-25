import { describe, expect, it } from 'vitest';

import {
  compareWidthBuckets,
  DIRECT_REFERRER_LABEL,
  mergeDirectReferrers,
  toColorSchemeLabel,
  toCountryLabel,
  toPlatformLabel,
  toReferrerLabel,
  toWidthBucketLabel,
  UNKNOWN_LABEL,
  UNREPORTED_LABEL,
} from './dimension-labels.ts';

describe('toCountryLabel', () => {
  it('names a country in Korean', () => {
    expect(toCountryLabel('KR')).toBe('대한민국');
    expect(toCountryLabel('JP')).toBe('일본');
  });

  it('normalizes the case so one country cannot become two buckets', () => {
    expect(toCountryLabel('kr')).toBe('대한민국');
  });

  it('renders an absent country as the unknown bucket', () => {
    // cf.country is null whenever Cloudflare could not resolve the request's country.
    expect(toCountryLabel(null)).toBe(UNKNOWN_LABEL);
    expect(toCountryLabel(undefined)).toBe(UNKNOWN_LABEL);
    expect(toCountryLabel('')).toBe(UNKNOWN_LABEL);
    expect(toCountryLabel('   ')).toBe(UNKNOWN_LABEL);
  });

  it('falls back to the raw code for something Intl cannot name', () => {
    // 'QQ' and 'AA' are well-formed but unassigned region subtags, and 'XX!' is not a region
    // subtag at all (Intl throws a RangeError for it rather than returning undefined). All three
    // must still show a label rather than a blank bar.
    expect(toCountryLabel('QQ')).toBe('QQ');
    expect(toCountryLabel('AA')).toBe('AA');
    expect(toCountryLabel('XX!')).toBe('XX!');
  });

  it('keeps the one code CLDR does name for "unknown"', () => {
    // 'ZZ' is NOT a fallback case: CLDR assigns it as the Unknown Region and a full-ICU Intl
    // answers with a real Korean name ('알려지지 않은 지역'), so the label is whatever Intl says
    // and not the raw code. The expectation is computed through the same Intl call rather than
    // pinned to the CLDR string, because the string only exists on full-ICU Node builds — a
    // small-icu or system-icu runtime answers differently and a literal pin would fail there
    // while the code under test is behaving correctly. What this still verifies: toCountryLabel
    // DELEGATES 'ZZ' to CLDR instead of treating it like the malformed-code fallback above.
    // See https://unicode.org/reports/tr35/tr35-info.html and
    // https://nodejs.org/api/intl.html#options-for-building-nodejs
    const cldrAnswer = new Intl.DisplayNames('ko', { type: 'region' }).of('ZZ') ?? 'ZZ';
    expect(toCountryLabel('ZZ')).toBe(cldrAnswer);
  });
});

describe('toReferrerLabel', () => {
  it('shortens a real referrer', () => {
    expect(toReferrerLabel('https://www.google.com/search?q=footprint')).toBe('google.com/search?q=footprint');
  });

  it('folds null and empty into the direct-visit bucket', () => {
    // The two cases the data cannot tell apart: a typed/bookmarked visit, and a referrer the
    // source page suppressed.
    expect(toReferrerLabel(null)).toBe(DIRECT_REFERRER_LABEL);
    expect(toReferrerLabel(undefined)).toBe(DIRECT_REFERRER_LABEL);
    expect(toReferrerLabel('')).toBe(DIRECT_REFERRER_LABEL);
    expect(toReferrerLabel('   ')).toBe(DIRECT_REFERRER_LABEL);
  });
});

describe('mergeDirectReferrers', () => {
  it('sums the null and empty rows into one bucket', () => {
    // The tracker groups '' and NULL separately, and toReferrerLabel names them both
    // 직접 유입·미상 — without this fold the panel draws two bars with identical labels.
    expect(
      mergeDirectReferrers([
        { referrer: null, views: 30 },
        { referrer: 'https://news.example.com/', views: 25 },
        { referrer: '', views: 20 },
      ]),
    ).toEqual([
      { referrer: null, views: 50 },
      { referrer: 'https://news.example.com/', views: 25 },
    ]);
  });

  it('re-sorts so the merged bucket lands at its real rank', () => {
    // Each half was smaller than the top referrer; their sum is not. Keeping the tracker's order
    // would show the largest bucket in second place.
    expect(
      mergeDirectReferrers([
        { referrer: 'https://a.example/', views: 40 },
        { referrer: null, views: 30 },
        { referrer: '', views: 25 },
      ])[0],
    ).toEqual({ referrer: null, views: 55 });
  });

  it('leaves a response with no direct traffic untouched', () => {
    // No empty bucket is invented: '직접 유입·미상 0' would claim a measurement nobody made.
    expect(
      mergeDirectReferrers([
        { referrer: 'https://a.example/', views: 9 },
        { referrer: 'https://b.example/', views: 4 },
      ]),
    ).toEqual([
      { referrer: 'https://a.example/', views: 9 },
      { referrer: 'https://b.example/', views: 4 },
    ]);
    expect(mergeDirectReferrers([])).toEqual([]);
  });

  it('keeps a whitespace-only referrer in the direct bucket', () => {
    expect(mergeDirectReferrers([{ referrer: '   ', views: 7 }])).toEqual([{ referrer: null, views: 7 }]);
  });

  it('treats a non-numeric view count as 0 instead of poisoning the sum', () => {
    const merged = mergeDirectReferrers([
      { referrer: null, views: Number.NaN },
      { referrer: '', views: 12 },
    ]);
    expect(merged).toEqual([{ referrer: null, views: 12 }]);
  });

  it('preserves the upstream order for equal counts', () => {
    expect(
      mergeDirectReferrers([
        { referrer: 'https://a.example/', views: 5 },
        { referrer: 'https://b.example/', views: 5 },
      ]).map((row) => row.referrer),
    ).toEqual(['https://a.example/', 'https://b.example/']);
  });
});

describe('toWidthBucketLabel', () => {
  it('translates every bucket the worker emits', () => {
    // One case per CASE WHEN branch in views-by-screen-width; a bucket added there without a label
    // here shows up as its raw key, which this suite is the alarm for.
    expect(toWidthBucketLabel('under-600')).toBe('600px 미만');
    expect(toWidthBucketLabel('600-to-1023')).toBe('600–1023px');
    expect(toWidthBucketLabel('1024-to-1439')).toBe('1024–1439px');
    expect(toWidthBucketLabel('1440-to-1919')).toBe('1440–1919px');
    expect(toWidthBucketLabel('1920-and-above')).toBe('1920px 이상');
  });

  it('renders an absent width as the unreported bucket', () => {
    expect(toWidthBucketLabel(null)).toBe(UNREPORTED_LABEL);
    expect(toWidthBucketLabel(undefined)).toBe(UNREPORTED_LABEL);
    expect(toWidthBucketLabel('')).toBe(UNREPORTED_LABEL);
  });

  it('passes an unknown bucket key through verbatim', () => {
    expect(toWidthBucketLabel('under-400')).toBe('under-400');
  });
});

describe('compareWidthBuckets', () => {
  it('orders the buckets narrow to wide, unreported last', () => {
    const shuffled = ['1920-and-above', null, 'under-600', '1024-to-1439', '600-to-1023', '1440-to-1919'];
    expect([...shuffled].sort(compareWidthBuckets)).toEqual([
      'under-600',
      '600-to-1023',
      '1024-to-1439',
      '1440-to-1919',
      '1920-and-above',
      null,
    ]);
  });
});

describe('toPlatformLabel', () => {
  it('passes the reported platform through', () => {
    expect(toPlatformLabel('macOS', false)).toBe('macOS');
    expect(toPlatformLabel('Windows', null)).toBe('Windows');
  });

  it('annotates only an explicitly mobile client', () => {
    // platform + mobile are two GROUP BY keys upstream, so the same platform can appear twice; the
    // suffix is what keeps those rows from looking like a duplicate.
    expect(toPlatformLabel('Android', true)).toBe('Android · 모바일');
    expect(toPlatformLabel('Android', false)).toBe('Android');
  });

  it('renders an absent platform as the unreported bucket', () => {
    expect(toPlatformLabel(null, null)).toBe(UNREPORTED_LABEL);
    expect(toPlatformLabel('', null)).toBe(UNREPORTED_LABEL);
    expect(toPlatformLabel(null, true)).toBe(`${UNREPORTED_LABEL} · 모바일`);
  });
});

describe('toColorSchemeLabel', () => {
  it('translates the two reported schemes', () => {
    expect(toColorSchemeLabel('dark')).toBe('다크');
    expect(toColorSchemeLabel('light')).toBe('라이트');
  });

  it('renders an absent scheme as the unreported bucket', () => {
    expect(toColorSchemeLabel(null)).toBe(UNREPORTED_LABEL);
    expect(toColorSchemeLabel('')).toBe(UNREPORTED_LABEL);
  });

  it('passes an unexpected value through verbatim', () => {
    expect(toColorSchemeLabel('no-preference')).toBe('no-preference');
  });
});
