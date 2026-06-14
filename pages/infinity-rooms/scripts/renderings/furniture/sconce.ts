// 벽 조명(스콘스)을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface SconceOptions {
  variant?: number;
  color?: string;
  lightColor?: string;
}

export function createSconce(options: SconceOptions): THREE.Group {
  const sconceGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const mainColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0xca8a04);
  const lightColorValue = options.lightColor ? new THREE.Color(options.lightColor) : new THREE.Color(0xfef3c7);

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.35,
    metalness: 0.7,
  });

  const shadeMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.7,
    metalness: 0.1,
  });

  // 발광체와 점광원을 함께 추가합니다(lamp.ts 규약을 따릅니다).
  const addLightSource = (group: THREE.Group, position: THREE.Vector3, intensity: number = 5) => {
    const pointLight = new THREE.PointLight(lightColorValue, intensity, 8);
    pointLight.position.copy(position);
    pointLight.castShadow = true;
    pointLight.shadow.bias = -0.002;
    group.add(pointLight);

    const bulbMaterial = new THREE.MeshBasicMaterial({ color: lightColorValue });
    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), bulbMaterial);
    bulbMesh.position.copy(position);
    group.add(bulbMesh);
  };

  // 벽에 붙는 받침판입니다. 방 안쪽(+Z)으로 돌출됩니다.
  const backPlateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.03), metalMaterial);
  backPlateMesh.position.set(0, 0, 0.015);
  backPlateMesh.castShadow = true;
  sconceGroup.add(backPlateMesh);

  if (variant === 1) {
    // 촛대형: 가지가 위로 뻗고 끝에 불꽃 모양 발광체가 있습니다.
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.16, 10), metalMaterial);
    armMesh.position.set(0, 0.08, 0.08);
    armMesh.castShadow = true;
    sconceGroup.add(armMesh);

    const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.04, 12), metalMaterial);
    cupMesh.position.set(0, 0.18, 0.08);
    cupMesh.castShadow = true;
    sconceGroup.add(cupMesh);

    const flameMaterial = new THREE.MeshStandardMaterial({
      color: lightColorValue,
      emissive: lightColorValue,
      emissiveIntensity: 0.9,
      roughness: 0.6,
    });
    const flameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 10), flameMaterial);
    flameMesh.position.set(0, 0.24, 0.08);
    sconceGroup.add(flameMesh);

    addLightSource(sconceGroup, new THREE.Vector3(0, 0.24, 0.12), 4);
  } else if (variant === 2) {
    // 갓형: 받침판에서 짧은 팔이 나오고 원통형 갓 안에서 빛납니다.
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8), metalMaterial);
    armMesh.position.set(0, 0, 0.07);
    armMesh.rotation.x = Math.PI / 2;
    armMesh.castShadow = true;
    sconceGroup.add(armMesh);

    const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 16, 1, true), shadeMaterial);
    shadeMesh.position.set(0, 0, 0.14);
    shadeMesh.castShadow = true;
    sconceGroup.add(shadeMesh);

    addLightSource(sconceGroup, new THREE.Vector3(0, 0, 0.14), 5);
  } else {
    // 업라이트형: 빛이 위를 향하도록 비스듬한 발광 막대를 둡니다.
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), metalMaterial);
    armMesh.position.set(0, 0.04, 0.06);
    armMesh.rotation.x = -0.4;
    armMesh.castShadow = true;
    sconceGroup.add(armMesh);

    const diffuserMaterial = new THREE.MeshStandardMaterial({
      color: lightColorValue,
      emissive: lightColorValue,
      emissiveIntensity: 0.75,
      roughness: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    const diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.1), diffuserMaterial);
    diffuserMesh.position.set(0, 0.12, 0.1);
    diffuserMesh.castShadow = true;
    sconceGroup.add(diffuserMesh);

    addLightSource(sconceGroup, new THREE.Vector3(0, 0.16, 0.1), 5);
  }

  return sconceGroup;
}
