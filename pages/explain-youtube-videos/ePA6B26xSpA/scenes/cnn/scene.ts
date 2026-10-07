import './cnn.scss';
import { appear, createDiagram, ease, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 9:43 "사람마다 글씨체가 제각각" ~ 10:58 "사람의 시각 피질도 층층이 일한다".
const start = 583.633;
const end = 658.233;

// 1단계: 같은 숫자도 사람마다 다르게 쓴다.
const variantsAt = [586.2, 587.8, 589.7, 593.8, 594.4];
const variantsOut = 600.1;
// 2단계: 돋보기(필터)로 훑고, 풀링으로 요약한다.
const gridAt = 600.5;
const windowAt = 605.2;
const kernelAt = 610.7;
const scanAt = 612.8;
const scanRate = 7;
const sameAt = 616.8;
const leftAt = 620.3;
const rightAt = 620.9;
const countAt = 623.6;
const countDropAt = 624.6;
const poolGridAt = 629.1;
const poolAt = 631.1;
const poolRate = 5;
const shiftAt = 640.2;
const keptAt = 641.4;
const convOut = 643.3;
// 3단계: 층을 쌓으면 선 → 모양 → 판단.
const layersAt = 643.8;
const edgesAt = 646.3;
const shapesAt = 649.6;
const decideAt = 652.2;
const cortexAt = 655;

const digit = [
  '............',
  '....#####...',
  '...#.....#..',
  '...#.....#..',
  '...#.....#..',
  '....#####...',
  '...#.....#..',
  '...#.....#..',
  '...#.....#..',
  '...#.....#..',
  '....#####...',
  '............',
];

const inkAt = (shift: number) => (r: number, c: number) => (digit[r][c - shift] === '#' ? 1 : 0);

// 세로선 돋보기: 가운데 열은 +2, 양옆 열은 -1.
const kernel = [[-1, 2, -1], [-1, 2, -1], [-1, 2, -1]];

const featureMap = (shift: number) => {
  const ink = inkAt(shift);
  return Array.from({ length: 10 }, (_, r) =>
    Array.from({ length: 10 }, (_, c) => {
      let sum = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          sum += kernel[i][j] * ink(r + i, c + j);
        }
      }
      return Math.max(sum, 0) / 6;
    }),
  );
};

const pooled = (map: number[][]) =>
  Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => Math.max(map[2 * r][2 * c], map[2 * r][2 * c + 1], map[2 * r + 1][2 * c], map[2 * r + 1][2 * c + 1])),
  );

const maps = [featureMap(0), featureMap(1)];
const pools = maps.map(pooled);

const inputCell = 38;
const input = { x: 110, y: 230 };
const kernelBox = { x: 640, y: 402, cell: 38 };
const feature = { x: 880, y: 289, cell: 34 };
const pool = { x: 1300, y: 374, cell: 34 };

const sevenPath = 'M40 40 L170 40 L90 210';
const variants = [
  { label: '또박또박', path: sevenPath, transform: '' },
  { label: '휘갈겨', path: 'M35 58 C80 30 128 64 176 36 C150 92 112 150 84 214', transform: '' },
  { label: '가로줄', path: `${sevenPath} M78 126 L152 126`, transform: '' },
  { label: '기울어짐', path: sevenPath, transform: 'skewX(-18) translate(40 0)' },
  { label: '작게', path: sevenPath, transform: 'translate(52 110) scale(.5)' },
];

