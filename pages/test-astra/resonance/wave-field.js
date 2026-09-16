/* Shared analytic wave model. No time integration or simulation state. */
const TAU = Math.PI * 2;

export function sample(x, y, sources, wavelength, time) {
  let height = 0;
  let dx = 0;
  let dy = 0;
  const frequency = TAU / wavelength;
  const normalization = Math.sqrt(Math.max(1, sources.length));
  for (const source of sources) {
    const deltaX = x - source.x;
    const deltaY = y - source.y;
    const distance = Math.hypot(deltaX, deltaY);
    const attenuation = 1 / (1 + distance * 0.0015);
    const phase = distance * frequency - time + source.phase;
    const sine = Math.sin(phase);
    const slope = Math.cos(phase) * frequency * attenuation - sine * 0.0015 * attenuation ** 2;
    height += sine * attenuation;
    if (distance > 0) {
      dx += (slope * deltaX) / distance;
      dy += (slope * deltaY) / distance;
    }
  }
  return { height: height / normalization, dx: dx / normalization, dy: dy / normalization };
}

export function clampPoint(x, y) {
  return { x: Math.max(0.06, Math.min(0.94, x)), y: Math.max(0.06, Math.min(0.94, y)) };
}
