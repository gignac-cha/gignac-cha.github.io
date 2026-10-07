import * as THREE from 'three';
import { appear, clamp, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import { createThreeDiagram } from '../../../shared/three-diagram';
import type { Variant } from '../../../shared/variants';
import { at, start } from './timing';

// Three.js 판 (임시 비교용). SVG 판과 같은 시점에 맞춰,
// 왼쪽에서는 한꺼번에 올린 10층 벽돌 탑이 실제로 무너지고, 오른쪽에서는 신경망 층이 한 층씩 올라와 굳는다.
// 모든 움직임은 재생 시간만으로 정한다(무너짐도 미리 정한 궤적이라 탐색·일시정지해도 같은 장면이 나온다).

const colors = {
  blue: new THREE.Color(0x5b9dff),
  orange: new THREE.Color(0xffad5b),
  green: new THREE.Color(0x4fd18b),
  yellow: new THREE.Color(0xffd75b),
  slate: new THREE.Color(0x3a3d48),
  line: new THREE.Color(0x3a3b44),
};

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

// "무너지기 쉽습니다"의 "무너지기"에서 탑이 넘어가기 시작한다.
const fallAt = 958.1;
const gravity = 9.8;
// 탑 전체가 왼쪽 아래 모서리를 축으로 넘어가는 각가속도(rad/s²).
const tilt = 3.4;

const naive = { x: -6.4, count: 10, width: 3, height: .5, depth: 1.6 };

// 층마다 미리 정한 궤적: 함께 기울다가(강체 회전) 위층부터 떨어져 나가 포물선으로 떨어지고, 바닥에 닿아 미끄러지며 눕는다.
const plans = Array.from({ length: naive.count }, (_, i) => {
  const rest = naive.height / 2 + i * naive.height;
  const separate = .48 - .024 * i;
  const theta = .5 * tilt * separate ** 2;
  const omega = tilt * separate;
  // 축(왼쪽 아래 모서리)에서 본 층 가운데의 위치를 회전한 값.
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

// 오른쪽: 깊은 신경망. 층마다 판(slab) 위에 뉴런이 놓인다.
const tower = { x: 3.4, spacing: .82, gap: 1.42, slabHeight: .28, depth: 1.8 };
const layerSpecs = [
  { count: 8, name: '입력' },
  { count: 6, name: '1층' },
  { count: 5, name: '2층' },
  { count: 4, name: '3층' },
  { count: 3, name: '4층' },
].map((spec, index) => ({ ...spec, y: .3 + index * tower.gap, width: spec.count * tower.spacing + .5 }));
const nodePosition = (layer: number, i: number) =>
  new THREE.Vector3(tower.x + (i - (layerSpecs[layer].count - 1) / 2) * tower.spacing, layerSpecs[layer].y + tower.slabHeight / 2 + .2, 0);

export const createDeepBeliefNetThree = (): Variant => {
  const { element, root, renderer, scene, camera, render, project } = createThreeDiagram('deep-belief-net-three', '심층 신뢰망');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 빛과 바닥.
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x16171c, .9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 15, 10);
  sun.target.position.set(-1.5, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 45 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.0004;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShadowMaterial({ opacity: .45 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(40, 40, 0x25262d, 0x1a1b20);
  grid.position.y = .001;
  scene.add(grid);

  // 왼쪽 벽돌 탑.
  const bricks = brickTexture();
  const floors = plans.map(() => {
    const material = new THREE.MeshStandardMaterial({ map: bricks, roughness: .85, metalness: 0, transparent: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(naive.width, naive.height, naive.depth), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { mesh, material };
  });

  // 오른쪽 신경망 층.
  const layerViews = layerSpecs.map((spec, index) => {
    const geometry = new THREE.BoxGeometry(spec.width, tower.slabHeight, tower.depth);
    const material = new THREE.MeshStandardMaterial({ color: colors.slate, roughness: .55, metalness: .1, transparent: true });
    const slab = new THREE.Mesh(geometry, material);
    slab.castShadow = true;
    slab.receiveShadow = true;
    scene.add(slab);
    const ghostMaterial = new THREE.LineDashedMaterial({ color: colors.line, dashSize: .18, gapSize: .14, transparent: true });
    const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), ghostMaterial);
    ghost.computeLineDistances();
    ghost.position.set(tower.x, spec.y, 0);
    scene.add(ghost);
    const nodeMaterial = new THREE.MeshStandardMaterial({ color: colors.slate, roughness: .35, metalness: .1, transparent: true });
    const nodes = Array.from({ length: spec.count }, (_, i) => {
      const node = new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 16), nodeMaterial);
      node.castShadow = true;
      node.userData.home = nodePosition(index, i);
      scene.add(node);
      return node;
    });
    let links: THREE.LineSegments | undefined;
    if (index > 0) {
      const points: THREE.Vector3[] = [];
      for (let from = 0; from < layerSpecs[index - 1].count; from++) {
        for (let to = 0; to < spec.count; to++) {
          points.push(nodePosition(index - 1, from), nodePosition(index, to));
        }
      }
      links = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: colors.line, transparent: true }));
      scene.add(links);
    }
    const name = text(root, 0, 0, spec.name, { class: 'dbn-layer-name' });
    return { spec, slab, material, ghost, ghostMaterial, nodes, nodeMaterial, links, name };
  });

  // 위로 올라가며 특징을 요약하는 신호.
  const particleMaterial = new THREE.MeshBasicMaterial({ color: colors.yellow, transparent: true });
  const haloMaterial = new THREE.MeshBasicMaterial({ color: colors.yellow, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false });
  const particles = Array.from({ length: 18 }, (_, i) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), particleMaterial);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), haloMaterial);
    dot.add(halo);
    scene.add(dot);
    return { dot, route: layerSpecs.map((spec, index) => Math.floor(random(i * 7 + index) * spec.count)), offset: random(i * 3 + 1) * 1.6 };
  });

  // 역전파: 위에서 아래로 훑고 내려가는 빛의 판.
  const pulse = new THREE.Mesh(
    new THREE.BoxGeometry(layerSpecs[0].width + .6, .06, tower.depth + .5),
    new THREE.MeshBasicMaterial({ color: colors.orange, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  const pulseGlow = new THREE.Mesh(
    new THREE.BoxGeometry(layerSpecs[0].width + .9, .5, tower.depth + .8),
    new THREE.MeshBasicMaterial({ color: colors.orange, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pulse.add(pulseGlow);
  scene.add(pulse);

  // 글자는 SVG 로 겹친다.
  const naiveLabel = text(root, 0, 0, '한꺼번에 10층', { class: 'dbn-caption' });
  // 정답 이름표는 탑과 무너진 더미 사이의 빈 위쪽에 둔다.
  const tag = svg('g', { class: 'dbn-tag', transform: 'translate(560 200)' }, root);
  svg('path', { d: 'M0 0 H150 L180 30 L150 60 H0 Z', class: 'dbn-tag-body' }, tag);
  svg('circle', { cx: 150, cy: 30, r: 7, class: 'dbn-tag-hole' }, tag);
  text(tag, 70, 41, '정답', { class: 'dbn-tag-text' });
  const strike = svg('line', { x1: -14, y1: 70, x2: 196, y2: -10, class: 'dbn-strike' }, tag);
  const tagCaption = text(tag, 90, 108, '이름표 없이', { class: 'dbn-caption' });
  const trainedLabel = text(root, 0, 0, '학습된다', { class: 'dbn-trained' });
  const deep = svg('g', {}, root);
  const depthArrow = svg('path', { class: 'dbn-depth' }, deep);
  text(deep, 140, 470, '딥러닝', { class: 'dbn-deep-title' });
  text(deep, 140, 530, '층이 깊은', { class: 'dbn-deep-sub' });
  text(deep, 140, 574, '신경망의 학습', { class: 'dbn-deep-sub' });

  const target = new THREE.Vector3(-1.5, 3.2, 0);
  const distance = 17.5;
  const color = new THREE.Color();

  const update = (time: number) => {
    // 카메라: 아주 천천히 좌우로 흔들린다.
    const orbit = .08 * Math.sin((time - start) * .16);
    camera.position.set(target.x + distance * Math.sin(orbit), 5.2, distance * Math.cos(orbit));
    camera.lookAt(target);
    camera.updateMatrixWorld();

    // 왼쪽 탑: "한꺼번에 10층을"에서 한 번에 내려앉고, "무너지기"에서 무너진다. 이후 흐려지고, 이름을 바꿀 즈음 사라진다.
    const faded = lerp(1, .35, appear(time, at.floors[0][0], .8)) * (1 - appear(time, at.rename, .8));
    floors.forEach(({ mesh, material }, i) => {
      const built = appear(time, at.allAtOnce + i * .012, .35);
      const pose = floorPose(i, time);
      mesh.visible = built > 0 && faded > 0;
      mesh.position.set(pose.x, pose.y + (1 - built) * 3, pose.z);
      mesh.rotation.set(pose.rx, pose.ry, pose.rz);
      // 흐려져도 벽돌끼리는 서로 가리게 둔다(속이 비쳐 보이지 않게).
      material.opacity = built * faded;
    });
    const caption = project(new THREE.Vector3(naive.x, 0, 2.6));
    setAttributes(naiveLabel, { x: caption.x.toFixed(1), y: (caption.y + 44).toFixed(1), opacity: (appear(time, at.allAtOnce, .35) * faded).toFixed(3) });

    // 오른쪽: 입력층과 빈 자리(점선)가 먼저 보이고, 층마다 위에서 내려와 굳는다.
    const outline = appear(time, at.outline, .6);
    const backprop = progress(time, at.backprop, at.backpropEnd - at.backprop);
    const pulseY = lerp(layerSpecs[4].y + .5, layerSpecs[0].y, ease(backprop));
    const trained = ease(progress(time, at.trained, .6));
    layerViews.forEach(({ spec, slab, material, ghost, ghostMaterial, nodes, nodeMaterial, links, name }, index) => {
      const [rise, solid] = index === 0 ? [at.outline, at.outline] : at.floors[index - 1];
      const built = index === 0 ? outline : ease(appear(time, rise, .55));
      const hardened = index === 0 ? 1 : ease(progress(time, solid - .15, .35));
      // 내려앉을 때 살짝 눌렸다 돌아온다.
      const squash = index === 0 ? 0 : Math.max(0, 1 - Math.abs(time - (rise + .55)) / .25) * .25;
      const y = spec.y + (1 - built) * 2.6;
      slab.position.set(tower.x, y, 0);
      slab.scale.set(1, 1 - squash, 1);
      slab.visible = built > 0;
      material.opacity = built;
      material.depthWrite = built > .99;
      // 색: 굳는 중(주황) → 굳음(파랑) → 학습됨(초록). 입력층은 처음부터 차분한 회색.
      if (index === 0) {
        color.copy(colors.slate);
      } else {
        color.copy(colors.orange).lerp(colors.blue, hardened);
      }
      color.lerp(colors.green, trained);
      material.color.copy(color);
      // 굳는 순간 한 번 밝게 빛난다. 굳는 동안은 은은하게 숨 쉰다.
      const flash = index === 0 ? 0 : Math.max(0, 1 - Math.abs(time - solid) / .35);
      const breathing = index > 0 && built > 0 && hardened < 1 ? .25 + .2 * Math.sin((time - rise) * 9) : 0;
      material.emissive.copy(color);
      material.emissiveIntensity = (flash * .9 + breathing) * (1 - trained) + trained * .15;
      ghostMaterial.opacity = outline * (1 - built) * .7;
      ghost.visible = ghostMaterial.opacity > 0;

      nodeMaterial.opacity = built;
      nodeMaterial.color.copy(index === 0 ? colors.slate : color);
      nodeMaterial.emissive.copy(nodeMaterial.color);
      nodeMaterial.emissiveIntensity = index === 0 ? .1 : (.15 + flash * .8) * (1 - trained) + trained * .3;
      nodes.forEach((node) => {
        node.visible = built > 0;
        node.position.copy(node.userData.home as THREE.Vector3);
        node.position.y += y - spec.y;
      });

      if (links) {
        const material = links.material as THREE.LineBasicMaterial;
        const hot = backprop > 0 && backprop < 1 && pulseY <= spec.y + .4 && pulseY >= layerSpecs[index - 1].y - .2;
        material.color.copy(hot ? colors.orange : colors.line).lerp(colors.green, hot ? 0 : trained * .7);
        material.opacity = built * (hot ? 1 : .75);
        links.visible = built > .02;
      }

      const anchor = project(new THREE.Vector3(tower.x - spec.width / 2 - 1, spec.y, tower.depth / 2));
      setAttributes(name, { x: anchor.x.toFixed(1), y: (anchor.y + 10).toFixed(1), opacity: (outline * (built > 0 || index === 0 ? 1 : .35)).toFixed(3) });
    });

    // 아래에서 위로: 각 층이 입력을 요약한다(정답 없이).
    const flowing = time >= at.summarize && time < at.backprop;
    particles.forEach(({ dot, route, offset }) => {
      if (!flowing) {
        dot.visible = false;
        return;
      }
      const phase = ((((time - at.summarize + offset) % 1.6) + 1.6) % 1.6) / 1.6;
      const segment = Math.min(Math.floor(phase * 4), 3);
      const local = phase * 4 - segment;
      dot.visible = time >= at.floors[segment][0];
      dot.position.lerpVectors(nodePosition(segment, route[segment]), nodePosition(segment + 1, route[segment + 1]), local);
      dot.position.y += .05;
      particleMaterial.opacity = 1 - phase * .3;
    });
    particleMaterial.opacity = clamp(particleMaterial.opacity);

    // 역전파: 위에서 아래로. 빛의 판 폭은 지나는 층의 폭을 따라간다.
    pulse.visible = backprop > 0 && backprop < 1;
    pulse.position.set(tower.x, pulseY, 0);
    const below = Math.max(layerSpecs.findLastIndex((spec) => spec.y <= pulseY), 0);
    const above = Math.min(below + 1, layerSpecs.length - 1);
    const between = above === below ? 0 : clamp((pulseY - layerSpecs[below].y) / (layerSpecs[above].y - layerSpecs[below].y));
    pulse.scale.x = (lerp(layerSpecs[below].width, layerSpecs[above].width, between) + .6) / (layerSpecs[0].width + .6);

    // 글자.
    const noLabels = appear(time, at.noLabels, .4) * (1 - appear(time, at.backprop, .4));
    setAttributes(tag, { opacity: noLabels.toFixed(3) });
    setAttributes(strike, { opacity: appear(time, at.noLabels + .5, .3).toFixed(3) });
    setAttributes(tagCaption, { opacity: 1 });
    const crown = project(new THREE.Vector3(tower.x, layerSpecs[4].y + 1.15, 0));
    setAttributes(trainedLabel, { x: crown.x.toFixed(1), y: crown.y.toFixed(1), opacity: appear(time, at.trained, .5).toFixed(3) });
    // 깊이 화살표: 1층~4층 오른쪽(넓은 입력층 위)으로 아래에서 위로.
    const arrowX = tower.x + layerSpecs[1].width / 2 + .45;
    const bottom = project(new THREE.Vector3(arrowX, layerSpecs[1].y - .4, 0));
    const peak = project(new THREE.Vector3(arrowX, layerSpecs[4].y + .4, 0));
    setAttributes(depthArrow, {
      d: `M${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)} L${peak.x.toFixed(1)} ${peak.y.toFixed(1)} M${(peak.x - 22).toFixed(1)} ${(peak.y + 28).toFixed(1)} L${peak.x.toFixed(1)} ${peak.y.toFixed(1)} L${(peak.x + 22).toFixed(1)} ${(peak.y + 28).toFixed(1)}`,
    });
    setAttributes(deep, { opacity: appear(time, at.deepLearning, .6).toFixed(3) });

    render();
  };

  return { element, update };
};
