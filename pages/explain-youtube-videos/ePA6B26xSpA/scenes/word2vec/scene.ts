import './word2vec.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { withThree } from '../../../shared/three-scene.ts';
import { end, king, map, pixels, seoul, start, symbols, word } from './timing.ts';

// 단어 지도 위의 자리. 관계가 같은 방향으로 놓이도록 남자→여자 와 왕→여왕, 한국→일본 과 서울→도쿄 를 나란히 둔다.
const places: Record<string, [number, number]> = {
  사과: [300, 300], 배: [410, 360], 포도: [240, 420], 바나나: [380, 470],
  커피: [700, 290], 차: [800, 335], 우유: [690, 410],
  자동차: [1300, 760], 버스: [1410, 690], 자전거: [1180, 810],
  남자: [460, 760], 여자: [580, 650], 왕: [800, 780], 여왕: [920, 670],
  한국: [1060, 280], 일본: [1260, 230], 서울: [1120, 420], 도쿄: [1328, 378],
};
const fillOrder = ['포도', '바나나', '우유', '버스', '자전거', '남자', '여자', '왕', '여왕', '한국', '일본', '서울', '도쿄'];
// 지도가 나오기 전 번호표가 붙은 세 기호의 자리. Three.js 판은 이 자리에서 3D 좌표로 옮겨 간다.
export const triangle: Record<string, [number, number]> = { 사과: [520, 360], 배: [1080, 360], 자동차: [800, 700] };

const apple = ['..sg..', '.rrrr.', 'rrrrrr', 'rrrrrr', '.rrrr.', '..rr..'];
const brightness: Record<string, number> = { '.': 12, r: 186, g: 152, s: 71 };

const arrowPath = (x1: number, y1: number, x2: number, y2: number) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 20;
  const left = [x2 - head * Math.cos(angle - .45), y2 - head * Math.sin(angle - .45)];
  const right = [x2 - head * Math.cos(angle + .45), y2 - head * Math.sin(angle + .45)];
  const f = (n: number) => n.toFixed(1);
  return `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} M${f(left[0])} ${f(left[1])} L${f(x2)} ${f(y2)} L${f(right[0])} ${f(right[1])}`;
};

const createPixels = (root: SVGElement) => {
  const group = svg('g', {}, root);
  text(group, 428, 226, '사진', { class: 'word2vec-caption', 'text-anchor': 'middle' });
  const numbers: SVGTextElement[] = [];
  apple.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      svg('rect', { class: `word2vec-pixel word2vec-pixel-${cell === '.' ? 'empty' : cell}`, x: 200 + x * 76, y: 250 + y * 76, width: 74, height: 74, rx: 6 }, group);
      numbers.push(text(group, 237 + x * 76, 297 + y * 76, String(brightness[cell]), { class: `word2vec-number ${cell === '.' ? '' : 'on-color'}` }));
    }),
  );
  return { group, numbers };
};

const createWord = (root: SVGElement) => {
  const group = svg('g', {}, root);
  text(group, 1140, 300, '단어', { class: 'word2vec-caption', 'text-anchor': 'middle' });
  text(group, 1140, 420, '사과', { class: 'word2vec-big-word' });
  const codes = text(group, 1140, 490, '49324 · 44284', { class: 'word2vec-codes' });
  const codesLabel = text(group, 1140, 536, '글자 번호일 뿐', { class: 'word2vec-caption', 'text-anchor': 'middle' });
  const link = svg('path', { class: 'word2vec-no-link', d: 'M1010 400 L690 470' }, group);
  const cross = svg('g', { class: 'word2vec-cross', transform: 'translate(850 435)' }, group);
  svg('circle', { r: 26 }, cross);
  svg('path', { d: 'M-10 -10 L10 10 M10 -10 L-10 10' }, cross);
  return { group, codes, codesLabel, link, cross };
};

