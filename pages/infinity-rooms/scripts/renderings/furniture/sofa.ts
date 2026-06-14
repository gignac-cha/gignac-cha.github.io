// 소파를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface SofaOptions {
  variant?: number;
  color?: string;
  legColor?: string;
}

export function createSofa(options: SofaOptions): THREE.Group {
  const sofaGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const mainColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0xd97706);
  const legColorValue = options.legColor ? new THREE.Color(options.legColor) : new THREE.Color(0x1e293b);

  const mainMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.65,
    metalness: 0.05,
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColorValue,
    roughness: 0.4,
    metalness: 0.5,
  });

  const addLegs = (group: THREE.Group, offsets: Array<{ x: number; z: number }>, legHeight: number) => {
    const legGeometry = new THREE.CylinderGeometry(0.04, 0.02, legHeight, 8);
    offsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, legHeight / 2, offset.z);
      legMesh.castShadow = true;
      group.add(legMesh);
    });
  };

  if (variant === 1) {
    // 1인용 소파입니다.
    const cushionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.72), mainMaterial);
    cushionMesh.position.set(0, 0.28, 0);
    cushionMesh.castShadow = true;
    cushionMesh.receiveShadow = true;
    sofaGroup.add(cushionMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.45, 0.14), mainMaterial);
    backMesh.position.set(0, 0.46, -0.36);
    backMesh.castShadow = true;
    sofaGroup.add(backMesh);

    const armGeometry = new THREE.BoxGeometry(0.12, 0.38, 0.86);
    const leftArmMesh = new THREE.Mesh(armGeometry, mainMaterial);
    leftArmMesh.position.set(-0.41, 0.32, 0.02);
    leftArmMesh.castShadow = true;
    sofaGroup.add(leftArmMesh);

    const rightArmMesh = new THREE.Mesh(armGeometry, mainMaterial);
    rightArmMesh.position.set(0.41, 0.32, 0.02);
    rightArmMesh.castShadow = true;
    sofaGroup.add(rightArmMesh);

    addLegs(
      sofaGroup,
      [
        { x: -0.4, z: -0.4 },
        { x: 0.4, z: -0.4 },
        { x: -0.4, z: 0.4 },
        { x: 0.4, z: 0.4 },
      ],
      0.16,
    );
  } else if (variant === 2) {
    // 3인용 소파입니다.
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.1, 0.86), mainMaterial);
    baseMesh.position.set(0, 0.2, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    sofaGroup.add(baseMesh);

    const cushionGeometry = new THREE.BoxGeometry(0.66, 0.18, 0.72);
    [-1, 0, 1].forEach((cushionSlot) => {
      const cushionMesh = new THREE.Mesh(cushionGeometry, mainMaterial);
      cushionMesh.position.set(cushionSlot * 0.69, 0.32, 0.03);
      cushionMesh.castShadow = true;
      cushionMesh.receiveShadow = true;
      sofaGroup.add(cushionMesh);
    });

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 0.14), mainMaterial);
    backMesh.position.set(0, 0.52, -0.36);
    backMesh.castShadow = true;
    sofaGroup.add(backMesh);

    const armGeometry = new THREE.BoxGeometry(0.12, 0.42, 0.86);
    const leftArmMesh = new THREE.Mesh(armGeometry, mainMaterial);
    leftArmMesh.position.set(-1.08, 0.36, 0.02);
    leftArmMesh.castShadow = true;
    sofaGroup.add(leftArmMesh);

    const rightArmMesh = new THREE.Mesh(armGeometry, mainMaterial);
    rightArmMesh.position.set(1.08, 0.36, 0.02);
    rightArmMesh.castShadow = true;
    sofaGroup.add(rightArmMesh);

    addLegs(
      sofaGroup,
      [
        { x: -1.05, z: -0.38 },
        { x: 1.05, z: -0.38 },
        { x: -1.05, z: 0.38 },
        { x: 1.05, z: 0.38 },
      ],
      0.15,
    );
  } else {
    // L자형 카우치 소파입니다.
    const mainBaseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.86), mainMaterial);
    mainBaseMesh.position.set(0.1, 0.18, 0);
    mainBaseMesh.castShadow = true;
    mainBaseMesh.receiveShadow = true;
    sofaGroup.add(mainBaseMesh);

    const mainCushionMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.72), mainMaterial);
    mainCushionMesh.position.set(0.1, 0.3, 0.04);
    mainCushionMesh.castShadow = true;
    mainCushionMesh.receiveShadow = true;
    sofaGroup.add(mainCushionMesh);

    const mainBackMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.14), mainMaterial);
    mainBackMesh.position.set(0.1, 0.5, -0.36);
    mainBackMesh.castShadow = true;
    sofaGroup.add(mainBackMesh);

    const extensionBaseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 1.2), mainMaterial);
    extensionBaseMesh.position.set(-0.57, 0.18, 0.8);
    extensionBaseMesh.castShadow = true;
    extensionBaseMesh.receiveShadow = true;
    sofaGroup.add(extensionBaseMesh);

    const extensionCushionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 1.2), mainMaterial);
    extensionCushionMesh.position.set(-0.57, 0.3, 0.8);
    extensionCushionMesh.castShadow = true;
    extensionCushionMesh.receiveShadow = true;
    sofaGroup.add(extensionCushionMesh);

    const extensionArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 1.2), mainMaterial);
    extensionArmMesh.position.set(-0.93, 0.5, 0.8);
    extensionArmMesh.castShadow = true;
    sofaGroup.add(extensionArmMesh);

    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.86), mainMaterial);
    rightArmMesh.position.set(1.14, 0.35, 0.0);
    rightArmMesh.castShadow = true;
    sofaGroup.add(rightArmMesh);

    addLegs(
      sofaGroup,
      [
        { x: -0.9, z: -0.38 },
        { x: 1.1, z: -0.38 },
        { x: 1.1, z: 0.38 },
        { x: -0.9, z: 1.35 },
        { x: -0.2, z: 1.35 },
        { x: -0.2, z: 0.38 },
      ],
      0.12,
    );
  }

  return sofaGroup;
}
