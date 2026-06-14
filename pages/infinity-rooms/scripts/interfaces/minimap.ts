// D3 SVG 미니맵 패널입니다. 탐험한 방 격자와 플레이어 위치/시야 원뿔을 2차원으로 그립니다.
// 좌표 변환은 tools/constants.ts 의 방 피치(ROOM_PITCH_X/Z)를 기준으로 합니다.
import * as d3 from 'd3';

import { ROOM_PITCH_X, ROOM_PITCH_Z } from '../tools/constants.ts';
import { RoomSummary } from '../tools/room-grid.ts';

// 활성 방과 탐험한 방 전체를 포함하는 격자 좌표 경계를 구합니다.
export function calculateBounds(
  activeRoomX: number,
  activeRoomZ: number,
  exploredRooms: { roomX: number; roomZ: number }[],
): { minRoomX: number; maxRoomX: number; minRoomZ: number; maxRoomZ: number } {
  return exploredRooms.reduce(
    (bounds, room) => ({
      minRoomX: Math.min(bounds.minRoomX, room.roomX),
      maxRoomX: Math.max(bounds.maxRoomX, room.roomX),
      minRoomZ: Math.min(bounds.minRoomZ, room.roomZ),
      maxRoomZ: Math.max(bounds.maxRoomZ, room.roomZ),
    }),
    {
      minRoomX: activeRoomX,
      maxRoomX: activeRoomX,
      minRoomZ: activeRoomZ,
      maxRoomZ: activeRoomZ,
    },
  );
}

// 경계를 1:1 비율로 감싸는 뷰포트 중심과 반경(half span)을 구합니다.
// 경계가 maxHalfSpan 을 넘으면 활성 방을 중심으로 뷰포트를 고정합니다.
export function calculateCenterAndSpan(
  minRoomX: number,
  maxRoomX: number,
  minRoomZ: number,
  maxRoomZ: number,
  activeRoomX: number,
  activeRoomZ: number,
  maxHalfSpan = 4.5,
): { centerX: number; centerZ: number; halfSpanX: number; halfSpanZ: number; isSingleRoom: boolean } {
  const isSingleRoom = minRoomX === maxRoomX && minRoomZ === maxRoomZ;

  const minDomainX = minRoomX - 0.5;
  const maxDomainX = maxRoomX + 0.5;
  const minDomainZ = minRoomZ - 0.5;
  const maxDomainZ = maxRoomZ + 0.5;

  const spanX = maxDomainX - minDomainX;
  const spanZ = maxDomainZ - minDomainZ;

  const maxSpan = Math.max(spanX, spanZ);
  const marginLength = isSingleRoom ? 0.0 : 0.25;
  const temporaryHalfSpan = maxSpan / 2 + marginLength;

  const isViewportFixed = !isSingleRoom && temporaryHalfSpan > maxHalfSpan;

  const centerX = isViewportFixed ? activeRoomX : (minDomainX + maxDomainX) / 2;
  const centerZ = isViewportFixed ? activeRoomZ : (minDomainZ + maxDomainZ) / 2;

  const halfSpan = isViewportFixed ? maxHalfSpan : temporaryHalfSpan;

  return {
    centerX,
    centerZ,
    halfSpanX: halfSpan,
    halfSpanZ: halfSpan,
    isSingleRoom,
  };
}

// 방 격자 좌표를 사각형의 좌상단 SVG 좌표로 변환합니다.
export function calculateRoomRectangle(
  roomX: number,
  roomZ: number,
  scaleX: (value: number) => number,
  scaleZ: (value: number) => number,
  roomSize: number,
): { x: number; y: number } {
  return {
    x: scaleX(roomX) - roomSize / 2,
    y: scaleZ(roomZ) - roomSize / 2,
  };
}

