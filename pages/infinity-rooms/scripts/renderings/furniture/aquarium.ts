// 수조를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface AquariumOptions {
  variant?: number;
  glassColor?: string;
  waterColor?: string;
}

export function createAquarium(options: AquariumOptions): THREE.Group {
  const aquariumGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const glassColorValue = options.glassColor ? new THREE.Color(options.glassColor) : new THREE.Color(0xcfe8ef);
  const waterColorValue = options.waterColor ? new THREE.Color(options.waterColor) : new THREE.Color(0x2f8fb8);

  const standMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3b2e,
    roughness: 0.7,
    metalness: 0.1,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: glassColorValue,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.25,
  });

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: waterColorValue,
    roughness: 0.2,
    metalness: 0.0,
    transparent: true,
    opacity: 0.5,
  });

  if (variant === 2) {
    // 원통형 수조입니다.
    const standMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.36, 20), standMaterial);
    standMesh.position.set(0, 0.18, 0);
    standMesh.castShadow = true;
    standMesh.receiveShadow = true;
    aquariumGroup.add(standMesh);

    const waterMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.34, 20), waterMaterial);
    waterMesh.position.set(0, 0.55, 0);
    aquariumGroup.add(waterMesh);

    const glassMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 20, 1, true), glassMaterial);
    glassMesh.position.set(0, 0.56, 0);
    aquariumGroup.add(glassMesh);

    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 8, 24), standMaterial);
    rimMesh.position.set(0, 0.76, 0);
    rimMesh.rotation.x = Math.PI / 2;
    aquariumGroup.add(rimMesh);
  } else if (variant === 3) {
    // 벽걸이형 스탠드 수조입니다.
    const standMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.46, 12), standMaterial);
    standMesh.position.set(0, 0.23, 0);
    standMesh.castShadow = true;
    standMesh.receiveShadow = true;
    aquariumGroup.add(standMesh);

    const footMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 16), standMaterial);
    footMesh.position.set(0, 0.02, 0);
    footMesh.receiveShadow = true;
    aquariumGroup.add(footMesh);

    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.06), standMaterial);
    frameMesh.position.set(0, 0.62, 0);
    frameMesh.castShadow = true;
    aquariumGroup.add(frameMesh);

    const waterMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.32, 0.05), waterMaterial);
    waterMesh.position.set(0, 0.62, 0.01);
    aquariumGroup.add(waterMesh);

    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.08), glassMaterial);
    glassMesh.position.set(0, 0.62, 0.02);
    aquariumGroup.add(glassMesh);
  } else {
    // 직사각형 수조입니다.
    const standMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.34, 0.46), standMaterial);
    standMesh.position.set(0, 0.17, 0);
    standMesh.castShadow = true;
    standMesh.receiveShadow = true;
    aquariumGroup.add(standMesh);

    const waterMesh = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.32, 0.4), waterMaterial);
    waterMesh.position.set(0, 0.52, 0);
    aquariumGroup.add(waterMesh);

    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.38, 0.42), glassMaterial);
    glassMesh.position.set(0, 0.53, 0);
    aquariumGroup.add(glassMesh);

    const frameGeometry = new THREE.BoxGeometry(1.18, 0.02, 0.44);
    const topFrameMesh = new THREE.Mesh(frameGeometry, standMaterial);
    topFrameMesh.position.set(0, 0.72, 0);
    aquariumGroup.add(topFrameMesh);
  }

  return aquariumGroup;
}
