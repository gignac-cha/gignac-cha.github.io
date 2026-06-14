// 화분 식물을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface PlantOptions {
  variant?: number;
  potColor?: string;
  foliageColor?: string;
}

export function createPlant(options: PlantOptions): THREE.Group {
  const plantGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const potColorValue = options.potColor ? new THREE.Color(options.potColor) : new THREE.Color(0xb45309);
  const foliageColorValue = options.foliageColor ? new THREE.Color(options.foliageColor) : new THREE.Color(0x2f9e44);

  const potMaterial = new THREE.MeshStandardMaterial({
    color: potColorValue,
    roughness: 0.8,
    metalness: 0.05,
  });

  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: foliageColorValue,
    roughness: 0.85,
    metalness: 0.0,
  });

  const stemMaterial = new THREE.MeshStandardMaterial({
    color: foliageColorValue.clone().offsetHSL(0, -0.1, -0.25),
    roughness: 0.9,
    metalness: 0.0,
  });

  // 공통 화분을 만드는 헬퍼입니다.
  const addPot = (radiusTop: number, radiusBottom: number, height: number) => {
    // 화분을 바닥(y=0)에서 살짝 띄워 바닥면과의 z-fighting 을 피합니다.
    const potMesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16), potMaterial);
    potMesh.position.set(0, height / 2 + 0.003, 0);
    potMesh.castShadow = true;
    potMesh.receiveShadow = true;
    plantGroup.add(potMesh);

    // 흙은 화분 윗면 캡 위로 올려, 두 면이 같은 높이에서 겹쳐 깜빡이는 z-fighting 을 막습니다.
    const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x3f2d1d, roughness: 1.0 });
    const soilMesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop * 0.92, radiusTop * 0.92, 0.02, 16), soilMaterial);
    soilMesh.position.set(0, height + 0.015, 0);
    plantGroup.add(soilMesh);

    return height;
  };

  if (variant === 2) {
    // 둥근 덤불 식물입니다.
    const potHeight = addPot(0.18, 0.14, 0.2);

    const bushMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), foliageMaterial);
    bushMesh.position.set(0, potHeight + 0.18, 0);
    bushMesh.scale.set(1, 0.9, 1);
    bushMesh.castShadow = true;
    plantGroup.add(bushMesh);

    const sproutPositions = [
      { x: 0.12, z: 0.08 },
      { x: -0.1, z: 0.12 },
      { x: 0.05, z: -0.14 },
    ];
    sproutPositions.forEach((sproutPosition) => {
      const sproutMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), foliageMaterial);
      sproutMesh.position.set(sproutPosition.x, potHeight + 0.34, sproutPosition.z);
      sproutMesh.castShadow = true;
      plantGroup.add(sproutMesh);
    });
  } else if (variant === 3) {
    // 늘어지는 덩굴 식물입니다.
    const potHeight = addPot(0.16, 0.12, 0.22);

    const crownMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), foliageMaterial);
    crownMesh.position.set(0, potHeight + 0.1, 0);
    crownMesh.scale.set(1.1, 0.7, 1.1);
    crownMesh.castShadow = true;
    plantGroup.add(crownMesh);

    const vineAngles = [0, (Math.PI * 2) / 5, (Math.PI * 4) / 5, (Math.PI * 6) / 5, (Math.PI * 8) / 5];
    vineAngles.forEach((angle, vineIndex) => {
      const vineLength = 0.24 + (vineIndex % 2) * 0.1;
      const vineMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.006, vineLength, 6), stemMaterial);
      const vineRadius = 0.15;
      vineMesh.position.set(Math.sin(angle) * vineRadius, potHeight + 0.08 - vineLength / 2, Math.cos(angle) * vineRadius);
      vineMesh.rotation.z = Math.sin(angle) * 0.3;
      vineMesh.rotation.x = -Math.cos(angle) * 0.3;
      vineMesh.castShadow = true;
      plantGroup.add(vineMesh);

      const leafMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), foliageMaterial);
      leafMesh.position.set(Math.sin(angle) * (vineRadius + 0.04), potHeight + 0.08 - vineLength, Math.cos(angle) * (vineRadius + 0.04));
      leafMesh.castShadow = true;
      plantGroup.add(leafMesh);
    });
  } else {
    // 키 큰 야자수 식물입니다.
    const potHeight = addPot(0.16, 0.13, 0.24);

    const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.5, 8), stemMaterial);
    trunkMesh.position.set(0, potHeight + 0.25, 0);
    trunkMesh.castShadow = true;
    plantGroup.add(trunkMesh);

    const frondAngles = [0, (Math.PI * 2) / 6, (Math.PI * 4) / 6, (Math.PI * 6) / 6, (Math.PI * 8) / 6, (Math.PI * 10) / 6];
    frondAngles.forEach((angle) => {
      const frondMesh = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 6), foliageMaterial);
      const frondRadius = 0.16;
      frondMesh.position.set(Math.sin(angle) * frondRadius, potHeight + 0.52, Math.cos(angle) * frondRadius);
      frondMesh.rotation.z = -Math.sin(angle) * 0.9;
      frondMesh.rotation.x = Math.cos(angle) * 0.9;
      frondMesh.castShadow = true;
      plantGroup.add(frondMesh);
    });
  }

  return plantGroup;
}
