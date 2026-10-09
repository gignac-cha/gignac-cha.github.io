import * as THREE from 'three';
import { lerp, setAttributes } from '../../../shared/diagram.ts';
import { createThreeLayer } from '../../../shared/three-diagram.ts';
import type { SceneLayer } from '../../../shared/three-scene.ts';
import { count, drugAtoms, phase, pocketCenter, residueColors, residues, SCALE, truth, view, type Vec3 } from './model.ts';
import { drug, drugBonds, pocket } from './protein.ts';
import { createAlphaFoldSvg } from './scene.ts';

// Three.js 판: 글자·서열·숫자는 SVG 판 그대로 두고, 단백질 끈과 약만 정사영 입체로 그린다.
// 움직임은 SVG 판과 같은 model.ts 에서 계산하므로 박자와 자리가 같다. 끌어서 돌려 보면 실제 3차원 모양이 보인다.

const up = new THREE.Vector3(0, 1, 0);
const matrix = new THREE.Matrix4();
const rotation = new THREE.Quaternion();
const place = new THREE.Vector3();
const size = new THREE.Vector3();
const direction = new THREE.Vector3();
const color = new THREE.Color();

const setSphere = (mesh: THREE.InstancedMesh, index: number, [x, y, z]: Vec3, radius: number) => {
  place.set(x, y, z);
  rotation.identity();
  size.setScalar(radius);
  mesh.setMatrixAt(index, matrix.compose(place, rotation, size));
};
const setCylinder = (mesh: THREE.InstancedMesh, index: number, a: Vec3, b: Vec3, radius: number) => {
  direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const length = direction.length();
  place.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  rotation.setFromUnitVectors(up, length > 0 ? direction.divideScalar(length) : up);
  size.set(radius, length, radius);
  mesh.setMatrixAt(index, matrix.compose(place, rotation, size));
};
const elementColor: Record<string, number> = { C: 0xc9ccd6, N: 0x5b9dff, O: 0xff6b6b };

