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
      userAgentHints: device.userAgentHints ?? navigator.userAgentHints,
    },
    gpu: device.gpu,
    storage: device.storage,
    battery: device.battery,
  };
};
