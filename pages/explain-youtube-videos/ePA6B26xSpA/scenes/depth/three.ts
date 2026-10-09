import './depth.scss';
import * as THREE from 'three';
import { appear, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import { createThreeDiagram } from '../../../shared/three-diagram';
import type { SceneLayer } from '../../../shared/three-scene';
import { depthTimeline as timeline } from './timeline';

// Three.js 판: 층을 실제 입체 판으로 쌓는다.
// 1. 알렉스넷 8층이 한 장씩 쌓이고, 위에 "더 쌓으면?" 빈 판.
// 2. 층마다 본 특징 지도가 판에서 빠져나와 옆에 펼쳐진다: 선·모서리 → 부품 → 전체 모양.
// 3. 알렉스넷·VGG·구글넷 세 탑이 나란히 솟고, 꼭대기를 잇는 "깊이 = 실력?" 곡선.
// 모든 움직임은 재생 시간으로 정한다.

const COLOR = {
  blue: new THREE.Color('#5b9dff'),
  purple: new THREE.Color('#b18cff'),
  green: new THREE.Color('#4fd18b'),
  gray: new THREE.Color('#55565e'),
  yellow: new THREE.Color('#ffd75b'),
};

// 아래층은 파랑(선), 가운데는 보라(부품), 위층은 초록(전체 모양).
const levelColor = (t: number, target = new THREE.Color()) =>
  t < .5 ? target.lerpColors(COLOR.blue, COLOR.purple, t * 2) : target.lerpColors(COLOR.purple, COLOR.green, (t - .5) * 2);

const WHITE = new THREE.Color('#ffffff');
const slab = { width: 2.4, height: .12, depth: 1.6 };
const loose = .5;
const compact = .22;
const towerX = { alexnet: -4.6, vgg: 0, googlenet: 4.6 };
const asideX = -5;

// 판에서 빠져나오는 특징 지도. 그림은 SVG 판과 같은 선(120×120 칸 기준).
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rows = [
  {
    level: '첫 층',
    name: '선 · 모서리',
    color: '#5b9dff',
    slabs: [0, 1, 2],
    at: timeline.edges,
    tiles: [
      { width: 120, paths: ['M24 60 H96'] },
      { width: 120, paths: ['M60 24 V96'] },
      { width: 120, paths: ['M30 90 L90 30'] },
      { width: 120, paths: ['M34 32 V88 H90'] },
    ],
  },
  {
    level: '다음 층',
    name: '부품',
    color: '#b18cff',
    slabs: [3, 4, 5],
    at: timeline.parts,
    tiles: [
      { width: 120, paths: ['M18 60 Q60 26 102 60 Q60 94 18 60 Z', circle(60, 60, 13)] },
      { width: 120, paths: [circle(60, 60, 38), circle(60, 60, 9), 'M60 22 V51 M60 69 V98 M22 60 H51 M69 60 H98'] },
      { width: 120, paths: ['M24 82 L38 42 H82 L96 82 Z', 'M60 42 V82'] },
      { width: 120, paths: ['M62 24 Q44 70 54 84 Q62 92 76 84'] },
    ],
  },
  {
    level: '위층',
    name: '전체 모양',
    color: '#4fd18b',
    slabs: [6, 7],
    at: timeline.whole,
    tiles: [
      { width: 120, paths: [circle(60, 60, 40), circle(46, 52, 4), circle(74, 52, 4), 'M44 72 Q60 86 76 72'] },
      { width: 216, paths: ['M18 84 L40 52 H128 L162 70 H198 V92 H18 Z', 'M52 52 L44 70 H86 V52 M98 52 V70 H140 L124 52', circle(56, 94, 15), circle(160, 94, 15)] },
    ],
  },
] as const;

const tileTexture = (width: number, paths: readonly string[], color: string) => {
  const scale = 2.4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(120 * scale);
  const context = canvas.getContext('2d')!;
  context.scale(scale, scale);
  context.beginPath();
  context.roundRect(2, 2, width - 4, 116, 14);
  context.fillStyle = '#16171b';
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = color;
  context.globalAlpha = .55;
  context.stroke();
  context.globalAlpha = 1;
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = color;
  for (const path of paths) {
    context.stroke(new Path2D(path));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

// 카메라 구도: 알렉스넷 → 층별 특징 → 세 탑 비교 → 믿음.
const shots = {
  alexnet: { position: new THREE.Vector3(4.6, 4.4, 10.8), target: new THREE.Vector3(0, 1.9, 0) },
  hierarchy: { position: new THREE.Vector3(3.2, 3.9, 12.2), target: new THREE.Vector3(.5, 1.9, 0) },
  compare: { position: new THREE.Vector3(3.2, 4.6, 15.2), target: new THREE.Vector3(0, 2.5, 0) },
  belief: { position: new THREE.Vector3(2.2, 5.8, 15.6), target: new THREE.Vector3(0, 3.1, 0) },
};

const createTower = (scene: THREE.Scene, count: number) =>
  Array.from({ length: count }, () => {
    const material = new THREE.MeshStandardMaterial({ color: COLOR.gray, roughness: .55, metalness: .05, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(slab.width, slab.height, slab.depth), material);
    mesh.castShadow = true;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: COLOR.gray, transparent: true, opacity: 0 }),
    );
    mesh.add(edges);
    scene.add(mesh);
    return { mesh, material, edges: edges.material as THREE.LineBasicMaterial };
  });

const setSlab = (
  view: ReturnType<typeof createTower>[number],
  position: THREE.Vector3Like,
  color: THREE.Color,
  opacity: number,
) => {
  view.mesh.position.set(position.x, position.y, position.z);
  view.mesh.visible = opacity > .001;
  view.material.color.copy(color);
  view.material.emissive.copy(color).multiplyScalar(.18);
  view.material.opacity = opacity * .88;
  view.edges.color.copy(color).lerp(WHITE, .25);
  view.edges.opacity = opacity;
};

export const createDepthThree = (): SceneLayer => {
  // 정사영 카메라: 원근 없이 층의 두께와 높이를 그대로 비교한다.
  const { element, root, renderer, scene, camera, render, project, look } = createThreeDiagram('depth depth-three', '깊이와 계층 특징', { orthographic: {} });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.fog = new THREE.Fog('#0f1013', 18, 34);

  scene.add(new THREE.HemisphereLight('#c9d6ff', '#1a1b20', .9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(5, 11, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 30 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .32 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(40, 40, '#2a2b31', '#1b1c21');
  grid.position.y = -.005;
  scene.add(grid);

  const alexnet = createTower(scene, 8);
  const vgg = createTower(scene, 19);
  const googlenet = createTower(scene, 22);

  // "더 쌓으면?" 비어 있는 판: 옅은 몸체에 흐린 테두리.
  const ghostBox = new THREE.BoxGeometry(slab.width, slab.height, slab.depth);
  const ghostBody = new THREE.MeshBasicMaterial({ color: '#a0a0a8', transparent: true, opacity: 0, depthWrite: false });
  const ghost = new THREE.Mesh(ghostBox, ghostBody);
  const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(ghostBox), new THREE.LineBasicMaterial({ color: '#c9c9d0', transparent: true, opacity: 0 }));
  ghost.add(ghostEdges);
  scene.add(ghost);

  // 층별 특징 지도: 판에서 빠져나와 옆으로 펼쳐진다.
  const rowY = (row: (typeof rows)[number]) => .06 + ((row.slabs as readonly number[]).reduce((sum, index) => sum + index, 0) / row.slabs.length) * loose;
  const panels = rows.flatMap((row, rowIndex) => {
    let x = .25;
    return row.tiles.map((tile, tileIndex) => {
      const width = tile.width / 120;
      const material = new THREE.MeshBasicMaterial({ map: tileTexture(tile.width, tile.paths, row.color), transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 1), material);
      scene.add(mesh);
      const home = new THREE.Vector3(x + width / 2, rowY(row), .2);
      x += width + .25;
      return { mesh, material, home, rowIndex, tileIndex };
    });
  });

  // "더 추상적": 특징 지도 옆으로 위를 향한 화살표.
  const arrowLength = 3.6;
  const abstractArrow = new THREE.Group();
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: COLOR.yellow, transparent: true, opacity: 0 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1, 12), arrowMaterial);
  const head = new THREE.Mesh(new THREE.ConeGeometry(.13, .3, 20), arrowMaterial);
  abstractArrow.add(shaft, head);
  abstractArrow.position.set(5.6, .1, .2);
  scene.add(abstractArrow);

  // VGG 의 작은 돋보기(3×3): 판 윗면을 천천히 훑는다.
  const kernelSize = .1;
  const kernels = new THREE.InstancedMesh(
    new THREE.BoxGeometry(kernelSize, kernelSize * .5, kernelSize),
    new THREE.MeshStandardMaterial({ color: COLOR.yellow, emissive: COLOR.yellow, emissiveIntensity: .45, roughness: .4 }),
    19 * 9,
  );
  scene.add(kernels);

  // "깊이 = 실력?": 세 탑의 꼭대기 위를 휘어 넘는 곡선.
  const beliefCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(towerX.alexnet, 2.45, 0),
    new THREE.Vector3(-2.6, 4.4, 0),
    new THREE.Vector3(towerX.vgg, 5.1, 0),
    new THREE.Vector3(2.5, 5.85, 0),
    new THREE.Vector3(towerX.googlenet - .2, 5.95, 0),
  ]);
  const beliefSegments = 160;
  const beliefTube = new THREE.Mesh(
    new THREE.TubeGeometry(beliefCurve, beliefSegments, .045, 10, false),
    new THREE.MeshBasicMaterial({ color: COLOR.yellow }),
  );
  scene.add(beliefTube);
  const beliefHead = new THREE.Mesh(new THREE.ConeGeometry(.16, .38, 20), new THREE.MeshBasicMaterial({ color: COLOR.yellow, transparent: true }));
  scene.add(beliefHead);
  const beliefIndexCount = beliefTube.geometry.index!.count;

  // 글자는 SVG 로 위에 겹친다.
  const overlay = svg('g', {}, root);
  const towerLabel = (name: string, layers: string) => {
    const group = svg('g', { opacity: 0 }, overlay);
    const title = text(group, 0, 0, name, { class: 'depth-tower-name' });
    const sub = text(group, 0, 40, layers, { class: 'depth-tower-layers' });
    return { group, title, sub };
  };
  const alexnetLabel = towerLabel('알렉스넷', '8층');
  const vggLabel = towerLabel('VGG', '16~19층');
  const googlenetLabel = towerLabel('', '22층');
  googlenetLabel.title.innerHTML = '<tspan>Goog</tspan><tspan class="depth-homage">LeNet</tspan>';
  const homage = googlenetLabel.title.querySelector('.depth-homage')!;
  const ghostLabel = text(overlay, 0, 0, '더 쌓으면?', { class: 'depth-ghost-label', opacity: 0 });
  const rowLabels = rows.map((row) => {
    const group = svg('g', { opacity: 0 }, overlay);
    text(group, 0, -16, row.level, { class: 'depth-row-level' });
    text(group, 0, 26, row.name, { class: 'depth-row-name', style: `fill: ${row.color}` });
    return group;
  });
  const abstractLabel = text(overlay, 0, 0, '더 추상적', { class: 'depth-abstract-label', opacity: 0 });
  const winner = svg('g', { class: 'depth-winner', opacity: 0 }, overlay);
  svg('rect', { x: -90, y: -26, width: 180, height: 52, rx: 26 }, winner);
  text(winner, 0, 10, '대회 우승', {});
  const beliefLabel = text(overlay, 0, 0, '깊이 = 실력?', { class: 'depth-belief-label', opacity: 0 });

  const scratch = new THREE.Vector3();
  const color = new THREE.Color();
  const level = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const rowColors = rows.map((row) => new THREE.Color(row.color));
  const matrix = new THREE.Matrix4();
  const place = (element: Element, position: THREE.Vector3, dx = 0, dy = 0, extra: Record<string, string | number> = {}) => {
    const point = project(position);
    setAttributes(element, { transform: `translate(${(point.x + dx).toFixed(1)} ${(point.y + dy).toFixed(1)})`, ...extra });
  };

  const update = (time: number) => {
    const aside = ease(progress(time, timeline.edges - .9, .8));
    const compare = ease(progress(time, timeline.compare, .9));
    const belief = ease(progress(time, timeline.belief, 1.2));

    // 카메라: 단계마다 구도를 옮기고, 아주 천천히 둘러본다.
    const position = shots.alexnet.position.clone().lerp(shots.hierarchy.position, aside).lerp(shots.compare.position, compare).lerp(shots.belief.position, belief);
    const target = shots.alexnet.target.clone().lerp(shots.hierarchy.target, aside).lerp(shots.compare.target, compare).lerp(shots.belief.target, belief);
    const orbit = Math.sin((time - timeline.alexnet) * .12) * .08;
    position.sub(target).applyAxisAngle(up, orbit).add(target);
    camera.position.copy(position);
    look(target);
    camera.updateMatrixWorld();

    // 알렉스넷: 가운데에 한 장씩 쌓이고, 층별 설명 때 왼쪽으로 비켜섰다가, 비교 때 촘촘해진다.
    const alexX = lerp(lerp(0, asideX, aside), towerX.alexnet, compare);
    const spacing = lerp(loose, compact, compare);
    alexnet.forEach((view, index) => {
      const shown = appear(time, timeline.alexnet + index * .14, .3);
      const row = rows.findIndex((candidate) => (candidate.slabs as readonly number[]).includes(index));
      const lit = row >= 0 ? appear(time, rows[row].at, .4) * (1 - compare) : 0;
      color.copy(COLOR.gray).lerp(row >= 0 ? rowColors[row] : COLOR.gray, lit);
      color.lerp(levelColor(index / 7, level), compare);
      setSlab(view, { x: alexX, y: .06 + index * spacing + (1 - shown) * .5, z: 0 }, color, shown * lerp(.62, 1, Math.max(lit, compare)));
    });
    const ghostShown = appear(time, timeline.deeper, .4) * (1 - appear(time, timeline.edges - 1.2, .4));
    ghost.position.set(alexX, .06 + 8 * loose + Math.sin(time * 2.4) * .04, 0);
    // 깜빡이듯 숨 쉬는 빈 판.
    const breathe = .75 + Math.sin(time * 3) * .25;
    ghostBody.opacity = ghostShown * .16 * breathe;
    (ghostEdges.material as THREE.LineBasicMaterial).opacity = ghostShown * .7 * breathe;
    ghost.visible = ghostShown > .001;

    // 층별 특징 지도.
    const hierarchy = 1 - compare;
    for (const panel of panels) {
      const row = rows[panel.rowIndex];
      const out = ease(progress(time, row.at + panel.tileIndex * .12, .65));
      const source = scratch.set(alexX, rowY(row), 0);
      panel.mesh.position.copy(source).lerp(panel.home, out);
      panel.mesh.scale.setScalar(lerp(.25, 1, out));
      panel.mesh.quaternion.copy(camera.quaternion);
      panel.material.opacity = Math.min(out * 1.6, 1) * hierarchy;
      panel.mesh.visible = panel.material.opacity > .001;
    }
    const abstractShown = appear(time, timeline.abstract, .5) * hierarchy;
    const grow = ease(progress(time, timeline.abstract, .9));
    const length = Math.max(arrowLength * grow, .001);
    shaft.scale.y = length;
    shaft.position.y = length / 2;
    head.position.y = length + .15;
    arrowMaterial.opacity = abstractShown;
    abstractArrow.visible = abstractShown > .001;

    // VGG 와 구글넷: 판이 하나씩 내려앉으며 쌓인다.
    const vggBuilt = lerp(0, 16, progress(time, timeline.vgg, timeline.vggDeeper - timeline.vgg)) + lerp(0, 3, progress(time, timeline.vggDeeper, .7));
    const googlenetBuilt = lerp(0, 22, progress(time, timeline.googlenet, 1.5));
    const build = (tower: ReturnType<typeof createTower>, x: number, built: number) =>
      tower.forEach((view, index) => {
        const shown = ease(Math.min(Math.max(built - index, 0), 1));
        setSlab(view, { x, y: .06 + index * compact + (1 - shown) * .45, z: 0 }, levelColor(index / (tower.length - 1), color), shown);
      });
    build(vgg, towerX.vgg, vggBuilt);
    build(googlenet, towerX.googlenet, googlenetBuilt);

    vgg.forEach((view, index) => {
      const shown = appear(time, timeline.vggKernels + index * .07, .25) * Math.min(Math.max(vggBuilt - index, 0), 1);
      const sweep = Math.sin((time - timeline.vggKernels) * .9 + index * .7) * (slab.width / 2 - .25);
      for (let cell = 0; cell < 9; cell++) {
        const column = cell % 3;
        const row = Math.floor(cell / 3);
        matrix.makeScale(shown, shown, shown);
        matrix.setPosition(
          towerX.vgg + sweep + (column - 1) * (kernelSize + .025),
          view.mesh.position.y + slab.height / 2 + kernelSize * .25,
          .25 + (row - 1) * (kernelSize + .025),
        );
        kernels.setMatrixAt(index * 9 + cell, matrix);
      }
    });
    kernels.instanceMatrix.needsUpdate = true;

    // 믿음의 곡선: 왼쪽 탑에서 오른쪽 탑으로 그려 나간다.
    const drawn = belief;
    beliefTube.geometry.setDrawRange(0, Math.floor((beliefIndexCount * drawn) / 6) * 6);
    beliefTube.visible = drawn > .001;
    const tip = beliefCurve.getPointAt(Math.max(drawn, .001));
    const tangent = beliefCurve.getTangentAt(Math.max(drawn, .001));
    beliefHead.position.copy(tip);
    beliefHead.quaternion.setFromUnitVectors(up, tangent);
    beliefHead.visible = drawn > .02;

    render();

    // 글자: 입체 위치를 화면 좌표로 옮겨 붙인다.
    place(alexnetLabel.group, scratch.set(alexX, 0, slab.depth / 2), 0, 56, { opacity: appear(time, timeline.alexnetLabel, .5).toFixed(3) });
    place(vggLabel.group, scratch.set(towerX.vgg, 0, slab.depth / 2), 0, 56, { opacity: appear(time, timeline.vgg, .5).toFixed(3) });
    place(googlenetLabel.group, scratch.set(towerX.googlenet, 0, slab.depth / 2), 0, 56, { opacity: appear(time, timeline.googlenet, .5).toFixed(3) });
    homage.classList.toggle('on', time >= timeline.homage);
    place(ghostLabel, scratch.set(alexX + slab.width / 2 + .55, ghost.position.y, 0), 0, 10, { opacity: ghostShown.toFixed(3) });
    rows.forEach((row, index) => {
      place(rowLabels[index], scratch.set(-2.35, rowY(row), .2), 0, 0, { opacity: (appear(time, row.at, .5) * hierarchy).toFixed(3) });
    });
    const label = project(scratch.set(abstractArrow.position.x, 1.9, abstractArrow.position.z));
    setAttributes(abstractLabel, { transform: `translate(${(label.x + 44).toFixed(1)} ${label.y.toFixed(1)}) rotate(-90)`, opacity: abstractShown.toFixed(3) });
    place(winner, scratch.set(towerX.googlenet, .06 + 22 * compact + .55, 0), 0, -20, {
      opacity: (appear(time, timeline.winner, .4) * (1 - appear(time, timeline.homage - .4, .4))).toFixed(3),
    });
    const end = beliefCurve.getPointAt(1);
    place(beliefLabel, scratch.copy(end), 34, 12, { opacity: progress(time, timeline.belief + 1, .4).toFixed(3) });
  };

  return { element, update };
};