export const createAlphaFoldThree = (): SceneLayer => {
  const base = createAlphaFoldSvg({ protein3d: true });
  const { scene, camera, render, project, look } = createThreeLayer(base.element, { orthographic: {}, placement: 'front' });

  scene.add(new THREE.HemisphereLight(0xe4e9ff, 0x1a1b22, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-30, 50, 80);
  scene.add(sun);

  const material = () => new THREE.MeshStandardMaterial({ roughness: .42, metalness: .05, transparent: true });
  const residueMaterial = material();
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), residueMaterial, count);
  const segments = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), residueMaterial, count - 1);
  // 주머니를 이루는 아미노산을 감싸는 노란 빛.
  const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffd75b, transparent: true, depthWrite: false });
  const halos = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), haloMaterial, pocket.length);
  const drugMaterial = material();
  const atoms = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), drugMaterial, drug.length);
  const bonds = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), drugMaterial, drugBonds.length);
  drug.forEach(({ element }, k) => atoms.setColorAt(k, color.setHex(elementColor[element] ?? elementColor.C)));
  drugBonds.forEach((_, k) => bonds.setColorAt(k, color.setHex(0xf4f4f6)));
  // 실험 구조(정답)는 예측 끈 안에 거의 그대로 묻히므로 늘 위에 보이는 가는 흰 선으로 겹친다.
  const truthGeometry = new THREE.BufferGeometry();
  truthGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const truthMaterial = new THREE.LineBasicMaterial({ color: 0xf4f4f6, transparent: true, depthTest: false });
  const truthLine = new THREE.Line(truthGeometry, truthMaterial);
  truthLine.renderOrder = 2;
  for (const mesh of [beads, segments, halos, atoms, bonds]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
  }
  truthLine.frustumCulled = false;
  scene.add(segments, beads, halos, atoms, bonds, truthLine);

  // SVG 판에서 단백질 위치를 따라다니는 것들(주머니 빛, 이름표). 입체에서 투영한 자리로 다시 옮긴다.
  const pocketGlow = base.element.querySelector<SVGCircleElement>('.af-pocket-glow');
  const pocketLabel = base.element.querySelector<SVGTextElement>('.af-label-pocket');
  const drugLabel = base.element.querySelector<SVGTextElement>('.af-label-drug');

  const target = new THREE.Vector3();
  const update = (time: number) => {
    base.update?.(time);
    const { cx, cy, scale } = view(time);
    const state = phase(time);

    // 정사영 카메라: 1 Å 이 SVG 판과 같은 픽셀 크기로 보이고, 단백질 중심이 SVG 판의 중심 자리(cx, cy)에 오도록 화면을 민다.
    const half = 450 / scale;
    camera.position.set(0, 0, half / Math.tan(THREE.MathUtils.degToRad(35 / 2)));
    camera.setViewOffset(1600, 900, 800 - cx, 450 - cy, 1600, 900);
    look(target);

    const placed = residues(time);
    const colors = residueColors(time);
    const darken = lerp(1, .45, state.unknown);
    placed.forEach(({ position, fold }, i) => {
      setSphere(beads, i, position, lerp(8 / SCALE, .5, fold));
      beads.setColorAt(i, color.setRGB((colors[i][0] / 255) * darken, (colors[i][1] / 255) * darken, (colors[i][2] / 255) * darken, THREE.SRGBColorSpace));
      if (i < count - 1) {
        setCylinder(segments, i, position, placed[i + 1].position, lerp(.12, .42, (fold + placed[i + 1].fold) / 2));
        segments.setColorAt(i, color.setRGB(
          ((colors[i][0] + colors[i + 1][0]) / 510) * darken,
          ((colors[i][1] + colors[i + 1][1]) / 510) * darken,
          ((colors[i][2] + colors[i + 1][2]) / 510) * darken,
          THREE.SRGBColorSpace,
        ));
      }
    });
    for (const mesh of [beads, segments]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    }
    residueMaterial.opacity = state.shown;
    beads.visible = segments.visible = state.shown > 0;

    pocket.forEach((index, k) => setSphere(halos, k, placed[index].position, 1.15));
    halos.instanceMatrix.needsUpdate = true;
    haloMaterial.opacity = state.pocket * .35 * state.shown;
    halos.visible = haloMaterial.opacity > 0;

    const atomPositions = drugAtoms(time);
    atomPositions.forEach((position, k) => setSphere(atoms, k, position, .55));
    drugBonds.forEach(([a, b], k) => setCylinder(bonds, k, atomPositions[a], atomPositions[b], .17));
    atoms.instanceMatrix.needsUpdate = true;
    bonds.instanceMatrix.needsUpdate = true;
    drugMaterial.opacity = state.medicine;
    atoms.visible = bonds.visible = state.medicine > 0;

    const truthPositions = truthGeometry.getAttribute('position') as THREE.BufferAttribute;
    truth(time).forEach(([x, y, z], i) => truthPositions.setXYZ(i, x, y, z));
    truthPositions.needsUpdate = true;
    truthMaterial.opacity = state.truth * state.shown;
    truthLine.visible = truthMaterial.opacity > 0;

    // 입체를 돌려도 주머니 빛과 이름표가 따라오게 한다.
    const pocketScreen = project(new THREE.Vector3(...pocketCenter(time)));
    if (pocketGlow) {
      setAttributes(pocketGlow, { cx: pocketScreen.x.toFixed(1), cy: pocketScreen.y.toFixed(1) });
    }
    if (pocketLabel) {
      setAttributes(pocketLabel, { x: (pocketScreen.x + 150).toFixed(1), y: (pocketScreen.y - 155).toFixed(1) });
    }
    if (drugLabel) {
      const center = atomPositions.reduce((sum, [x, y, z]) => sum.add(new THREE.Vector3(x, y, z)), new THREE.Vector3()).divideScalar(atomPositions.length);
      const drugScreen = project(center);
      setAttributes(drugLabel, { x: drugScreen.x.toFixed(1), y: (drugScreen.y + 110).toFixed(1) });
    }

    render();
  };

  return { element: base.element, update };
};