export const createCnnScene = (): Scene => {
  const { element, root } = createDiagram('cnn', '합성곱 신경망 CNN');

  // 1단계
  const handwriting = svg('g', {}, root);
  const variantGroups = variants.map(({ label, path, transform }, index) => {
    const x = 160 + index * 270;
    const group = svg('g', { transform: `translate(${x} 300)` }, handwriting);
    svg('rect', { class: 'cnn-card', x: 0, y: 0, width: 210, height: 250, rx: 18 }, group);
    svg('path', { class: 'cnn-stroke', d: path, transform }, group);
    text(group, 105, 310, label, { class: 'cnn-label' });
    return group;
  });

  // 2단계
  const convolution = svg('g', {}, root);
  text(convolution, input.x, 190, '입력', { class: 'cnn-heading' });
  const inputGrid = svg('g', {}, convolution);
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 12; c++) {
      svg('rect', { class: 'cnn-cell', x: input.x + c * inputCell, y: input.y + r * inputCell, width: inputCell, height: inputCell }, inputGrid);
    }
  }
  const ink = svg('g', {}, convolution);
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 12; c++) {
      if (digit[r][c] === '#') {
        svg('rect', { class: 'cnn-ink', x: input.x + c * inputCell + 2, y: input.y + r * inputCell + 2, width: inputCell - 4, height: inputCell - 4, rx: 4 }, ink);
      }
    }
  }
  const scanWindow = svg('rect', { class: 'cnn-window', width: inputCell * 3, height: inputCell * 3, rx: 6 }, convolution);
  const link = svg('line', { class: 'cnn-link' }, convolution);
  const sameLabel = text(convolution, input.x + inputCell * 6, input.y + inputCell * 12 + 52, '그림 전체에 같은 돋보기 하나', { class: 'cnn-note' });

  const kernelGroup = svg('g', {}, convolution);
  text(kernelGroup, kernelBox.x + kernelBox.cell * 1.5, 190, '돋보기', { class: 'cnn-heading cnn-center' });
  text(kernelGroup, kernelBox.x + kernelBox.cell * 1.5, 232, '세로선?', { class: 'cnn-note cnn-center' });
  kernel.forEach((row, i) =>
    row.forEach((weight, j) => {
      svg('rect', {
        class: weight > 0 ? 'cnn-weight cnn-weight-plus' : 'cnn-weight cnn-weight-minus',
        x: kernelBox.x + j * kernelBox.cell, y: kernelBox.y + i * kernelBox.cell, width: kernelBox.cell, height: kernelBox.cell,
      }, kernelGroup);
    }),
  );
  const kernelFrame = svg('rect', { class: 'cnn-kernel-frame', x: kernelBox.x - 4, y: kernelBox.y - 4, width: kernelBox.cell * 3 + 8, height: kernelBox.cell * 3 + 8, rx: 8 }, kernelGroup);

  const featureGroup = svg('g', {}, convolution);
  text(featureGroup, feature.x, 190, '세로선이 있는 곳', { class: 'cnn-heading' });
  const featureCells = Array.from({ length: 10 }, (_, r) =>
    Array.from({ length: 10 }, (_, c) => {
      svg('rect', { class: 'cnn-cell', x: feature.x + c * feature.cell, y: feature.y + r * feature.cell, width: feature.cell, height: feature.cell }, featureGroup);
      return svg('rect', { class: 'cnn-response', x: feature.x + c * feature.cell + 2, y: feature.y + r * feature.cell + 2, width: feature.cell - 4, height: feature.cell - 4, rx: 3 }, featureGroup);
    }),
  );
  const ringLeft = svg('rect', { class: 'cnn-ring', x: feature.x + 2 * feature.cell - 6, y: feature.y + 2 * feature.cell - 6, width: feature.cell + 12, height: feature.cell + 12, rx: 8 }, featureGroup);
  const ringRight = svg('rect', { class: 'cnn-ring', x: feature.x + 8 * feature.cell - 6, y: feature.y + 2 * feature.cell - 6, width: feature.cell + 12, height: feature.cell + 12, rx: 8 }, featureGroup);
  const cursor = svg('rect', { class: 'cnn-cursor', width: feature.cell, height: feature.cell }, featureGroup);
  const poolCursor = svg('rect', { class: 'cnn-window', width: feature.cell * 2, height: feature.cell * 2, rx: 4 }, featureGroup);

  const poolGroup = svg('g', {}, convolution);
  text(poolGroup, pool.x, 190, '풀링', { class: 'cnn-heading' });
  text(poolGroup, pool.x, 232, '4칸 → 1칸', { class: 'cnn-note' });
  const poolCells = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => {
      svg('rect', { class: 'cnn-cell', x: pool.x + c * pool.cell, y: pool.y + r * pool.cell, width: pool.cell, height: pool.cell }, poolGroup);
      return svg('rect', { class: 'cnn-response', x: pool.x + c * pool.cell + 2, y: pool.y + r * pool.cell + 2, width: pool.cell - 4, height: pool.cell - 4, rx: 3 }, poolGroup);
    }),
  );
  const keptLabel = text(poolGroup, pool.x + pool.cell * 2.5, pool.y + pool.cell * 5 + 50, '그대로', { class: 'cnn-note cnn-center cnn-kept' });

  const count = svg('g', {}, convolution);
  const countMany = text(count, 770, 820, '칸마다 따로 배우면 900개', { class: 'cnn-count cnn-count-many' });
  const strike = svg('line', { class: 'cnn-strike', x1: 410, x2: 772, y1: 808, y2: 808 }, count);
  const countFew = text(count, 812, 820, '→  돋보기 하나면 9개', { class: 'cnn-count cnn-count-few' });

  // 3단계
  const layers = svg('g', {}, root);
  const columns = [
    { x: 250, title: '입력' },
    { x: 610, title: '선 · 모서리' },
    { x: 970, title: '모양' },
    { x: 1330, title: '3일까 8일까' },
  ];
  const columnTitles = columns.map(({ x, title }) => text(layers, x, 230, title, { class: 'cnn-heading cnn-center' }));
  const mini = svg('g', { transform: 'translate(166 376)' }, layers);
  digit.forEach((row, r) =>
    [...row].forEach((value, c) => {
      if (value === '#') {
        svg('rect', { class: 'cnn-ink', x: c * 14, y: r * 14, width: 13, height: 13, rx: 2 }, mini);
      }
    }),
  );
  const tile = (parent: Element, x: number, y: number, path: string) => {
    const group = svg('g', { transform: `translate(${x - 60} ${y - 60})` }, parent);
    svg('rect', { class: 'cnn-tile', width: 120, height: 120, rx: 16 }, group);
    svg('path', { class: 'cnn-tile-stroke', d: path }, group);
    return group;
  };
  const edgeTiles = [
    tile(layers, 610, 320, 'M60 28 L60 92'),
    tile(layers, 610, 460, 'M28 60 L92 60'),
    tile(layers, 610, 600, 'M36 30 L36 86 L88 86'),
  ];
  const shapeTiles = [
    tile(layers, 970, 390, 'M60 30 A30 30 0 1 1 59.9 30 Z'),
    tile(layers, 970, 530, 'M34 36 L86 36 L86 84 L34 84'),
  ];
  const fan = svg('g', { class: 'cnn-fan' }, layers);
  const fanLines = (fromX: number, fromYs: number[], toX: number, toYs: number[]) => {
    const group = svg('g', {}, fan);
    for (const y1 of fromYs) {
      for (const y2 of toYs) {
        svg('line', { x1: fromX, y1, x2: toX, y2 }, group);
      }
    }
    return group;
  };
  const fanEdges = fanLines(340, [460], 550, [320, 460, 600]);
  const fanShapes = fanLines(670, [320, 460, 600], 910, [390, 530]);
  const fanDecide = fanLines(1030, [390, 530], 1200, [420, 500]);
  const bars = [
    { digit: '3', y: 420, value: .08 },
    { digit: '8', y: 500, value: .92 },
  ].map(({ digit: label, y, value }) => {
    text(layers, 1228, y + 12, label, { class: 'cnn-bar-label' });
    svg('rect', { class: 'cnn-bar-track', x: 1262, y: y - 18, width: 200, height: 36, rx: 8 }, layers);
    const bar = svg('rect', { class: label === '8' ? 'cnn-bar cnn-bar-win' : 'cnn-bar', x: 1262, y: y - 18, height: 36, rx: 8 }, layers);
    return { bar, value };
  });
  const barGroupItems = layers.querySelectorAll('.cnn-bar-label, .cnn-bar-track');
  const cortex = text(layers, 800, 800, '사람의 시각 피질도 층층이 일한다', { class: 'cnn-note cnn-center' });

  const update = (time: number) => {
    // 1단계
    setAttributes(handwriting, { opacity: (1 - appear(time, variantsOut, .4)).toFixed(3) });
    variantGroups.forEach((group, index) => setAttributes(group, { opacity: appear(time, variantsAt[index], .4).toFixed(3) }));

    // 2단계
    setAttributes(convolution, { opacity: (appear(time, gridAt, .5) * (1 - appear(time, convOut, .5))).toFixed(3) });
    const shift = ease(progress(time, shiftAt, .7));
    const map = shift >= .5 ? 1 : 0;
    setAttributes(ink, { transform: `translate(${(shift * inputCell).toFixed(1)} 0)` });

    const scanned = Math.min(Math.max(Math.floor((time - scanAt) * scanRate) + 1, 0), 100);
    const position = Math.max(scanned - 1, 0);
    const [row, column] = [Math.floor(position / 10), position % 10];
    const scanning = time >= windowAt && time < scanAt + 100 / scanRate + .4;
    setAttributes(scanWindow, {
      x: input.x + column * inputCell, y: input.y + row * inputCell,
      opacity: scanning ? appear(time, windowAt, .3).toFixed(3) : 0,
    });
    const linking = scanning && time >= scanAt;
    setAttributes(link, {
      x1: input.x + (column + 3) * inputCell, y1: input.y + (row + 1.5) * inputCell,
      x2: feature.x + column * feature.cell, y2: feature.y + (row + .5) * feature.cell,
      opacity: linking ? 1 : 0,
    });
    setAttributes(cursor, { x: feature.x + column * feature.cell, y: feature.y + row * feature.cell, opacity: linking ? 1 : 0 });
    setAttributes(kernelGroup, { opacity: appear(time, kernelAt, .4).toFixed(3) });
    const same = time >= sameAt && time < countAt;
    kernelFrame.classList.toggle('cnn-same', same);
    scanWindow.classList.toggle('cnn-same', same);
    setAttributes(sameLabel, { opacity: (appear(time, sameAt + .4, .4) * (1 - appear(time, countAt, .4))).toFixed(3) });
    setAttributes(featureGroup, { opacity: appear(time, scanAt, .4).toFixed(3) });
    featureCells.forEach((cells, r) =>
      cells.forEach((cell, c) => {
        const visible = r * 10 + c < scanned;
        setAttributes(cell, { opacity: visible ? maps[map][r][c].toFixed(3) : 0 });
      }),
    );
    const ringFade = 1 - appear(time, countAt, .4);
    setAttributes(ringLeft, { opacity: (appear(time, leftAt, .3) * ringFade).toFixed(3) });
    setAttributes(ringRight, { opacity: (appear(time, rightAt, .3) * ringFade).toFixed(3) });

    setAttributes(count, { opacity: (appear(time, countAt, .4) * (1 - appear(time, poolGridAt, .4))).toFixed(3) });
    setAttributes(strike, { opacity: appear(time, countDropAt, .3).toFixed(3) });
    countMany.classList.toggle('cnn-count-dropped', time >= countDropAt);
    setAttributes(countFew, { opacity: appear(time, countDropAt, .4).toFixed(3) });

    setAttributes(poolGroup, { opacity: appear(time, poolGridAt, .4).toFixed(3) });
    const pooledCount = Math.min(Math.max(Math.floor((time - poolAt) * poolRate) + 1, 0), 25);
    poolCells.forEach((cells, r) =>
      cells.forEach((cell, c) => {
        setAttributes(cell, { opacity: r * 5 + c < pooledCount ? pools[map][r][c].toFixed(3) : 0 });
      }),
    );
    const block = Math.max(pooledCount - 1, 0);
    const pooling = time >= poolAt && time < poolAt + 25 / poolRate + .3;
    setAttributes(poolCursor, {
      x: feature.x + (block % 5) * 2 * feature.cell, y: feature.y + Math.floor(block / 5) * 2 * feature.cell,
      opacity: pooling ? 1 : 0,
    });
    setAttributes(keptLabel, { opacity: appear(time, keptAt, .4).toFixed(3) });

    // 3단계
    setAttributes(layers, { opacity: appear(time, layersAt, .5).toFixed(3) });
    setAttributes(columnTitles[0], { opacity: 1 });
    setAttributes(columnTitles[1], { opacity: appear(time, edgesAt, .4).toFixed(3) });
    setAttributes(columnTitles[2], { opacity: appear(time, shapesAt, .4).toFixed(3) });
    setAttributes(columnTitles[3], { opacity: appear(time, decideAt, .4).toFixed(3) });
    edgeTiles.forEach((group, index) => setAttributes(group, { opacity: appear(time, edgesAt + index * .3, .4).toFixed(3) }));
    shapeTiles.forEach((group, index) => setAttributes(group, { opacity: appear(time, shapesAt + index * .3, .4).toFixed(3) }));
    setAttributes(fanEdges, { opacity: appear(time, edgesAt, .5).toFixed(3) });
    setAttributes(fanShapes, { opacity: appear(time, shapesAt, .5).toFixed(3) });
    setAttributes(fanDecide, { opacity: appear(time, decideAt, .5).toFixed(3) });
    const decide = appear(time, decideAt, .4);
    barGroupItems.forEach((item) => setAttributes(item, { opacity: decide.toFixed(3) }));
    const grow = ease(progress(time, decideAt + .8, 1));
    for (const { bar, value } of bars) {
      setAttributes(bar, { width: (200 * value * grow).toFixed(1), opacity: decide.toFixed(3) });
    }
    setAttributes(cortex, { opacity: appear(time, cortexAt, .5).toFixed(3) });
  };

  return {
    element,
    update,
    title: '합성곱 신경망 CNN',
    start,
    end,
    chapters: [
      { time: start, title: '제각각인 글씨' },
      { time: gridAt, title: 'CNN' },
      { time: windowAt, title: '작은 돋보기' },
      { time: scanAt, title: '한 칸씩 훑기' },
      { time: sameAt, title: '같은 돋보기' },
      { time: countAt, title: '배울 것이 줄어듦' },
      { time: poolGridAt, title: '풀링' },
      { time: shiftAt, title: '밀려도 알아봄' },
      { time: layersAt, title: '층층이 쌓기' },
    ],
  };
};
