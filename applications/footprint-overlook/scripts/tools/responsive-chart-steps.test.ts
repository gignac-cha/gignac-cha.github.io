import { describe, expect, it } from 'vitest';

import { getSteppedChartWidth } from './responsive-chart-steps.ts';

describe('responsive-chart-steps', () => {
  it('maps small container widths to 720', () => {
    expect(getSteppedChartWidth(360)).toBe(720);
    expect(getSteppedChartWidth(640)).toBe(720);
    expect(getSteppedChartWidth(899)).toBe(720);
  });

  it('maps medium container widths to 1080', () => {
    expect(getSteppedChartWidth(900)).toBe(1080);
    expect(getSteppedChartWidth(1040)).toBe(1080);
    expect(getSteppedChartWidth(1299)).toBe(1080);
  });

  it('maps large container widths to 1440', () => {
    expect(getSteppedChartWidth(1300)).toBe(1440);
    expect(getSteppedChartWidth(1920)).toBe(1440);
  });
});
