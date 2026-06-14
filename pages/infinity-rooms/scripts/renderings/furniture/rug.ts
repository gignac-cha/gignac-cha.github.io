// 러그를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface RugOptions {
  variant?: number;
  color?: string;
}

export function createRug(options: RugOptions): THREE.Group {
  const rugGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const mainColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0xb0a496);

  const rugMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.95,
    metalness: 0.02,
  });

  if (variant === 2) {
    // 원형 러그입니다.
    const circleMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.01, 32), rugMaterial);
    circleMesh.position.set(0, 0.005, 0);
    circleMesh.receiveShadow = true;
    rugGroup.add(circleMesh);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: mainColorValue.clone().offsetHSL(0, 0, 0.1) });
    const ringMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.21, 1.21, 0.012, 32, 1, true), ringMaterial);
    ringMesh.position.set(0, 0.006, 0);
    rugGroup.add(ringMesh);
  } else if (variant === 3) {
    // 정사각 패턴 러그입니다.
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.01, 2.2), rugMaterial);
    bodyMesh.position.set(0, 0.005, 0);
    bodyMesh.receiveShadow = true;
    rugGroup.add(bodyMesh);

    const lineMaterial = new THREE.MeshStandardMaterial({
      color: mainColorValue.clone().offsetHSL(0, -0.15, -0.15),
      roughness: 0.95,
    });
    const lineMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.012, 2.0), lineMaterial);
    lineMesh.position.set(0, 0.006, 0);
    rugGroup.add(lineMesh);

    const innerMesh = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.014, 1.92), rugMaterial);
    innerMesh.position.set(0, 0.007, 0);
    rugGroup.add(innerMesh);
  } else {
    // 직사각 술 장식 러그입니다.
    const rectangleMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.01, 1.8), rugMaterial);
    rectangleMesh.position.set(0, 0.005, 0);
    rectangleMesh.receiveShadow = true;
    rugGroup.add(rectangleMesh);

    const fringeGeometry = new THREE.BoxGeometry(0.04, 0.008, 1.8);
    const fringeMaterial = new THREE.MeshStandardMaterial({ color: 0xefecdf, roughness: 0.9 });

    const leftFringeMesh = new THREE.Mesh(fringeGeometry, fringeMaterial);
    leftFringeMesh.position.set(-1.32, 0.005, 0);
    rugGroup.add(leftFringeMesh);

    const rightFringeMesh = new THREE.Mesh(fringeGeometry, fringeMaterial);
    rightFringeMesh.position.set(1.32, 0.005, 0);
    rugGroup.add(rightFringeMesh);
  }

  return rugGroup;
}
