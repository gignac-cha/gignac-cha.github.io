// 샹들리에를 만드는 가구 팩토리입니다(천장 부착).

import * as THREE from 'three';

export interface ChandelierOptions {
  variant?: number;
  color?: string;
  lightColor?: string;
}

export function createChandelier(options: ChandelierOptions): THREE.Group {
  const chandelierGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const frameColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0xb8860b);
  const lightColorValue = options.lightColor ? new THREE.Color(options.lightColor) : new THREE.Color(0xfef08a);

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: frameColorValue,
    roughness: 0.3,
    metalness: 0.85,
  });

  const glowingMaterial = new THREE.MeshBasicMaterial({ color: lightColorValue });

  // 발광체와 점광원을 추가합니다(ceiling-light.ts 규약을 따릅니다).
  const addLightSource = (group: THREE.Group, position: THREE.Vector3, intensity: number = 4) => {
    const pointLight = new THREE.PointLight(lightColorValue, intensity, 12);
    pointLight.position.copy(position);
    pointLight.castShadow = true;
    pointLight.shadow.bias = -0.002;
    group.add(pointLight);

    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), glowingMaterial);
    bulbMesh.position.copy(position);
    group.add(bulbMesh);
  };

  // 천장 부착판(캐노피)입니다. 원점에서 아래로 매달립니다.
  const canopyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), metalMaterial);
  canopyMesh.position.set(0, -0.015, 0);
  canopyMesh.castShadow = true;
  chandelierGroup.add(canopyMesh);

  // 캐노피에서 본체까지 이어지는 줄기입니다.
  const stemMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8), metalMaterial);
  stemMesh.position.set(0, -0.2, 0);
  chandelierGroup.add(stemMesh);

  // 본체 중심 위치(아래로 매달린 지점)입니다.
  const hubY = -0.4;

  if (variant === 1) {
    // 크리스털형: 중앙 본체에 매달린 크리스털 드롭과 발광체입니다.
    const hubMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), metalMaterial);
    hubMesh.position.set(0, hubY, 0);
    hubMesh.castShadow = true;
    chandelierGroup.add(hubMesh);

    const crystalMaterial = new THREE.MeshStandardMaterial({
      color: lightColorValue,
      emissive: lightColorValue,
      emissiveIntensity: 0.5,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.7,
    });

    const armCount = 6;
    const armRadius = 0.3;
    for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
      const angle = (armIndex / armCount) * Math.PI * 2;
      const dropX = Math.sin(angle) * armRadius;
      const dropZ = Math.cos(angle) * armRadius;

      // 본체에서 바깥으로 뻗는 팔입니다.
      const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, armRadius, 6), metalMaterial);
      armMesh.position.set(dropX / 2, hubY + 0.02, dropZ / 2);
      armMesh.rotation.z = Math.PI / 2;
      armMesh.rotation.y = -angle;
      chandelierGroup.add(armMesh);

      // 팔 끝의 크리스털 드롭입니다.
      const crystalMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), crystalMaterial);
      crystalMesh.position.set(dropX, hubY - 0.08, dropZ);
      chandelierGroup.add(crystalMesh);

      addLightSource(chandelierGroup, new THREE.Vector3(dropX, hubY - 0.08, dropZ), 3);
    }

    // 중앙 하단의 큰 크리스털 드롭입니다.
    const centerCrystalMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), crystalMaterial);
    centerCrystalMesh.position.set(0, hubY - 0.14, 0);
    chandelierGroup.add(centerCrystalMesh);
    addLightSource(chandelierGroup, new THREE.Vector3(0, hubY - 0.14, 0), 4);
  } else if (variant === 2) {
    // 촛대형: 위로 솟은 여러 팔 끝에 촛불 모양 발광체가 있습니다.
    const hubMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), metalMaterial);
    hubMesh.position.set(0, hubY, 0);
    hubMesh.castShadow = true;
    chandelierGroup.add(hubMesh);

    const flameMaterial = new THREE.MeshStandardMaterial({
      color: lightColorValue,
      emissive: lightColorValue,
      emissiveIntensity: 0.9,
      roughness: 0.6,
    });

    const armCount = 5;
    const armRadius = 0.28;
    for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
      const angle = (armIndex / armCount) * Math.PI * 2;
      const armEndX = Math.sin(angle) * armRadius;
      const armEndZ = Math.cos(angle) * armRadius;

      // 살짝 위로 휘어 올라가는 팔입니다.
      const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, armRadius * 1.1, 8), metalMaterial);
      armMesh.position.set(armEndX / 2, hubY + 0.04, armEndZ / 2);
      armMesh.rotation.z = Math.PI / 2 - 0.3;
      armMesh.rotation.y = -angle;
      armMesh.castShadow = true;
      chandelierGroup.add(armMesh);

      // 팔 끝의 촛대 컵입니다.
      const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.04, 12), metalMaterial);
      cupMesh.position.set(armEndX, hubY + 0.1, armEndZ);
      cupMesh.castShadow = true;
      chandelierGroup.add(cupMesh);

      // 촛불 모양 발광체입니다.
      const flameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 10), flameMaterial);
      flameMesh.position.set(armEndX, hubY + 0.16, armEndZ);
      chandelierGroup.add(flameMesh);

      addLightSource(chandelierGroup, new THREE.Vector3(armEndX, hubY + 0.16, armEndZ), 3);
    }
  } else {
    // 모던 링형: 두 개의 동심 발광 링으로 구성됩니다.
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: lightColorValue,
      emissive: lightColorValue,
      emissiveIntensity: 0.85,
      roughness: 0.5,
    });

    const ringConfigs = [
      { radius: 0.34, tube: 0.022, offsetY: 0 },
      { radius: 0.2, tube: 0.018, offsetY: -0.1 },
    ];

    ringConfigs.forEach((ringConfig) => {
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(ringConfig.radius, ringConfig.tube, 10, 40), ringMaterial);
      ringMesh.position.set(0, hubY + ringConfig.offsetY, 0);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.castShadow = true;
      chandelierGroup.add(ringMesh);

      // 줄기에서 링까지 연결하는 가는 와이어입니다.
      const wireAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
      wireAngles.forEach((angle) => {
        const wireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 6), metalMaterial);
        wireMesh.position.set(Math.sin(angle) * (ringConfig.radius / 2), hubY + ringConfig.offsetY + 0.09, Math.cos(angle) * (ringConfig.radius / 2));
        wireMesh.rotation.z = -0.5;
        wireMesh.rotation.y = angle;
        chandelierGroup.add(wireMesh);
      });
    });

    addLightSource(chandelierGroup, new THREE.Vector3(0, hubY - 0.05, 0), 6);
  }

  return chandelierGroup;
}
