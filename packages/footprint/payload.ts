type UserAgentBrand = { brand: string; version: string };
type LowEntropyUserAgent = { brands?: UserAgentBrand[]; mobile?: boolean; platform?: string };
type HighEntropyUserAgent = {
  architecture?: string;
  bitness?: string;
  model?: string;
  platformVersion?: string;
  fullVersionList?: UserAgentBrand[];
  wow64?: boolean;
};
type Device = {
  userAgentHints?: unknown;
  gpu?: unknown;
  storage?: unknown;
  battery?: unknown;
};

export const pointerFrom = (coarse: boolean, fine: boolean): 'coarse' | 'fine' | 'none' =>
  coarse ? 'coarse' : fine ? 'fine' : 'none';

export const mergeUserAgentHints = (low?: LowEntropyUserAgent, high?: HighEntropyUserAgent) => ({
  brands: low?.brands,
  mobile: low?.mobile,
  platform: low?.platform,
  architecture: high?.architecture,
  bitness: high?.bitness,
  model: high?.model,
  platformVersion: high?.platformVersion,
  fullVersionList: high?.fullVersionList,
  wow64: high?.wow64,
});

export const buildPayload = <B extends { navigator: unknown }>(
  arguments_: unknown[],
  uuid: string,
  base: B,
  device: Device,
) => {
  const navigator = base.navigator as Record<string, unknown>;
  return {
    arguments: arguments_,
    uuid,
    ...base,
    navigator: {
      ...navigator,
      // Not redundant with the userAgentHints already present in `base.navigator`: that one is
      // the synchronous, low-entropy snapshot taken by collect() in footprint.ts (brands /
      // mobile / platform only — see the comment there). The high-entropy fields
      // (architecture, bitness, model, ...) require the async getHighEntropyValues(), which can
      // reject, so the full merge arrives separately via `device`. When it resolved, it
      // supersedes the snapshot (it re-includes the same low-entropy fields); when it failed,
      // `device.userAgentHints` is undefined and `??` keeps the sync snapshot as the graceful
      // floor. footprint.test.ts pins both directions ('merges async device info ...' and
      // 'degrades every device group gracefully when the APIs reject').
      userAgentHints: device.userAgentHints ?? navigator.userAgentHints,
    },
    gpu: device.gpu,
    storage: device.storage,
    battery: device.battery,
  };
};
