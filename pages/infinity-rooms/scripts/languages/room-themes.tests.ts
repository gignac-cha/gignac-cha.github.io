// parseRoomThemeResponse 의 파싱·검증 동작을 확인하는 테스트입니다.

import { describe, expect, it } from 'vitest';

import { RoomThemeData, buildNeighborSeedPrompt, parseRoomThemeResponse } from './room-themes.ts';

function buildValidResponseObject() {
  return {
    room: {
      theme: 'cyberpunk neon loft',
      wallColor: '#1a1a2e',
      ceilingColor: '#16213e',
      floorColor: '#0f3460',
      doorColor: '#e94560',
    },
    furniture: [
      { name: 'desk', variant: 1, x: 1.5, z: -2.0, rotation: 0.5, topColor: '#854d0e', legColor: '#1e293b' },
      { name: 'chair', variant: 2, x: 1.5, z: -1.2, rotation: 0.5, color: '#3b82f6', legColor: '#4b5563' },
      { name: 'ceiling-light', variant: 3, x: 0.0, z: 0.0, rotation: 0.0, color: '#334155', lightColor: '#fef08a' },
    ],
  };
}

describe('parseRoomThemeResponse', () => {
  it('정상 JSON 응답을 파싱해 동일한 데이터 형태로 반환한다', () => {
    const responseObject = buildValidResponseObject();
    const parsed = parseRoomThemeResponse(JSON.stringify(responseObject));

    expect(parsed).toEqual(responseObject);
  });

  it('JSON 앞뒤에 잡설이 섞여 있어도 본문만 추출해 파싱한다', () => {
    const responseObject = buildValidResponseObject();
    const rawText = `Sure! Here is the design:\n${JSON.stringify(responseObject)}\nEnjoy!`;

    expect(parseRoomThemeResponse(rawText)).toEqual(responseObject);
  });

  it('후행 쉼표가 섞인 비표준 JSON 도 정리 후 파싱한다', () => {
    const rawText = `{
      "room": { "theme": "zen study", "wallColor": "#e5e7eb", "ceilingColor": "#f3f4f6", "floorColor": "#d1d5db", "doorColor": "#334155", },
      "furniture": [
        { "name": "rug", "variant": 1, "x": 0.0, "z": 1.0, "rotation": 0.0, "color": "#b0a496", },
      ],
    }`;

    const parsed = parseRoomThemeResponse(rawText);
    expect(parsed.room.theme).toBe('zen study');
    expect(parsed.furniture).toHaveLength(1);
    expect(parsed.furniture[0].name).toBe('rug');
  });

  it('JSON 경계가 없는 응답이면 throw 한다', () => {
    expect(() => parseRoomThemeResponse('모델이 빈 답변을 반환했습니다.')).toThrow('JSON 경계');
  });

  it('복구 불가능한 깨진 JSON 이면 throw 한다', () => {
    expect(() => parseRoomThemeResponse('{ "room": { "theme": ::: 깨진 본문 ::: }')).toThrow('JSON 파싱');
  });

  it('room 색상이 hex 형식이 아니면 throw 한다', () => {
    const responseObject = buildValidResponseObject();
    responseObject.room.wallColor = 'red';

    expect(() => parseRoomThemeResponse(JSON.stringify(responseObject))).toThrow('room.wallColor');
  });

  it('가구의 선택 색상 값이 hex 형식이 아니면 throw 한다', () => {
    const responseObject = buildValidResponseObject();
    responseObject.furniture[0].topColor = '#12345';

    expect(() => parseRoomThemeResponse(JSON.stringify(responseObject))).toThrow('topColor');
  });

  it('허용되지 않은 가구 타입이면 throw 한다', () => {
    const responseObject = buildValidResponseObject();
    responseObject.furniture[1].name = 'television';

    expect(() => parseRoomThemeResponse(JSON.stringify(responseObject))).toThrow('가구 타입');
  });

  it('variant 가 1~3 범위의 정수가 아니면 throw 한다', () => {
    const responseObject = buildValidResponseObject();
    responseObject.furniture[0].variant = 7;

    expect(() => parseRoomThemeResponse(JSON.stringify(responseObject))).toThrow('variant');
  });

  it('좌표가 숫자가 아니면 throw 한다', () => {
    const rawText = `{
      "room": { "theme": "zen study", "wallColor": "#e5e7eb", "ceilingColor": "#f3f4f6", "floorColor": "#d1d5db", "doorColor": "#334155" },
      "furniture": [ { "name": "desk", "variant": 1, "x": "center", "z": 0.0, "rotation": 0.0 } ]
    }`;

    expect(() => parseRoomThemeResponse(rawText)).toThrow('furniture[0].x');
  });

  it('furniture 배열이 비어 있으면 throw 한다', () => {
    const responseObject = buildValidResponseObject();
    responseObject.furniture = [];

    expect(() => parseRoomThemeResponse(JSON.stringify(responseObject))).toThrow('furniture');
  });
});

describe('buildNeighborSeedPrompt', () => {
  it('이웃 테마가 null 이면 흔한 스타일과 구별되는 방을 만들라는 지시를 반환한다', () => {
    const seedPrompt = buildNeighborSeedPrompt(null);

    expect(seedPrompt).toContain('distinct from common styles');
    expect(seedPrompt).not.toContain('adjacent room');
  });

  it('이웃 테마가 있으면 그 방의 팔레트를 시드로 프롬프트에 포함한다', () => {
    const neighborThemeData: RoomThemeData = {
      room: {
        theme: 'cyberpunk neon loft',
        wallColor: '#1a1a2e',
        ceilingColor: '#16213e',
        floorColor: '#0f3460',
        doorColor: '#e94560',
      },
      furniture: [{ name: 'rug', variant: 1, x: 0.0, z: 0.0, rotation: 0.0, color: '#b0a496' }],
    };

    const seedPrompt = buildNeighborSeedPrompt(neighborThemeData);

    expect(seedPrompt).toContain('cyberpunk neon loft');
    expect(seedPrompt).toContain('#1a1a2e');
    expect(seedPrompt).toContain('#16213e');
    expect(seedPrompt).toContain('#0f3460');
    expect(seedPrompt).toContain('#e94560');
    expect(seedPrompt).toContain('flow naturally');
  });
});
