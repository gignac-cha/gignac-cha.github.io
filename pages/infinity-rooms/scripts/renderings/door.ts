// 방과 방을 잇는 문을 만드는 팩토리입니다.

import * as THREE from 'three';

export interface DoorOptions {
  isGenerated: boolean;
  color?: number;
  knobColor?: number;
}

export function createDoor(options: DoorOptions): THREE.Group {
  const doorGroup = new THREE.Group();
  const isGenerated = options.isGenerated;
  const doorColor = options.color ?? 0x334155;
  const knobColor = options.knobColor ?? 0xd4af37;

  const doorPanelMaterial = new THREE.MeshStandardMaterial({
    color: doorColor,
    roughness: 0.65,
    metalness: 0.25,
    transparent: !isGenerated,
    opacity: isGenerated ? 1.0 : 0.35,
  });
  const doorPanelMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.08), doorPanelMaterial);
  doorPanelMesh.position.set(0, 1.1, 0);
  doorGroup.add(doorPanelMesh);

  // 문 양면에 붙는 장식 패널입니다.
  const panelConfigs = [
    { width: 0.9, height: 0.8, x: 0, y: 0.55 },
    { width: 0.9, height: 0.6, x: 0, y: -0.65 },
  ];

  panelConfigs.forEach((panelConfig) => {
    const frontPanelMesh = new THREE.Mesh(new THREE.BoxGeometry(panelConfig.width, panelConfig.height, 0.01), doorPanelMaterial);
    frontPanelMesh.position.set(panelConfig.x, panelConfig.y, 0.04 + 0.005);
    doorPanelMesh.add(frontPanelMesh);

    const backPanelMesh = new THREE.Mesh(new THREE.BoxGeometry(panelConfig.width, panelConfig.height, 0.01), doorPanelMaterial);
    backPanelMesh.position.set(panelConfig.x, panelConfig.y, -0.04 - 0.005);
    doorPanelMesh.add(backPanelMesh);
  });

  const knobMaterial = new THREE.MeshStandardMaterial({
    color: knobColor,
    roughness: 0.15,
    metalness: 0.85,
    transparent: !isGenerated,
    opacity: isGenerated ? 1.0 : 0.35,
  });

  const addKnob = (x: number, y: number, signZ: number) => {
    const knobGroup = new THREE.Group();
    knobGroup.position.set(x, y, signZ * 0.04);

    const rosetteGeometry = new THREE.CylinderGeometry(0.022, 0.022, 0.006, 16);
    rosetteGeometry.rotateX(Math.PI / 2);
    const rosetteMesh = new THREE.Mesh(rosetteGeometry, knobMaterial);
    rosetteMesh.position.set(0, 0, signZ * 0.003);
    knobGroup.add(rosetteMesh);

    const shaftGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.02, 16);
    shaftGeometry.rotateX(Math.PI / 2);
    const shaftMesh = new THREE.Mesh(shaftGeometry, knobMaterial);
    shaftMesh.position.set(0, 0, signZ * 0.013);
    knobGroup.add(shaftMesh);

    const knobMesh = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), knobMaterial);
    knobMesh.position.set(0, 0, signZ * 0.023);
    knobGroup.add(knobMesh);

    doorPanelMesh.add(knobGroup);
  };

  addKnob(0.5, -0.15, 1);
  addKnob(0.5, -0.15, -1);

  return doorGroup;
}
