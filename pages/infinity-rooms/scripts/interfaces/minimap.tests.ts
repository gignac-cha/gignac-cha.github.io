import { describe, expect, it } from 'vitest';

import { ROOM_PITCH_X, ROOM_PITCH_Z } from '../tools/constants.ts';
import { calculateBounds, calculateCenterAndSpan, calculatePlayerGraphics, calculateRoomRectangle } from './minimap.ts';

describe('미니맵 계산 함수', () => {
  describe('calculateBounds', () => {
    it('방이 하나일 때 그 방의 좌표가 경계가 된다', () => {
      const bounds = calculateBounds(0, 0, [{ roomX: 0, roomZ: 0 }]);
      expect(bounds).toEqual({ minRoomX: 0, maxRoomX: 0, minRoomZ: 0, maxRoomZ: 0 });
    });

    it('여러 방의 최소/최대 좌표를 경계로 구한다', () => {
      const bounds = calculateBounds(0, 0, [
        { roomX: 0, roomZ: 0 },
        { roomX: 1, roomZ: -1 },
        { roomX: -2, roomZ: 2 },
      ]);
      expect(bounds).toEqual({ minRoomX: -2, maxRoomX: 1, minRoomZ: -1, maxRoomZ: 2 });
    });

    it('탐험한 방 목록이 비어 있으면 활성 방 좌표가 경계가 된다', () => {
      const bounds = calculateBounds(2, -3, []);
      expect(bounds).toEqual({ minRoomX: 2, maxRoomX: 2, minRoomZ: -3, maxRoomZ: -3 });
    });

    it('탐험한 방 목록에 없는 활성 방 좌표도 경계에 포함된다', () => {
      const bounds = calculateBounds(5, 5, [{ roomX: 0, roomZ: 0 }]);
      expect(bounds).toEqual({ minRoomX: 0, maxRoomX: 5, minRoomZ: 0, maxRoomZ: 5 });
    });
  });

  describe('calculateCenterAndSpan', () => {
    it('방이 하나일 때 중심과 반경을 구한다', () => {
      const result = calculateCenterAndSpan(0, 0, 0, 0, 0, 0);
      expect(result).toEqual({
        centerX: 0,
        centerZ: 0,
        halfSpanX: 0.5,
        halfSpanZ: 0.5,
        isSingleRoom: true,
      });
    });

    it('비대칭 경계에서도 가로/세로 1:1 비율을 유지한다', () => {
      const result = calculateCenterAndSpan(-1, 1, -2, 2, 0, 0);
      expect(result).toEqual({
        centerX: 0,
        centerZ: 0,
        halfSpanX: 2.75,
        halfSpanZ: 2.75,
        isSingleRoom: false,
      });
    });

    it('경계가 최대 반경을 넘으면 활성 방 좌표를 중심으로 고정한다', () => {
      const result = calculateCenterAndSpan(-4, 4, 0, 0, 2, 3, 2.5);
      expect(result).toEqual({
        centerX: 2,
        centerZ: 3,
        halfSpanX: 2.5,
        halfSpanZ: 2.5,
        isSingleRoom: false,
      });
    });

    it('방이 여럿이면 여백 0.25 를 더한 반경을 사용한다', () => {
      const result = calculateCenterAndSpan(0, 0, 0, 1, 0, 0);
      expect(result).toEqual({
        centerX: 0,
        centerZ: 0.5,
        halfSpanX: 1.25,
        halfSpanZ: 1.25,
        isSingleRoom: false,
      });
    });

    it('기본 최대 반경 4.5 를 넘으면 뷰포트를 고정한다', () => {
      const result = calculateCenterAndSpan(-5, 5, 0, 0, 1, 0);
      expect(result).toEqual({
        centerX: 1,
        centerZ: 0,
        halfSpanX: 4.5,
        halfSpanZ: 4.5,
        isSingleRoom: false,
      });
    });

    it('반경이 최대 반경과 같으면 뷰포트를 고정하지 않는다', () => {
      const result = calculateCenterAndSpan(-4, 4, 0, 0, 3, 3, 4.75);
      expect(result).toEqual({
        centerX: 0,
        centerZ: 0,
        halfSpanX: 4.75,
        halfSpanZ: 4.75,
        isSingleRoom: false,
      });
    });
  });

  describe('calculateRoomRectangle', () => {
    const scaleX = (value: number) => value * 100;
    const scaleZ = (value: number) => value * 100;

    it('방 격자 좌표를 사각형의 좌상단 좌표로 변환한다', () => {
      const rectangle = calculateRoomRectangle(1, 2, scaleX, scaleZ, 40);
      expect(rectangle).toEqual({ x: 80, y: 180 });
    });

    it('음수 격자 좌표도 올바르게 변환한다', () => {
      const rectangle = calculateRoomRectangle(-1, -2, scaleX, scaleZ, 40);
      expect(rectangle).toEqual({ x: -120, y: -220 });
    });

    it('방 크기가 0이면 중심 좌표가 그대로 좌상단이 된다', () => {
      const rectangle = calculateRoomRectangle(1, 1, scaleX, scaleZ, 0);
      expect(rectangle).toEqual({ x: 100, y: 100 });
    });
  });

  describe('calculatePlayerGraphics', () => {
    const scaleX = (value: number) => value * 100;
    const scaleZ = (value: number) => value * 100;
    const step = 50;

    it('플레이어 투영 좌표와 시야 원뿔 값을 계산한다', () => {
      const graphics = calculatePlayerGraphics(1.5 * ROOM_PITCH_X, 2.5 * ROOM_PITCH_Z, 0, scaleX, scaleZ, step);
      expect(graphics.playerMappedX).toBeCloseTo(150);
      expect(graphics.playerMappedZ).toBeCloseTo(250);
      expect(graphics.directionX).toBeCloseTo(0);
      expect(graphics.directionZ).toBeCloseTo(-1);
      expect(graphics.viewDistance).toBeCloseTo(27.5);
    });

    it('시선 각도가 90도(π/2)면 -X 방향을 가리킨다', () => {
      const graphics = calculatePlayerGraphics(0, 0, Math.PI / 2, scaleX, scaleZ, step);
      expect(graphics.directionX).toBeCloseTo(-1);
      expect(graphics.directionZ).toBeCloseTo(0);
    });

    it('시선 각도가 180도(π)면 +Z 방향을 가리킨다', () => {
      const graphics = calculatePlayerGraphics(0, 0, Math.PI, scaleX, scaleZ, step);
      expect(graphics.directionX).toBeCloseTo(0);
      expect(graphics.directionZ).toBeCloseTo(1);
    });

    it('월드 좌표를 방 피치(ROOM_PITCH)로 나누어 격자 좌표로 투영한다', () => {
      const graphics = calculatePlayerGraphics(ROOM_PITCH_X, -2 * ROOM_PITCH_Z, 0, scaleX, scaleZ, step);
      expect(graphics.playerMappedX).toBeCloseTo(100);
      expect(graphics.playerMappedZ).toBeCloseTo(-200);
    });

    it('시야 거리는 격자 한 칸 폭(step)의 55%이다', () => {
      const graphics = calculatePlayerGraphics(0, 0, 0, scaleX, scaleZ, 100);
      expect(graphics.viewDistance).toBeCloseTo(55);
    });

    it('시선 각도가 0이면 시야 원뿔이 좌우 대칭이다', () => {
      const graphics = calculatePlayerGraphics(0, 0, 0, scaleX, scaleZ, step);
      expect(graphics.leftX).toBeCloseTo(-graphics.rightXOffset);
      expect(graphics.leftZ).toBeCloseTo(graphics.rightZOffset);
      expect(graphics.leftZ).toBeLessThan(0);
    });

    it('시야각 180도면 원뿔 가장자리가 좌우 수평선 위에 놓인다', () => {
      const graphics = calculatePlayerGraphics(0, 0, 0, scaleX, scaleZ, step, 180);
      expect(graphics.leftX).toBeCloseTo(27.5);
      expect(graphics.leftZ).toBeCloseTo(0);
      expect(graphics.rightXOffset).toBeCloseTo(-27.5);
      expect(graphics.rightZOffset).toBeCloseTo(0);
    });
  });
});
