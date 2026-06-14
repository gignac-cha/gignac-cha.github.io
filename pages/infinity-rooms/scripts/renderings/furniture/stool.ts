// 스툴을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface StoolOptions {
  variant?: number;
  color?: string;
  legColor?: string;
}

export function createStool(options: StoolOptions): THREE.Group {
  const stoolGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const seatColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0xca8a04);
  const legColorValue = options.legColor ? new THREE.Color(options.legColor) : new THREE.Color(0x374151);

  const seatMaterial = new THREE.MeshStandardMaterial({
    color: seatColorValue,
    roughness: 0.6,
    metalness: 0.1,
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColorValue,
    roughness: 0.35,
    metalness: 0.7,
  });

  const seatHeight = 0.45;

  if (variant === 1) {
    // 원형 스툴입니다. 둥근 좌판과 네 개의 다리를 가집니다.
    const seatMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), seatMaterial);
    seatMesh.position.set(0, seatHeight, 0);
    seatMesh.castShadow = true;
    seatMesh.receiveShadow = true;
    stoolGroup.add(seatMesh);

    const legGeometry = new THREE.CylinderGeometry(0.02, 0.015, seatHeight - 0.05, 10);
    Array.from({ length: 4 }).forEach((_, legIndex) => {
      const angle = (legIndex * Math.PI * 2) / 4 + Math.PI / 4;
      const radius = 0.15;
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(Math.sin(angle) * radius, (seatHeight - 0.05) / 2, Math.cos(angle) * radius);
      legMesh.rotation.z = -Math.sin(angle) * 0.12;
      legMesh.rotation.x = Math.cos(angle) * 0.12;
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      stoolGroup.add(legMesh);
    });
  } else if (variant === 2) {
    // 사각 스툴입니다. 네모난 좌판과 사각 다리를 가집니다.
    const seatSize = 0.38;
    const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(seatSize, 0.06, seatSize), seatMaterial);
    seatMesh.position.set(0, seatHeight, 0);
    seatMesh.castShadow = true;
    seatMesh.receiveShadow = true;
    stoolGroup.add(seatMesh);

    const legGeometry = new THREE.BoxGeometry(0.04, seatHeight - 0.06, 0.04);
    const legOffset = seatSize / 2 - 0.05;
    const legOffsets = [
      { x: -legOffset, z: -legOffset },
      { x: legOffset, z: -legOffset },
      { x: -legOffset, z: legOffset },
      { x: legOffset, z: legOffset },
    ];

    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, (seatHeight - 0.06) / 2, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      stoolGroup.add(legMesh);
    });
  } else {
    // 3다리 스툴입니다. 삼각으로 벌어진 세 다리를 가집니다.
    const seatMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 18), seatMaterial);
    seatMesh.position.set(0, seatHeight, 0);
    seatMesh.castShadow = true;
    seatMesh.receiveShadow = true;
    stoolGroup.add(seatMesh);

    const legGeometry = new THREE.CylinderGeometry(0.022, 0.012, seatHeight - 0.05, 10);
    Array.from({ length: 3 }).forEach((_, legIndex) => {
      const angle = (legIndex * Math.PI * 2) / 3;
      const radius = 0.14;
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(Math.sin(angle) * radius, (seatHeight - 0.05) / 2, Math.cos(angle) * radius);
      legMesh.rotation.z = -Math.sin(angle) * 0.2;
      legMesh.rotation.x = Math.cos(angle) * 0.2;
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      stoolGroup.add(legMesh);
    });
  }

  return stoolGroup;
}
