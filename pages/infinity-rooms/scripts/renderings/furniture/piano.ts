// 피아노를 만드는 가구 팩토리입니다.

import * as THREE from 'three';

export interface PianoOptions {
  variant?: number;
  bodyColor?: string;
}

export function createPiano(options: PianoOptions): THREE.Group {
  const pianoGroup = new THREE.Group();
  const variant = options.variant ?? 1;
  const bodyColorValue = options.bodyColor ? new THREE.Color(options.bodyColor) : new THREE.Color(0x111827);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColorValue,
    roughness: 0.25,
    metalness: 0.2,
  });

  const whiteKeyMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.4,
    metalness: 0.05,
  });

  const blackKeyMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.4,
    metalness: 0.1,
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: bodyColorValue,
    roughness: 0.3,
    metalness: 0.3,
  });

  if (variant === 1) {
    // 업라이트 피아노입니다. 키보드 위로 세워진 큰 몸체를 가집니다.
    const bodyWidth = 1.5;
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, 1.1, 0.4), bodyMaterial);
    bodyMesh.position.set(0, 0.65, -0.1);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    pianoGroup.add(bodyMesh);

    // 건반이 놓이는 받침입니다.
    const keybedMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, 0.12, 0.32), bodyMaterial);
    keybedMesh.position.set(0, 0.62, 0.18);
    keybedMesh.castShadow = true;
    pianoGroup.add(keybedMesh);

    const keyboardMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth - 0.1, 0.04, 0.26), whiteKeyMaterial);
    keyboardMesh.position.set(0, 0.7, 0.2);
    keyboardMesh.castShadow = true;
    pianoGroup.add(keyboardMesh);

    addBlackKeys(pianoGroup, blackKeyMaterial, bodyWidth - 0.16, 0.73, 0.16);

    const sideGeometry = new THREE.BoxGeometry(0.12, 0.62, 0.4);
    [-1, 1].forEach((legSide) => {
      const sideMesh = new THREE.Mesh(sideGeometry, legMaterial);
      sideMesh.position.set(legSide * (bodyWidth / 2 - 0.06), 0.31, -0.1);
      sideMesh.castShadow = true;
      sideMesh.receiveShadow = true;
      pianoGroup.add(sideMesh);
    });
  } else if (variant === 2) {
    // 그랜드 피아노입니다. 수평으로 누운 날개형 몸체와 세 다리를 가집니다.
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.28, 24, 1, false, 0, Math.PI), bodyMaterial);
    bodyMesh.rotation.x = Math.PI / 2;
    bodyMesh.position.set(0, 0.75, -0.15);
    bodyMesh.scale.set(1, 1, 0.95);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    pianoGroup.add(bodyMesh);

    // 열린 뚜껑입니다.
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.9), bodyMaterial);
    lidMesh.position.set(-0.35, 1.05, -0.35);
    lidMesh.rotation.z = -0.5;
    lidMesh.castShadow = true;
    pianoGroup.add(lidMesh);

    const keyboardMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.28), whiteKeyMaterial);
    keyboardMesh.position.set(0, 0.78, 0.55);
    keyboardMesh.castShadow = true;
    pianoGroup.add(keyboardMesh);

    addBlackKeys(pianoGroup, blackKeyMaterial, 1.3, 0.81, 0.5);

    const legGeometry = new THREE.CylinderGeometry(0.05, 0.04, 0.75, 10);
    const legOffsets = [
      { x: 0, z: 0.5 },
      { x: -0.55, z: -0.45 },
      { x: 0.55, z: -0.45 },
    ];
    legOffsets.forEach((offset) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(offset.x, 0.375, offset.z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      pianoGroup.add(legMesh);
    });
  } else {
    // 전자 피아노입니다. 얇은 건반 본체와 가는 스탠드 다리를 가집니다.
    const bodyWidth = 1.4;
    const standHeight = 0.7;

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, 0.12, 0.34), bodyMaterial);
    bodyMesh.position.set(0, standHeight, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    pianoGroup.add(bodyMesh);

    const keyboardMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth - 0.1, 0.04, 0.24), whiteKeyMaterial);
    keyboardMesh.position.set(0, standHeight + 0.07, 0.04);
    keyboardMesh.castShadow = true;
    pianoGroup.add(keyboardMesh);

    addBlackKeys(pianoGroup, blackKeyMaterial, bodyWidth - 0.16, standHeight + 0.1, 0.0);

    // X자 스탠드 다리입니다.
    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      roughness: 0.3,
      metalness: 0.8,
    });
    const standGeometry = new THREE.BoxGeometry(0.04, standHeight, 0.04);
    [-1, 1].forEach((standSide) => {
      const standMesh = new THREE.Mesh(standGeometry, standMaterial);
      standMesh.position.set(standSide * 0.35, standHeight / 2, 0);
      standMesh.rotation.z = standSide * 0.25;
      standMesh.castShadow = true;
      standMesh.receiveShadow = true;
      pianoGroup.add(standMesh);

      const crossMesh = new THREE.Mesh(standGeometry, standMaterial);
      crossMesh.position.set(standSide * 0.35, standHeight / 2, 0);
      crossMesh.rotation.z = standSide * -0.25;
      crossMesh.castShadow = true;
      pianoGroup.add(crossMesh);
    });

    const footGeometry = new THREE.BoxGeometry(0.4, 0.03, 0.34);
    [-1, 1].forEach((footSide) => {
      const footMesh = new THREE.Mesh(footGeometry, standMaterial);
      footMesh.position.set(footSide * 0.4, 0.015, 0);
      footMesh.receiveShadow = true;
      pianoGroup.add(footMesh);
    });
  }

  return pianoGroup;
}

// 흰 건반 위에 검은 건반 묶음을 일정 간격으로 얹습니다.
function addBlackKeys(
  targetGroup: THREE.Group,
  material: THREE.Material,
  keyboardWidth: number,
  topY: number,
  centerZ: number,
): void {
  const blackKeyGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.16);
  const blackKeyCount = 10;
  const spacing = keyboardWidth / (blackKeyCount + 1);
  Array.from({ length: blackKeyCount }).forEach((_, keyIndex) => {
    // 2-3 패턴으로 검은 건반을 건너뜁니다.
    const positionInOctave = keyIndex % 5;
    if (positionInOctave === 2) {
      return;
    }
    const offsetX = -keyboardWidth / 2 + spacing * (keyIndex + 1);
    const blackKeyMesh = new THREE.Mesh(blackKeyGeometry, material);
    blackKeyMesh.position.set(offsetX, topY, centerZ - 0.04);
    blackKeyMesh.castShadow = true;
    targetGroup.add(blackKeyMesh);
  });
}
