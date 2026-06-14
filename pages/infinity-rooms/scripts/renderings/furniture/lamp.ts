// 램프를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface LampOptions {
  variant?: number;
  color?: string;
  lightColor?: string;
}

export function createLamp(options: LampOptions): THREE.Group {
  const lampGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const mainColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0xd1d5db);
  const lightColorValue = options.lightColor ? new THREE.Color(options.lightColor) : new THREE.Color(0xfef08a);

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.25,
    metalness: 0.8,
  });

  const shadeMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.6,
    metalness: 0.1,
  });

  const addLightSource = (group: THREE.Group, positionY: number, intensity: number = 8) => {
    const pointLight = new THREE.PointLight(lightColorValue, intensity, 12);
    pointLight.position.set(0, positionY, 0);
    pointLight.castShadow = true;
    pointLight.shadow.bias = -0.002;
    group.add(pointLight);

    const bulbMaterial = new THREE.MeshBasicMaterial({ color: lightColorValue });
    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), bulbMaterial);
    bulbMesh.position.set(0, positionY, 0);
    group.add(bulbMesh);
  };

  if (variant === 1) {
    // 아치형 플로어 램프입니다.
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16), metalMaterial);
    baseMesh.position.set(0, 0.02, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    lampGroup.add(baseMesh);

    const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8), metalMaterial);
    poleMesh.position.set(0, 0.62, 0);
    poleMesh.castShadow = true;
    lampGroup.add(poleMesh);

    const firstArcMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.4, 8), metalMaterial);
    firstArcMesh.position.set(0.08, 1.35, 0);
    firstArcMesh.rotation.z = -0.3;
    firstArcMesh.castShadow = true;
    lampGroup.add(firstArcMesh);

    const secondArcMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.4, 8), metalMaterial);
    secondArcMesh.position.set(0.24, 1.48, 0);
    secondArcMesh.rotation.z = -0.8;
    secondArcMesh.castShadow = true;
    lampGroup.add(secondArcMesh);

    const thirdArcMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 8), metalMaterial);
    thirdArcMesh.position.set(0.38, 1.5, 0);
    thirdArcMesh.rotation.z = -1.57;
    thirdArcMesh.castShadow = true;
    lampGroup.add(thirdArcMesh);

    const shadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), shadeMaterial);
    shadeMesh.position.set(0.48, 1.44, 0);
    shadeMesh.rotation.x = Math.PI;
    shadeMesh.castShadow = true;
    lampGroup.add(shadeMesh);

    const lampLightGroup = new THREE.Group();
    lampLightGroup.position.set(0.48, 0, 0);
    lampGroup.add(lampLightGroup);
    addLightSource(lampLightGroup, 1.34, 10);
  } else if (variant === 2) {
    // 삼각대형 플로어 램프입니다.
    const legGeometry = new THREE.CylinderGeometry(0.015, 0.01, 1.4, 8);
    const legAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
    const legSpread = 0.22;

    legAngles.forEach((angle) => {
      const legMesh = new THREE.Mesh(legGeometry, metalMaterial);
      legMesh.position.set(Math.sin(angle) * (legSpread / 2), 0.66, Math.cos(angle) * (legSpread / 2));
      legMesh.rotation.z = -0.15;
      legMesh.rotation.y = angle;
      legMesh.castShadow = true;
      lampGroup.add(legMesh);
    });

    const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 16, 1, true), shadeMaterial);
    shadeMesh.position.set(0, 1.42, 0);
    shadeMesh.castShadow = true;
    lampGroup.add(shadeMesh);

    addLightSource(lampGroup, 1.42, 8);
  } else {
    // 발광 기둥형 무드 램프입니다.
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16), metalMaterial);
    baseMesh.position.set(0, 0.03, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    lampGroup.add(baseMesh);

    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: lightColorValue,
      emissive: lightColorValue,
      emissiveIntensity: 0.65,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    });
    const pillarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 16), pillarMaterial);
    pillarMesh.position.set(0, 0.71, 0);
    pillarMesh.castShadow = true;
    pillarMesh.receiveShadow = true;
    lampGroup.add(pillarMesh);

    addLightSource(lampGroup, 0.8, 12);
  }

  return lampGroup;
}
