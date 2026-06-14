// 침대를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface BedOptions {
  variant?: number;
  frameColor?: string;
  beddingColor?: string;
}

export function createBed(options: BedOptions): THREE.Group {
  const bedGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const frameColorValue = options.frameColor ? new THREE.Color(options.frameColor) : new THREE.Color(0x78350f);
  const beddingColorValue = options.beddingColor ? new THREE.Color(options.beddingColor) : new THREE.Color(0xe2e8f0);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorValue,
    roughness: 0.65,
    metalness: 0.1,
  });

  const beddingMaterial = new THREE.MeshStandardMaterial({
    color: beddingColorValue,
    roughness: 0.85,
    metalness: 0.02,
  });

  const pillowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
  });

  if (variant === 2) {
    // 더블 침대입니다. 폭이 넓고 높은 헤드보드를 가집니다.
    const bedWidth = 2.0;
    const bedDepth = 2.0;

    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth, 0.3, bedDepth), frameMaterial);
    frameMesh.position.set(0, 0.15, 0);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    bedGroup.add(frameMesh);

    const mattressMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth - 0.1, 0.22, bedDepth - 0.1), beddingMaterial);
    mattressMesh.position.set(0, 0.41, 0);
    mattressMesh.castShadow = true;
    mattressMesh.receiveShadow = true;
    bedGroup.add(mattressMesh);

    // 베개 두 개를 헤드보드 쪽에 배치합니다.
    [-0.45, 0.45].forEach((offsetX) => {
      const pillowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.4), pillowMaterial);
      pillowMesh.position.set(offsetX, 0.58, -bedDepth / 2 + 0.35);
      pillowMesh.castShadow = true;
      bedGroup.add(pillowMesh);
    });

    const headboardMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth, 0.85, 0.12), frameMaterial);
    headboardMesh.position.set(0, 0.55, -bedDepth / 2 - 0.06);
    headboardMesh.castShadow = true;
    headboardMesh.receiveShadow = true;
    bedGroup.add(headboardMesh);
  } else if (variant === 3) {
    // 플랫폼 침대입니다. 다리 없이 낮은 단 위에 매트리스가 놓입니다.
    const bedWidth = 1.9;
    const bedDepth = 2.0;

    const platformMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth + 0.3, 0.18, bedDepth + 0.3), frameMaterial);
    platformMesh.position.set(0, 0.09, 0);
    platformMesh.castShadow = true;
    platformMesh.receiveShadow = true;
    bedGroup.add(platformMesh);

    const mattressMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth, 0.24, bedDepth), beddingMaterial);
    mattressMesh.position.set(0, 0.3, 0);
    mattressMesh.castShadow = true;
    mattressMesh.receiveShadow = true;
    bedGroup.add(mattressMesh);

    const pillowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.42), pillowMaterial);
    pillowMesh.position.set(0, 0.48, -bedDepth / 2 + 0.35);
    pillowMesh.castShadow = true;
    bedGroup.add(pillowMesh);

    // 낮은 헤드보드입니다.
    const headboardMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth + 0.3, 0.45, 0.12), frameMaterial);
    headboardMesh.position.set(0, 0.32, -bedDepth / 2 - 0.21);
    headboardMesh.castShadow = true;
    bedGroup.add(headboardMesh);
  } else {
    // 싱글 침대입니다. 네 다리와 직사각형 헤드보드를 가집니다.
    const bedWidth = 1.1;
    const bedDepth = 2.0;

    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth, 0.18, bedDepth), frameMaterial);
    frameMesh.position.set(0, 0.32, 0);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    bedGroup.add(frameMesh);

    const mattressMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth - 0.08, 0.2, bedDepth - 0.08), beddingMaterial);
    mattressMesh.position.set(0, 0.51, 0);
    mattressMesh.castShadow = true;
    mattressMesh.receiveShadow = true;
    bedGroup.add(mattressMesh);

    const pillowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.4), pillowMaterial);
    pillowMesh.position.set(0, 0.67, -bedDepth / 2 + 0.35);
    pillowMesh.castShadow = true;
    bedGroup.add(pillowMesh);

    const headboardMesh = new THREE.Mesh(new THREE.BoxGeometry(bedWidth, 0.7, 0.1), frameMaterial);
    headboardMesh.position.set(0, 0.5, -bedDepth / 2 - 0.05);
    headboardMesh.castShadow = true;
    headboardMesh.receiveShadow = true;
    bedGroup.add(headboardMesh);

    const legGeometry = new THREE.BoxGeometry(0.08, 0.24, 0.08);
    const legOffsets = [
      { x: -bedWidth / 2 + 0.08, z: -bedDepth / 2 + 0.08 },
      { x: bedWidth / 2 - 0.08, z: -bedDepth / 2 + 0.08 },
      { x: -bedWidth / 2 + 0.08, z: bedDepth / 2 - 0.08 },
      { x: bedWidth / 2 - 0.08, z: bedDepth / 2 - 0.08 },
    ];

    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, frameMaterial);
      legMesh.position.set(offset.x, 0.12, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      bedGroup.add(legMesh);
    });
  }

  return bedGroup;
}
