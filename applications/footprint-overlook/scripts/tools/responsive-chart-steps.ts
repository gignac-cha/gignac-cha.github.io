// Pure mapping logic from container width (pixels) to discrete stepped SVG viewBox width.
// Prevents aspect ratio text warp while expanding charts smoothly across wide screens.

export type SteppedChartWidth = 720 | 1080 | 1440;

export function getSteppedChartWidth(containerWidth: number): SteppedChartWidth {
  if (containerWidth >= 1300) {
    return 1440;
  }
  if (containerWidth >= 900) {
    return 1080;
  }
  return 720;
}
