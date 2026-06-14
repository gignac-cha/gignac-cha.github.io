// 책상을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface DeskOptions {
  variant?: number;
  topColor?: string;
  legColor?: string;
}

export function createDesk(options: DeskOptions): THREE.Group {
  const deskGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const topColorValue = options.topColor ? new THREE.Color(options.topColor) : new THREE.Color(0x854d0e);
  const legColorValue = options.legColor ? new THREE.Color(options.legColor) : new THREE.Color(0x1e293b);

  const topMaterial = new THREE.MeshStandardMaterial({
    color: topColorValue,
    roughness: 0.6,
    metalness: 0.05,
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColorValue,
    roughness: 0.35,
    metalness: 0.7,
  });

  if (variant === 2) {
    // L자형 책상입니다.
    const mainTopMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.9), topMaterial);
    mainTopMesh.position.set(0, 0.75, 0);
    mainTopMesh.castShadow = true;
    mainTopMesh.receiveShadow = true;
    deskGroup.add(mainTopMesh);

    const sideTopMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.2), topMaterial);
    sideTopMesh.position.set(0.55, 0.75, 0.75);
    sideTopMesh.castShadow = true;
    sideTopMesh.receiveShadow = true;
    deskGroup.add(sideTopMesh);

    const legGeometry = new THREE.BoxGeometry(0.08, 0.72, 0.08);
    const legOffsets = [
      { x: -0.9, z: -0.37 },
      { x: -0.9, z: 0.37 },
      { x: 0.9, z: -0.37 },
      { x: 0.18, z: 1.25 },
      { x: 0.9, z: 1.25 },
    ];

    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, 0.36, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      deskGroup.add(legMesh);
    });
  } else if (variant === 3) {
    // 높이 조절형 스탠딩 책상입니다.
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.85), topMaterial);
    topMesh.position.set(0, 0.95, 0);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    deskGroup.add(topMesh);

    const pillarGeometry = new THREE.BoxGeometry(0.12, 0.92, 0.12);
    const baseGeometry = new THREE.BoxGeometry(0.16, 0.04, 0.75);

    [-0.6, 0.6].forEach((offsetX) => {
      const pillarMesh = new THREE.Mesh(pillarGeometry, legMaterial);
      pillarMesh.position.set(offsetX, 0.46, 0);
      pillarMesh.castShadow = true;
      pillarMesh.receiveShadow = true;
      deskGroup.add(pillarMesh);

      const baseMesh = new THREE.Mesh(baseGeometry, legMaterial);
      baseMesh.position.set(offsetX, 0.02, 0);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      deskGroup.add(baseMesh);
    });

    const controlMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const controlMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.06), controlMaterial);
    controlMesh.position.set(0.7, 0.91, 0.38);
    deskGroup.add(controlMesh);
  } else {
    // 기본 4다리 책상입니다.
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.1), topMaterial);
    topMesh.position.y = 0.75;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    deskGroup.add(topMesh);

    const legGeometry = new THREE.BoxGeometry(0.08, 0.72, 0.08);
    const legOffsets = [
      { x: -1.0, z: -0.45 },
      { x: 1.0, z: -0.45 },
      { x: -1.0, z: 0.45 },
      { x: 1.0, z: 0.45 },
    ];

    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, 0.36, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      deskGroup.add(legMesh);
    });
  }

  return deskGroup;
}
