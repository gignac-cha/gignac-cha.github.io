// 벽거울을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface MirrorOptions {
  variant?: number;
  frameColor?: string;
}

export function createMirror(options: MirrorOptions): THREE.Group {
  const mirrorGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const frameColorValue = options.frameColor ? new THREE.Color(options.frameColor) : new THREE.Color(0xb45309);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorValue,
    roughness: 0.4,
    metalness: 0.6,
  });

  // 반사 느낌을 살리기 위해 밝고 매끈한 면을 사용합니다.
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.05,
    metalness: 0.95,
    envMapIntensity: 1.2,
  });

  const borderSize = 0.05;
  const depth = 0.05;

  if (variant === 1) {
    // 직사각형 거울입니다.
    const width = 0.62;
    const height = 0.9;

    const horizontalBorderGeometry = new THREE.BoxGeometry(width, borderSize, depth);
    const topBorderMesh = new THREE.Mesh(horizontalBorderGeometry, frameMaterial);
    topBorderMesh.position.set(0, height / 2 - borderSize / 2, 0);
    topBorderMesh.castShadow = true;
    mirrorGroup.add(topBorderMesh);

    const bottomBorderMesh = new THREE.Mesh(horizontalBorderGeometry, frameMaterial);
    bottomBorderMesh.position.set(0, -height / 2 + borderSize / 2, 0);
    bottomBorderMesh.castShadow = true;
    mirrorGroup.add(bottomBorderMesh);

    const verticalBorderGeometry = new THREE.BoxGeometry(borderSize, height - borderSize * 2, depth);
    const leftBorderMesh = new THREE.Mesh(verticalBorderGeometry, frameMaterial);
    leftBorderMesh.position.set(-width / 2 + borderSize / 2, 0, 0);
    leftBorderMesh.castShadow = true;
    mirrorGroup.add(leftBorderMesh);

    const rightBorderMesh = new THREE.Mesh(verticalBorderGeometry, frameMaterial);
    rightBorderMesh.position.set(width / 2 - borderSize / 2, 0, 0);
    rightBorderMesh.castShadow = true;
    mirrorGroup.add(rightBorderMesh);

    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(width - borderSize * 2, height - borderSize * 2, 0.02), glassMaterial);
    glassMesh.position.set(0, 0, 0.001);
    mirrorGroup.add(glassMesh);
  } else if (variant === 2) {
    // 원형 거울입니다.
    const radius = 0.45;

    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(radius, borderSize, 12, 48), frameMaterial);
    ringMesh.position.set(0, 0, 0);
    ringMesh.castShadow = true;
    mirrorGroup.add(ringMesh);

    const glassMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.02, 48), glassMaterial);
    glassMesh.position.set(0, 0, 0);
    glassMesh.rotation.x = Math.PI / 2;
    mirrorGroup.add(glassMesh);
  } else {
    // 아치형 거울입니다.
    const width = 0.62;
    const height = 0.9;
    const archRadius = width / 2;
    const straightHeight = height - archRadius;

    // 아래 직선 구간의 좌우 테두리입니다.
    const verticalBorderGeometry = new THREE.BoxGeometry(borderSize, straightHeight, depth);
    const leftBorderMesh = new THREE.Mesh(verticalBorderGeometry, frameMaterial);
    leftBorderMesh.position.set(-width / 2 + borderSize / 2, -height / 2 + straightHeight / 2, 0);
    leftBorderMesh.castShadow = true;
    mirrorGroup.add(leftBorderMesh);

    const rightBorderMesh = new THREE.Mesh(verticalBorderGeometry, frameMaterial);
    rightBorderMesh.position.set(width / 2 - borderSize / 2, -height / 2 + straightHeight / 2, 0);
    rightBorderMesh.castShadow = true;
    mirrorGroup.add(rightBorderMesh);

    const bottomBorderMesh = new THREE.Mesh(new THREE.BoxGeometry(width, borderSize, depth), frameMaterial);
    bottomBorderMesh.position.set(0, -height / 2 + borderSize / 2, 0);
    bottomBorderMesh.castShadow = true;
    mirrorGroup.add(bottomBorderMesh);

    // 윗부분의 반원 아치 테두리입니다.
    const archMesh = new THREE.Mesh(new THREE.TorusGeometry(archRadius - borderSize / 2, borderSize / 2, 10, 32, Math.PI), frameMaterial);
    archMesh.position.set(0, -height / 2 + straightHeight, 0);
    archMesh.castShadow = true;
    mirrorGroup.add(archMesh);

    // 직선 구간 유리면입니다.
    const lowerGlassMesh = new THREE.Mesh(new THREE.BoxGeometry(width - borderSize * 2, straightHeight, 0.02), glassMaterial);
    lowerGlassMesh.position.set(0, -height / 2 + straightHeight / 2, 0.001);
    mirrorGroup.add(lowerGlassMesh);

    // 아치 구간 유리면입니다.
    const upperGlassMesh = new THREE.Mesh(new THREE.CircleGeometry(archRadius - borderSize, 32, 0, Math.PI), glassMaterial);
    upperGlassMesh.position.set(0, -height / 2 + straightHeight, 0.001);
    mirrorGroup.add(upperGlassMesh);
  }

  return mirrorGroup;
}
