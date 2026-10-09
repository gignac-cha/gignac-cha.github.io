import * as THREE from 'three';
import { appear, clamp, ease, lerp, progress } from '../../../shared/diagram.ts';
import { createThreeLayer } from '../../../shared/three-diagram.ts';
import type { SceneLayer } from '../../../shared/three-scene.ts';
import { DEPTH, diffusedAt, inkClock, inkPosition3d, PARTICLES, surface, tank } from './ink.ts';
import { gaussian } from './noise.ts';
import { createDiffusionSvg } from './scene.ts';
import { at, start } from './timing.ts';

// Three.js 판: 잉크 수조만 정사영 입체로 그린다. 사진·잡음 사슬과 글자는 SVG 판 그대로다.
// 입자는 SVG 판과 같은 잉크 시계·씨앗으로 움직이고(정면에서 보면 SVG 판과 같은 모양), 앞뒤로도 펼쳐져 수조 안을 채운다.

// 수조가 놓일 자리(1600×900 SVG 좌표). 떨어지는 방울과 비스듬히 본 수조가 들어갈 만큼.
const region = { x: 300, y: 110, width: 1000, height: 700 };
// SVG 좌표(픽셀) → 3D(1 = 100px). 수조 바닥 가운데가 원점이고 y 는 위쪽.
const S = 100;
const worldX = (x: number) => (x - 800) / S;
const worldY = (y: number) => (tank.bottom - y) / S;
const W = (tank.right - tank.left) / S;
const H = (tank.bottom - tank.top) / S;
const D = DEPTH / S;
const waterTop = worldY(surface);
const INK = 0x7a63ff;
// 입자 하나를 작은 점 셋으로 나눠 그려 잉크 덩어리가 부드럽게 보이게 한다.
const SUB = 3;

// SVG 판의 방울 모양(꼭지가 위, 아래가 둥근 물방울)을 돌려 만든 입체. 원점은 SVG 경로의 원점과 같다.
const dropGeometry = () => {
  const points: THREE.Vector2[] = [];
  for (let k = 0; k <= 12; k++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (k / 12);
    points.push(new THREE.Vector2((15 * Math.cos(a)) / S, -(6 - 15 * Math.sin(a)) / S));
  }
  const bezier = [[15, 6], [15, -4], [9, -12], [0, -26]];
  for (let k = 1; k <= 16; k++) {
    const t = k / 16;
    const u = 1 - t;
    const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const x = weights.reduce((sum, w, i) => sum + w * bezier[i][0], 0);
    const y = weights.reduce((sum, w, i) => sum + w * bezier[i][1], 0);
    points.push(new THREE.Vector2(Math.max(x, 0) / S, -y / S));
  }
  return new THREE.LatheGeometry(points, 32);
};

const vertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uScale;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uScale;
  }
`;
// 갓 떨어진 잉크는 가장자리가 또렷한 점, 번질수록 가운데만 진하고 가장자리로 옅어지는 부드러운 점.
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSoft;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = dot(c, c);
    if (d > 1.0) discard;
    float crisp = 1.0 - smoothstep(0.55, 1.0, sqrt(d));
    float soft = exp(-3.5 * d) * (1.0 - smoothstep(0.8, 1.0, d));
    gl_FragColor = vec4(uColor, uOpacity * mix(crisp, soft, uSoft));
    #include <colorspace_fragment>
  }
`;

