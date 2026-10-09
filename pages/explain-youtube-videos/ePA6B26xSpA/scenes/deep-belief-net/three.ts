import * as THREE from 'three';
import { appear, lerp, progress, setAttributes } from '../../../shared/diagram.ts';
import { createThreeLayer } from '../../../shared/three-diagram.ts';
import type { SceneLayer } from '../../../shared/three-scene.ts';
import { createDeepBeliefNetSVG } from './scene.ts';
import { at, start } from './timing.ts';

// Three.js 판: 오른쪽 신경망은 SVG 판 그대로 두고,
// 왼쪽 "한꺼번에 올린 10층"만 정사영 3D 벽돌 탑으로 그려 실제로 무너지게 한다.
// 무너짐은 층마다 미리 정한 궤적이라 재생 시간만으로 정해진다(탐색·일시정지해도 같은 장면).

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

// "무너지기 쉽습니다"의 "무너지기"에서 탑이 넘어가기 시작한다.
const fallAt = 958.1;
const gravity = 9.8;
// 탑 전체가 왼쪽 아래 모서리를 축으로 넘어가는 각가속도(rad/s²).
const tilt = 3.4;

const naive = { x: 0, count: 10, width: 3, height: .5, depth: 1.6 };

// 층마다 미리 정한 궤적: 함께 기울다가(강체 회전) 위층부터 떨어져 나가 포물선으로 떨어지고, 바닥에 닿아 미끄러지며 눕는다.
const plans = Array.from({ length: naive.count }, (_, i) => {
  const rest = naive.height / 2 + i * naive.height;
  const separate = .48 - .024 * i;
  const theta = .5 * tilt * separate ** 2;
  const omega = tilt * separate;
  const rx = naive.width / 2;
  const px = rx * Math.cos(theta) - rest * Math.sin(theta);
  const py = rx * Math.sin(theta) + rest * Math.cos(theta);
  const origin = new THREE.Vector3(naive.x - naive.width / 2 + px, py, 0);
  const velocity = new THREE.Vector3(
    -omega * py * .42 + (random(i * 5 + 1) - .5) * 1.2,
    omega * px * .4 + random(i * 5 + 2) * .9,
    (random(i * 5 + 3) - .5) * 3.4,
  );
  const spin = new THREE.Vector3((random(i * 5 + 4) - .5) * 3.2, (random(i * 5 + 5) - .5) * 4, omega * (.6 + random(i * 5 + 6) * .9));
  const drop = Math.max(origin.y - naive.height / 2, 0);
  const landing = (velocity.y + Math.sqrt(velocity.y ** 2 + 2 * gravity * drop)) / gravity;
  return { rest, separate, theta, origin, velocity, spin, landing, impact: Math.abs(velocity.y - gravity * landing) };
});

// i 층의 위치와 기울기(재생 시간만으로).
const floorPose = (i: number, time: number) => {
  const plan = plans[i];
  const tau = time - fallAt;
  const pivot = { x: naive.x - naive.width / 2, y: 0 };
  if (tau < plan.separate) {
    // 무너지기 전: "올리면"에서 살짝 흔들리고(가운데 아래 축), "무너지기"부터 함께 기운다(왼쪽 아래 모서리 축).
    if (tau < 0) {
      const sway = time >= at.collapse ? Math.sin((time - at.collapse) * Math.PI * 2 * 2.6) * .028 * progress(time, at.collapse, fallAt - at.collapse) : 0;
      return { x: naive.x - plan.rest * Math.sin(sway), y: plan.rest * Math.cos(sway), z: 0, rx: 0, ry: 0, rz: sway };
    }
    const theta = .5 * tilt * tau * tau;
    const rx = naive.width / 2;
    return {
      x: pivot.x + rx * Math.cos(theta) - plan.rest * Math.sin(theta),
      y: pivot.y + rx * Math.sin(theta) + plan.rest * Math.cos(theta),
      z: 0,
      rx: 0,
      ry: 0,
      rz: theta,
    };
  }
  const s = tau - plan.separate;
  if (s < plan.landing) {
    // 떨어지는 중: 포물선 + 제각각 회전.
    return {
      x: plan.origin.x + plan.velocity.x * s,
      y: plan.origin.y + plan.velocity.y * s - .5 * gravity * s * s,
      z: plan.origin.z + plan.velocity.z * s,
      rx: plan.spin.x * s,
      ry: plan.spin.y * s,
      rz: plan.theta + plan.spin.z * s,
    };
  }
  // 바닥에 닿은 뒤: 한 번 튀고, 미끄러지다 멈추며, 납작하게 눕는다.
  const after = s - plan.landing;
  const land = {
    x: plan.origin.x + plan.velocity.x * plan.landing,
    z: plan.origin.z + plan.velocity.z * plan.landing,
    rx: plan.spin.x * plan.landing,
    ry: plan.spin.y * plan.landing,
    rz: plan.theta + plan.spin.z * plan.landing,
  };
  const slide = (1 - Math.exp(-4 * after)) / 4;
  const flat = (angle: number) => {
    const target = Math.round(angle / Math.PI) * Math.PI;
    return target + (angle - target) * Math.exp(-9 * after);
  };
  const bounce = Math.min(plan.impact / 8, 1) * .35 * Math.abs(Math.sin((Math.PI * after) / .3)) * Math.exp(-after / .2);
  return {
    x: land.x + plan.velocity.x * .45 * slide,
    y: naive.height / 2 + bounce + i * .004,
    z: land.z + plan.velocity.z * .45 * slide,
    rx: flat(land.rx),
    ry: land.ry + plan.spin.y * .25 * (1 - Math.exp(-4 * after)),
    rz: flat(land.rz),
  };
};

