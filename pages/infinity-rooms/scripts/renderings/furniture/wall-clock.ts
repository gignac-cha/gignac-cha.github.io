// 벽시계를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface WallClockOptions {
  variant?: number;
  color?: string;
}

export function createWallClock(options: WallClockOptions): THREE.Group {
  const clockGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const frameColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x1e293b);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorValue,
    roughness: 0.5,
    metalness: 0.4,
  });

  const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.85,
    metalness: 0.05,
  });

  const handMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.6,
    metalness: 0.3,
  });

  const markMaterial = new THREE.MeshBasicMaterial({ color: frameColorValue });

  // 변형마다 반지름과 두께를 다르게 설정합니다.
  let radius = 0.25;
  let bezelThickness = 0.05;
  if (variant === 3) {
    radius = 0.4;
    bezelThickness = 0.06;
  }

  // 시계 베젤(테두리)입니다.
  const bezelMesh = new THREE.Mesh(new THREE.TorusGeometry(radius, bezelThickness / 2, 12, 48), frameMaterial);
  bezelMesh.position.set(0, 0, 0);
  bezelMesh.castShadow = true;
  clockGroup.add(bezelMesh);

  // 시계판입니다.
  const faceMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.03, 48), faceMaterial);
  faceMesh.position.set(0, 0, -0.01);
  faceMesh.rotation.x = Math.PI / 2;
  faceMesh.receiveShadow = true;
  clockGroup.add(faceMesh);

  // 시각 표시 마크를 배치합니다.
  if (variant === 1) {
    // 모던: 12개의 짧은 막대형 마크입니다.
    const markGeometry = new THREE.BoxGeometry(0.012, 0.04, 0.01);
    for (let hourIndex = 0; hourIndex < 12; hourIndex += 1) {
      const angle = (hourIndex / 12) * Math.PI * 2;
      const markMesh = new THREE.Mesh(markGeometry, markMaterial);
      const markRadius = radius * 0.82;
      markMesh.position.set(Math.sin(angle) * markRadius, Math.cos(angle) * markRadius, 0.02);
      markMesh.rotation.z = -angle;
      clockGroup.add(markMesh);
    }
  } else if (variant === 2) {
    // 로마숫자 느낌: 4개의 주요 방위에 굵은 마크를 배치합니다.
    const majorMarkGeometry = new THREE.BoxGeometry(0.02, 0.06, 0.012);
    for (let quarterIndex = 0; quarterIndex < 4; quarterIndex += 1) {
      const angle = (quarterIndex / 4) * Math.PI * 2;
      const markMesh = new THREE.Mesh(majorMarkGeometry, markMaterial);
      const markRadius = radius * 0.8;
      markMesh.position.set(Math.sin(angle) * markRadius, Math.cos(angle) * markRadius, 0.02);
      markMesh.rotation.z = -angle;
      clockGroup.add(markMesh);
    }

    // 그 사이의 보조 마크입니다.
    const minorMarkGeometry = new THREE.BoxGeometry(0.01, 0.03, 0.01);
    for (let hourIndex = 0; hourIndex < 12; hourIndex += 1) {
      if (hourIndex % 3 === 0) {
        continue;
      }
      const angle = (hourIndex / 12) * Math.PI * 2;
      const markMesh = new THREE.Mesh(minorMarkGeometry, markMaterial);
      const markRadius = radius * 0.83;
      markMesh.position.set(Math.sin(angle) * markRadius, Math.cos(angle) * markRadius, 0.02);
      markMesh.rotation.z = -angle;
      clockGroup.add(markMesh);
    }
  } else {
    // 대형: 12개의 큰 마크입니다.
    const markGeometry = new THREE.BoxGeometry(0.018, 0.06, 0.012);
    for (let hourIndex = 0; hourIndex < 12; hourIndex += 1) {
      const angle = (hourIndex / 12) * Math.PI * 2;
      const markMesh = new THREE.Mesh(markGeometry, markMaterial);
      const markRadius = radius * 0.83;
      markMesh.position.set(Math.sin(angle) * markRadius, Math.cos(angle) * markRadius, 0.02);
      markMesh.rotation.z = -angle;
      clockGroup.add(markMesh);
    }
  }

  // 중심축입니다.
  const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12), handMaterial);
  hubMesh.position.set(0, 0, 0.03);
  hubMesh.rotation.x = Math.PI / 2;
  clockGroup.add(hubMesh);

  // 시침입니다(약 11시 방향).
  const hourHandLength = radius * 0.5;
  const hourHandMesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, hourHandLength, 0.01), handMaterial);
  hourHandMesh.position.set(Math.sin(-0.5) * (hourHandLength / 2), Math.cos(-0.5) * (hourHandLength / 2), 0.035);
  hourHandMesh.rotation.z = -0.5;
  clockGroup.add(hourHandMesh);

  // 분침입니다(약 2시 방향).
  const minuteHandLength = radius * 0.72;
  const minuteHandMesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, minuteHandLength, 0.01), handMaterial);
  minuteHandMesh.position.set(Math.sin(1.0) * (minuteHandLength / 2), Math.cos(1.0) * (minuteHandLength / 2), 0.04);
  minuteHandMesh.rotation.z = -1.0;
  clockGroup.add(minuteHandMesh);

  return clockGroup;
}
