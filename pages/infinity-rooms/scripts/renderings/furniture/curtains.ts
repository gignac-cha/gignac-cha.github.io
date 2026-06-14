// 벽 커튼을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface CurtainsOptions {
  variant?: number;
  color?: string;
}

export function createCurtains(options: CurtainsOptions): THREE.Group {
  const curtainsGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const fabricColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x7c3aed);

  const fabricMaterial = new THREE.MeshStandardMaterial({
    color: fabricColorValue,
    roughness: 0.95,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const rodMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    roughness: 0.4,
    metalness: 0.7,
  });

  const totalWidth = 1.6;
  const panelHeight = 1.6;
  const topY = panelHeight / 2;

  // 주름이 진 천 패널을 만듭니다. 폭 방향으로 사인파 형태의 주름을 줍니다.
  const buildPleatedPanel = (panelWidth: number, centerX: number) => {
    const pleatCount = Math.max(3, Math.round(panelWidth / 0.12));
    const pleatDepth = 0.04;
    const segmentWidth = panelWidth / pleatCount;
    const panelGroup = new THREE.Group();
    panelGroup.position.set(centerX, 0, 0);

    for (let pleatIndex = 0; pleatIndex < pleatCount; pleatIndex += 1) {
      const localX = -panelWidth / 2 + segmentWidth * (pleatIndex + 0.5);
      // 주름 깊이를 번갈아 적용해 입체감을 줍니다.
      const offsetZ = (pleatIndex % 2 === 0 ? pleatDepth : -pleatDepth) * 0.5;
      const foldMesh = new THREE.Mesh(new THREE.BoxGeometry(segmentWidth * 0.96, panelHeight, 0.03), fabricMaterial);
      foldMesh.position.set(localX, 0, offsetZ);
      foldMesh.castShadow = true;
      foldMesh.receiveShadow = true;
      panelGroup.add(foldMesh);
    }

    return panelGroup;
  };

  // 천장에 가까운 커튼 봉입니다.
  const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, totalWidth + 0.12, 12), rodMaterial);
  rodMesh.position.set(0, topY + 0.04, 0.04);
  rodMesh.rotation.z = Math.PI / 2;
  rodMesh.castShadow = true;
  curtainsGroup.add(rodMesh);

  const finialGeometry = new THREE.SphereGeometry(0.04, 12, 12);
  [-1, 1].forEach((side) => {
    const finialMesh = new THREE.Mesh(finialGeometry, rodMaterial);
    finialMesh.position.set(side * (totalWidth / 2 + 0.07), topY + 0.04, 0.04);
    curtainsGroup.add(finialMesh);
  });

  if (variant === 1) {
    // 양쪽 개폐형: 두 개의 패널을 좌우에 배치합니다.
    const panelWidth = totalWidth * 0.46;
    curtainsGroup.add(buildPleatedPanel(panelWidth, -totalWidth / 2 + panelWidth / 2));
    curtainsGroup.add(buildPleatedPanel(panelWidth, totalWidth / 2 - panelWidth / 2));
  } else if (variant === 2) {
    // 일자형: 폭 전체를 덮는 단일 패널입니다.
    curtainsGroup.add(buildPleatedPanel(totalWidth, 0));
  } else {
    // 탑밸런스형: 일자 패널 위에 장식용 가로 밸런스를 덧댑니다.
    curtainsGroup.add(buildPleatedPanel(totalWidth, 0));

    const valanceMesh = new THREE.Mesh(new THREE.BoxGeometry(totalWidth + 0.04, 0.3, 0.07), fabricMaterial);
    valanceMesh.position.set(0, topY - 0.15, 0.05);
    valanceMesh.castShadow = true;
    curtainsGroup.add(valanceMesh);

    // 밸런스 아래 가장자리에 짧은 주름 장식을 더합니다.
    const trimCount = 8;
    const trimGeometry = new THREE.BoxGeometry((totalWidth / trimCount) * 0.9, 0.08, 0.04);
    for (let trimIndex = 0; trimIndex < trimCount; trimIndex += 1) {
      const localX = -totalWidth / 2 + (totalWidth / trimCount) * (trimIndex + 0.5);
      const trimMesh = new THREE.Mesh(trimGeometry, fabricMaterial);
      trimMesh.position.set(localX, topY - 0.34, 0.06);
      curtainsGroup.add(trimMesh);
    }
  }

  return curtainsGroup;
}
