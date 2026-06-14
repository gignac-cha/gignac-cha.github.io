// 소형 장식 꽃병을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface VaseOptions {
  variant?: number;
  color?: string;
}

export function createVase(options: VaseOptions): THREE.Group {
  const vaseGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const mainColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x6d8a96);

  const ceramicMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.35,
    metalness: 0.1,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue.clone().offsetHSL(0, 0.05, 0.15),
    roughness: 0.3,
    metalness: 0.15,
  });

  if (variant === 2) {
    // 넓은 항아리형 꽃병입니다.
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), ceramicMaterial);
    bodyMesh.position.set(0, 0.14, 0);
    bodyMesh.scale.set(1, 0.85, 1);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    vaseGroup.add(bodyMesh);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.06, 16), accentMaterial);
    neckMesh.position.set(0, 0.28, 0);
    neckMesh.castShadow = true;
    vaseGroup.add(neckMesh);

    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.012, 8, 20), accentMaterial);
    rimMesh.position.set(0, 0.31, 0);
    rimMesh.rotation.x = Math.PI / 2;
    vaseGroup.add(rimMesh);
  } else if (variant === 3) {
    // 원통형 꽃병입니다.
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 20), ceramicMaterial);
    bodyMesh.position.set(0, 0.16, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    vaseGroup.add(bodyMesh);

    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), accentMaterial);
    baseMesh.position.set(0, 0.01, 0);
    vaseGroup.add(baseMesh);

    const stripeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.04, 20), accentMaterial);
    stripeMesh.position.set(0, 0.24, 0);
    vaseGroup.add(stripeMesh);
  } else {
    // 호리병형 꽃병입니다.
    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), ceramicMaterial);
    bulbMesh.position.set(0, 0.12, 0);
    bulbMesh.castShadow = true;
    bulbMesh.receiveShadow = true;
    vaseGroup.add(bulbMesh);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.2, 16), ceramicMaterial);
    neckMesh.position.set(0, 0.28, 0);
    neckMesh.castShadow = true;
    vaseGroup.add(neckMesh);

    const lipMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.03, 16), accentMaterial);
    lipMesh.position.set(0, 0.395, 0);
    vaseGroup.add(lipMesh);
  }

  return vaseGroup;
}
