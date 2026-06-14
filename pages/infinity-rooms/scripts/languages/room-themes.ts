// Prompt API 응답(방 테마 JSON)의 데이터 형태 정의와 파싱·검증 계층입니다.
// 검증 실패 시 기본값으로 대체하지 않고 즉시 한국어 메시지를 담은 Error 를 throw 합니다.

export interface RoomFurnitureData {
  name: string;
  variant: number;
  x: number;
  z: number;
  rotation: number;
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

export interface RoomThemeData {
  room: {
    theme: string;
    wallColor: string;
    ceilingColor: string;
    floorColor: string;
    doorColor: string;
  };
  furniture: RoomFurnitureData[];
}

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

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

// LanguageModel.prompt() 의 responseConstraint 옵션으로 전달하는 JSON 스키마입니다.
export const roomThemeResponseSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    room: {
      type: 'object',
      properties: {
        theme: { type: 'string' },
        wallColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        ceilingColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        floorColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        doorColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      },
      required: ['theme', 'wallColor', 'ceilingColor', 'floorColor', 'doorColor'],
    },
    furniture: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: [...FURNITURE_NAMES] },
          variant: { type: 'integer', minimum: 1, maximum: 3 },
          x: { type: 'number', minimum: -4.5, maximum: 4.5 },
          z: { type: 'number', minimum: -4.5, maximum: 4.5 },
          rotation: { type: 'number', minimum: 0, maximum: 6.29 },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          legColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          topColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          lightColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          artColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          frameColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          beddingColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          handleColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          bodyColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          potColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          foliageColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          glassColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          waterColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          bladeColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        },
        required: ['name', 'variant', 'x', 'z', 'rotation'],
      },
    },
  },
  required: ['room', 'furniture'],
};

// 인접 방의 테마 데이터를 받아, 색감이 자연스럽게 이어지도록 유도하는 영어 프롬프트 조각을 만듭니다.
// neighborThemeData 가 null 이면 흔한 스타일과 구별되는 방을 만들라는 기존 지시를 반환합니다.
export function buildNeighborSeedPrompt(neighborThemeData: RoomThemeData | null): string {
  if (neighborThemeData === null) {
    return ' Try to create a theme that is distinct from common styles.';
  }

  const neighborRoom = neighborThemeData.room;
  return (
    ` The adjacent room has the theme "${neighborRoom.theme}" with a wall color of "${neighborRoom.wallColor}",` +
    ` floor color of "${neighborRoom.floorColor}", ceiling color of "${neighborRoom.ceilingColor}",` +
    ` and door color of "${neighborRoom.doorColor}".` +
    ` Create this new room such that its style and colors flow naturally and harmoniously from the adjacent room's palette,` +
    ` avoiding sudden or jarring visual jumps while still being uniquely configured.`
  );
}

// LLM 원문에서 JSON 본문을 추출해 파싱·검증합니다. 어떤 단계든 실패하면 throw 합니다.
export function parseRoomThemeResponse(rawText: string): RoomThemeData {
  const startIndex = rawText.indexOf('{');
  const endIndex = rawText.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('LLM 응답에서 JSON 경계를 찾지 못했습니다.');
  }

  // 주석과 후행 쉼표 등 LLM 이 섞어 넣기 쉬운 비표준 표기를 제거합니다.
  const cleanedText = rawText
    .substring(startIndex, endIndex + 1)
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([}\]])/g, '$1');

  return validateRoomThemeData(parseLenientJson(cleanedText));
}

