// 천장등을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface CeilingLightOptions {
  variant?: number;
  color?: string;
  lightColor?: string;
}

export function createCeilingLight(options: CeilingLightOptions): THREE.Group {
  const lightGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const frameColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x334155);
  const lightColorValue = options.lightColor ? new THREE.Color(options.lightColor) : new THREE.Color(0xfef08a);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: frameColorValue,
    roughness: 0.3,
    metalness: 0.8,
  });

  const glowingMaterial = new THREE.MeshBasicMaterial({
    color: lightColorValue,
  });

  const addLightSource = (group: THREE.Group, offsetY: number, intensity: number = 10) => {
    const pointLight = new THREE.PointLight(lightColorValue, intensity, 15);
    pointLight.position.set(0, offsetY, 0);
    pointLight.castShadow = true;
    pointLight.shadow.bias = -0.002;
    group.add(pointLight);

    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), glowingMaterial);
    bulbMesh.position.set(0, offsetY, 0);
    group.add(bulbMesh);
  };

  if (variant === 1) {
    // 펜던트형 천장등입니다.
    const canopyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16), bodyMaterial);
    canopyMesh.position.set(0, -0.015, 0);
    canopyMesh.castShadow = true;
    lightGroup.add(canopyMesh);

    const cordMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.45, 8), bodyMaterial);
    cordMesh.position.set(0, -0.24, 0);
    lightGroup.add(cordMesh);

    const shadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), bodyMaterial);
    shadeMesh.position.set(0, -0.465, 0);
    shadeMesh.rotation.x = Math.PI;
    shadeMesh.castShadow = true;
    lightGroup.add(shadeMesh);

    addLightSource(lightGroup, -0.48, 12);
  } else if (variant === 2) {
    // 트랙 스포트라이트형 천장등입니다.
    const trackBarMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.04), bodyMaterial);
    trackBarMesh.position.set(0, -0.015, 0);
    trackBarMesh.castShadow = true;
    lightGroup.add(trackBarMesh);

    const supportGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8);
    [-0.4, 0.4].forEach((supportX) => {
      const supportMesh = new THREE.Mesh(supportGeometry, bodyMaterial);
      supportMesh.position.set(supportX, -0.02, 0);
      lightGroup.add(supportMesh);
    });

    const spotConfigs = [
      { x: -0.4, rotationZ: 0.25 },
      { x: 0, rotationZ: 0 },
      { x: 0.4, rotationZ: -0.25 },
    ];

    spotConfigs.forEach((spotConfig) => {
      const spotGroup = new THREE.Group();
      spotGroup.position.set(spotConfig.x, -0.03, 0);

      const jointMesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), bodyMaterial);
      jointMesh.position.set(0, -0.015, 0);
      spotGroup.add(jointMesh);

      const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), bodyMaterial);
      headMesh.position.set(0, -0.08, 0);
      headMesh.rotation.z = spotConfig.rotationZ;
      headMesh.castShadow = true;
      spotGroup.add(headMesh);

      addLightSource(spotGroup, -0.15, 5);

      lightGroup.add(spotGroup);
    });
  } else {
    // 발광 링형 천장등입니다.
    const canopyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 16), bodyMaterial);
    canopyMesh.position.set(0, -0.015, 0);
    lightGroup.add(canopyMesh);

    const wireGeometry = new THREE.CylinderGeometry(0.003, 0.003, 0.5, 6);
    const wireAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
    const ringRadius = 0.45;

    wireAngles.forEach((angle) => {
      const wireMesh = new THREE.Mesh(wireGeometry, bodyMaterial);
      wireMesh.position.set(Math.sin(angle) * (ringRadius / 2), -0.25, Math.cos(angle) * (ringRadius / 2));
      wireMesh.rotation.z = -0.38;
      wireMesh.rotation.y = angle;
      lightGroup.add(wireMesh);
    });

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: lightColorValue,
      emissive: lightColorValue,
      emissiveIntensity: 0.8,
      roughness: 0.5,
    });
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.025, 8, 32), ringMaterial);
    ringMesh.position.set(0, -0.5, 0);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.castShadow = true;
    lightGroup.add(ringMesh);

    addLightSource(lightGroup, -0.5, 12);
  }

  return lightGroup;
}
