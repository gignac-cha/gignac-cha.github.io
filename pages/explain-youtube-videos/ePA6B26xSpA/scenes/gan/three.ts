import './three.scss';
import * as THREE from 'three';
import { appear, between, clamp, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import { createThreeDiagram } from '../../../shared/three-diagram';
import type { SceneLayer } from '../../../shared/three-scene';
import { FACE_HEIGHT, FACE_WIDTH, faceCanvas, faces, random } from './face';
import { ganTimeline as T } from './timeline';
import { GRID_HEIGHT, GRID_WIDTH, snapshots, trainingFrames, trainingStep } from './training';

// Three.js 판. SVG 판(gan.ts)과 같은 시점에 같은 이야기를 하되,
// 위조범·경찰은 입체 카드로, "잡음에서 얼굴로"는 같은 자리의 픽셀 타일이 학습할 때마다 새 값으로 칠해지는 판으로,
// "해마다 선명해진 그림"은 점점 크고 선명해지는 입체 액자로 보여 준다.
// 모든 움직임은 재생 시간만으로 정해진다(난수는 seed 고정).

// SVG 좌표(1600×900)와 월드 좌표를 맞춘다: 카메라가 정면에서 보면 z=0 평면의 1 단위 = SVG 100px.
const unit = 100;
const world = (x: number, y: number, z = 0) => new THREE.Vector3((x - 800) / unit, (450 - y) / unit, z);
const fov = 35;
// 16:9 화면에서 양쪽 카드가 잘리지 않도록 세로 반폭 5.1 이 보이는 거리에 둔다.
const baseDistance = 5.1 / Math.tan(THREE.MathUtils.degToRad(fov / 2));

const ORANGE = 0xffad5b;
const BLUE = 0x5b9dff;
const GRAY = 0x6c6c74;

// 위조범과 경찰의 실력. 번갈아 상대보다 조금씩 앞서 나간다(SVG 판과 같은 계산).
const levels = (time: number) => {
  let forge = .1;
  let watch = .22;
  let forgeTarget = forge;
  let watchTarget = watch;
  for (const [at, who] of T.rounds) {
    const t = ease(progress(time, at, .4));
    if (who === 'forge') {
      const from = forgeTarget;
      forgeTarget = Math.min(watchTarget + .08, .96);
      forge += (forgeTarget - from) * t;
    } else {
      const from = watchTarget;
      watchTarget = Math.min(forgeTarget + .08, .98);
      watch += (watchTarget - from) * t;
    }
  }
  return { forge, watch };
};

// 지폐 그림. clean 이면 진짜(초록), 아니면 잡음 섞인 엉터리(회색).
const billTexture = (clean: boolean, seed: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 300;
  const context = canvas.getContext('2d')!;
  const color = clean ? '#4fd18b' : '#8b8b94';
  context.lineJoin = 'round';
  context.fillStyle = clean ? 'rgba(79, 209, 139, .16)' : 'rgba(139, 139, 148, .08)';
  context.strokeStyle = color;
  context.lineWidth = 6;
  context.beginPath();
  context.roundRect(6, 6, 588, 288, 24);
  context.fill();
  context.stroke();
  if (clean) {
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(28, 28, 544, 244, 16);
    context.stroke();
  }
  context.save();
  if (!clean) {
    context.translate(24, -10);
    context.rotate(-.12);
  }
  context.fillStyle = color;
  context.globalAlpha = clean ? 1 : .55;
  context.font = '700 80px -apple-system, BlinkMacSystemFont, sans-serif';
  context.fillText('10000', 52, 140);
  context.restore();
  context.globalAlpha = clean ? 1 : .2;
  context.strokeStyle = color;
  context.lineWidth = 5;
  context.beginPath();
  context.arc(450, 150, 84, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(450, 130, 26, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(398, 210);
  context.quadraticCurveTo(450, 152, 502, 210);
  context.stroke();
  context.globalAlpha = clean ? 1 : .25;
  context.lineWidth = 4;
  for (const y of [210, 246]) {
    context.beginPath();
    context.moveTo(44, y);
    for (let x = 44; x <= 300; x += 32) {
      context.quadraticCurveTo(x + 16, y - 24, x + 32, y);
    }
    context.stroke();
  }
  if (!clean) {
    const next = random(seed);
    context.globalAlpha = .85;
    context.fillStyle = '#a0a0a8';
    for (let i = 0; i < 70; i++) {
      context.beginPath();
      context.arc(next() * 600, next() * 300, 3 + next() * 9, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// 바깥 테두리만 있는 사각형(지폐 자리 → 얼굴 자리로 크기가 바뀐다).
const createFrame = (color: number) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
  return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true }));
};

// 재질 투명도를 정하고, 거의 안 보이면 그리지 않는다.
const setOpacity = (object: THREE.Object3D, value: number) => {
  object.visible = value > .002;
  object.traverse((child) => {
    const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const item of material ? (Array.isArray(material) ? material : [material]) : []) {
      item.opacity = (item.userData.base ?? 1) * value;
    }
  });
};

// 입체 카드: 위조범(주황)·경찰(파랑). 글자는 SVG 로 카드 앞면에 겹친다.
const createStation = (color: number) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.3, 2.1, .36),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0x0f1013), .8), transparent: true }),
  );
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color, transparent: true }));
  edges.material.userData.base = .55;
  group.add(body, edges);
  return { group, body, edges };
};

