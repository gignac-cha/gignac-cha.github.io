// 벽 액자를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface WallFrameOptions {
  variant?: number;
  color?: string;
  artColor?: string;
}

export function createWallFrame(options: WallFrameOptions): THREE.Group {
  const frameGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const frameColorValue = options.color ? new THREE.Color(options.color) : new THREE.Color(0x1e293b);
  const artColorValue = options.artColor ? new THREE.Color(options.artColor) : new THREE.Color(0xef4444);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorValue,
    roughness: 0.5,
    metalness: 0.2,
  });

  const matBoardMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.95,
    metalness: 0.01,
  });

  const canvasMaterial = new THREE.MeshStandardMaterial({
    color: artColorValue,
    roughness: 0.8,
    metalness: 0.05,
  });

  const buildSingleFrame = (width: number, height: number, depth: number, parentGroup: THREE.Group, offsetX: number = 0) => {
    const singleFrameGroup = new THREE.Group();
    singleFrameGroup.position.x = offsetX;

    const borderSize = 0.04;

    const horizontalBorderGeometry = new THREE.BoxGeometry(width, borderSize, depth);
    const topBorderMesh = new THREE.Mesh(horizontalBorderGeometry, frameMaterial);
    topBorderMesh.position.set(0, height / 2 - borderSize / 2, 0);
    topBorderMesh.castShadow = true;
    singleFrameGroup.add(topBorderMesh);

    const bottomBorderMesh = new THREE.Mesh(horizontalBorderGeometry, frameMaterial);
    bottomBorderMesh.position.set(0, -height / 2 + borderSize / 2, 0);
    bottomBorderMesh.castShadow = true;
    singleFrameGroup.add(bottomBorderMesh);

    const verticalBorderGeometry = new THREE.BoxGeometry(borderSize, height - borderSize * 2, depth);
    const leftBorderMesh = new THREE.Mesh(verticalBorderGeometry, frameMaterial);
    leftBorderMesh.position.set(-width / 2 + borderSize / 2, 0, 0);
    leftBorderMesh.castShadow = true;
    singleFrameGroup.add(leftBorderMesh);

    const rightBorderMesh = new THREE.Mesh(verticalBorderGeometry, frameMaterial);
    rightBorderMesh.position.set(width / 2 - borderSize / 2, 0, 0);
    rightBorderMesh.castShadow = true;
    singleFrameGroup.add(rightBorderMesh);

    const matBoardMesh = new THREE.Mesh(new THREE.BoxGeometry(width - borderSize * 2, height - borderSize * 2, 0.015), matBoardMaterial);
    matBoardMesh.position.set(0, 0, -0.005);
    matBoardMesh.receiveShadow = true;
    singleFrameGroup.add(matBoardMesh);

    const artWidth = (width - borderSize * 2) * 0.76;
    const artHeight = (height - borderSize * 2) * 0.72;
    const canvasMesh = new THREE.Mesh(new THREE.BoxGeometry(artWidth, artHeight, 0.018), canvasMaterial);
    canvasMesh.position.set(0, 0, 0.001);
    singleFrameGroup.add(canvasMesh);

    const decorationMaterial = new THREE.MeshBasicMaterial({ color: artColorValue.clone().offsetHSL(0.3, 0.2, 0.15) });
    const decorationMesh = new THREE.Mesh(new THREE.BoxGeometry(artWidth * 0.4, artHeight * 0.4, 0.02), decorationMaterial);
    decorationMesh.position.set(-artWidth * 0.15, artHeight * 0.15, 0.002);
    singleFrameGroup.add(decorationMesh);

    parentGroup.add(singleFrameGroup);
  };

  if (variant === 1) {
    buildSingleFrame(1.1, 0.72, 0.05, frameGroup);
  } else if (variant === 2) {
    buildSingleFrame(0.68, 1.05, 0.05, frameGroup);
  } else {
    // 작은 액자 두 개를 나란히 배치하는 변형입니다.
    const smallWidth = 0.52;
    const smallHeight = 0.52;
    buildSingleFrame(smallWidth, smallHeight, 0.04, frameGroup, -0.32);

    const alternateArtColorValue = artColorValue.clone().offsetHSL(0.5, 0, 0);
    const alternateCanvasMaterial = new THREE.MeshStandardMaterial({
      color: alternateArtColorValue,
      roughness: 0.8,
    });

    const secondFrameGroup = new THREE.Group();
    secondFrameGroup.position.x = 0.32;

    const borderSize = 0.03;
    const horizontalBorderGeometry = new THREE.BoxGeometry(smallWidth, borderSize, 0.04);
    const topBorderMesh = new THREE.Mesh(horizontalBorderGeometry, frameMaterial);
    topBorderMesh.position.set(0, smallHeight / 2 - borderSize / 2, 0);
    secondFrameGroup.add(topBorderMesh);

    const bottomBorderMesh = new THREE.Mesh(horizontalBorderGeometry, frameMaterial);
    bottomBorderMesh.position.set(0, -smallHeight / 2 + borderSize / 2, 0);
    secondFrameGroup.add(bottomBorderMesh);

    const verticalBorderGeometry = new THREE.BoxGeometry(borderSize, smallHeight - borderSize * 2, 0.04);
    const leftBorderMesh = new THREE.Mesh(verticalBorderGeometry, frameMaterial);
    leftBorderMesh.position.set(-smallWidth / 2 + borderSize / 2, 0, 0);
    secondFrameGroup.add(leftBorderMesh);

    const rightBorderMesh = new THREE.Mesh(verticalBorderGeometry, frameMaterial);
    rightBorderMesh.position.set(smallWidth / 2 - borderSize / 2, 0, 0);
    secondFrameGroup.add(rightBorderMesh);

    const matBoardMesh = new THREE.Mesh(new THREE.BoxGeometry(smallWidth - borderSize * 2, smallHeight - borderSize * 2, 0.015), matBoardMaterial);
    matBoardMesh.position.set(0, 0, -0.005);
    secondFrameGroup.add(matBoardMesh);

    const artWidth = (smallWidth - borderSize * 2) * 0.72;
    const artHeight = (smallHeight - borderSize * 2) * 0.72;
    const canvasMesh = new THREE.Mesh(new THREE.BoxGeometry(artWidth, artHeight, 0.018), alternateCanvasMaterial);
    canvasMesh.position.set(0, 0, 0.001);
    secondFrameGroup.add(canvasMesh);

    frameGroup.add(secondFrameGroup);
  }

  return frameGroup;
}
