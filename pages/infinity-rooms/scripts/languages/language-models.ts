// Chrome 내장 Prompt API(LanguageModel) 가용성 진단과 방 테마 생성 호출 계층입니다.
// 진단은 절대 reject 하지 않고 상태 값으로 수렴하며, 생성은 실패 시 그대로 throw 합니다.

import { RoomCoordinate } from '../tools/room-grid.ts';
import { RoomThemeData, buildNeighborSeedPrompt, parseRoomThemeResponse, roomThemeResponseSchema } from './room-themes.ts';

export type LanguageModelAvailabilityStatus = 'available' | 'downloadable' | 'downloading' | 'no-api' | 'no-model';

export interface LanguageModelDiagnosis {
  status: LanguageModelAvailabilityStatus | 'error';
  rawMessage: string;
}

// 크롬 런타임이 요구하는 출력 언어 옵션입니다. availability() 와 create() 에 동일하게 전달합니다.
const LANGUAGE_MODEL_OUTPUT_OPTIONS: LanguageModelCreateCoreOptions = {
  outputLanguage: 'en',
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

const INSPIRATIONAL_THEMES = [
  'cyberpunk neon loft',
  'scandinavian warm minimalist study',
  'luxury white marble office',
  'victorian dark academia library',
  'cozy cottagecore wooden study',
  'futuristic high-tech control room',
  'mid-century modern retro den',
  'japanese traditional zen tea room',
  'industrial brick warehouse lounge',
  'vibrant pop art creative studio',
  'mediterranean seaside sunroom',
  'gothic velvet noir lounge',
  'space-age retro-futuristic bedroom',
  'mystical fantasy alchemy workshop',
  'bohemian botanical greenroom',
  'art deco gatsby ballroom',
  'brutalist raw concrete bunker',
  'tropical rattan beach bungalow',
  'moroccan riad courtyard salon',
  'steampunk brass engine room',
  'japandi minimalist reading nook',
  'rustic farmhouse country kitchen',
  'nordic frosted ice cabin retreat',
  'vaporwave pastel arcade',
  'baroque gold opulent parlor',
  'desert adobe southwestern den',
  'coastal hamptons white living room',
  'rococo pink pastel salon',
  'neon tokyo capsule pod',
  'french provincial vintage boudoir',
  'industrial photographer loft studio',
  'wabi-sabi earthen meditation hall',
  'retro 70s shag carpet lounge',
  'alpine chalet ski lodge',
  'sleek minimalist spaceship cabin',
  'maximalist eclectic art gallery',
  'scandinavian hygge fireplace room',
  'art nouveau botanical conservatory',
  'palm springs poolside lounge',
  'candlelit gothic cathedral study',
  'synthwave retro computer room',
  'cozy bookshop reading corner',
  'luxury penthouse skyline suite',
  'moroccan tent bohemian lounge',
  'prohibition speakeasy cocktail bar',
  'minimalist white cube gallery',
  'retro american diner kitchen',
  'lush jungle greenhouse atrium',
  'arctic research station lab',
  'medieval castle stone great hall',
];

function extractErrorMessage(error: unknown, defaultMessage: string): string {
  return error instanceof Error ? error.message : defaultMessage;
}

// 진단·생성 후 세션을 해제합니다. 해제 실패는 기능에 영향이 없으므로 무시합니다.
function destroySessionSafely(session: LanguageModel): void {
  try {
    session.destroy();
  } catch {
    // 세션 해제 실패는 무시합니다.
  }
}

// availability 가 'available' 인데도 create 가 실패하는 환경(정책 차단 등)을 잡아내기 위한 시험 생성입니다.
async function probeSessionCreation(): Promise<string | null> {
  try {
    const probeSession = await LanguageModel.create(LANGUAGE_MODEL_OUTPUT_OPTIONS);
    destroySessionSafely(probeSession);
    return null;
  } catch (error) {
    return extractErrorMessage(error, 'Unknown session creation error');
  }
}

// Prompt API 가용성을 진단합니다. 어떤 경우에도 reject 하지 않고 진단 실패도 'error' 상태로 수렴합니다.
export async function diagnoseLanguageModelAvailability(): Promise<LanguageModelDiagnosis> {
  if (typeof LanguageModel === 'undefined') {
    return {
      status: 'no-api',
      rawMessage: 'LanguageModel class is undefined. Prompt API is not supported on this browser.',
    };
  }

  try {
    const availability = await LanguageModel.availability(LANGUAGE_MODEL_OUTPUT_OPTIONS);

    // 다운로드 단계에서는 사용자 제스처 없이 create 를 호출할 수 없으므로 시험 생성을 건너뜁니다.
    const requiresGesture = availability === 'downloadable' || availability === 'downloading';
    const createErrorMessage = requiresGesture ? null : await probeSessionCreation();

    if (createErrorMessage !== null) {
      return { status: 'error', rawMessage: createErrorMessage };
    }

    switch (availability) {
      case 'available': {
        return { status: 'available', rawMessage: availability };
      }
      case 'downloadable': {
        return { status: 'downloadable', rawMessage: availability };
      }
      case 'downloading': {
        return { status: 'downloading', rawMessage: availability };
      }
      case 'unavailable':
      default: {
        return { status: 'no-model', rawMessage: availability };
      }
    }
  } catch (error) {
    return {
      status: 'error',
      rawMessage: extractErrorMessage(error, 'An unexpected exception occurred during LanguageModel.availability() execution.'),
    };
  }
}

function buildSystemPromptText(randomSeed: string): string {
  return `You are an expert interior designer. Generate a JSON config for a creative, highly aesthetic, and sophisticated 10x10x5 room.
Choose a unique, cohesive theme yourself (such as cyberpunk loft, cozy wood library, modern zen study, mid-century retro, gothic lounge, or futuristic sci-fi).
Decide on a matching, harmonious color palette for the walls, ceiling, floor, and door.

You MUST output ONLY a valid JSON block containing the room theme name, colors, and a furniture list.
Do not output markdown ticks like \`\`\`json. Output raw JSON text.
System Seed: ${randomSeed}

Furniture catalog — choose ONLY the furniture types that genuinely fit your theme. Do NOT include types that do not belong (an empty kind is better than a forced one). Each entry below lists "name" and the color fields it uses:
- "desk" (topColor, legColor)            - "chair" (color, legColor)
- "sofa" (color, legColor)               - "lamp" (color, lightColor)
- "rug" (color)                          - "bookshelf" (color)
- "wall-frame" (color, artColor)         - "ceiling-light" (color, lightColor)
- "bed" (frameColor, beddingColor)       - "cabinet" (color, handleColor)
- "stool" (color, legColor)              - "armchair" (color, legColor)
- "piano" (bodyColor)                    - "plant" (potColor, foliageColor)
- "vase" (color)                         - "sculpture" (color)
- "aquarium" (glassColor, waterColor)    - "ceiling-fan" (bladeColor)
- "mirror" (frameColor)                  - "wall-clock" (color)
- "curtains" (color)                     - "sconce" (color, lightColor)
- "chandelier" (color, lightColor)

How many of each to place:
- Large / structural pieces — "bed", "sofa", "desk", "piano", "aquarium", "cabinet", "bookshelf" — use 0 or 1 each. Never crowd a room with these.
- Small / decorative / seating pieces — "chair", "stool", "armchair", "lamp", "sconce", "plant", "vase", "sculpture", "mirror", "wall-frame", "rug", "curtains" — use roughly 1 to 3 each, as fits the theme.
- You MAY repeat the same type multiple times (e.g. several "chair" entries with different positions, variants, and colors).
- Aim for a believable, well-composed room: a handful of well-chosen pieces, not the whole catalog.

Per-item rules:
- Coordinates: X is from -4.5 to 4.5, Z is from -4.5 to 4.5. Position them layout-wise nicely, spread out random-like, and do not overlap with each other.
- Rotation: angle in radians (0 to 6.28).
- Variant: randomly choose 1, 2, or 3 for each object.
- Colors: hex colors like "#ffffff", cohesive with your chosen theme. Only emit the color fields listed for that "name"; omit fields that do not apply.

Output JSON in exactly this shape. Emit ONE array entry per furniture piece you decided to place (the list below is a FORMAT example, not a required set — vary which types and how many you include each time). Replace every <...> placeholder with your own freshly chosen value — never output the placeholder text itself, and never reuse the same positions or variants across rooms:
{
  "room": {
    "theme": "<short theme name>",
    "wallColor": "<#rrggbb>",
    "ceilingColor": "<#rrggbb>",
    "floorColor": "<#rrggbb>",
    "doorColor": "<#rrggbb>"
  },
  "furniture": [
    { "name": "<a fitting type from the catalog>", "variant": <1-3>, "x": <-4.5..4.5>, "z": <-4.5..4.5>, "rotation": <0-6.28>, "<colorFieldForThatType>": "<#rrggbb>" },
    { "name": "sofa", "variant": <1-3>, "x": <-4.5..4.5>, "z": <-4.5..4.5>, "rotation": <0-6.28>, "color": "<#rrggbb>", "legColor": "<#rrggbb>" },
    { "name": "chair", "variant": <1-3>, "x": <-4.5..4.5>, "z": <-4.5..4.5>, "rotation": <0-6.28>, "color": "<#rrggbb>", "legColor": "<#rrggbb>" },
    { "name": "plant", "variant": <1-3>, "x": <-4.5..4.5>, "z": <-4.5..4.5>, "rotation": <0-6.28>, "potColor": "<#rrggbb>", "foliageColor": "<#rrggbb>" },
    { "name": "wall-frame", "variant": <1-3>, "x": <-4.5..4.5>, "z": <-4.5..4.5>, "rotation": <0-6.28>, "color": "<#rrggbb>", "artColor": "<#rrggbb>" },
    { "name": "ceiling-light", "variant": <1-3>, "x": <-4.5..4.5>, "z": <-4.5..4.5>, "rotation": <0-6.28>, "color": "<#rrggbb>", "lightColor": "<#rrggbb>" }
  ]
}`;
}

// 지정한 방 좌표를 위한 방 테마를 Prompt API 로 생성합니다. 실패 시 그대로 throw 합니다.
// neighborThemeData 가 있으면 그 팔레트를 시드로 프롬프트에 넣어 인접 방과 색 연속성을 부여합니다.
export async function generateRoomTheme(
  roomCoordinate: RoomCoordinate,
  neighborThemeData: RoomThemeData | null,
): Promise<RoomThemeData> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error('이 브라우저에서는 LanguageModel(Prompt API)을 사용할 수 없습니다.');
  }

  const randomSeed = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  // systemPrompt 옵션은 타입 명세에 없어 tsc 오류를 일으키므로 initialPrompts 의 system 메시지로 전달합니다.
  const session = await LanguageModel.create({
    ...LANGUAGE_MODEL_OUTPUT_OPTIONS,
    initialPrompts: [{ role: 'system', content: buildSystemPromptText(randomSeed) }],
  });

  try {
    const inspirationalTheme = INSPIRATIONAL_THEMES[Math.floor(Math.random() * INSPIRATIONAL_THEMES.length)];
    const promptText =
      `Generate a new unique and cohesive room design config. Design style recommendation: ${inspirationalTheme}. Seed/Entropy: ${randomSeed}.` +
      ` Room grid coordinate: (${roomCoordinate.roomX}, ${roomCoordinate.roomZ}).` +
      buildNeighborSeedPrompt(neighborThemeData);

    console.log(`[Prompt API] Sending prompt with random seed: ${randomSeed}`);
    const response = await session.prompt(promptText, { responseConstraint: roomThemeResponseSchema });
    console.log('[Prompt API] Raw response from Chrome AI:', response);

    const roomThemeData = parseRoomThemeResponse(response);
    console.log('[Prompt API] Parsed and validated room theme data:', roomThemeData);
    return roomThemeData;
  } finally {
    destroySessionSafely(session);
  }
}
