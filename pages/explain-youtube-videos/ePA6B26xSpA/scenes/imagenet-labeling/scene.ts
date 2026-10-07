import './imagenet-labeling.scss';
import { appear, createDiagram, lerp, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 17:47 "좋은 알고리즘보다 먼저 좋은 데이터" ~ 18:41 "천 가지 사물을 누가 가장 정확히 맞히는지".
const start = 1067.733;
const end = 1121.567;
const at = {
  dataFirst: 1067.9,
  scenes: 1073,
  distinguish: 1076.4,
  machine: 1078.9,
  imagenet: 1083.6,
  tags: 1088,
  scale: 1090.1,
  students: 1092.1,
  crowd: 1100.4,
  question: 1104.7,
  answer: 1107.2,
  tenMillion: 1111.9,
  contest: 1116.2,
  categories: 1118.4,
};

const subjects = [
  ['🐈', '고양이'], ['🐕', '강아지'], ['🚗', '자동차'], ['🪑', '의자'], ['☕', '컵'], ['🌳', '나무'],
  ['🐦', '새'], ['🍎', '사과'], ['🚲', '자전거'], ['🐟', '물고기'], ['🌻', '꽃'], ['🏠', '집'],
];

const wall = { columns: 8, rows: 4, pitch: 120, tile: 108, x: 320, y: 230 };
const mosaic = { columns: 34, rows: 18, pitch: 30, x: 140, y: 160 };
const scaled = mosaic.pitch / wall.pitch;

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const person = (parent: Element, x: number, y: number, size: number) => {
  const group = svg('g', {}, parent);
  svg('circle', { cx: x, cy: y - size * .32, r: size * .2 }, group);
  svg('path', { d: `M${x - size * .3} ${y + size * .42} Q${x} ${y - size * .18} ${x + size * .3} ${y + size * .42} Z` }, group);
  return group;
};

export const createImageNetLabelingScene = (): Scene => {
  const { element, root } = createDiagram('imagenet-labeling', '이미지넷 · 이름표');

  // 거대한 모자이크: 사진 한 장이 한 칸.
  const cellGroup = svg('g', { class: 'imagenet-cells' }, root);
  const wallCell = (column: number, row: number) => column < wall.columns && row < wall.rows;
  let studentOrder = 0;
  const cells = Array.from({ length: mosaic.columns * mosaic.rows }, (_, i) => {
    const column = i % mosaic.columns;
    const row = Math.floor(i / mosaic.columns);
    const rect = svg('rect', { x: mosaic.x + column * mosaic.pitch, y: mosaic.y + row * mosaic.pitch, width: mosaic.pitch - 4, height: mosaic.pitch - 4, rx: 4 }, cellGroup);
    // 대학원생 몇 명은 벽 바로 옆 몇 칸을 겨우 채운다. 나머지는 전 세계 사람들이 한꺼번에.
    const nearWall = !wallCell(column, row) && row < wall.rows + 1 && column < wall.columns + 2;
    const labeledAt = nearWall ? at.students + .5 + studentOrder++ * .45 : at.crowd + .2 + random(i * 3 + 7) * 11.2;
    return { rect, labeledAt, hidden: wallCell(column, row), category: Math.floor(random(i * 5 + 2) * 6) };
  });

  // 처음에는 크게 보이는 사진 벽.
  const photos = svg('g', { class: 'imagenet-wall' }, root);
  const tiles = Array.from({ length: wall.columns * wall.rows }, (_, i) => {
    const column = i % wall.columns;
    const row = Math.floor(i / wall.columns);
    const pick = random(i * 13 + 5);
    const index = pick < .22 ? 0 : pick < .4 ? 1 : 2 + Math.floor(random(i * 17 + 3) * (subjects.length - 2));
    const [emoji, name] = subjects[index];
    const group = svg('g', { transform: `translate(${column * wall.pitch} ${row * wall.pitch})` }, photos);
    const frame = svg('rect', { width: wall.tile, height: wall.tile, rx: 12, class: 'imagenet-tile' }, group);
    text(group, wall.tile / 2, 58, emoji, { class: 'imagenet-emoji' });
    const tag = svg('g', { class: 'imagenet-tag' }, group);
    svg('rect', { y: wall.tile - 36, width: wall.tile, height: 36, class: 'imagenet-tag-band' }, tag);
    text(tag, wall.tile / 2, wall.tile - 9, name, { class: 'imagenet-tag-text' });
    return { group, frame, tag, kind: index, appearAt: at.scenes + random(i * 7 + 1) * 2.6, order: i };
  });
  const imagenetTitle = text(root, 320, 200, 'ImageNet', { class: 'imagenet-title' });

  // 대학원생 몇 명 → 전 세계 사람들.
  const students = svg('g', { class: 'imagenet-people' }, root);
  [0, 1, 2].forEach((i) => person(students, 190 + i * 60, 790, 56));
  const studentsLabel = text(root, 380, 805, '대학원생 몇 명이면 수십 년', { class: 'imagenet-note' });
  const crowd = svg('g', { class: 'imagenet-people crowd' }, root);
  const crowdPeople = Array.from({ length: 34 }, (_, i) => ({
    node: person(crowd, 160 + i * 30.5, 790 + (i % 2) * 22, 34),
    at: at.crowd + random(i * 9 + 4) * 1.4,
  }));
  const crowdLabel = text(root, 140, 870, '전 세계 사람들에게 작은 일로 나눠서', { class: 'imagenet-note' });

  // 오른쪽: 작은 일 하나.
  const task = svg('g', { class: 'imagenet-task' }, root);
  svg('rect', { x: 1240, y: 160, width: 300, height: 380, rx: 20, class: 'imagenet-card' }, task);
  svg('rect', { x: 1270, y: 190, width: 240, height: 170, rx: 12, class: 'imagenet-tile' }, task);
  text(task, 1390, 300, '🐈', { class: 'imagenet-emoji imagenet-emoji-large' });
  text(task, 1390, 410, '고양이가 맞나요?', { class: 'imagenet-question' });
  const yes = svg('rect', { x: 1270, y: 445, width: 112, height: 60, rx: 12, class: 'imagenet-button' }, task);
  text(task, 1326, 485, '✓ 예', { class: 'imagenet-button-text' });
  svg('rect', { x: 1398, y: 445, width: 112, height: 60, rx: 12, class: 'imagenet-button' }, task);
  text(task, 1454, 485, '✕ 아니요', { class: 'imagenet-button-text' });

  const count = svg('g', { class: 'imagenet-count' }, root);
  text(count, 1390, 640, '1,000만 장+', { class: 'imagenet-big' });
  text(count, 1390, 690, '이름표 붙은 사진', { class: 'imagenet-note imagenet-center' });

  const categories = svg('g', { class: 'imagenet-categories' }, root);
  text(categories, 1390, 230, '1,000가지 사물', { class: 'imagenet-category-title' });
  subjects.slice(0, 8).forEach(([emoji, name], i) => {
    const x = 1250 + (i % 2) * 150;
    const y = 270 + Math.floor(i / 2) * 64;
    svg('rect', { x, y, width: 136, height: 50, rx: 25, class: `imagenet-chip c${i % 6}` }, categories);
    text(categories, x + 68, y + 35, `${emoji} ${name}`, { class: 'imagenet-chip-text' });
  });
  text(categories, 1390, 560, '…', { class: 'imagenet-category-title' });

  const update = (time: number) => {
    // 사진 벽: 하나씩 쌓이다가, 규모를 보여 줄 때 모자이크의 한 귀퉁이로 줄어든다.
    const zoom = appear(time, at.scale, 1.2);
    const scale = lerp(1, scaled, zoom);
    setAttributes(photos, {
      transform: `translate(${lerp(wall.x, mosaic.x, zoom).toFixed(1)} ${lerp(wall.y, mosaic.y, zoom).toFixed(1)}) scale(${scale.toFixed(4)})`,
    });
    const highlight = time >= at.distinguish && time < at.machine + 1.5;
    tiles.forEach(({ group, frame, tag, kind, appearAt, order }) => {
      setAttributes(group, { opacity: (appear(time, appearAt, .4) * (highlight && kind > 1 ? .3 : 1)).toFixed(3) });
      const pet = kind === 0 ? 'cat' : kind === 1 ? 'dog' : 'other';
      setAttributes(frame, { class: highlight ? `imagenet-tile ${pet}` : 'imagenet-tile' });
      // 이름표는 한 장씩 손으로 붙인다.
      setAttributes(tag, { opacity: appear(time, at.tags + order * .32, .25).toFixed(3) });
    });
    setAttributes(imagenetTitle, { opacity: (appear(time, at.imagenet) * (1 - zoom)).toFixed(3) });

    const mosaicIn = appear(time, at.scale + .2, 1);
    const colored = time >= at.categories;
    cells.forEach(({ rect, labeledAt, hidden, category }) => {
      const labeled = time >= labeledAt;
      setAttributes(rect, {
        opacity: hidden ? 0 : mosaicIn.toFixed(3),
        class: labeled ? (colored ? `labeled c${category}` : 'labeled') : '',
      });
    });

    const studentsIn = appear(time, at.students) * (1 - appear(time, at.crowd - .4, .5));
    setAttributes(students, { opacity: studentsIn.toFixed(3) });
    setAttributes(studentsLabel, { opacity: studentsIn.toFixed(3) });
    crowdPeople.forEach(({ node, at: personAt }) => setAttributes(node, { opacity: appear(time, personAt, .3).toFixed(3) }));
    setAttributes(crowdLabel, { opacity: appear(time, at.crowd + .4).toFixed(3) });

    setAttributes(task, { opacity: (appear(time, at.question) * (1 - appear(time, at.contest, .5))).toFixed(3) });
    setAttributes(yes, { class: time >= at.answer ? 'imagenet-button pressed' : 'imagenet-button' });
    setAttributes(count, { opacity: appear(time, at.tenMillion).toFixed(3) });
    setAttributes(categories, { opacity: appear(time, at.categories - .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: '이미지넷 · 이름표',
    start,
    end,
    chapters: [
      { time: at.scenes, title: '수없이 많은 장면' },
      { time: at.imagenet, title: '이미지넷' },
      { time: at.tags, title: '사물마다 이름표' },
      { time: at.scale, title: '상상을 넘는 규모' },
      { time: at.crowd, title: '전 세계에 나눠 맡기기' },
      { time: at.tenMillion, title: '천만 장 넘게' },
      { time: at.categories, title: '천 가지 사물' },
    ],
  };
};