// 해마다 커지고 선명해진 네 장: 그림 해상도와 색, 액자 높이(월드 단위).
const stages = [
  { pixels: 8, gray: true, height: .8, name: '흑백 8px' },
  { pixels: 16, gray: true, height: 1.35, name: '흑백 16px' },
  { pixels: 32, gray: false, height: 2.1, name: '컬러 32px' },
  { pixels: FACE_WIDTH, gray: false, height: 3.1, name: '선명한 얼굴' },
];

// 그림 한 장을 얇은 입체 액자로. 작은 그림은 픽셀 칸이 그대로 보이게 늘린다.
const createPanel = (canvas: HTMLCanvasElement, width: number, height: number, pixelated: boolean) => {
  const group = new THREE.Group();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (pixelated) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width + .08, height + .08, .08), new THREE.MeshLambertMaterial({ color: 0x24262d, transparent: true }));
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  picture.position.z = .041;
  const frame = createFrame(GRAY);
  frame.scale.set(width + .08, height + .08, 1);
  frame.position.z = .042;
  group.add(slab, picture, frame);
  return group;
};

export const createGanThree = (): SceneLayer => {
  // 시야각은 공통 기본값(35°)과 같다.
  const { element, root, scene, camera, render, project, look } = createThreeDiagram('gan gan-three', '생성적 적대 신경망(GAN)');

  // 3D 위치 → SVG 좌표(1600×900)는 공통 project() 를 쓴다. 캔버스가 SVG 와 같은 16:9 상자에 그려지므로 그대로 맞는다.

  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb8ff, .6);
  rim.position.set(6, -2, -4);
  scene.add(rim);

  // 바닥 격자: 깊이감.
  const floor = new THREE.GridHelper(40, 40, 0x2a2b33, 0x1c1d22);
  floor.position.set(0, -3.6, -4);
  const floorMaterial = floor.material as THREE.Material;
  floorMaterial.transparent = true;
  floorMaterial.userData.base = .8;
  scene.add(floor);

  // 1. 위조범과 경찰
  const machine = new THREE.Group();
  scene.add(machine);
  const generatorAt = world(245, 545);
  const policeAt = world(1355, 435);
  const generator = createStation(ORANGE);
  generator.group.position.copy(generatorAt);
  const police = createStation(BLUE);
  police.group.position.copy(policeAt);
  machine.add(generator.group, police.group);

  const realAt = world(790, 280);
  const fakeAt = world(790, 545);
  const billGeometry = new THREE.PlaneGeometry(3, 1.5);
  const realBill = new THREE.Mesh(billGeometry, new THREE.MeshBasicMaterial({ map: billTexture(true, 3), transparent: true, depthWrite: false }));
  const fakeClean = new THREE.Mesh(billGeometry, new THREE.MeshBasicMaterial({ map: billTexture(true, 5), transparent: true, depthWrite: false }));
  const fakeNoisy = new THREE.Mesh(billGeometry, new THREE.MeshBasicMaterial({ map: billTexture(false, 7), transparent: true, depthWrite: false }));
  const realSlot = new THREE.Group();
  realSlot.position.copy(realAt);
  const fakeSlot = new THREE.Group();
  fakeSlot.position.copy(fakeAt);
  realSlot.add(realBill);
  fakeSlot.add(fakeClean, fakeNoisy);
  const realFrame = createFrame(GRAY);
  const fakeFrame = createFrame(GRAY);
  realSlot.add(realFrame);
  fakeSlot.add(fakeFrame);
  // 진짜 쪽 얼굴: 완성된 그림.
  const realFaceTexture = new THREE.CanvasTexture(faceCanvas(faces[1], FACE_WIDTH, false));
  realFaceTexture.colorSpace = THREE.SRGBColorSpace;
  const realFace = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.04), new THREE.MeshBasicMaterial({ map: realFaceTexture, transparent: true, depthWrite: false }));
  realSlot.add(realFace);
  machine.add(realSlot, fakeSlot);

  // 들킬 때마다 수법을 고친다: 경찰에서 바닥을 돌아 위조범으로 돌아오는 관.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(5.55, -.92, .25),
    new THREE.Vector3(5.2, -2.9, 1.3),
    new THREE.Vector3(0, -3.2, 2.2),
    new THREE.Vector3(-5.2, -2.95, 1.3),
    new THREE.Vector3(-5.55, -2.1, .25),
  ]);
  // 관 자체는 3D 곡선을 화면에 옮겨 SVG 로 그린다(앞으로 휘어 나와 원근이 보인다).
  const curveSamples = curve.getPoints(80);

  // 2. 위조범의 출력: 가짜 자리의 픽셀 타일(GRID_WIDTH×GRID_HEIGHT). 타일은 제자리에 있고, 학습할 때마다 값만 새로 칠해진다.
  const slotFaceHeight = 2.04;
  const frames = trainingFrames();
  const tileWidth = 1.7 / GRID_WIDTH;
  const tileHeight = slotFaceHeight / GRID_HEIGHT;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(tileWidth, tileHeight, .03), new THREE.MeshBasicMaterial({ transparent: true }), GRID_WIDTH * GRID_HEIGHT);
  tiles.frustumCulled = false;
  fakeSlot.add(tiles);
  // 다 배운 뒤의 선명한 얼굴: 타일 바로 앞에 겹쳐 서서히 드러난다.
  const generatedTexture = new THREE.CanvasTexture(faceCanvas(faces[0], FACE_WIDTH, false));
  generatedTexture.colorSpace = THREE.SRGBColorSpace;
  const generatedFace = new THREE.Mesh(new THREE.PlaneGeometry(1.7, slotFaceHeight), new THREE.MeshBasicMaterial({ map: generatedTexture, transparent: true, depthWrite: false }));
  generatedFace.position.z = .03;
  fakeSlot.add(generatedFace);
  const tileMatrix = new THREE.Matrix4();
  const tileColor = new THREE.Color();
  const white = new THREE.Color(1, 1, 1);
  // 학습 한 번: 모든 타일이 한꺼번에 새 값으로 바뀐다. 많이 바뀐 타일일수록 크게 튀어나오며 반짝인다.
  const paintTiles = (from: Uint8ClampedArray, to: Uint8ClampedArray, blend: number) => {
    const bump = Math.sin(Math.PI * blend);
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let column = 0; column < GRID_WIDTH; column++) {
        const i = row * GRID_WIDTH + column;
        const o = i * 4;
        const change = (Math.abs(to[o] - from[o]) + Math.abs(to[o + 1] - from[o + 1]) + Math.abs(to[o + 2] - from[o + 2])) / (3 * 255);
        const lift = bump * Math.min(change * 2.5, 1);
        tileMatrix.makeTranslation((column + .5) * tileWidth - .85, slotFaceHeight / 2 - (row + .5) * tileHeight, lift * .2);
        tiles.setMatrixAt(i, tileMatrix);
        const [r, g, b] = [0, 1, 2].map((c) => lerp(from[o + c], to[o + c], blend) / 255);
        tiles.setColorAt(i, tileColor.setRGB(r, g, b, THREE.SRGBColorSpace).lerp(white, lift * .2));
      }
    }
    tiles.instanceMatrix.needsUpdate = true;
    tiles.instanceColor!.needsUpdate = true;
  };

  // "세상에 없는 얼굴" 강조: 얼굴 뒤로 번지는 빛.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext('2d')!;
  const gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 215, 91, .38)');
  gradient.addColorStop(1, 'rgba(255, 215, 91, 0)');
  glowContext.fillStyle = gradient;
  glowContext.fillRect(0, 0, 128, 128);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.position.set(fakeAt.x, fakeAt.y, -.6);
  // 입자보다 먼저 그려 얼굴 색을 덮지 않게.
  glow.renderOrder = -1;
  scene.add(glow);

  // 3. 해마다 커지고 선명해진 그림: 한 줄로 선 네 장의 입체 액자. 아래쪽을 맞춰 세운다.
  const baseline = -1.2;
  const gap = .7;
  const widths = stages.map(({ height }) => (height * FACE_WIDTH) / FACE_HEIGHT);
  const rowLeft = -(widths.reduce((sum, width) => sum + width, 0) + gap * (stages.length - 1)) / 2;
  let left = rowLeft;
  const panels = stages.map(({ pixels, gray, height }, k) => {
    const width = widths[k];
    const group = createPanel(faceCanvas(faces[0], pixels, gray), width, height, pixels < FACE_WIDTH);
    const at = new THREE.Vector3(left + width / 2, baseline + height / 2, 0);
    left += width + gap;
    scene.add(group);
    return { group, at, appearAt: k === 0 ? T.early : T.yearly + (k - 1) * .7 };
  });
  const rowRight = left - gap;
  const growthTarget = new THREE.Vector3(0, -.2, 0);
  const growthDistance = 12.5;

  // 3. SVG 겹침: 글자·계기판·배지·칩.
  const overlay = svg('g', {}, root);
  const name = svg('g', { class: 'gan-name' }, overlay);
  text(name, 800, 440, '생성적 적대 신경망', { class: 'gan-name-title' });
  text(name, 800, 506, 'Generative Adversarial Network', { class: 'gan-name-subtitle' });

  const machineOverlay = svg('g', {}, overlay);
  // 점선 화살표는 3D 끝점을 화면에 옮겨 SVG 로 그린다(글자와 같은 선명도).
  const toFake = svg('path', { class: 'gan-arrow' }, machineOverlay);
  const realToPolice = svg('path', { class: 'gan-arrow' }, machineOverlay);
  const fakeToPolice = svg('path', { class: 'gan-arrow' }, machineOverlay);
  const segment = (path: Element, from: THREE.Vector3, to: THREE.Vector3, opacity: number) => {
    const a = project(from);
    const b = project(to);
    setAttributes(path, { d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`, opacity: opacity.toFixed(3) });
  };
  const createCardLabel = (title: string, subtitle: string, kind: string) => {
    const group = svg('g', { class: `gan-card gan-card-${kind} gan-three-card` }, machineOverlay);
    text(group, 0, -26, title, { class: 'gan-card-title' });
    text(group, 0, 14, subtitle, { class: 'gan-card-subtitle' });
    text(group, -132, 70, '실력', { class: 'gan-card-meter-label' });
    svg('rect', { class: 'gan-meter-track', x: -60, y: 54, width: 186, height: 16, rx: 8 }, group);
    const meter = svg('rect', { class: 'gan-meter-fill', x: -60, y: 54, width: 0, height: 16, rx: 8 }, group);
    return { group, meter };
  };
  const generatorLabel = createCardLabel('위조범', '생성자', 'generator');
  const policeLabel = createCardLabel('경찰', '판별자', 'police');

  const createSlotLabel = (caption: string, kind: string) => {
    const group = svg('g', { class: `gan-slot-${kind}` }, machineOverlay);
    const label = text(group, 0, 0, caption, { class: 'gan-slot-caption' });
    const badge = svg('g', { class: 'gan-badge' }, group);
    svg('circle', { r: 26 }, badge);
    const glyph = text(badge, 0, 11, '', { class: 'gan-badge-glyph' });
    return { group, label, badge, glyph };
  };
  const realLabel = createSlotLabel('진짜', 'real');
  const fakeLabel = createSlotLabel('가짜', 'fake');
  const feedback = svg('path', { class: 'gan-feedback' }, machineOverlay);
  const feedbackHead = svg('path', { class: 'gan-feedback-head' }, machineOverlay);
  const pulse = svg('circle', { class: 'gan-three-pulse', r: 9 }, machineOverlay);
  const feedbackLabel = text(machineOverlay, 0, 0, '들킬 때마다 수법을 고친다', { class: 'gan-feedback-label' });
  const nobody = text(overlay, 0, 0, '세상에 없는 얼굴', { class: 'gan-nobody' });

  const createChip = (label: string, kind: string) => {
    const group = svg('g', { class: `gan-chip gan-chip-${kind}` }, machineOverlay);
    const width = label.length * 26 + 56;
    svg('rect', { x: -width / 2, y: -28, width, height: 56, rx: 28 }, group);
    text(group, 0, 10, label, {});
    return group;
  };
  const judgeChip = createChip('심판 · 고양이일까 개일까', 'judge');
  const brushChip = createChip('붓 · 새 그림을 그린다', 'brush');

  const counter = text(machineOverlay, 0, 0, '', { class: 'gan-counter' });
  const growthOverlay = svg('g', {}, overlay);
  const stageTags = stages.map(({ name }) => text(growthOverlay, 0, 0, name, { class: 'gan-three-stage' }));
  const firstLabel = text(growthOverlay, 0, 0, '작고 흐릿한 흑백', { class: 'gan-growth-label' });
  const growthArrow = svg('path', { class: 'gan-growth-arrow' }, growthOverlay);
  const yearlyLabel = text(growthOverlay, 0, 0, '해마다 더 크고 더 선명하게', { class: 'gan-growth-caption' });

  // 3D 점 위에 SVG 를 붙인다. scale 은 그 자리에서 월드 1 단위가 몇 px 인지로 정한다.
  const anchor = (group: Element, position: THREE.Vector3, offset = { x: 0, y: 0 }) => {
    const at = project(position);
    const side = project(position.clone().add(new THREE.Vector3(1, 0, 0)));
    const scale = (side.x - at.x) / unit;
    setAttributes(group, { transform: `translate(${(at.x + offset.x * scale).toFixed(1)} ${(at.y + offset.y * scale).toFixed(1)}) scale(${scale.toFixed(3)})` });
    return at;
  };

  const setBadge = (badge: Element, glyph: Element, state: 'pass' | 'caught' | 'unsure') => {
    for (const name of ['pass', 'caught', 'unsure']) {
      badge.classList.toggle(name, name === state);
    }
    const content = state === 'pass' ? '✓' : state === 'caught' ? '✕' : '?';
    if (glyph.textContent !== content) {
      glyph.textContent = content;
    }
  };

  const update = (time: number) => {
    // 카메라: 천천히 흔들려 입체감을 주고, 얼굴을 학습할 때는 가짜 자리로 다가갔다가, 성장 단계에서 액자 줄 가운데로.
    const focus = ease(progress(time, T.faces + .4, 2.2)) * (1 - ease(progress(time, T.early - .3, 1.2)));
    const growth = ease(progress(time, T.early - .3, 1.2));
    const target = new THREE.Vector3()
      .lerp(new THREE.Vector3(fakeAt.x * .3, fakeAt.y * .35, 0), focus)
      .lerp(growthTarget, growth);
    const distance = lerp(lerp(baseDistance, baseDistance * .9, focus), growthDistance, growth);
    // 흔들림은 카드와 칩이 화면 밖으로 나가지 않을 만큼만.
    const sway = time * .16;
    camera.position.set(target.x + Math.sin(sway) * .55, target.y + .2 + Math.sin(sway * .73) * .25, target.z + distance);
    look(target);
    camera.updateMatrixWorld();

    const machineIn = (1 - appear(time, T.early - .3, .6)) * appear(time, T.cards, .6);
    const nameIn = appear(time, T.name, .6) * (1 - appear(time, T.cards - .3, .5));
    setAttributes(name, { opacity: nameIn.toFixed(3) });
    setAttributes(machineOverlay, { opacity: machineIn.toFixed(3) });
    setOpacity(floor, appear(time, T.cards, 1) * .9);

    // 카드
    const generatorIn = appear(time, T.cards + .6, .5) * machineIn;
    const policeIn = appear(time, T.cards + 1.8, .5) * machineIn;
    setOpacity(generator.group, generatorIn);
    setOpacity(police.group, policeIn);
    const generatorFocus = between(time, T.generator, T.police) || time >= T.brush;
    const policeFocus = between(time, T.police, T.verdict) || between(time, T.judge, T.brush);
    // 경찰이 실력을 올리는 순간에는 테두리가 반짝인다.
    const scan = Math.max(0, ...T.rounds.filter(([, who]) => who === 'police').map(([at]) => (between(time, at, at + .5) ? Math.sin(((time - at) / .5) * Math.PI) : 0)));
    generator.edges.material.opacity = generatorIn * (generatorFocus ? 1 : .45);
    police.edges.material.opacity = policeIn * (time >= T.brush ? .25 : policeFocus ? 1 : .45 + .55 * scan);
    generator.group.rotation.y = .18 + Math.sin(time * .4) * .03;
    police.group.rotation.y = -.18 + Math.sin(time * .4 + 1) * .03;
    generatorLabel.group.classList.toggle('focus', generatorFocus);
    policeLabel.group.classList.toggle('focus', policeFocus);
    setAttributes(generatorLabel.group, { opacity: generatorIn.toFixed(3) });
    setAttributes(policeLabel.group, { opacity: (policeIn * (time >= T.brush ? .45 : 1)).toFixed(3) });
    anchor(generatorLabel.group, generatorAt.clone().setZ(.2));
    anchor(policeLabel.group, policeAt.clone().setZ(.2));
    const { forge, watch } = levels(time);
    setAttributes(generatorLabel.meter, { width: (186 * forge).toFixed(1) });
    setAttributes(policeLabel.meter, { width: (186 * watch).toFixed(1) });

    // 지폐 → 얼굴 자리
    const morph = ease(progress(time, T.faces, .8));
    const width = lerp(3, 1.7, morph);
    const height = lerp(1.5, slotFaceHeight, morph);
    const quality = clamp((forge - .1) / .84);
    const fakeIn = appear(time, T.firstFake, .6);
    const realIn = appear(time, T.real, .6);
    fakeSlot.position.set(fakeAt.x - (1 - fakeIn) * 2.6, fakeAt.y, 0);
    for (const [slot, seed] of [[realSlot, 0], [fakeSlot, 2]] as const) {
      slot.rotation.set(Math.sin(time * .5 + seed) * .05, Math.sin(time * .37 + seed) * .14, 0);
    }
    setOpacity(realBill, realIn * (1 - morph) * machineIn);
    setOpacity(fakeClean, fakeIn * (1 - morph) * quality * machineIn);
    setOpacity(fakeNoisy, fakeIn * (1 - morph) * (1 - quality) * machineIn);
    setOpacity(realFace, realIn * morph * machineIn);
    realFrame.scale.set(width, height, 1);
    fakeFrame.scale.set(width, height, 1);
    setOpacity(realFrame, realIn * morph * machineIn);
    setOpacity(fakeFrame, fakeIn * morph * machineIn);

    // 화살표
    segment(toFake, world(420, 545), new THREE.Vector3(fakeSlot.position.x - width / 2 - .14, fakeAt.y, 0), appear(time, T.firstFake - .5, .5));
    const toPolice = appear(time, T.real + 1.2, .5);
    segment(realToPolice, new THREE.Vector3(realAt.x + width / 2 + .14, realAt.y, 0), world(1178, 400), toPolice);
    segment(fakeToPolice, new THREE.Vector3(fakeAt.x + width / 2 + .14, fakeAt.y, 0), world(1178, 470), toPolice);

    // 자리 글자와 판정
    const realCorner = anchor(realLabel.group, new THREE.Vector3(realAt.x - width / 2, realAt.y + height / 2, 0), { x: 0, y: -18 });
    anchor(fakeLabel.group, new THREE.Vector3(fakeSlot.position.x - width / 2, fakeAt.y + height / 2, 0), { x: 0, y: -18 });
    void realCorner;
    setAttributes(realLabel.label, { opacity: realIn.toFixed(3) });
    setAttributes(fakeLabel.label, { opacity: fakeIn.toFixed(3) });
    for (const [label] of [[realLabel], [fakeLabel]] as const) {
      setAttributes(label.badge, { transform: `translate(${(width * unit).toFixed(1)} 18)` });
    }
    const verdictIn = appear(time, T.verdict, .3) * (1 - morph);
    const unsure = time >= T.indistinguishable;
    setBadge(realLabel.badge, realLabel.glyph, unsure ? 'unsure' : 'pass');
    setBadge(fakeLabel.badge, fakeLabel.glyph, unsure ? 'unsure' : forge > watch ? 'pass' : 'caught');
    setAttributes(realLabel.badge, { opacity: verdictIn.toFixed(3), transform: `translate(${(width * unit).toFixed(1)} 18)` });
    setAttributes(fakeLabel.badge, { opacity: verdictIn.toFixed(3), transform: `translate(${(width * unit).toFixed(1)} 18)` });

    // 되먹임 관: 그려지고, 위조범이 수법을 고치기 직전마다 빛이 관을 따라 돌아간다.
    const drawn = ease(progress(time, T.feedback, 1.3));
    const screen = curveSamples.map((point) => project(point));
    let length = 0;
    for (let i = 1; i < screen.length; i++) {
      length += Math.hypot(screen[i].x - screen[i - 1].x, screen[i].y - screen[i - 1].y);
    }
    setAttributes(feedback, {
      d: `M${screen.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`,
      'stroke-dasharray': length.toFixed(1),
      'stroke-dashoffset': ((1 - drawn) * length).toFixed(1),
      opacity: drawn > 0 ? 1 : 0,
    });
    // 화살촉: 마지막 구간의 방향으로.
    const tip = screen[screen.length - 1];
    const before = screen[screen.length - 4];
    const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
    const wing = (side: number) => `${(tip.x - Math.cos(angle + side) * 18).toFixed(1)} ${(tip.y - Math.sin(angle + side) * 18).toFixed(1)}`;
    setAttributes(feedbackHead, { d: `M${wing(.5)} L${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L${wing(-.5)}`, opacity: progress(time, T.feedback + 1.1, .3).toFixed(3) });
    // 위조범이 수법을 고치기 직전마다 빛이 관을 따라 경찰에서 위조범으로 돌아간다.
    let traveling = -1;
    for (const [at, who] of T.rounds) {
      if (who === 'forge' && between(time, at - .6, at)) {
        traveling = ease((time - (at - .6)) / .6);
      }
    }
    const spot = project(curve.getPoint(Math.max(traveling, 0)));
    setAttributes(pulse, { cx: spot.x.toFixed(1), cy: spot.y.toFixed(1), opacity: traveling >= 0 ? 1 : 0 });
    // 관이 감싸는 안쪽, 바닥 곡선 바로 위.
    anchor(feedbackLabel, curve.getPoint(.5), { x: 0, y: -26 });
    setAttributes(feedbackLabel, { opacity: appear(time, T.feedback + .6, .6).toFixed(3) });

    // 심판에서 붓으로
    // 칩은 화면 가장자리에서 잘리지 않도록 가운데 쪽으로 조금 당겨 둔다.
    anchor(judgeChip, policeAt.clone().add(new THREE.Vector3(0, 1.55, .2)), { x: -70, y: 0 });
    anchor(brushChip, generatorAt.clone().add(new THREE.Vector3(0, 1.55, .2)), { x: 70, y: 0 });
    setAttributes(judgeChip, { opacity: appear(time, T.judge, .5).toFixed(3) });
    setAttributes(brushChip, { opacity: appear(time, T.brush, .5).toFixed(3) });

    // 위조범의 출력: 학습할 때마다 같은 타일을 새 값으로 칠하고, 다 배우면 선명한 얼굴이 드러난다.
    const outputIn = fakeIn * morph * machineIn;
    setOpacity(tiles, outputIn);
    const step = trainingStep(time);
    if (tiles.visible) {
      paintTiles(frames[step.from], frames[step.to], step.blend);
    }
    setOpacity(generatedFace, outputIn * appear(time, T.formed, 1.2));
    const count = `학습 ${snapshots[step.to]}회`;
    if (counter.textContent !== count) {
      counter.textContent = count;
    }
    const nobodyIn = appear(time, T.nobody, .5);
    anchor(counter, new THREE.Vector3(fakeSlot.position.x, fakeAt.y - slotFaceHeight / 2, 0), { x: 0, y: 40 });
    setAttributes(counter, { opacity: (appear(time, T.faces + .6, .5) * (1 - nobodyIn)).toFixed(3) });

    // 세상에 없는 얼굴: 뒤에서 빛이 번진다.
    const shine = nobodyIn * (.45 + .55 * Math.max(0, Math.sin(((time - T.nobody) / 1.6) * Math.PI)) * (time < T.nobody + 1.6 ? 1 : 0)) * (1 - growth);
    setOpacity(glow, shine);
    anchor(nobody, new THREE.Vector3(fakeAt.x, fakeAt.y - slotFaceHeight / 2 - .1, 0), { x: 0, y: 46 });
    setAttributes(nobody, { opacity: (nobodyIn * (1 - growth)).toFixed(3) });

    // 해마다 선명해진 그림: 작고 흐릿한 흑백 한 장 옆으로, 해마다 더 크고 선명한 그림이 돌아 들어온다.
    setAttributes(growthOverlay, { opacity: growth.toFixed(3) });
    panels.forEach(({ group, at, appearAt }, k) => {
      const shown = appear(time, appearAt, .8);
      group.position.set(at.x, at.y - (1 - shown) * .5, at.z);
      group.rotation.set(0, (1 - shown) * -1.2 - at.x * .035, 0);
      setOpacity(group, shown * growth);
      anchor(stageTags[k], new THREE.Vector3(at.x, baseline - .08, 0), { x: 0, y: 34 });
      setAttributes(stageTags[k], { opacity: shown.toFixed(3) });
    });
    anchor(firstLabel, new THREE.Vector3(panels[0].at.x, baseline - .08, 0), { x: 0, y: 84 });
    setAttributes(firstLabel, { opacity: (appear(time, T.early + 1.2, .5) * (1 - appear(time, T.yearly, .4))).toFixed(3) });
    const yearlyIn = appear(time, T.yearly + .6, .6);
    const from = project(new THREE.Vector3(rowLeft, baseline - .75, 0));
    const to = project(new THREE.Vector3(rowRight, baseline - .75, 0));
    setAttributes(growthArrow, {
      d: `M${from.x.toFixed(1)} ${from.y.toFixed(1)} L${to.x.toFixed(1)} ${to.y.toFixed(1)} M${(to.x - 18).toFixed(1)} ${(to.y - 12).toFixed(1)} L${to.x.toFixed(1)} ${to.y.toFixed(1)} L${(to.x - 18).toFixed(1)} ${(to.y + 12).toFixed(1)}`,
      opacity: yearlyIn.toFixed(3),
    });
    anchor(yearlyLabel, new THREE.Vector3(0, baseline - .75, 0), { x: 0, y: 56 });
    setAttributes(yearlyLabel, { opacity: yearlyIn.toFixed(3) });

    render();
  };

  return { element, update };
};
