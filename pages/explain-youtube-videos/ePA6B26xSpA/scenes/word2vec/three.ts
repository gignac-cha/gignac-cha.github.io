import './three.scss';
import * as THREE from 'three';
import { appear, clamp, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import { createThreeDiagram } from '../../../shared/three-diagram';
import type { Variant } from '../../../shared/variants';
import { end, king, map, pixels, seoul, symbols, word } from './timing';

// Three.js 판 (임시 비교용): 단어가 실제 3D 좌표 공간에 놓이는 모습.
// 모든 움직임은 재생 시간만으로 정해지므로 탐색해도 같은 화면이 나온다.

type Vec = [number, number, number];
type Cluster = 'fruit' | 'drink' | 'vehicle' | 'people' | 'place';

const colors: Record<Cluster, number> = {
  fruit: 0xff6b6b,
  drink: 0xffad5b,
  vehicle: 0x5b9dff,
  people: 0xb18cff,
  place: 0x4fd18b,
};

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mix = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// 관계가 같은 방향이 되도록 여왕 = 왕 + (여자 − 남자), 도쿄 = 서울 + (일본 − 한국) 으로 둔다.
const man: Vec = [-2.8, .7, 2.2];
const woman: Vec = [-1.7, 1.6, 1.6];
const kingAt: Vec = [-.6, 1, 3];
const korea: Vec = [2.4, 2.5, -.6];
const japan: Vec = [3.9, 2.9, -1.4];
const seoulAt: Vec = [2.7, 1.4, .6];

const words: Record<string, { at: Vec; cluster: Cluster }> = {
  사과: { at: [-4.4, 1.7, -.6], cluster: 'fruit' },
  배: { at: [-3.3, 1.6, -2.6], cluster: 'fruit' },
  포도: { at: [-5.6, .9, .7], cluster: 'fruit' },
  바나나: { at: [-4.2, .4, -1.2], cluster: 'fruit' },
  커피: { at: [.1, 2.7, -2.6], cluster: 'drink' },
  차: { at: [1.2, 2.4, -2.1], cluster: 'drink' },
  우유: { at: [-1.2, 2.1, -2.4], cluster: 'drink' },
  자동차: { at: [4.8, .7, 2.4], cluster: 'vehicle' },
  버스: { at: [5.6, 1.3, 1.5], cluster: 'vehicle' },
  자전거: { at: [4.1, .4, 3.2], cluster: 'vehicle' },
  남자: { at: man, cluster: 'people' },
  여자: { at: woman, cluster: 'people' },
  왕: { at: kingAt, cluster: 'people' },
  여왕: { at: add(kingAt, sub(woman, man)), cluster: 'people' },
  한국: { at: korea, cluster: 'place' },
  일본: { at: japan, cluster: 'place' },
  서울: { at: seoulAt, cluster: 'place' },
  도쿄: { at: add(seoulAt, sub(japan, korea)), cluster: 'place' },
};
const fillOrder = ['포도', '바나나', '우유', '버스', '자전거', '남자', '여자', '왕', '여왕', '한국', '일본', '서울', '도쿄'];

// 지도가 나오기 전, 번호표가 붙은 기호로 떠 있던 자리.
const tokens: Record<string, { from: Vec; id: string }> = {
  사과: { from: [-2.8, 2.3, .8], id: '#1824' },
  배: { from: [2.8, 2.3, .8], id: '#3301' },
  자동차: { from: [0, .9, 1.8], id: '#907' },
};
const teaFrom: Vec = [3, 3.6, -3.6];
const friends: Array<{ name: string; at: Vec; shown: number }> = [
  { name: '컵', at: [-1.1, 3.6, -1.6], shown: map.friends[0] },
  { name: '마시다', at: [1.8, 3.7, -3.6], shown: map.friends[1] },
  { name: '아침', at: [-1, 1.4, -3.8], shown: map.friends[2] },
];

// 사과 사진: 픽셀 밝기만큼 앞으로 솟아 숫자가 된다.
const apple = ['..sg..', '.rrrr.', 'rrrrrr', 'rrrrrr', '.rrrr.', '..rr..'];
const brightness: Record<string, number> = { '.': 12, r: 186, g: 152, s: 71 };
const cellColors: Record<string, number> = { '.': 0x1c1e25, r: 0xe0524f, g: 0x4fd18b, s: 0x8a5a3a };
const pixelPitch = .5;
const pixelSize = .46;

const shownAt = (name: string) => {
  if (name === '사과') return symbols.apple;
  if (name === '배') return symbols.pear;
  if (name === '자동차') return symbols.car;
  if (name === '커피') return map.coffee;
  if (name === '차') return map.tea;
  return map.fill + fillOrder.indexOf(name) * .18;
};

const vector = (v: Vec) => new THREE.Vector3(v[0], v[1], v[2]);
const format = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`;

export const createWord2VecThree = (): Variant => {
  const { element, root, scene, camera, render, project } = createThreeDiagram('word2vec-three', '단어 좌표(Word2Vec)');
  scene.fog = new THREE.Fog(0x0f1013, 16, 32);
  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  // 바닥 격자: 단어가 놓이는 좌표 공간.
  const gridPoints: number[] = [];
  for (let x = -7; x <= 7; x++) {
    gridPoints.push(x, 0, -5, x, 0, 5);
  }
  for (let z = -5; z <= 5; z++) {
    gridPoints.push(-7, 0, z, 7, 0, z);
  }
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x2c2d35, transparent: true, opacity: 0 });
  scene.add(new THREE.LineSegments(gridGeometry, gridMaterial));

  // 사과 사진.
  const pixelGroup = new THREE.Group();
  pixelGroup.position.set(-2.8, .5, 0);
  scene.add(pixelGroup);
  const cellMaterials = Object.fromEntries(
    Object.entries(cellColors).map(([cell, color]) => [cell, new THREE.MeshStandardMaterial({ color, roughness: .55, transparent: true })]),
  );
  const tileGeometry = new THREE.BoxGeometry(pixelSize, pixelSize, 1);
  const tiles = apple.flatMap((row, y) =>
    [...row].map((cell, x) => {
      const mesh = new THREE.Mesh(tileGeometry, cellMaterials[cell]);
      mesh.position.set((x - 2.5) * pixelPitch, (5 - y) * pixelPitch, 0);
      pixelGroup.add(mesh);
      return { mesh, cell, depth: .06 + (brightness[cell] / 186) * 1.2 };
    }),
  );

  // 단어 점: 공, 바닥까지 내린 선, 바닥의 고리로 높이를 읽게 한다.
  const sphereGeometry = new THREE.SphereGeometry(.16, 28, 18);
  const ringGeometry = new THREE.RingGeometry(.16, .24, 32);
  const points = Object.fromEntries(
    Object.entries(words).map(([name, { cluster }]) => {
      const color = colors[cluster];
      const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .35, roughness: .35, transparent: true, opacity: 0 });
      const sphere = new THREE.Mesh(sphereGeometry, material);
      const dropGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const dropMaterial = new THREE.LineBasicMaterial({ color: 0x4a4b55, transparent: true, opacity: 0 });
      const drop = new THREE.Line(dropGeometry, dropMaterial);
      const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      scene.add(sphere, drop, ring);
      return [name, { sphere, material, drop, dropMaterial, ring, ringMaterial }];
    }),
  );

  // 화살표: 굵기가 보이도록 원기둥과 원뿔로 만든다.
  const up = new THREE.Vector3(0, 1, 0);
  const createArrow = (color: number) => {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .55, transparent: true });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 14), material);
    const head = new THREE.Mesh(new THREE.ConeGeometry(.12, .32, 18), material);
    const group = new THREE.Group();
    group.add(shaft, head);
    scene.add(group);
    return { group, shaft, head, material };
  };
  const setArrow = (arrow: ReturnType<typeof createArrow>, from: Vec, to: Vec, p: number, opacity: number) => {
    const start = vector(from);
    const delta = vector(to).sub(start);
    const full = Math.max(delta.length() - .2, .01);
    const length = full * p;
    arrow.group.visible = p > .001 && opacity > .001;
    if (!arrow.group.visible) {
      return;
    }
    arrow.group.position.copy(start);
    arrow.group.quaternion.setFromUnitVectors(up, delta.normalize());
    const headLength = Math.min(.32, length * .5);
    const shaftLength = Math.max(length - headLength, .001);
    arrow.shaft.scale.set(1, shaftLength, 1);
    arrow.shaft.position.set(0, shaftLength / 2, 0);
    arrow.head.scale.set(1, headLength / .32, 1);
    arrow.head.position.set(0, shaftLength + headLength / 2, 0);
    arrow.material.opacity = opacity;
  };
  const arrows = {
    gender: createArrow(0xededef),
    king: createArrow(0xffd75b),
    country: createArrow(0xededef),
    city: createArrow(0xffd75b),
  };

  // 평행 확인선: 남자→왕, 여자→여왕 이 나란하다.
  const dashed = (from: Vec, to: Vec) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([vector(from), vector(to)]);
    const material = new THREE.LineDashedMaterial({ color: 0xffd75b, dashSize: .18, gapSize: .12, transparent: true, opacity: 0 });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    scene.add(line);
    return material;
  };
  const parallels = [dashed(man, kingAt), dashed(woman, words.여왕.at)];

  // 위에 겹치는 글자(SVG).
  const overlay = svg('g', {}, root);
  const pixelNumbers = svg('g', {}, overlay);
  const numberTexts = tiles.map(({ cell }) => text(pixelNumbers, 0, 0, String(brightness[cell]), { class: `w2v3-number ${cell === '.' ? '' : 'on-color'}` }));
  const photoCaption = text(overlay, 0, 0, '사진', { class: 'w2v-caption', 'text-anchor': 'middle' });

  const written = svg('g', {}, overlay);
  text(written, 1150, 300, '단어', { class: 'w2v-caption', 'text-anchor': 'middle' });
  text(written, 1150, 420, '사과', { class: 'w2v-big-word' });
  const codes = text(written, 1150, 490, '49324 · 44284', { class: 'w2v-codes' });
  const codesLabel = text(written, 1150, 536, '글자 번호일 뿐', { class: 'w2v-caption', 'text-anchor': 'middle' });
  const noLink = svg('path', { class: 'w2v-no-link' }, written);
  const cross = svg('g', { class: 'w2v-cross' }, written);
  svg('circle', { r: 26 }, cross);
  svg('path', { d: 'M-10 -10 L10 10 M10 -10 L-10 10' }, cross);

  const lines = svg('g', { class: 'w2v3-lines' }, overlay);
  const unknownPairs: Array<[string, string]> = [['사과', '배'], ['사과', '자동차'], ['배', '자동차']];
  const unknown = unknownPairs.map(() => {
    const line = svg('line', { class: 'w2v3-unknown' }, lines);
    const mark = svg('g', { class: 'w2v3-question' }, lines);
    svg('circle', { r: 24 }, mark);
    text(mark, 0, 10, '?');
    return { line, mark };
  });
  const friendLines = friends.map(() => ({ coffee: svg('line', { class: 'w2v3-friend-line' }, lines), tea: svg('line', { class: 'w2v3-friend-line' }, lines) }));

  const labels = svg('g', {}, overlay);
  const wordLabels = Object.fromEntries(Object.keys(words).map((name) => [name, text(labels, 0, 0, name, { class: 'w2v3-label' })]));
  const vectorReadout = text(labels, 0, 0, `[${words.사과.at.map(format).join(', ')}]`, { class: 'w2v3-vector' });
  const friendChips = friends.map(({ name }) => {
    const group = svg('g', { class: 'w2v3-friend' }, labels);
    svg('rect', { x: -66, y: -28, width: 132, height: 56, rx: 28 }, group);
    text(group, 0, 10, name);
    return group;
  });
  const tokenChips = Object.fromEntries(
    Object.entries(tokens).map(([name, { id }]) => {
      const group = svg('g', { class: 'w2v3-chip' }, labels);
      svg('rect', { x: -86, y: -36, width: 172, height: 72, rx: 36 }, group);
      text(group, 0, 12, name, { class: 'w2v3-chip-label' });
      text(group, 0, 74, id, { class: 'w2v3-chip-id' });
      return [name, group];
    }),
  );
  const targets = [svg('circle', { class: 'w2v3-target', r: 30 }, labels), svg('circle', { class: 'w2v3-target', r: 30 }, labels)];
  const formulas = [
    text(overlay, 800, 862, '왕 − 남자 + 여자 ≈ 여왕', { class: 'w2v3-formula' }),
    text(overlay, 800, 862, '서울 − 한국 + 일본 ≈ 도쿄', { class: 'w2v3-formula' }),
  ];

  // 카메라: 지도가 나오면 조금 물러나 높이를 잡고, 이야기 동안 천천히 돌며 깊이를 보여 준다.
  const focus = new THREE.Vector3();
  const placeCamera = (time: number) => {
    const onMap = ease(progress(time, map.show, 1.6));
    const sweep = clamp((time - map.show) / (end - map.show));
    const azimuth = lerp(-.42, -.2, onMap) + onMap * .55 * Math.sin(Math.PI * sweep);
    const elevation = lerp(.22, .46, onMap);
    const radius = lerp(13, 16, onMap);
    focus.set(lerp(-.6, 0, onMap), lerp(1.9, 1.5, onMap), 0);
    camera.position.set(
      focus.x + radius * Math.cos(elevation) * Math.sin(azimuth),
      focus.y + radius * Math.sin(elevation),
      focus.z + radius * Math.cos(elevation) * Math.cos(azimuth),
    );
    camera.lookAt(focus);
    camera.updateMatrixWorld();
  };

  // 시간에 따른 단어 자리: 기호는 지도로 옮겨 가고, 차는 커피 곁으로 끌려온다.
  const positionOf = (name: string, time: number): Vec => {
    const { at } = words[name];
    if (name in tokens) {
      return mix(tokens[name].from, at, ease(progress(time, map.place, 1)));
    }
    if (name === '차') {
      return mix(teaFrom, at, ease(progress(time, map.teaMove, 1.1)));
    }
    return at;
  };

  const screen = (v: Vec) => project(vector(v));

  const update = (time: number) => {
    placeCamera(time);

    // 사진은 숫자.
    const photo = appear(time, pixels.show, .4) * (1 - appear(time, symbols.show, .5));
    const rise = ease(progress(time, pixels.numbers, .9));
    pixelGroup.visible = photo > .001;
    for (const material of Object.values(cellMaterials)) {
      material.opacity = photo;
    }
    for (const { mesh, depth } of tiles) {
      const value = lerp(.06, depth, rise);
      mesh.scale.z = value;
      mesh.position.z = value / 2;
    }

    // 지도.
    const onMap = appear(time, map.show, .6);
    gridMaterial.opacity = onMap * .9;

    const states = Object.fromEntries(
      Object.keys(words).map((name) => {
        const position = positionOf(name, time);
        const shown = appear(time, shownAt(name), .4);
        // 지도가 나오기 전 세 기호는 번호표로 보이고, 지도 위에서 점이 된다.
        const asChip = name in tokens ? 1 - appear(time, map.place, .5) : 0;
        return [name, { position, shown, dot: shown * (1 - asChip), asChip: shown * asChip }];
      }),
    );

    const role = (name: string) => {
      if ((name === '여왕' && time >= king.queen) || (name === '도쿄' && time >= seoul.tokyo)) return 'hit';
      if ((name === '왕' && time >= king.focus) || (name === '서울' && time >= seoul.focus)) return 'focus';
      if (((name === '남자' || name === '여자') && time >= king.minus) || ((name === '한국' || name === '일본') && time >= seoul.minus)) return 'reference';
      return '';
    };

    for (const [name, point] of Object.entries(points)) {
      const { position, dot } = states[name];
      const [x, y, z] = position;
      const emphasis = role(name);
      point.sphere.position.set(x, y, z);
      point.sphere.scale.setScalar(emphasis === 'focus' || emphasis === 'hit' ? 1.45 : 1);
      point.material.opacity = dot;
      point.material.emissiveIntensity = emphasis ? .8 : .35;
      point.sphere.visible = dot > .001;
      const ground = dot * onMap;
      const drop = point.drop.geometry.attributes.position as THREE.BufferAttribute;
      drop.setXYZ(0, x, 0, z);
      drop.setXYZ(1, x, y - .16, z);
      drop.needsUpdate = true;
      point.dropMaterial.opacity = ground * .7;
      point.drop.visible = ground > .001;
      point.ring.position.set(x, .004, z);
      point.ringMaterial.opacity = ground * .45;
      point.ring.visible = ground > .001;
    }

    // 관계 화살표.
    const earlier = 1 - appear(time, seoul.focus, .5) * .6;
    setArrow(arrows.gender, man, woman, ease(progress(time, king.minus, .7)), earlier);
    setArrow(arrows.king, kingAt, words.여왕.at, ease(progress(time, king.plus, .7)), earlier);
    setArrow(arrows.country, korea, japan, ease(progress(time, seoul.minus, .7)), 1);
    setArrow(arrows.city, seoulAt, words.도쿄.at, ease(progress(time, seoul.plus, .7)), 1);
    for (const material of parallels) {
      material.opacity = appear(time, king.direction) * earlier;
    }

    render();

    // 글자(SVG)를 3D 위치에 붙인다.
    setAttributes(pixelNumbers, { opacity: (appear(time, pixels.numbers + .3, .5) * photo).toFixed(3) });
    tiles.forEach(({ mesh }, index) => {
      const front = mesh.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, mesh.scale.z / 2));
      const { x, y } = project(front);
      setAttributes(numberTexts[index], { x: x.toFixed(1), y: (y + 6).toFixed(1) });
    });
    const photoTop = project(pixelGroup.localToWorld(new THREE.Vector3(0, 6 * pixelPitch, 0)));
    setAttributes(photoCaption, { x: photoTop.x.toFixed(1), y: (photoTop.y - 34).toFixed(1), opacity: photo.toFixed(3) });

    setAttributes(written, { opacity: (appear(time, word.show, .4) * (1 - appear(time, symbols.show, .5))).toFixed(3) });
    setAttributes(codes, { opacity: appear(time, word.codes).toFixed(3) });
    setAttributes(codesLabel, { opacity: appear(time, word.codes + .4).toFixed(3) });
    const photoCenter = project(pixelGroup.localToWorld(new THREE.Vector3(1.6, 2.6 * pixelPitch, .9)));
    setAttributes(noLink, { d: `M1010 400 L${photoCenter.x.toFixed(1)} ${photoCenter.y.toFixed(1)}`, opacity: appear(time, word.noMeaning).toFixed(3) });
    setAttributes(cross, {
      transform: `translate(${((1010 + photoCenter.x) / 2).toFixed(1)} ${((400 + photoCenter.y) / 2).toFixed(1)})`,
      opacity: appear(time, word.noMeaning + .3).toFixed(3),
    });

    // 번호표만 있을 때는 단어 사이 거리를 알 수 없다.
    const notYet = appear(time, symbols.car, .5) * (1 - appear(time, map.show, .5));
    unknownPairs.forEach(([a, b], index) => {
      const p = screen(states[a].position);
      const q = screen(states[b].position);
      setAttributes(unknown[index].line, { x1: p.x.toFixed(1), y1: p.y.toFixed(1), x2: q.x.toFixed(1), y2: q.y.toFixed(1), opacity: notYet.toFixed(3) });
      setAttributes(unknown[index].mark, {
        transform: `translate(${((p.x + q.x) / 2).toFixed(1)} ${((p.y + q.y) / 2).toFixed(1)})`,
        opacity: (appear(time, symbols.unknown + index * .2) * notYet).toFixed(3),
      });
    });

    for (const [name, chip] of Object.entries(tokenChips)) {
      const { x, y } = screen(states[name].position);
      setAttributes(chip, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: states[name].asChip.toFixed(3) });
    }

    for (const [name, label] of Object.entries(wordLabels)) {
      const { x, y } = screen(states[name].position);
      setAttributes(label, { x: x.toFixed(1), y: (y - 30).toFixed(1), opacity: states[name].dot.toFixed(3), class: `w2v3-label ${role(name)}`.trim() });
    }
    const appleSpot = screen(states.사과.position);
    setAttributes(vectorReadout, {
      x: appleSpot.x.toFixed(1),
      y: (appleSpot.y + 48).toFixed(1),
      opacity: (appear(time, map.place + 1.1, .5) * (1 - appear(time, map.coffee - .6, .5))).toFixed(3),
    });

    // 어울리는 친구들: 커피와 차가 같은 친구를 공유해 가까이 모인다.
    const friendsGone = 1 - appear(time, map.fill, .6);
    const coffee = screen(states.커피.position);
    const tea = screen(states.차.position);
    friends.forEach((friend, index) => {
      const shown = appear(time, friend.shown, .4) * friendsGone;
      const { x, y } = screen(friend.at);
      setAttributes(friendChips[index], { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: shown.toFixed(3) });
      setAttributes(friendLines[index].coffee, { x1: coffee.x.toFixed(1), y1: coffee.y.toFixed(1), x2: x.toFixed(1), y2: y.toFixed(1), opacity: shown.toFixed(3) });
      setAttributes(friendLines[index].tea, {
        x1: tea.x.toFixed(1), y1: tea.y.toFixed(1), x2: x.toFixed(1), y2: y.toFixed(1),
        opacity: (appear(time, map.teaFriends, .4) * friendsGone).toFixed(3),
      });
    });

    const queen = screen(words.여왕.at);
    const tokyo = screen(words.도쿄.at);
    setAttributes(targets[0], { cx: queen.x.toFixed(1), cy: queen.y.toFixed(1), opacity: (appear(time, king.plus + .7, .3) * earlier).toFixed(3) });
    setAttributes(targets[1], { cx: tokyo.x.toFixed(1), cy: tokyo.y.toFixed(1), opacity: appear(time, seoul.plus + .7, .3).toFixed(3) });
    setAttributes(formulas[0], { opacity: (appear(time, king.queen) * (1 - appear(time, seoul.focus, .4))).toFixed(3) });
    setAttributes(formulas[1], { opacity: appear(time, seoul.tokyo).toFixed(3) });
  };

  return { element, update };
};
