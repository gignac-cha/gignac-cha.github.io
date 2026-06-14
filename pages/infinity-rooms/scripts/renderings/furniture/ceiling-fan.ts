// 천장 선풍기를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface CeilingFanOptions {
  variant?: number;
  bladeColor?: string;
}

export function createCeilingFan(options: CeilingFanOptions): THREE.Group {
  const fanGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const bladeColorValue = options.bladeColor ? new THREE.Color(options.bladeColor) : new THREE.Color(0x8a6f4e);

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    roughness: 0.3,
    metalness: 0.8,
  });

  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: bladeColorValue,
    roughness: 0.6,
    metalness: 0.1,
  });

  // 천장에 부착되는 봉과 캐노피를 만드는 헬퍼입니다. (천장 높이에서 아래를 향함)
  const addMount = (motorOffsetY: number) => {
    const canopyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), metalMaterial);
    canopyMesh.position.set(0, -0.015, 0);
    canopyMesh.castShadow = true;
    fanGroup.add(canopyMesh);

    const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.abs(motorOffsetY), 8), metalMaterial);
    rodMesh.position.set(0, motorOffsetY / 2, 0);
    fanGroup.add(rodMesh);

    const motorMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 16), metalMaterial);
    motorMesh.position.set(0, motorOffsetY, 0);
    motorMesh.castShadow = true;
    fanGroup.add(motorMesh);
  };

  // 회전 날개들을 모터 아래에 배치하는 헬퍼입니다.
  const addBlades = (bladeCount: number, motorOffsetY: number, bladeLength: number) => {
    const bladeGeometry = new THREE.BoxGeometry(bladeLength, 0.01, 0.14);
    for (let bladeIndex = 0; bladeIndex < bladeCount; bladeIndex += 1) {
      const bladeAngle = (Math.PI * 2 * bladeIndex) / bladeCount;
      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(0, motorOffsetY - 0.04, 0);
      bladeGroup.rotation.y = bladeAngle;

      const bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
      bladeMesh.position.set(bladeLength / 2 + 0.08, 0, 0);
      bladeMesh.rotation.z = 0.08;
      bladeMesh.castShadow = true;
      bladeGroup.add(bladeMesh);

      const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.04), metalMaterial);
      armMesh.position.set(0.1, 0, 0);
      bladeGroup.add(armMesh);

      fanGroup.add(bladeGroup);
    }
  };

  if (variant === 2) {
    // 4날개 천장 선풍기입니다.
    const motorOffsetY = -0.45;
    addMount(motorOffsetY);
    addBlades(4, motorOffsetY, 0.42);
  } else if (variant === 3) {
    // 조명 결합형 천장 선풍기입니다.
    const motorOffsetY = -0.4;
    addMount(motorOffsetY);
    addBlades(4, motorOffsetY, 0.4);

    const lightColorValue = new THREE.Color(0xfef08a);
    const housingMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), metalMaterial);
    housingMesh.position.set(0, motorOffsetY - 0.06, 0);
    housingMesh.castShadow = true;
    fanGroup.add(housingMesh);

    const globeMaterial = new THREE.MeshStandardMaterial({
      color: lightColorValue,
      emissive: lightColorValue,
      emissiveIntensity: 0.7,
      roughness: 0.6,
      transparent: true,
      opacity: 0.9,
    });
    const globeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), globeMaterial);
    globeMesh.position.set(0, motorOffsetY - 0.12, 0);
    globeMesh.rotation.x = Math.PI;
    fanGroup.add(globeMesh);

    const pointLight = new THREE.PointLight(lightColorValue, 8, 14);
    pointLight.position.set(0, motorOffsetY - 0.16, 0);
    pointLight.castShadow = true;
    pointLight.shadow.bias = -0.002;
    fanGroup.add(pointLight);
  } else {
    // 3날개 천장 선풍기입니다.
    const motorOffsetY = -0.5;
    addMount(motorOffsetY);
    addBlades(3, motorOffsetY, 0.44);
  }

  return fanGroup;
}