// 플레이어 월드 좌표/시선 각도를 미니맵 투영 좌표와 시야 원뿔 좌표로 변환합니다.
export function calculatePlayerGraphics(
  playerX: number,
  playerZ: number,
  playerYaw: number,
  scaleX: (value: number) => number,
  scaleZ: (value: number) => number,
  step: number,
  fieldOfViewDegree = 72,
): {
  playerMappedX: number;
  playerMappedZ: number;
  directionX: number;
  directionZ: number;
  viewDistance: number;
  leftX: number;
  leftZ: number;
  rightXOffset: number;
  rightZOffset: number;
} {
  const playerMappedX = scaleX(playerX / ROOM_PITCH_X);
  const playerMappedZ = scaleZ(playerZ / ROOM_PITCH_Z);

  const directionX = -Math.sin(playerYaw);
  const directionZ = -Math.cos(playerYaw);
  const viewDistance = step * 0.55;

  const fieldOfView = fieldOfViewDegree * (Math.PI / 180);
  const leftYaw = playerYaw - fieldOfView / 2;
  const rightYaw = playerYaw + fieldOfView / 2;

  const leftX = playerMappedX - Math.sin(leftYaw) * viewDistance;
  const leftZ = playerMappedZ - Math.cos(leftYaw) * viewDistance;
  const rightXOffset = playerMappedX - Math.sin(rightYaw) * viewDistance;
  const rightZOffset = playerMappedZ - Math.cos(rightYaw) * viewDistance;

  return {
    playerMappedX,
    playerMappedZ,
    directionX,
    directionZ,
    viewDistance,
    leftX,
    leftZ,
    rightXOffset,
    rightZOffset,
  };
}

export interface MinimapPanel {
  element: HTMLElement;
  update(playerX: number, playerZ: number, playerYaw: number, exploredRooms: RoomSummary[], activeRoomX: number, activeRoomZ: number): void;
  destroy(): void;
}

// 범례 항목 한 개(스와치 + 라벨)를 만듭니다.
function createLegendItem(swatchClassName: string, labelText: string): HTMLSpanElement {
  const item = document.createElement('span');
  item.className = 'legend-item';

  const swatch = document.createElement('span');
  swatch.className = `legend-swatch ${swatchClassName}`;
  swatch.setAttribute('aria-hidden', 'true');
  item.appendChild(swatch);

  item.appendChild(document.createTextNode(labelText));
  return item;
}

