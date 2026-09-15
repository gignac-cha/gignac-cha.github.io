export const RING_COUNT = 48;
export function ringPose(
  index,
  { form = 0, openness = 0.16, twist = 1.8, time = 0, pulse = 0, hover = 0 } = {},
) {
  const t = index / (RING_COUNT - 1);
  const centered = t - 0.5;
  const envelope = Math.sin(Math.PI * t);
  const breathing = Math.sin(time * 0.8 - t * Math.PI * 3) * 0.035;
  let radius,
    y,
    rotationX = 0,
    rotationZ = 0;
  if (form === 1) {
    radius = 0.48 + 0.9 * t + envelope * 0.21;
    y = centered * 3.25;
    rotationX = Math.sin(t * Math.PI) * 0.12;
  } else if (form === 2) {
    radius = 0.32 + 1.42 * t;
    y = centered * 0.75;
    rotationX = centered * 1.85;
    rotationZ = Math.sin(t * Math.PI) * 0.35;
  } else {
    radius = 0.24 + Math.pow(envelope, 0.68) * 1.27;
    y = centered * 3.7;
    rotationX = Math.sin(t * Math.PI * 2) * 0.1;
  }
  const spread = openness + pulse * 0.55;
  radius += spread * 0.25 + hover * 0.15 + breathing;
  y *= 1 + spread * 0.2;
  rotationX += Math.sin(time * 0.5 + t * 4) * 0.035 + hover * 0.17;
  rotationZ += Math.cos(time * 0.45 - t * 3) * 0.025 + spread * Math.sin(t * 7) * 0.12;
  return {
    x: Math.sin(t * Math.PI * 2 + time * 0.35) * spread * 0.22,
    y,
    z: Math.cos(t * Math.PI * 2 + time * 0.35) * spread * 0.18,
    radius,
    rotationX,
    rotationY: centered * twist + Math.sin(time * 0.45 + t * 5) * 0.08,
    rotationZ,
  };
}
