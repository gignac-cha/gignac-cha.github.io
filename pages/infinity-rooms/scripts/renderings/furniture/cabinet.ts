// 수납장을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface CabinetOptions {
  variant?: number;
  color?: string;
  handleColor?: string;
}

export function createCabinet(options: CabinetOptions): THREE.Group {
  const cabinetGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const bodyColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x9a3412);
  const handleColorValue = options.handleColor ? new THREE.Color(options.handleColor) : new THREE.Color(0xd1d5db);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColorValue,
    roughness: 0.55,
    metalness: 0.1,
  });

  const handleMaterial = new THREE.MeshStandardMaterial({
    color: handleColorValue,
    roughness: 0.3,
    metalness: 0.8,
  });

  const cabinetWidth = 1.6;
  const cabinetDepth = 0.5;
  const cabinetHeight = 1.0;

  if (variant === 1) {
    // 서랍형 수납장입니다. 가로로 긴 서랍 세 개가 쌓입니다.
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinetWidth, cabinetHeight, cabinetDepth), bodyMaterial);
    bodyMesh.position.set(0, cabinetHeight / 2, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    cabinetGroup.add(bodyMesh);

    const drawerCount = 3;
    const drawerHeight = (cabinetHeight - 0.08) / drawerCount;
    Array.from({ length: drawerCount }).forEach((_, drawerIndex) => {
      const drawerFrontMesh = new THREE.Mesh(
        new THREE.BoxGeometry(cabinetWidth - 0.1, drawerHeight - 0.04, 0.03),
        bodyMaterial,
      );
      const drawerY = drawerHeight / 2 + 0.04 + drawerIndex * drawerHeight;
      drawerFrontMesh.position.set(0, drawerY, cabinetDepth / 2 + 0.015);
      drawerFrontMesh.castShadow = true;
      cabinetGroup.add(drawerFrontMesh);

      const handleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.04), handleMaterial);
      handleMesh.position.set(0, drawerY, cabinetDepth / 2 + 0.05);
      handleMesh.castShadow = true;
      cabinetGroup.add(handleMesh);
    });
  } else if (variant === 2) {
    // 문짝형 수납장입니다. 여닫이문 두 짝과 둥근 손잡이를 가집니다.
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinetWidth, cabinetHeight, cabinetDepth), bodyMaterial);
    bodyMesh.position.set(0, cabinetHeight / 2, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    cabinetGroup.add(bodyMesh);

    const doorMaterial = new THREE.MeshStandardMaterial({
      color: bodyColorValue.clone().offsetHSL(0, 0, 0.06),
      roughness: 0.5,
      metalness: 0.1,
    });

    [-1, 1].forEach((doorSide) => {
      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(cabinetWidth / 2 - 0.06, cabinetHeight - 0.1, 0.03),
        doorMaterial,
      );
      doorMesh.position.set(doorSide * (cabinetWidth / 4), cabinetHeight / 2, cabinetDepth / 2 + 0.015);
      doorMesh.castShadow = true;
      cabinetGroup.add(doorMesh);

      const handleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12), handleMaterial);
      handleMesh.rotation.x = Math.PI / 2;
      handleMesh.position.set(doorSide * 0.1, cabinetHeight / 2, cabinetDepth / 2 + 0.06);
      handleMesh.castShadow = true;
      cabinetGroup.add(handleMesh);
    });

    const legGeometry = new THREE.BoxGeometry(0.06, 0.1, 0.06);
    [-1, 1].forEach((legSide) => {
      [-1, 1].forEach((legDepthSide) => {
        const legMesh = new THREE.Mesh(legGeometry, handleMaterial);
        legMesh.position.set(
          legSide * (cabinetWidth / 2 - 0.1),
          -0.05,
          legDepthSide * (cabinetDepth / 2 - 0.08),
        );
        cabinetGroup.add(legMesh);
      });
    });
  } else {
    // 콘솔형 수납장입니다. 낮고 긴 몸체와 가는 다리, 가운데 서랍을 가집니다.
    const consoleHeight = 0.78;
    const bodyHeight = 0.32;

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinetWidth, bodyHeight, cabinetDepth), bodyMaterial);
    bodyMesh.position.set(0, consoleHeight - bodyHeight / 2, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    cabinetGroup.add(bodyMesh);

    const drawerFrontMesh = new THREE.Mesh(
      new THREE.BoxGeometry(cabinetWidth * 0.5, bodyHeight - 0.08, 0.03),
      bodyMaterial,
    );
    drawerFrontMesh.position.set(0, consoleHeight - bodyHeight / 2, cabinetDepth / 2 + 0.015);
    drawerFrontMesh.castShadow = true;
    cabinetGroup.add(drawerFrontMesh);

    const handleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.03), handleMaterial);
    handleMesh.position.set(0, consoleHeight - bodyHeight / 2, cabinetDepth / 2 + 0.05);
    handleMesh.castShadow = true;
    cabinetGroup.add(handleMesh);

    const legMaterial = new THREE.MeshStandardMaterial({
      color: handleColorValue,
      roughness: 0.4,
      metalness: 0.6,
    });
    const legGeometry = new THREE.CylinderGeometry(0.025, 0.02, consoleHeight - bodyHeight, 10);
    const legOffsets = [
      { x: -cabinetWidth / 2 + 0.1, z: -cabinetDepth / 2 + 0.08 },
      { x: cabinetWidth / 2 - 0.1, z: -cabinetDepth / 2 + 0.08 },
      { x: -cabinetWidth / 2 + 0.1, z: cabinetDepth / 2 - 0.08 },
      { x: cabinetWidth / 2 - 0.1, z: cabinetDepth / 2 - 0.08 },
    ];

    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, (consoleHeight - bodyHeight) / 2, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      cabinetGroup.add(legMesh);
    });
  }

  return cabinetGroup;
}
