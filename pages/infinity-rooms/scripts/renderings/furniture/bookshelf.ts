// 책장을 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface BookshelfOptions {
  variant?: number;
  color?: string;
  bookColors?: string[];
}

export function createBookshelf(options: BookshelfOptions): THREE.Group {
  const shelfGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const frameColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x78350f);
  const bookColors = options.bookColors ?? ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorValue,
    roughness: 0.75,
    metalness: 0.05,
  });

  const backMaterial = new THREE.MeshStandardMaterial({
    color: frameColorValue.clone().offsetHSL(0, -0.05, -0.05),
    roughness: 0.8,
  });

  // 선반 한 칸에 책 여러 권을 무작위 색·크기로 채웁니다.
  const addBookRow = (group: THREE.Group, startX: number, positionZ: number, baseY: number, bookCount: number, rowHeight: number = 0.22) => {
    Array.from({ length: bookCount }).forEach((_, bookIndex) => {
      const bookWidth = 0.03 + Math.random() * 0.02;
      const bookHeight = rowHeight - 0.04 + Math.random() * 0.04;
      const bookDepth = 0.25;
      const bookMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(bookColors[Math.floor(Math.random() * bookColors.length)]),
        roughness: 0.5,
      });
      const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(bookWidth, bookHeight, bookDepth), bookMaterial);

      if (bookIndex === bookCount - 1 && Math.random() > 0.5) {
        // 마지막 책은 절반 확률로 비스듬히 기울입니다.
        bookMesh.position.set(startX + bookIndex * 0.06 + 0.02, baseY + bookHeight / 2, positionZ);
        bookMesh.rotation.z = -0.15;
      } else {
        bookMesh.position.set(startX + bookIndex * 0.05, baseY + bookHeight / 2, positionZ);
      }

      bookMesh.castShadow = true;
      group.add(bookMesh);
    });
  };

  if (variant === 1) {
    // 낮은 개방형 책장입니다.
    const shelfWidth = 1.3;
    const shelfDepth = 0.35;
    const shelfHeight = 1.1;

    const sideGeometry = new THREE.BoxGeometry(0.04, shelfHeight, shelfDepth);
    const leftSideMesh = new THREE.Mesh(sideGeometry, frameMaterial);
    leftSideMesh.position.set(-shelfWidth / 2 + 0.02, shelfHeight / 2, 0);
    leftSideMesh.castShadow = true;
    shelfGroup.add(leftSideMesh);

    const rightSideMesh = new THREE.Mesh(sideGeometry, frameMaterial);
    rightSideMesh.position.set(shelfWidth / 2 - 0.02, shelfHeight / 2, 0);
    rightSideMesh.castShadow = true;
    shelfGroup.add(rightSideMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth - 0.08, shelfHeight - 0.04, 0.02), backMaterial);
    backMesh.position.set(0, shelfHeight / 2, -shelfDepth / 2 + 0.01);
    backMesh.receiveShadow = true;
    shelfGroup.add(backMesh);

    const shelfBoardGeometry = new THREE.BoxGeometry(shelfWidth - 0.08, 0.03, shelfDepth - 0.02);
    [0.04, 0.38, 0.72, 1.06].forEach((boardY) => {
      const boardMesh = new THREE.Mesh(shelfBoardGeometry, frameMaterial);
      boardMesh.position.set(0, boardY, 0.01);
      boardMesh.castShadow = true;
      boardMesh.receiveShadow = true;
      shelfGroup.add(boardMesh);
    });

    addBookRow(shelfGroup, -0.4, 0.02, 0.06, 8);
    addBookRow(shelfGroup, 0.1, 0.02, 0.4, 6);
    addBookRow(shelfGroup, -0.3, 0.02, 0.74, 5);
  } else if (variant === 2) {
    // 키 큰 책장입니다.
    const shelfWidth = 1.2;
    const shelfDepth = 0.35;
    const shelfHeight = 1.85;

    const sideGeometry = new THREE.BoxGeometry(0.04, shelfHeight, shelfDepth);
    const leftSideMesh = new THREE.Mesh(sideGeometry, frameMaterial);
    leftSideMesh.position.set(-shelfWidth / 2 + 0.02, shelfHeight / 2, 0);
    leftSideMesh.castShadow = true;
    shelfGroup.add(leftSideMesh);

    const rightSideMesh = new THREE.Mesh(sideGeometry, frameMaterial);
    rightSideMesh.position.set(shelfWidth / 2 - 0.02, shelfHeight / 2, 0);
    rightSideMesh.castShadow = true;
    shelfGroup.add(rightSideMesh);

    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth - 0.08, shelfHeight - 0.04, 0.02), backMaterial);
    backMesh.position.set(0, shelfHeight / 2, -shelfDepth / 2 + 0.01);
    backMesh.receiveShadow = true;
    shelfGroup.add(backMesh);

    const shelfBoardGeometry = new THREE.BoxGeometry(shelfWidth - 0.08, 0.03, shelfDepth - 0.02);
    [0.04, 0.38, 0.72, 1.06, 1.4, 1.81].forEach((boardY) => {
      const boardMesh = new THREE.Mesh(shelfBoardGeometry, frameMaterial);
      boardMesh.position.set(0, boardY, 0.01);
      boardMesh.castShadow = true;
      boardMesh.receiveShadow = true;
      shelfGroup.add(boardMesh);
    });

    addBookRow(shelfGroup, -0.35, 0.02, 0.06, 7);
    addBookRow(shelfGroup, 0.05, 0.02, 0.4, 6);
    addBookRow(shelfGroup, -0.4, 0.02, 0.74, 9);
    addBookRow(shelfGroup, -0.1, 0.02, 1.09, 5);
    addBookRow(shelfGroup, 0.1, 0.02, 1.43, 6);
  } else {
    // 격자형 큐브 책장입니다.
    const cubeSize = 1.2;
    const cubeDepth = 0.32;
    const boardThickness = 0.04;

    const horizontalBoardGeometry = new THREE.BoxGeometry(cubeSize, boardThickness, cubeDepth);
    const bottomBoardMesh = new THREE.Mesh(horizontalBoardGeometry, frameMaterial);
    bottomBoardMesh.position.set(0, boardThickness / 2, 0);
    bottomBoardMesh.castShadow = true;
    shelfGroup.add(bottomBoardMesh);

    const topBoardMesh = new THREE.Mesh(horizontalBoardGeometry, frameMaterial);
    topBoardMesh.position.set(0, cubeSize - boardThickness / 2, 0);
    topBoardMesh.castShadow = true;
    shelfGroup.add(topBoardMesh);

    const verticalBoardGeometry = new THREE.BoxGeometry(boardThickness, cubeSize - boardThickness * 2, cubeDepth);
    const leftSideMesh = new THREE.Mesh(verticalBoardGeometry, frameMaterial);
    leftSideMesh.position.set(-cubeSize / 2 + boardThickness / 2, cubeSize / 2, 0);
    leftSideMesh.castShadow = true;
    shelfGroup.add(leftSideMesh);

    const rightSideMesh = new THREE.Mesh(verticalBoardGeometry, frameMaterial);
    rightSideMesh.position.set(cubeSize / 2 - boardThickness / 2, cubeSize / 2, 0);
    rightSideMesh.castShadow = true;
    shelfGroup.add(rightSideMesh);

    const innerShelfGeometry = new THREE.BoxGeometry(cubeSize - boardThickness * 2, 0.025, cubeDepth - 0.01);
    const firstInnerShelfMesh = new THREE.Mesh(innerShelfGeometry, frameMaterial);
    firstInnerShelfMesh.position.set(0, 0.42, 0);
    firstInnerShelfMesh.castShadow = true;
    shelfGroup.add(firstInnerShelfMesh);

    const secondInnerShelfMesh = new THREE.Mesh(innerShelfGeometry, frameMaterial);
    secondInnerShelfMesh.position.set(0, 0.8, 0);
    secondInnerShelfMesh.castShadow = true;
    shelfGroup.add(secondInnerShelfMesh);

    const innerDividerGeometry = new THREE.BoxGeometry(0.025, cubeSize - boardThickness * 2, cubeDepth - 0.01);
    const firstInnerDividerMesh = new THREE.Mesh(innerDividerGeometry, frameMaterial);
    firstInnerDividerMesh.position.set(-0.36, cubeSize / 2, 0);
    firstInnerDividerMesh.castShadow = true;
    shelfGroup.add(firstInnerDividerMesh);

    const secondInnerDividerMesh = new THREE.Mesh(innerDividerGeometry, frameMaterial);
    secondInnerDividerMesh.position.set(0.36, cubeSize / 2, 0);
    secondInnerDividerMesh.castShadow = true;
    shelfGroup.add(secondInnerDividerMesh);

    addBookRow(shelfGroup, -0.5, 0.01, 0.04, 3, 0.18);
    addBookRow(shelfGroup, -0.1, 0.01, 0.44, 4, 0.18);
    addBookRow(shelfGroup, 0.42, 0.01, 0.82, 3, 0.18);

    // 장식용 꽃병입니다.
    const vaseGroup = new THREE.Group();
    vaseGroup.position.set(0, 0.88, 0);

    const vaseMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1 });
    const vaseBodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), vaseMaterial);
    vaseBodyMesh.position.y = 0.08;
    vaseGroup.add(vaseBodyMesh);

    const vaseNeckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), vaseMaterial);
    vaseNeckMesh.position.y = 0.17;
    vaseGroup.add(vaseNeckMesh);

    shelfGroup.add(vaseGroup);
  }

  return shelfGroup;
}
