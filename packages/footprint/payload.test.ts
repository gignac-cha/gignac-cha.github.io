import { describe, expect, it } from 'vitest';
import { buildPayload, mergeUserAgentHints, pointerFrom } from './payload.ts';

describe('pointerFrom', () => {
  it.each([
    [true, true, 'coarse'],
    [true, false, 'coarse'],
    [false, true, 'fine'],
    [false, false, 'none'],
  ] as const)('coarse=%s fine=%s -> %s', (coarse, fine, expected) => {
    expect(pointerFrom(coarse, fine)).toBe(expected);
  });
});

describe('mergeUserAgentHints', () => {
  it('combines low- and high-entropy fields', () => {
    const merged = mergeUserAgentHints(
      { brands: [{ brand: 'Chromium', version: '120' }], mobile: false, platform: 'macOS' },
      { architecture: 'arm', bitness: '64' },
    );
    expect(merged.brands).toEqual([{ brand: 'Chromium', version: '120' }]);
    expect(merged.mobile).toBe(false);
    expect(merged.platform).toBe('macOS');
    expect(merged.architecture).toBe('arm');
    expect(merged.bitness).toBe('64');
    expect(merged.model).toBeUndefined();
  });

  it('passes every high-entropy field through verbatim', () => {
    const merged = mergeUserAgentHints(undefined, {
      architecture: 'arm',
      bitness: '64',
      model: 'MacBookPro18,3',
      platformVersion: '15.0.0',
      fullVersionList: [{ brand: 'Chromium', version: '126.0.6478.126' }],
      wow64: false,
    });
    expect(merged).toMatchObject({
      architecture: 'arm',
      bitness: '64',
      model: 'MacBookPro18,3',
      platformVersion: '15.0.0',
      fullVersionList: [{ brand: 'Chromium', version: '126.0.6478.126' }],
      wow64: false,
    });
    expect(merged.brands).toBeUndefined();
  });

  it('yields all-undefined when both are absent', () => {
    expect(mergeUserAgentHints()).toEqual({
      brands: undefined,
      mobile: undefined,
      platform: undefined,
      architecture: undefined,
      bitness: undefined,
      model: undefined,
      platformVersion: undefined,
      fullVersionList: undefined,
      wow64: undefined,
    });
  });
});

describe('buildPayload', () => {
  const makeBase = () => ({
    navigator: { userAgent: 'ua', userAgentHints: { platform: 'macOS' } },
    location: { href: 'https://x/' },
    screen: { width: 1920 },
    colorScheme: 'dark',
  });

  it('passes arguments and uuid through and keeps every base group', () => {
    const payload = buildPayload(['cta-click', { plan: 'pro' }], 'uuid-1', makeBase(), {});
    expect(payload.arguments).toEqual(['cta-click', { plan: 'pro' }]);
    expect(payload.uuid).toBe('uuid-1');
    expect(payload.location).toEqual({ href: 'https://x/' });
    expect(payload.screen).toEqual({ width: 1920 });
    expect(payload.colorScheme).toBe('dark');
  });

  it('keeps an empty arguments array as-is', () => {
    expect(buildPayload([], 'u', makeBase(), {}).arguments).toEqual([]);
  });

  it('overrides navigator.userAgentHints with device hints when present', () => {
    const payload = buildPayload([], 'u', makeBase(), {
      userAgentHints: { platform: 'macOS', architecture: 'arm' },
    });
    expect(payload.navigator.userAgentHints).toEqual({ platform: 'macOS', architecture: 'arm' });
    expect(payload.navigator.userAgent).toBe('ua');
  });

  it('keeps base userAgentHints when device hints are absent', () => {
    const payload = buildPayload([], 'u', makeBase(), {});
    expect(payload.navigator.userAgentHints).toEqual({ platform: 'macOS' });
  });

  it('attaches device gpu/storage/battery groups', () => {
    const payload = buildPayload([], 'u', makeBase(), {
      gpu: { vendor: 'apple' },
      storage: { quota: 1 },
      battery: { level: 0.5 },
    });
    expect(payload.gpu).toEqual({ vendor: 'apple' });
    expect(payload.storage).toEqual({ quota: 1 });
    expect(payload.battery).toEqual({ level: 0.5 });
  });

  it('leaves missing device groups undefined so JSON drops them', () => {
    const payload = buildPayload([], 'u', makeBase(), {});
    expect(payload.gpu).toBeUndefined();
    expect(payload.storage).toBeUndefined();
    expect(payload.battery).toBeUndefined();
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('gpu');
  });

  it('does not mutate the base snapshot', () => {
    const base = makeBase();
    const copy = structuredClone(base);
    buildPayload(['x'], 'u', base, { userAgentHints: { platform: 'linux' }, gpu: { vendor: 'nvidia' } });
    expect(base).toEqual(copy);
  });
});
