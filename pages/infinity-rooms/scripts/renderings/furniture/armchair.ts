// 1인 안락의자를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface ArmchairOptions {
  variant?: number;
  color?: string;
  legColor?: string;
}

export function createArmchair(options: ArmchairOptions): THREE.Group {
  const armchairGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const mainColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x7c3aed);
  const legColorValue = options.legColor ? new THREE.Color(options.legColor) : new THREE.Color(0x3f2d1c);

  const mainMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.7,
    metalness: 0.05,
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColorValue,
    roughness: 0.4,
    metalness: 0.3,
  });

  if (variant === 1) {
    // 라운지 안락의자입니다. 낮고 깊은 좌석에 비스듬한 등받이를 가집니다.
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.8), mainMaterial);
    baseMesh.position.set(0, 0.28, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    armchairGroup.add(baseMesh);

    const cushionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.72), mainMaterial);
    cushionMesh.position.set(0, 0.46, 0);
    cushionMesh.castShadow = true;
    armchairGroup.add(cushionMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.16), mainMaterial);
    backMesh.position.set(0, 0.66, -0.32);
    backMesh.rotation.x = 0.18;
    backMesh.castShadow = true;
    armchairGroup.add(backMesh);

    const armGeometry = new THREE.BoxGeometry(0.14, 0.28, 0.8);
    [-1, 1].forEach((armSide) => {
      const armMesh = new THREE.Mesh(armGeometry, mainMaterial);
      armMesh.position.set(armSide * 0.4, 0.54, 0);
      armMesh.castShadow = true;
      armchairGroup.add(armMesh);
    });

    const legGeometry = new THREE.CylinderGeometry(0.035, 0.025, 0.18, 8);
    const legOffsets = [
      { x: -0.32, z: -0.32 },
      { x: 0.32, z: -0.32 },
      { x: -0.32, z: 0.32 },
      { x: 0.32, z: 0.32 },
    ];
    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, 0.09, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      armchairGroup.add(legMesh);
    });
  } else if (variant === 2) {
    // 윙백 안락의자입니다. 높은 등받이 양옆에 날개가 솟습니다.
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.78), mainMaterial);
    baseMesh.position.set(0, 0.35, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    armchairGroup.add(baseMesh);

    const cushionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), mainMaterial);
    cushionMesh.position.set(0, 0.53, 0);
    cushionMesh.castShadow = true;
    armchairGroup.add(cushionMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.8, 0.14), mainMaterial);
    backMesh.position.set(0, 0.85, -0.32);
    backMesh.castShadow = true;
    armchairGroup.add(backMesh);

    // 양옆으로 솟은 날개입니다.
    const wingGeometry = new THREE.BoxGeometry(0.12, 0.5, 0.3);
    [-1, 1].forEach((wingSide) => {
      const wingMesh = new THREE.Mesh(wingGeometry, mainMaterial);
      wingMesh.position.set(wingSide * 0.36, 0.95, -0.2);
      wingMesh.rotation.y = wingSide * -0.2;
      wingMesh.castShadow = true;
      armchairGroup.add(wingMesh);
    });

    const armGeometry = new THREE.BoxGeometry(0.12, 0.32, 0.7);
    [-1, 1].forEach((armSide) => {
      const armMesh = new THREE.Mesh(armGeometry, mainMaterial);
      armMesh.position.set(armSide * 0.4, 0.66, 0.02);
      armMesh.castShadow = true;
      armchairGroup.add(armMesh);
    });

    const legGeometry = new THREE.BoxGeometry(0.05, 0.24, 0.05);
    const legOffsets = [
      { x: -0.32, z: -0.32 },
      { x: 0.32, z: -0.32 },
      { x: -0.32, z: 0.32 },
      { x: 0.32, z: 0.32 },
    ];
    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, 0.12, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      armchairGroup.add(legMesh);
    });
  } else {
    // 모던 안락의자입니다. 얇은 좌석과 가는 금속 프레임을 가집니다.
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: legColorValue,
      roughness: 0.3,
      metalness: 0.8,
    });

    const cushionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), mainMaterial);
    cushionMesh.position.set(0, 0.42, 0);
    cushionMesh.castShadow = true;
    cushionMesh.receiveShadow = true;
    armchairGroup.add(cushionMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.1), mainMaterial);
    backMesh.position.set(0, 0.66, -0.3);
    backMesh.rotation.x = 0.1;
    backMesh.castShadow = true;
    armchairGroup.add(backMesh);

    // 좌우를 감싸는 금속 팔걸이 프레임입니다.
    const armGeometry = new THREE.TorusGeometry(0.2, 0.02, 8, 16, Math.PI);
    [-1, 1].forEach((armSide) => {
      const armMesh = new THREE.Mesh(armGeometry, frameMaterial);
      armMesh.position.set(armSide * 0.36, 0.42, 0);
      armMesh.rotation.z = Math.PI / 2;
      armMesh.rotation.y = Math.PI / 2;
      armMesh.castShadow = true;
      armchairGroup.add(armMesh);
    });

    const legGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.36, 8);
    const legOffsets = [
      { x: -0.3, z: -0.3 },
      { x: 0.3, z: -0.3 },
      { x: -0.3, z: 0.3 },
      { x: 0.3, z: 0.3 },
    ];
    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, frameMaterial);
      legMesh.position.set(offset.x, 0.18, offset.z);
      legMesh.rotation.z = offset.x > 0 ? -0.12 : 0.12;
      legMesh.rotation.x = offset.z > 0 ? 0.12 : -0.12;
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      armchairGroup.add(legMesh);
    });
  }

  return armchairGroup;
}
