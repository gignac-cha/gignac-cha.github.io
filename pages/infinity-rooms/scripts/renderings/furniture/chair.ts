// 의자를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface ChairOptions {
  variant?: number;
  color?: string;
  legColor?: string;
}

export function createChair(options: ChairOptions): THREE.Group {
  const chairGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const mainColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x3b82f6);
  const legColorValue = options.legColor ? new THREE.Color(options.legColor) : new THREE.Color(0x4b5563);

  const mainMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.5,
    metalness: 0.1,
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColorValue,
    roughness: 0.3,
    metalness: 0.6,
  });

  if (variant === 1) {
    // 회전형 사무용 의자입니다.
    const seatMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16), mainMaterial);
    seatMesh.position.set(0, 0.46, 0);
    seatMesh.castShadow = true;
    seatMesh.receiveShadow = true;
    chairGroup.add(seatMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.05), mainMaterial);
    backMesh.position.set(0, 0.8, -0.26);
    backMesh.rotation.x = 0.08;
    backMesh.castShadow = true;
    chairGroup.add(backMesh);

    const supportMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.04), legMaterial);
    supportMesh.position.set(0, 0.6, -0.22);
    supportMesh.rotation.x = -0.1;
    supportMesh.castShadow = true;
    chairGroup.add(supportMesh);

    const columnMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8), legMaterial);
    columnMesh.position.set(0, 0.3, 0);
    columnMesh.castShadow = true;
    chairGroup.add(columnMesh);

    const baseLegLength = 0.28;
    const baseLegGeometry = new THREE.BoxGeometry(0.05, 0.03, baseLegLength);
    Array.from({ length: 5 }).forEach((_, legIndex) => {
      const angle = (legIndex * Math.PI * 2) / 5;
      const baseLegMesh = new THREE.Mesh(baseLegGeometry, legMaterial);
      baseLegMesh.position.set(Math.sin(angle) * (baseLegLength / 2), 0.16, Math.cos(angle) * (baseLegLength / 2));
      baseLegMesh.rotation.y = angle;
      baseLegMesh.castShadow = true;
      chairGroup.add(baseLegMesh);
    });
  } else if (variant === 2) {
    // 원목 식탁 의자입니다.
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: options.color ? mainColorValue : new THREE.Color(0xb45309),
      roughness: 0.7,
      metalness: 0.05,
    });

    const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.48), woodMaterial);
    seatMesh.position.set(0, 0.46, 0);
    seatMesh.castShadow = true;
    seatMesh.receiveShadow = true;
    chairGroup.add(seatMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.04), woodMaterial);
    backMesh.position.set(0, 0.72, -0.2);
    backMesh.castShadow = true;
    chairGroup.add(backMesh);

    const backPillarGeometry = new THREE.BoxGeometry(0.03, 0.42, 0.02);
    [-1, 1].forEach((pillarSide) => {
      const pillarMesh = new THREE.Mesh(backPillarGeometry, woodMaterial);
      pillarMesh.position.set(pillarSide * 0.12, 0.72, -0.19);
      chairGroup.add(pillarMesh);
    });

    const legGeometry = new THREE.BoxGeometry(0.04, 0.44, 0.04);
    const legOffsets = [
      { x: -0.2, z: -0.2 },
      { x: 0.2, z: -0.2 },
      { x: -0.2, z: 0.2 },
      { x: 0.2, z: 0.2 },
    ];

    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, woodMaterial);
      legMesh.position.set(offset.x, 0.22, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      chairGroup.add(legMesh);
    });
  } else {
    // 팔걸이가 있는 안락의자입니다.
    const cushionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.58), mainMaterial);
    cushionMesh.position.set(0, 0.33, 0);
    cushionMesh.castShadow = true;
    cushionMesh.receiveShadow = true;
    chairGroup.add(cushionMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.48, 0.12), mainMaterial);
    backMesh.position.set(0, 0.62, -0.23);
    backMesh.rotation.x = 0.05;
    backMesh.castShadow = true;
    chairGroup.add(backMesh);

    const armGeometry = new THREE.BoxGeometry(0.12, 0.32, 0.58);
    const leftArmMesh = new THREE.Mesh(armGeometry, mainMaterial);
    leftArmMesh.position.set(-0.29, 0.46, 0);
    leftArmMesh.castShadow = true;
    chairGroup.add(leftArmMesh);

    const rightArmMesh = new THREE.Mesh(armGeometry, mainMaterial);
    rightArmMesh.position.set(0.29, 0.46, 0);
    rightArmMesh.castShadow = true;
    chairGroup.add(rightArmMesh);

    const legGeometry = new THREE.CylinderGeometry(0.03, 0.02, 0.24, 8);
    const legOffsets = [
      { x: -0.22, z: -0.22 },
      { x: 0.22, z: -0.22 },
      { x: -0.22, z: 0.22 },
      { x: 0.22, z: 0.22 },
    ];

    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, 0.12, offset.z);
      legMesh.rotation.z = offset.x > 0 ? -0.15 : 0.15;
      legMesh.rotation.x = offset.z > 0 ? 0.15 : -0.15;
      legMesh.castShadow = true;
      chairGroup.add(legMesh);
    });
  }

  return chairGroup;
}