interface Point {
  group: SVGGElement;
  label: SVGTextElement;
  chip: SVGGElement;
}

const createPoint = (parent: SVGElement, name: string, id?: string): Point => {
  const group = svg('g', { class: 'word2vec-point' }, parent);
  const chip = svg('g', { class: 'word2vec-chip' }, group);
  svg('rect', { x: -86, y: -36, width: 172, height: 72, rx: 36 }, chip);
  text(chip, 0, 12, name, { class: 'word2vec-chip-label' });
  if (id) {
    text(chip, 0, 76, id, { class: 'word2vec-chip-id' });
  }
  svg('circle', { class: 'word2vec-dot', r: 9 }, group);
  // 화살표가 오른쪽으로 지나가는 단어는 라벨을 점 아래에 둔다.
  const below = name === '서울' || name === '한국';
  const label = text(group, below ? 0 : 18, below ? 46 : 11, name, { class: 'word2vec-label', 'text-anchor': below ? 'middle' : 'start' });
  return { group, label, chip };
};

// SVG 판. Three.js 판도 지도가 나오기 전(사진·기호·번호표)은 이 그림을 그대로 쓴다.
export const createWord2VecSVG = (): Scene => {
  const { element, root } = createDiagram('word2vec', '단어 좌표(Word2Vec)');

  const grid = svg('g', { class: 'word2vec-grid' }, root);
  for (let x = 100; x <= 1500; x += 100) {
    svg('line', { x1: x, y1: 180, x2: x, y2: 840 }, grid);
  }
  for (let y = 200; y <= 840; y += 80) {
    svg('line', { x1: 100, y1: y, x2: 1500, y2: y }, grid);
  }

  const photo = createPixels(root);
  const written = createWord(root);

  const unknownEdges = svg('g', { class: 'word2vec-unknown' }, root);
  const pairs: Array<[string, string]> = [['사과', '배'], ['사과', '자동차'], ['배', '자동차']];
  const questions = pairs.map(([a, b]) => {
    const [x1, y1] = triangle[a];
    const [x2, y2] = triangle[b];
    svg('line', { x1, y1, x2, y2 }, unknownEdges);
    const mark = svg('g', { transform: `translate(${(x1 + x2) / 2} ${(y1 + y2) / 2})` }, unknownEdges);
    svg('circle', { r: 26 }, mark);
    text(mark, 0, 11, '?');
    return mark;
  });

  const friendLines = svg('g', { class: 'word2vec-friend-lines' }, root);
  const friends = [
    { name: '컵', x: 900, y: 240 },
    { name: '마시다', x: 960, y: 400 },
    { name: '아침', x: 840, y: 480 },
  ].map((friend, index) => {
    const group = svg('g', { class: 'word2vec-friend', transform: `translate(${friend.x} ${friend.y})` }, root);
    svg('rect', { x: -70, y: -30, width: 140, height: 60, rx: 30 }, group);
    text(group, 0, 10, friend.name);
    return { ...friend, group, at: map.friends[index], coffeeLine: svg('line', {}, friendLines), teaLine: svg('line', {}, friendLines) };
  });

  const relations = svg('g', { class: 'word2vec-relations' }, root);
  const parallel = svg('path', { class: 'word2vec-parallel' }, relations);
  const arrows = {
    gender: svg('path', { class: 'word2vec-arrow reference' }, relations),
    king: svg('path', { class: 'word2vec-arrow result' }, relations),
    country: svg('path', { class: 'word2vec-arrow reference' }, relations),
    city: svg('path', { class: 'word2vec-arrow result' }, relations),
  };
  const targets = [svg('circle', { class: 'word2vec-target', r: 22 }, relations), svg('circle', { class: 'word2vec-target', r: 22 }, relations)];

  const ids: Record<string, string> = { 사과: '#1824', 배: '#3301', 자동차: '#907' };
  const points = Object.fromEntries(Object.keys(places).map((name) => [name, createPoint(root, name, ids[name])]));

  const formulas = [
    text(root, 800, 870, '왕 − 남자 + 여자 ≈ 여왕', { class: 'word2vec-formula' }),
    text(root, 800, 870, '서울 − 한국 + 일본 ≈ 도쿄', { class: 'word2vec-formula' }),
  ];

  const position = (name: string, time: number): [number, number] => {
    const [x, y] = places[name];
    if (name in triangle) {
      const [fx, fy] = triangle[name];
      const t = ease(progress(time, map.place, 1));
      return [lerp(fx, x, t), lerp(fy, y, t)];
    }
    if (name === '차') {
      const t = ease(progress(time, map.teaMove, 1.1));
      return [lerp(1010, x, t), lerp(560, y, t)];
    }
    return [x, y];
  };

  const shownAt = (name: string) => {
    if (name === '사과') return symbols.apple;
    if (name === '배') return symbols.pear;
    if (name === '자동차') return symbols.car;
    if (name === '커피') return map.coffee;
    if (name === '차') return map.tea;
    return map.fill + fillOrder.indexOf(name) * .18;
  };

  const draw = (path: SVGPathElement, from: string, to: string, origin: string | undefined, at: number, time: number) => {
    // origin 이 있으면 from→to 와 같은 방향의 화살표를 origin 에서 출발시킨다.
    const [fx, fy] = places[from];
    const [tx, ty] = places[to];
    const [ox, oy] = origin ? places[origin] : [fx, fy];
    const [dx, dy] = [tx - fx, ty - fy];
    const p = ease(progress(time, at, .7));
    setAttributes(path, { d: arrowPath(ox, oy, ox + dx * Math.max(p, .001), oy + dy * Math.max(p, .001)), opacity: (p > 0 ? 1 : 0).toString() });
  };

  const update = (time: number) => {
    const photoPhase = appear(time, pixels.show, .4) * (1 - appear(time, symbols.show, .5));
    setAttributes(photo.group, { opacity: photoPhase.toFixed(3) });
    const numbers = appear(time, pixels.numbers, .5);
    for (const number of photo.numbers) {
      setAttributes(number, { opacity: numbers.toFixed(3) });
    }
    setAttributes(written.group, { opacity: (appear(time, word.show, .4) * (1 - appear(time, symbols.show, .5))).toFixed(3) });
    setAttributes(written.codes, { opacity: appear(time, word.codes).toFixed(3) });
    setAttributes(written.codesLabel, { opacity: appear(time, word.codes + .4).toFixed(3) });
    setAttributes(written.link, { opacity: appear(time, word.noMeaning).toFixed(3) });
    setAttributes(written.cross, { opacity: appear(time, word.noMeaning + .3).toFixed(3) });

    const unknown = 1 - appear(time, map.show, .5);
    setAttributes(unknownEdges, { opacity: (appear(time, symbols.car, .5) * unknown).toFixed(3) });
    questions.forEach((mark, index) => setAttributes(mark, { opacity: appear(time, symbols.unknown + index * .2).toFixed(3) }));

    const onMap = appear(time, map.show, .6);
    setAttributes(grid, { opacity: onMap.toFixed(3) });

    for (const [name, point] of Object.entries(points)) {
      const [x, y] = position(name, time);
      const shown = appear(time, shownAt(name), .4);
      setAttributes(point.group, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: shown.toFixed(3) });
      // 지도가 나오기 전에는 번호표가 붙은 기호, 지도 위에서는 좌표 점으로 보인다.
      const asChip = name in triangle ? 1 - appear(time, map.place, .5) : 0;
      setAttributes(point.chip, { opacity: asChip.toFixed(3) });
      setAttributes(point.label, { opacity: (1 - asChip).toFixed(3) });
      setAttributes(point.group.querySelector('.word2vec-dot')!, { opacity: (1 - asChip).toFixed(3) });
    }

    const friendsGone = 1 - appear(time, map.fill, .6);
    friends.forEach((friend) => {
      const shown = appear(time, friend.at, .4) * friendsGone;
      setAttributes(friend.group, { opacity: shown.toFixed(3) });
      const [cx, cy] = position('커피', time);
      const [tx, ty] = position('차', time);
      setAttributes(friend.coffeeLine, { x1: cx, y1: cy, x2: friend.x, y2: friend.y, opacity: shown.toFixed(3) });
      setAttributes(friend.teaLine, {
        x1: tx.toFixed(1), y1: ty.toFixed(1), x2: friend.x, y2: friend.y,
        opacity: (appear(time, map.teaFriends, .4) * friendsGone).toFixed(3),
      });
    });

    const highlight = (name: string, kind: string, from: number) => points[name].group.classList.toggle(kind, time >= from);
    highlight('왕', 'focus', king.focus);
    highlight('남자', 'reference', king.minus);
    highlight('여자', 'reference', king.minus);
    highlight('여왕', 'hit', king.queen);
    highlight('서울', 'focus', seoul.focus);
    highlight('한국', 'reference', seoul.minus);
    highlight('일본', 'reference', seoul.minus);
    highlight('도쿄', 'hit', seoul.tokyo);

    draw(arrows.gender, '남자', '여자', undefined, king.minus, time);
    draw(arrows.king, '남자', '여자', '왕', king.plus, time);
    draw(arrows.country, '한국', '일본', undefined, seoul.minus, time);
    draw(arrows.city, '한국', '일본', '서울', seoul.plus, time);
    // 서울 이야기로 넘어가면 앞의 관계는 한 단계 흐리게 둔다.
    const earlier = 1 - appear(time, seoul.focus, .5) * .6;
    setAttributes(arrows.gender, { 'stroke-opacity': earlier.toFixed(3) });
    setAttributes(arrows.king, { 'stroke-opacity': earlier.toFixed(3) });

    const [mx, my] = places.남자;
    const [wx, wy] = places.여자;
    const [kx, ky] = places.왕;
    const [qx, qy] = [kx + wx - mx, ky + wy - my];
    setAttributes(parallel, { d: `M${mx} ${my} L${kx} ${ky} M${wx} ${wy} L${qx} ${qy}`, opacity: (appear(time, king.direction) * earlier).toFixed(3) });
    const [sx, sy] = places.서울;
    const [hx, hy] = places.한국;
    const [jx, jy] = places.일본;
    setAttributes(targets[0], { cx: qx, cy: qy, opacity: (appear(time, king.plus + .7, .3) * earlier).toFixed(3) });
    setAttributes(targets[1], { cx: sx + jx - hx, cy: sy + jy - hy, opacity: appear(time, seoul.plus + .7, .3).toFixed(3) });

    setAttributes(formulas[0], { opacity: (appear(time, king.queen) * (1 - appear(time, seoul.focus, .4))).toFixed(3) });
    setAttributes(formulas[1], { opacity: appear(time, seoul.tokyo).toFixed(3) });
  };

  return {
    element,
    update,
    title: '단어 좌표(Word2Vec)',
    start,
    end,
    chapters: [
      { time: pixels.show, title: '사진은 숫자' },
      { time: word.show, title: '단어는 기호' },
      { time: map.show, title: '단어를 좌표로' },
      { time: map.coffee, title: '어울리는 친구들' },
      { time: map.fill, title: '스스로 그린 지도' },
      { time: king.focus, title: '왕 − 남자 + 여자' },
      { time: seoul.focus, title: '서울 − 한국 + 일본' },
    ],
  };
};

// Three.js 판으로 보여 준다(shared/three-scene.ts). three.js 를 불러오기 전에는 SVG 판을 보여 준다.
export const createWord2VecScene = (): Scene =>
  withThree(createWord2VecSVG(), () => import('./three.ts').then(({ createWord2VecThree }) => createWord2VecThree));