export const createDiffusionThree = (): SceneLayer => {
  const base = createDiffusionSvg({ ink3d: true });
  const { renderer, scene, camera, render, look } = createThreeLayer(base.element, { region, orthographic: {}, placement: 'front' });
  const canvas = renderer.domElement;
  const resetButton = base.element.querySelector<HTMLElement>('.three-view-reset');

  scene.add(new THREE.HemisphereLight(0xe4e9ff, 0x1a1b22, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 8, 6);
  scene.add(sun);

  // 물: 안쪽 면(뒤·바닥)은 조금 진하게, 앞면은 아주 옅게. 잉크는 그 사이에 그려 물속에 있는 것처럼 보인다.
  const waterGeometry = new THREE.BoxGeometry(W, waterTop, D).translate(0, waterTop / 2, 0);
  const waterBack = new THREE.Mesh(waterGeometry, new THREE.MeshBasicMaterial({ color: 0x5b9dff, transparent: true, opacity: .1, side: THREE.BackSide, depthWrite: false }));
  waterBack.renderOrder = 1;
  const waterFront = new THREE.Mesh(waterGeometry, new THREE.MeshBasicMaterial({ color: 0x5b9dff, transparent: true, opacity: .04, depthWrite: false }));
  waterFront.renderOrder = 5;
  // 물 전체가 뿌옇게 되는 정도(SVG 판의 haze 와 같은 값).
  const hazeMaterial = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0, depthWrite: false });
  const haze = new THREE.Mesh(waterGeometry, hazeMaterial);
  haze.renderOrder = 4;
  const waterSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2).translate(0, waterTop, 0),
    new THREE.MeshBasicMaterial({ color: 0x9db4ff, transparent: true, opacity: .07, side: THREE.DoubleSide, depthWrite: false }),
  );
  waterSurface.renderOrder = 5;

  // 유리 수조: 윗면이 열린 옅은 유리 판과 SVG 판의 유리 선과 같은 색의 모서리.
  const glass = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .025, side: THREE.DoubleSide, depthWrite: false });
  const open = new THREE.MeshBasicMaterial({ visible: false });
  const panes = new THREE.Mesh(new THREE.BoxGeometry(W, H, D).translate(0, H / 2, 0), [glass, glass, open, glass, glass, glass]);
  panes.renderOrder = 2;
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0x8b8b94 });
  const edges = new THREE.Group();
  const t = .04;
  for (const y of [0, H]) {
    for (const z of [-D / 2, D / 2]) {
      edges.add(new THREE.Mesh(new THREE.BoxGeometry(W + t, t, t).translate(0, y, z), edgeMaterial));
    }
    for (const x of [-W / 2, W / 2]) {
      edges.add(new THREE.Mesh(new THREE.BoxGeometry(t, t, D + t).translate(x, y, 0), edgeMaterial));
    }
  }
  for (const x of [-W / 2, W / 2]) {
    for (const z of [-D / 2, D / 2]) {
      edges.add(new THREE.Mesh(new THREE.BoxGeometry(t, H, t).translate(x, H / 2, z), edgeMaterial));
    }
  }

  // 수면에 닿는 순간 퍼지는 물결.
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0x9d8dff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64).rotateX(-Math.PI / 2), rippleMaterial);
  ripple.position.y = waterTop + .005;
  ripple.renderOrder = 6;

  // 떨어지는 방울과, 거꾸로 돌려 다시 모인 방울.
  const dropMaterial = () => new THREE.MeshStandardMaterial({ color: INK, roughness: .25, metalness: 0, emissive: 0x2a1f80, emissiveIntensity: .5, transparent: true });
  const drop = new THREE.Mesh(dropGeometry(), dropMaterial());
  const gatheredDrop = new THREE.Mesh(drop.geometry, dropMaterial());
  gatheredDrop.position.set(0, worldY(surface + 26), 0);

  // 잉크 입자: 부드러운 점. 색이 하나라 그리는 순서와 상관없이 겹친 만큼 진해진다.
  const count = PARTICLES * SUB;
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  const jitter = gaussian(20153, count * 3);
  const uniforms = {
    uColor: { value: new THREE.Color(INK) },
    uSize: { value: .1 },
    uScale: { value: 100 },
    uOpacity: { value: 0 },
    uSoft: { value: 0 },
  };
  const inkMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false });
  const ink = new THREE.Points(geometry, inkMaterial);
  ink.frustumCulled = false;
  ink.renderOrder = 3;
  // 점 크기는 화면 픽셀이라, 그리기 직전에 지금 캔버스에서 3D 1 이 몇 픽셀인지로 맞춘다(확대·축소 포함).
  const buffer = new THREE.Vector2();
  ink.onBeforeRender = (current) => {
    current.getDrawingBufferSize(buffer);
    const ortho = camera as THREE.OrthographicCamera;
    uniforms.uScale.value = buffer.y / ((ortho.top - ortho.bottom) / ortho.zoom);
  };

  scene.add(waterBack, panes, ink, haze, waterFront, waterSurface, ripple, edges, drop, gatheredDrop);

  // 정사영 카메라: 수조를 앞쪽 위에서 비스듬히(3/4) 보고, 아주 천천히 좌우로 흔들린다. 3D 1 = SVG 100px 이 되는 거리.
  const target = new THREE.Vector3(0, 2.2, 0);
  const distance = region.height / 2 / S / Math.tan(THREE.MathUtils.degToRad(17.5));

  const update = (time: number) => {
    base.update?.(time);
    // 잉크 부분에서만 보인다.
    const shown = appear(time, at.physics, .6) * (1 - appear(time, at.picture, .6));
    canvas.style.opacity = shown.toFixed(3);
    canvas.style.visibility = shown > 0 ? '' : 'hidden';
    if (resetButton) {
      resetButton.style.visibility = shown > 0 ? '' : 'hidden';
    }
    if (shown <= 0) {
      return;
    }

    const yaw = -.6 + .07 * Math.sin((time - start) * .25);
    const pitch = .3;
    camera.position.set(
      target.x + distance * Math.sin(yaw) * Math.cos(pitch),
      target.y + distance * Math.sin(pitch),
      target.z + distance * Math.cos(yaw) * Math.cos(pitch),
    );
    look(target);

    const landed = time >= at.land;
    const fall = progress(time, at.drop, at.land - at.drop);
    drop.position.set(0, worldY(lerp(200, surface + 6, fall * fall)), 0);
    drop.visible = !landed && time >= at.ink;
    (drop.material as THREE.MeshStandardMaterial).opacity = appear(time, at.ink, .4);

    const e = inkClock(time);
    const amount = diffusedAt(e);
    const regathered = appear(time, at.gather + at.gathered - .25, .25);
    ink.visible = landed && regathered < 1;
    if (ink.visible) {
      // 진한 잉크는 작고 또렷한 점이 촘촘히 모여 있고, 번질수록 점이 커지고 흐려져 옅은 구름이 된다.
      const radius = 4.5 + 15 * Math.sqrt(amount);
      const blur = 1.6 + 12 * Math.sqrt(amount);
      const spread = 3 + 20 * Math.sqrt(amount);
      // 점이 커져도 유리 밖으로 번져 보이지 않도록 벽에서 점 반지름의 절반만큼 띄운다.
      const margin = 4 + (radius + blur) * .55;
      for (let p = 0; p < PARTICLES; p++) {
        const [x, y, z] = inkPosition3d(p, e);
        for (let s = 0; s < SUB; s++) {
          const i = p * SUB + s;
          const offset = s === 0 ? 0 : spread;
          positions[i * 3] = worldX(clamp(x + jitter[i * 3] * offset, tank.left + margin, tank.right - margin));
          positions[i * 3 + 1] = worldY(clamp(y + jitter[i * 3 + 1] * offset, surface + 4, tank.bottom - margin));
          positions[i * 3 + 2] = clamp(z + jitter[i * 3 + 2] * offset, -DEPTH / 2 + margin, DEPTH / 2 - margin) / S;
        }
      }
      positionAttribute.needsUpdate = true;
      uniforms.uSize.value = (2 * (radius + 1.1 * blur)) / S;
      uniforms.uSoft.value = Math.sqrt(amount);
      uniforms.uOpacity.value = lerp(.24, .085, Math.sqrt(amount)) * (1 - regathered);
    }
    hazeMaterial.opacity = landed ? .3 * amount ** 1.5 * (1 - regathered) : 0;

    gatheredDrop.visible = regathered > 0;
    (gatheredDrop.material as THREE.MeshStandardMaterial).opacity = regathered;

    const wave = progress(e, 0, 1.1);
    const rippleRadius = (12 + 150 * ease(wave)) / S;
    ripple.scale.set(rippleRadius, 1, Math.min(rippleRadius, D / 2 - .05));
    rippleMaterial.opacity = landed && wave < 1 ? .8 * (1 - wave) * (1 - regathered) : 0;

    render();
  };

  return { element: base.element, update };
};