// 미니맵 카드(제목 행 + D3 SVG + 범례)를 만듭니다. 색상은 styles 의 미니맵 클래스가 결정하고,
// 방마다 다른 테마색만 인라인 스타일로 주입합니다.
export function createMinimapPanel(): MinimapPanel {
  const card = document.createElement('div');
  card.className = 'minimap-card';
  card.setAttribute('aria-label', '미니맵');

  // 제목 행: 한국어 제목 + 현재 방 좌표(모노)
  const titleRow = document.createElement('div');
  titleRow.className = 'minimap-title-row';

  const title = document.createElement('span');
  title.className = 'minimap-title';
  title.textContent = '미니맵';
  titleRow.appendChild(title);

  const coordinateLabel = document.createElement('span');
  coordinateLabel.className = 'minimap-coordinate';
  coordinateLabel.textContent = '(0, 0)';
  titleRow.appendChild(coordinateLabel);

  card.appendChild(titleRow);

  const svgWrap = document.createElement('div');
  svgWrap.className = 'minimap-svg-wrap';
  card.appendChild(svgWrap);

  const svgWidth = 172;
  const svgHeight = 172;
  const svg = d3.select(svgWrap).append('svg').attr('width', svgWidth).attr('height', svgHeight).attr('class', 'minimap-svg');

  const gridGroup = svg.append('g').attr('class', 'minimap-rooms-grid');
  const playerGroup = svg.append('g').attr('class', 'minimap-player');

  const visionCone = playerGroup.append('path').attr('class', 'minimap-vision-cone');
  const playerDot = playerGroup.append('circle').attr('class', 'minimap-player-dot').attr('r', 3.5);
  const playerDirectionLine = playerGroup.append('line').attr('class', 'minimap-direction-line');

  // 범례: 현재 방 / 탐험한 방 / 생성 중 / 미생성 — 색과 형태(채움·실선·펄스·점선)를 함께 안내합니다.
  const legend = document.createElement('div');
  legend.className = 'minimap-legend';
  legend.appendChild(createLegendItem('legend-current', '현재 방'));
  legend.appendChild(createLegendItem('legend-explored', '탐험한 방'));
  legend.appendChild(createLegendItem('legend-generating', '생성 중'));
  legend.appendChild(createLegendItem('legend-pending', '미생성'));
  card.appendChild(legend);

  return {
    element: card,
    update(playerX, playerZ, playerYaw, exploredRooms, activeRoomX, activeRoomZ) {
      coordinateLabel.textContent = `(${activeRoomX}, ${activeRoomZ})`;
      const { minRoomX, maxRoomX, minRoomZ, maxRoomZ } = calculateBounds(activeRoomX, activeRoomZ, exploredRooms);
      const { centerX, centerZ, halfSpanX, halfSpanZ, isSingleRoom } = calculateCenterAndSpan(
        minRoomX,
        maxRoomX,
        minRoomZ,
        maxRoomZ,
        activeRoomX,
        activeRoomZ,
      );

      const rangePadding = isSingleRoom ? 12 : 15;

      const scaleX = d3
        .scaleLinear()
        .domain([centerX - halfSpanX, centerX + halfSpanX])
        .range([rangePadding, svgWidth - rangePadding]);

      const scaleZ = d3
        .scaleLinear()
        .domain([centerZ - halfSpanZ, centerZ + halfSpanZ])
        .range([rangePadding, svgHeight - rangePadding]);

      const step = scaleX(1) - scaleX(0);
      const roomSize = isSingleRoom ? step : step * 0.95;

      interface RenderedRoom {
        id: string;
        x: number;
        y: number;
        isGenerated: boolean;
        // 생성이 진행 중인 방(미생성이지만 테마 요청 중)입니다. 펄스 스타일로 구분합니다.
        isGenerating: boolean;
        themeColor: string | null;
        isActive: boolean;
      }

      const roomsData = exploredRooms.map((room): RenderedRoom => {
        const { x, y } = calculateRoomRectangle(room.roomX, room.roomZ, scaleX, scaleZ, roomSize);
        return {
          id: `${room.roomX},${room.roomZ}`,
          x,
          y,
          isGenerated: room.isGenerated,
          isGenerating: room.isGenerating,
          themeColor: room.themeColor,
          isActive: room.roomX === activeRoomX && room.roomZ === activeRoomZ,
        };
      });

      const rectangles = gridGroup.selectAll<SVGRectElement, RenderedRoom>('rect').data(roomsData, (room) => room.id);

      rectangles.exit().remove();

      rectangles
        .enter()
        .append('rect')
        .merge(rectangles)
        .attr('class', (room) => {
          const classNames = ['minimap-room'];
          if (room.isGenerated) {
            classNames.push('is-generated');
          }
          // 미생성이면서 생성 요청이 진행 중인 방은 펄스로 구분합니다(생성 완료 방과 시각적으로 분리).
          if (!room.isGenerated && room.isGenerating) {
            classNames.push('is-generating');
          }
          if (room.isActive) {
            classNames.push('is-active');
          }
          return classNames.join(' ');
        })
        .attr('x', (room) => room.x)
        .attr('y', (room) => room.y)
        .attr('width', roomSize)
        .attr('height', roomSize)
        .attr('rx', Math.max(1, roomSize * 0.15))
        // 활성/미생성 방의 채움색은 CSS 클래스가 결정하고, 생성 완료된 방만 테마색을 인라인으로 칠합니다.
        .style('fill', (room) => {
          if (room.isActive || !room.isGenerated) {
            return null;
          }
          if (room.themeColor === null) {
            throw new Error(`생성 완료된 방(${room.id})에 테마 색상이 없습니다.`);
          }
          return room.themeColor;
        });

      const { playerMappedX, playerMappedZ, directionX, directionZ, viewDistance, leftX, leftZ, rightXOffset, rightZOffset } = calculatePlayerGraphics(
        playerX,
        playerZ,
        playerYaw,
        scaleX,
        scaleZ,
        step,
      );

      const dotRadius = Math.max(3.5, Math.min(8.0, roomSize * 0.12));
      playerDot.attr('cx', playerMappedX).attr('cy', playerMappedZ).attr('r', dotRadius);

      playerDirectionLine
        .attr('x1', playerMappedX)
        .attr('y1', playerMappedZ)
        .attr('x2', playerMappedX + directionX * (viewDistance * 0.55))
        .attr('y2', playerMappedZ + directionZ * (viewDistance * 0.55));

      visionCone.attr('d', `M ${playerMappedX} ${playerMappedZ} L ${leftX} ${leftZ} A ${viewDistance} ${viewDistance} 0 0 0 ${rightXOffset} ${rightZOffset} Z`);
    },
    destroy() {
      card.remove();
    },
  };
}
