// 받침 위 추상 조형을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface SculptureOptions {
  variant?: number;
  color?: string;
}

export function createSculpture(options: SculptureOptions): THREE.Group {
  const sculptureGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const mainColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0xcbb89d);

  const pedestalMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.6,
    metalness: 0.2,
  });

  const formMaterial = new THREE.MeshStandardMaterial({
    color: mainColorValue,
    roughness: 0.35,
    metalness: 0.4,
  });

  // 공통 받침을 만드는 헬퍼입니다.
  const addPedestal = (height: number) => {
    const pedestalMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, height, 0.22), pedestalMaterial);
    pedestalMesh.position.set(0, height / 2, 0);
    pedestalMesh.castShadow = true;
    pedestalMesh.receiveShadow = true;
    sculptureGroup.add(pedestalMesh);

    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.26), pedestalMaterial);
    topMesh.position.set(0, height + 0.01, 0);
    sculptureGroup.add(topMesh);

    return height + 0.02;
  };

  if (variant === 2) {
    // 비틀린 기둥형 조형입니다.
    const pedestalTop = addPedestal(0.18);

    const segmentCount = 5;
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const segmentMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1), formMaterial);
      segmentMesh.position.set(0, pedestalTop + 0.05 + segmentIndex * 0.06, 0);
      segmentMesh.rotation.y = segmentIndex * 0.4;
      segmentMesh.castShadow = true;
      sculptureGroup.add(segmentMesh);
    }
  } else if (variant === 3) {
    // 기하 추상 조형입니다.
    const pedestalTop = addPedestal(0.16);

    const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), formMaterial);
    cubeMesh.position.set(0, pedestalTop + 0.1, 0);
    cubeMesh.rotation.set(0.4, 0.6, 0.2);
    cubeMesh.castShadow = true;
    sculptureGroup.add(cubeMesh);

    const coneMesh = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), formMaterial);
    coneMesh.position.set(0.06, pedestalTop + 0.26, -0.02);
    coneMesh.rotation.z = -0.5;
    coneMesh.castShadow = true;
    sculptureGroup.add(coneMesh);

    const torusMesh = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 16), formMaterial);
    torusMesh.position.set(-0.06, pedestalTop + 0.06, 0.04);
    torusMesh.rotation.x = 0.8;
    torusMesh.castShadow = true;
    sculptureGroup.add(torusMesh);
  } else {
    // 구체형 조형입니다.
    const pedestalTop = addPedestal(0.2);

    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 18), formMaterial);
    sphereMesh.position.set(0, pedestalTop + 0.13, 0);
    sphereMesh.castShadow = true;
    sculptureGroup.add(sphereMesh);

    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 8, 28), formMaterial);
    ringMesh.position.set(0, pedestalTop + 0.13, 0);
    ringMesh.rotation.set(0.5, 0.3, 0);
    ringMesh.castShadow = true;
    sculptureGroup.add(ringMesh);
  }

  return sculptureGroup;
}
