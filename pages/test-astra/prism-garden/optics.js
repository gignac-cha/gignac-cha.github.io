import { THREE } from '../tools/studio.js';

export const spectrum = [
  { wavelength: 700, color: '#ff6457' },
  { wavelength: 620, color: '#ffa357' },
  { wavelength: 570, color: '#f4df82' },
  { wavelength: 530, color: '#96e4aa' },
  { wavelength: 490, color: '#69dfe5' },
  { wavelength: 440, color: '#739fff' },
  { wavelength: 380, color: '#b497ff' },
];

export function refract(direction, normal, ratio) {
  const cosine = -direction.dot(normal);
  const discriminant = 1 - ratio * ratio * (1 - cosine * cosine);
  if (discriminant < 0) return direction.clone().reflect(normal).normalize();
  return direction
    .clone()
    .multiplyScalar(ratio)
    .addScaledVector(normal, ratio * cosine - Math.sqrt(discriminant))
    .normalize();
}

export function traceLight(origin, direction, prisms, index) {
  const points = [origin.clone()];
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.002;
  raycaster.far = 15;
  let point = origin.clone();
  let ray = direction.clone().normalize();
  for (let step = 0; step < 9; step++) {
    raycaster.set(point.clone().addScaledVector(ray, 0.004), ray);
    const hit = raycaster.intersectObjects(prisms, false)[0];
    if (!hit) {
      points.push(point.clone().addScaledVector(ray, 11));
      break;
    }
    const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    const entering = ray.dot(normal) < 0;
    if (!entering) normal.negate();
    ray = refract(ray, normal, entering ? 1 / index : index);
    point = hit.point.clone();
    points.push(point);
  }
  return points;
}