// 벽돌 무늬 텍스처.
const brickTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#2c211d';
  context.fillRect(0, 0, 256, 64);
  for (let row = 0; row < 2; row++) {
    for (let column = -1; column < 5; column++) {
      const x = column * 64 + (row % 2 ? 32 : 0);
      const shade = random(row * 11 + column * 3 + 7);
      context.fillStyle = `hsl(${20 + shade * 8}, ${48 + shade * 10}%, ${40 + shade * 9}%)`;
      context.fillRect(x + 3, row * 32 + 3, 58, 26);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 1);
  return texture;
};

// SVG 판에서 왼쪽 탑이 있던 자리(1600×900 좌표). 무너진 층이 왼쪽으로 흩어질 공간까지 포함한다.
const region = { x: 0, y: 150, width: 720, height: 690 };

export const createDeepBeliefNetThree = (): SceneLayer => {
  const base = createDeepBeliefNetSVG({ naiveTower: false });
  const { renderer, scene, camera, render, project, look } = createThreeLayer(base.element, { region, orthographic: {}, placement: 'front' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // 빛과 그림자만 받는 바닥(바닥 자체는 보이지 않아 2D 배경과 어울린다).
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x16171c, 1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-2, 14, 9);
  sun.target.position.set(-2, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.0004;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.ShadowMaterial({ opacity: .5 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const bricks = brickTexture();
  const floors = plans.map(() => {
    const material = new THREE.MeshStandardMaterial({ map: bricks, roughness: .85, metalness: 0, transparent: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(naive.width, naive.height, naive.depth), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { mesh, material };
  });

  // SVG 판의 "한꺼번에 10층" 글자를 3D 탑 아래로 옮겨 붙인다.
  const caption = base.element.querySelector<SVGTextElement>('text.deep-belief-net-caption');

  // SVG 판의 탑 자리(가로 340 근처)와 크기(10층 ≈ 세로 440)에 맞춘 시점.
  const target = new THREE.Vector3(.25, 2.4, 0);
  const distance = 13.5;

  const update = (time: number) => {
    base.update?.(time);

    // 정사영 카메라: 앞쪽 위에서 비스듬히, 아주 천천히 좌우로 흔들린다.
    const orbit = .45 + .06 * Math.sin((time - start) * .16);
    camera.position.set(target.x + distance * Math.sin(orbit), target.y + distance * .38, target.z + distance * Math.cos(orbit));
    look(target);

    // SVG 판과 같은 박자: "한꺼번에 10층을"에서 나타나고, 무너진 뒤 흐려지며, 이름을 바꿀 즈음 사라진다.
    const shown = appear(time, at.allAtOnce, .3) * lerp(1, .22, appear(time, at.collapse + 1.3, .6)) * (1 - appear(time, at.rename, .8));
    floors.forEach(({ mesh, material }, i) => {
      const built = appear(time, at.allAtOnce + i * .012, .35);
      const pose = floorPose(i, time);
      mesh.visible = built > 0 && shown > 0;
      mesh.position.set(pose.x, pose.y + (1 - built) * 3, pose.z);
      mesh.rotation.set(pose.rx, pose.ry, pose.rz);
      material.opacity = built * shown;
    });
    if (caption) {
      const anchor = project(new THREE.Vector3(naive.x, 0, naive.depth));
      setAttributes(caption, { x: anchor.x.toFixed(1), y: (anchor.y + 56).toFixed(1) });
    }

    render();
  };

  return { element: base.element, update };
};
