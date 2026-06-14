// 책상·의자·소파·램프·러그·책장·벽 액자·천장등을 만드는 가구 팩토리 계층입니다.
// 각 가구 빌더는 furniture/ 하위 파일로 분리하고, 여기서는 공통 모델과 진입점(createFurnitureObject)만 유지합니다.

import * as THREE from 'three';

import { createBookshelf } from './furniture/bookshelf.ts';
import { createCeilingLight } from './furniture/ceiling-light.ts';
import { createChair } from './furniture/chair.ts';
import { createDesk } from './furniture/desk.ts';
import { createLamp } from './furniture/lamp.ts';
import { createRug } from './furniture/rug.ts';
import { createSofa } from './furniture/sofa.ts';
import { createWallFrame } from './furniture/wall-frame.ts';
import { createBed } from './furniture/bed.ts';
import { createCabinet } from './furniture/cabinet.ts';
import { createStool } from './furniture/stool.ts';
import { createArmchair } from './furniture/armchair.ts';
import { createPiano } from './furniture/piano.ts';
import { createPlant } from './furniture/plant.ts';
import { createVase } from './furniture/vase.ts';
import { createSculpture } from './furniture/sculpture.ts';
import { createAquarium } from './furniture/aquarium.ts';
import { createCeilingFan } from './furniture/ceiling-fan.ts';
import { createMirror } from './furniture/mirror.ts';
import { createWallClock } from './furniture/wall-clock.ts';
import { createCurtains } from './furniture/curtains.ts';
import { createSconce } from './furniture/sconce.ts';
import { createChandelier } from './furniture/chandelier.ts';

// 방에 등장할 수 있는 가구 23종의 표준 이름 목록입니다. 쇼룸 전시·테마 생성 명세가 공유합니다.
export const FURNITURE_NAMES = [
  'desk',
  'chair',
  'sofa',
  'lamp',
  'rug',
  'bookshelf',
  'wall-frame',
  'ceiling-light',
  'bed',
  'cabinet',
  'stool',
  'armchair',
  'piano',
  'plant',
  'vase',
  'sculpture',
  'aquarium',
  'ceiling-fan',
  'mirror',
  'wall-clock',
  'curtains',
  'sconce',
  'chandelier',
] as const;

export interface FurnitureSpecification {
  width: number;
  depth: number;
  radius: number;
}

// 가구 배치(충돌 완화·벽 여백 계산)에 사용하는 평면 크기와 충돌 반경입니다.
export const FURNITURE_SPECIFICATIONS: Record<string, FurnitureSpecification> = {
  desk: { width: 2.2, depth: 1.1, radius: 0.8 },
  chair: { width: 0.6, depth: 0.6, radius: 0.4 },
  sofa: { width: 2.1, depth: 0.9, radius: 0.9 },
  lamp: { width: 0.5, depth: 0.5, radius: 0.3 },
  rug: { width: 2.6, depth: 1.8, radius: 0.0 },
  bookshelf: { width: 1.3, depth: 0.4, radius: 0.7 },
  'wall-frame': { width: 1.1, depth: 0.1, radius: 0.0 },
  'ceiling-light': { width: 0.6, depth: 0.6, radius: 0.0 },
  bed: { width: 2.0, depth: 1.6, radius: 1.0 },
  cabinet: { width: 1.6, depth: 0.5, radius: 0.8 },
  stool: { width: 0.4, depth: 0.4, radius: 0.3 },
  armchair: { width: 0.9, depth: 0.9, radius: 0.55 },
  piano: { width: 1.5, depth: 1.4, radius: 0.9 },
  plant: { width: 0.6, depth: 0.6, radius: 0.4 },
  vase: { width: 0.3, depth: 0.3, radius: 0.2 },
  sculpture: { width: 0.5, depth: 0.5, radius: 0.4 },
  aquarium: { width: 1.2, depth: 0.5, radius: 0.7 },
  'ceiling-fan': { width: 1.0, depth: 1.0, radius: 0.0 },
  mirror: { width: 1.1, depth: 0.1, radius: 0.0 },
  'wall-clock': { width: 0.5, depth: 0.1, radius: 0.0 },
  curtains: { width: 1.6, depth: 0.2, radius: 0.0 },
  sconce: { width: 0.3, depth: 0.2, radius: 0.0 },
  chandelier: { width: 1.0, depth: 1.0, radius: 0.0 },
};

export interface FurnitureObjectOptions {
  name: string;
  variant?: number;
  color?: string;
  legColor?: string;
  topColor?: string;
  lightColor?: string;
  artColor?: string;
  frameColor?: string;
  beddingColor?: string;
  handleColor?: string;
  bodyColor?: string;
  potColor?: string;
  foliageColor?: string;
  glassColor?: string;
  waterColor?: string;
  bladeColor?: string;
}

// 가구 이름을 받아 해당 3차원 오브젝트를 생성하는 공통 팩토리입니다.
export function createFurnitureObject(options: FurnitureObjectOptions): THREE.Group {
  switch (options.name) {
    case 'desk':
      return createDesk({ variant: options.variant, topColor: options.topColor, legColor: options.legColor });
    case 'chair':
      return createChair({ variant: options.variant, color: options.color, legColor: options.legColor });
    case 'sofa':
      return createSofa({ variant: options.variant, color: options.color, legColor: options.legColor });
    case 'lamp':
      return createLamp({ variant: options.variant, color: options.color, lightColor: options.lightColor });
    case 'rug':
      return createRug({ variant: options.variant, color: options.color });
    case 'bookshelf':
      return createBookshelf({ variant: options.variant, color: options.color });
    case 'wall-frame':
      return createWallFrame({ variant: options.variant, color: options.color, artColor: options.artColor });
    case 'ceiling-light':
      return createCeilingLight({ variant: options.variant, color: options.color, lightColor: options.lightColor });
    case 'bed':
      return createBed({ variant: options.variant, frameColor: options.frameColor, beddingColor: options.beddingColor });
    case 'cabinet':
      return createCabinet({ variant: options.variant, color: options.color, handleColor: options.handleColor });
    case 'stool':
      return createStool({ variant: options.variant, color: options.color, legColor: options.legColor });
    case 'armchair':
      return createArmchair({ variant: options.variant, color: options.color, legColor: options.legColor });
    case 'piano':
      return createPiano({ variant: options.variant, bodyColor: options.bodyColor });
    case 'plant':
      return createPlant({ variant: options.variant, potColor: options.potColor, foliageColor: options.foliageColor });
    case 'vase':
      return createVase({ variant: options.variant, color: options.color });
    case 'sculpture':
      return createSculpture({ variant: options.variant, color: options.color });
    case 'aquarium':
      return createAquarium({ variant: options.variant, glassColor: options.glassColor, waterColor: options.waterColor });
    case 'ceiling-fan':
      return createCeilingFan({ variant: options.variant, bladeColor: options.bladeColor });
    case 'mirror':
      return createMirror({ variant: options.variant, frameColor: options.frameColor });
    case 'wall-clock':
      return createWallClock({ variant: options.variant, color: options.color });
    case 'curtains':
      return createCurtains({ variant: options.variant, color: options.color });
    case 'sconce':
      return createSconce({ variant: options.variant, color: options.color, lightColor: options.lightColor });
    case 'chandelier':
      return createChandelier({ variant: options.variant, color: options.color, lightColor: options.lightColor });
    default:
      throw new Error(`알 수 없는 가구 이름입니다: ${options.name}`);
  }
}