// 1차 파싱 실패 시 작은따옴표·따옴표 없는 키를 교정해 한 번 더 시도합니다. 그래도 실패하면 throw 합니다.
function parseLenientJson(cleanedText: string): unknown {
  try {
    return JSON.parse(cleanedText);
  } catch {
    const repairedText = cleanedText.replace(/'/g, '"').replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    try {
      return JSON.parse(repairedText);
    } catch {
      throw new Error('LLM 응답의 JSON 파싱에 실패했습니다. 유효하지 않은 형식입니다.');
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireHexColor(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    throw new Error(`${fieldName} 값이 유효한 hex 색상(#rrggbb)이 아닙니다: ${String(value)}`);
  }
  return value;
}

function requireOptionalHexColor(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireHexColor(value, fieldName);
}

function requireFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} 값이 유효한 숫자가 아닙니다: ${String(value)}`);
  }
  return value;
}

function validateFurnitureItem(value: unknown, furnitureIndex: number): RoomFurnitureData {
  if (!isRecord(value)) {
    throw new Error(`furniture[${furnitureIndex}] 항목이 객체가 아닙니다.`);
  }

  const name = value.name;
  if (typeof name !== 'string' || !(FURNITURE_NAMES as readonly string[]).includes(name)) {
    throw new Error(`furniture[${furnitureIndex}].name 이 허용된 가구 타입이 아닙니다: ${String(name)}`);
  }

  const variant = requireFiniteNumber(value.variant, `furniture[${furnitureIndex}].variant`);
  if (!Number.isInteger(variant) || variant < 1 || variant > 3) {
    throw new Error(`furniture[${furnitureIndex}].variant 값이 1~3 범위의 정수가 아닙니다: ${String(variant)}`);
  }

  return {
    name,
    variant,
    x: requireFiniteNumber(value.x, `furniture[${furnitureIndex}].x`),
    z: requireFiniteNumber(value.z, `furniture[${furnitureIndex}].z`),
    rotation: requireFiniteNumber(value.rotation, `furniture[${furnitureIndex}].rotation`),
    color: requireOptionalHexColor(value.color, `furniture[${furnitureIndex}].color`),
    legColor: requireOptionalHexColor(value.legColor, `furniture[${furnitureIndex}].legColor`),
    topColor: requireOptionalHexColor(value.topColor, `furniture[${furnitureIndex}].topColor`),
    lightColor: requireOptionalHexColor(value.lightColor, `furniture[${furnitureIndex}].lightColor`),
    artColor: requireOptionalHexColor(value.artColor, `furniture[${furnitureIndex}].artColor`),
    frameColor: requireOptionalHexColor(value.frameColor, `furniture[${furnitureIndex}].frameColor`),
    beddingColor: requireOptionalHexColor(value.beddingColor, `furniture[${furnitureIndex}].beddingColor`),
    handleColor: requireOptionalHexColor(value.handleColor, `furniture[${furnitureIndex}].handleColor`),
    bodyColor: requireOptionalHexColor(value.bodyColor, `furniture[${furnitureIndex}].bodyColor`),
    potColor: requireOptionalHexColor(value.potColor, `furniture[${furnitureIndex}].potColor`),
    foliageColor: requireOptionalHexColor(value.foliageColor, `furniture[${furnitureIndex}].foliageColor`),
    glassColor: requireOptionalHexColor(value.glassColor, `furniture[${furnitureIndex}].glassColor`),
    waterColor: requireOptionalHexColor(value.waterColor, `furniture[${furnitureIndex}].waterColor`),
    bladeColor: requireOptionalHexColor(value.bladeColor, `furniture[${furnitureIndex}].bladeColor`),
  };
}

function validateRoomThemeData(parsed: unknown): RoomThemeData {
  if (!isRecord(parsed)) {
    throw new Error('LLM 응답의 최상위 값이 객체가 아닙니다.');
  }

  const room = parsed.room;
  if (!isRecord(room)) {
    throw new Error('LLM 응답에 room 객체가 없습니다.');
  }

  const theme = room.theme;
  if (typeof theme !== 'string' || theme.length === 0) {
    throw new Error('room.theme 값이 비어 있지 않은 문자열이 아닙니다.');
  }

  const furnitureList = parsed.furniture;
  if (!Array.isArray(furnitureList) || furnitureList.length === 0) {
    throw new Error('LLM 응답에 furniture 배열이 없거나 비어 있습니다.');
  }

  return {
    room: {
      theme,
      wallColor: requireHexColor(room.wallColor, 'room.wallColor'),
      ceilingColor: requireHexColor(room.ceilingColor, 'room.ceilingColor'),
      floorColor: requireHexColor(room.floorColor, 'room.floorColor'),
      doorColor: requireHexColor(room.doorColor, 'room.doorColor'),
    },
    furniture: furnitureList.map((furnitureItem, furnitureIndex) => validateFurnitureItem(furnitureItem, furnitureIndex)),
  };
}
