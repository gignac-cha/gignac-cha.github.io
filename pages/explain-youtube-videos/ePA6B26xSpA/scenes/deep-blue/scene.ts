import './deep-blue.scss';
import { appear, createDiagram, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 14:46 "작은 반전" ~ 15:28 "그 벽을 넘은 건 결국 신경망".
const start = 886.4;
const end = 928.867;
const at = {
  grow: 890.4,
  explode: 893.5,
  rules: 896.7,
  evaluate: 897.4,
  sweep: 900,
  sweepEnd: 903.6,
  choose: 903.8,
  chessOnly: 905.5,
  searchMachine: 913.6,
  go: 922.2,
};

const root = { x: 550, y: 196 };
const levels = [
  { count: 4, y: 350, radius: 13 },
  { count: 12, y: 485, radius: 9 },
  { count: 36, y: 610, radius: 7 },
  { count: 72, y: 725, radius: 5.5 },
];
const left = 100;
const span = 900;
const best = 41;

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

interface Node {
  x: number;
  y: number;
  parent?: Node;
  edge?: SVGLineElement;
  dot: SVGCircleElement;
  level: number;
}

export const createDeepBlueScene = (): Scene => {
  const { element, root: canvas } = createDiagram('deep-blue', '딥블루의 탐색');

  const fan = svg('g', { class: 'deep-blue-fan' }, canvas);
  const fanLines = Array.from({ length: 220 }, (_, i) => {
    const x = lerp(-320, 1040, random(i * 3 + 1));
    const y = lerp(380, 900, random(i * 7 + 2));
    return { x, y, line: svg('line', { x1: root.x, y1: root.y, x2: root.x, y2: root.y }, fan), delay: random(i * 11 + 5) * 2.6 };
  });

  const tree = svg('g', { class: 'deep-blue-tree' }, canvas);
  const edges = svg('g', {}, tree);
  const dots = svg('g', {}, tree);
  const nodes: Node[][] = [];
  levels.forEach(({ count, y, radius }, level) => {
    nodes.push(Array.from({ length: count }, (_, i) => {
      const x = left + ((i + .5) * span) / count;
      const parent = level === 0 ? undefined : nodes[level - 1][Math.floor((i * nodes[level - 1].length) / count)];
      const edge = svg('line', { x1: parent?.x ?? root.x, y1: parent?.y ?? root.y, x2: x, y2: y }, edges);
      const dot = svg('circle', { cx: x, cy: y, r: radius, class: 'deep-blue-node' }, dots);
      return { x, y, parent, edge, dot, level };
    }));
  });
  const leaves = nodes[3];
  const pathTo = (leaf: Node) => {
    const path: Node[] = [];
    for (let node: Node | undefined = leaf; node; node = node.parent) {
      path.push(node);
    }
    return path;
  };
  const bestPath = new Set(pathTo(leaves[best]));
  const bestLabel = text(canvas, leaves[best].x, 790, '최선의 수', { class: 'deep-blue-best' });

  // 뿌리: 지금의 판. 체스판이 바둑판으로 바뀐다.
  const board = svg('g', { transform: `translate(${root.x - 52} ${root.y - 52})` }, canvas);
  const chess = svg('g', { class: 'deep-blue-chess' }, board);
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      svg('rect', { x: column * 13, y: row * 13, width: 13, height: 13, class: (row + column) % 2 ? 'dark' : 'light' }, chess);
    }
  }
  const go = svg('g', { class: 'deep-blue-go' }, board);
  svg('rect', { x: -2, y: -2, width: 108, height: 108, rx: 4, class: 'deep-blue-go-board' }, go);
  for (let i = 0; i < 19; i++) {
    const p = 4 + (i * 96) / 18;
    svg('line', { x1: 4, y1: p, x2: 100, y2: p }, go);
    svg('line', { x1: p, y1: 4, x2: p, y2: 100 }, go);
  }
  for (let i = 0; i < 26; i++) {
    const p = (n: number) => 4 + (Math.floor(random(n) * 19) * 96) / 18;
    svg('circle', { cx: p(i * 5 + 1), cy: p(i * 5 + 3), r: 2.6, class: i % 2 ? 'white' : 'black' }, go);
  }
  const machine = text(canvas, root.x + 82, root.y + 10, '탐색 기계', { class: 'deep-blue-machine' });

  // 오른쪽: 사실 패널.
  const speed = svg('g', { class: 'deep-blue-panel' }, canvas);
  text(speed, 1110, 250, '1초에', { class: 'deep-blue-small' });
  text(speed, 1110, 322, '수억 개의 수', { class: 'deep-blue-big' });
  text(speed, 1110, 370, '끝까지 따져 본다', { class: 'deep-blue-small' });

  const rules = svg('g', { class: 'deep-blue-panel' }, canvas);
  svg('rect', { x: 1110, y: 440, width: 400, height: 250, rx: 18, class: 'deep-blue-card' }, rules);
  text(rules, 1142, 496, '사람이 넣은 규칙', { class: 'deep-blue-card-title' });
  ['기물의 가치', '킹의 안전', '중앙 장악'].forEach((rule, i) => text(rules, 1142, 556 + i * 46, `· ${rule}`, { class: 'deep-blue-rule' }));

  const cat = svg('g', { class: 'deep-blue-panel' }, canvas);
  svg('rect', { x: 1110, y: 440, width: 400, height: 250, rx: 18, class: 'deep-blue-card' }, cat);
  text(cat, 1310, 590, '🐈', { class: 'deep-blue-cat' });
  svg('circle', { cx: 1452, cy: 486, r: 26, class: 'deep-blue-fail' }, cat);
  svg('path', { d: 'M1441 475 L1463 497 M1463 475 L1441 497', class: 'deep-blue-fail-mark' }, cat);
  text(cat, 1310, 740, '고양이 사진은 못 알아봄', { class: 'deep-blue-small deep-blue-center' });

  const tooMany = svg('g', { class: 'deep-blue-panel' }, canvas);
  text(tooMany, 1110, 520, '바둑', { class: 'deep-blue-small' });
  text(tooMany, 1110, 592, '경우의 수가', { class: 'deep-blue-big deep-blue-warning' });
  text(tooMany, 1110, 664, '너무 많다', { class: 'deep-blue-big deep-blue-warning' });

  const update = (time: number) => {
    const goMode = appear(time, at.go, .8);
    const evaluated = time >= at.evaluate;
    const visited = Math.floor((time - at.sweep) / ((at.sweepEnd - at.sweep) / leaves.length));
    const sweeping = time >= at.sweep && time < at.sweepEnd;
    const chosen = time >= at.choose;
    const current = sweeping ? pathTo(leaves[Math.min(visited, leaves.length - 1)]) : [];

    levels.forEach((_, level) => {
      // 한 층씩 차례로 뻗어 나간다. 마지막 층은 "수억 개" 대목에서 터진다.
      const grow = level < 3 ? progress(time, at.grow + level * 1.03, 1) : progress(time, at.explode, 1.1);
      nodes[level].forEach((node, i) => {
        const p = Math.min(1, Math.max(0, grow * 1.4 - (i / nodes[level].length) * .4));
        const from = node.parent ?? root;
        const onPath = current.includes(node) || (chosen && bestPath.has(node));
        setAttributes(node.edge!, {
          x2: lerp(from.x, node.x, p).toFixed(1),
          y2: lerp(from.y, node.y, p).toFixed(1),
          class: onPath ? 'deep-blue-edge on' : chosen ? 'deep-blue-edge dim' : 'deep-blue-edge',
        });
        let state = '';
        if (level === 3 && evaluated) {
          const score = random(i + 17);
          const shown = time >= at.evaluate + (i / leaves.length) * 1.6;
          state = shown ? (score > .62 ? 'good' : score < .3 ? 'bad' : 'even') : '';
        }
        if (onPath) {
          state = 'on';
        } else if (chosen) {
          state += ' dim';
        }
        setAttributes(node.dot, { opacity: p > .98 ? 1 : 0, class: `deep-blue-node ${state}` });
      });
    });

    setAttributes(tree, { opacity: lerp(1, .18, goMode).toFixed(3) });
    setAttributes(bestLabel, { opacity: (appear(time, at.choose, .4) * (1 - goMode)).toFixed(3) });
    setAttributes(chess, { opacity: (1 - goMode).toFixed(3) });
    setAttributes(go, { opacity: goMode.toFixed(3) });
    setAttributes(machine, { opacity: (appear(time, at.searchMachine) * (1 - goMode)).toFixed(3) });

    fanLines.forEach(({ x, y, line, delay }) => {
      const p = progress(time, at.go + .6 + delay, .5);
      setAttributes(line, { x2: lerp(root.x, x, p).toFixed(1), y2: lerp(root.y, y, p).toFixed(1), opacity: p > 0 ? .55 : 0 });
    });

    setAttributes(speed, { opacity: (appear(time, at.explode) * lerp(1, .35, goMode)).toFixed(3) });
    setAttributes(rules, { opacity: (appear(time, at.rules) * (1 - appear(time, at.chessOnly, .4))).toFixed(3) });
    setAttributes(cat, { opacity: (appear(time, at.chessOnly + .3) * (1 - goMode)).toFixed(3) });
    setAttributes(tooMany, { opacity: appear(time, at.go + .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: '딥블루의 탐색',
    start,
    end,
    chapters: [
      { time: 888.1, title: '신경망이 아니었다' },
      { time: at.explode, title: '1초에 수억 개의 수' },
      { time: at.rules, title: '사람이 넣은 규칙' },
      { time: at.sweep, title: '모든 갈림길을 끝까지' },
      { time: at.chessOnly, title: '체스 말고는 못 함' },
      { time: at.go, title: '바둑에서 막힘' },
    ],
  };
};
