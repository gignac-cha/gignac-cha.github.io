import './svm.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 7:55 "그 사이 강력한 경쟁자가 나타났습니다" ~ 8:15 "설명하기 어려웠거든요".
const start = 475.933;
const end = 495.567;
const pointsAt = 476.5;
const candidatesAt = [480.6, 481.0, 481.4];
const roadAt = 481.7;
const sidesAt = 482.3;
const supportAt = 482.8;
const testAt = 484.3;
const classifyAt = 485.4;
const fewAt = 486.6;
const compareAt = 488.6;
const chooseAt = 491.1;
const blackBoxAt = 492.3;

// 길(결정 경계)을 가로축으로 둔 좌표계. v < 0 은 파랑, v > 0 은 주황.
const angle = -22;
const margin = 72;
const blue: Array<[number, number]> = [[-260, -72], [150, -72], [-120, -150], [40, -210], [230, -170], [-330, -190], [-210, -260], [120, -270], [330, -110]];
const orange: Array<[number, number]> = [[-60, 72], [-280, 150], [-160, 240], [60, 170], [200, 120], [330, 210], [-20, 270], [150, 270], [-400, 95]];
const support = new Set(['-260,-72', '150,-72', '-60,72']);
const testPoint: [number, number] = [-200, 125];
const candidates = [
  { rotate: -14, offset: -15 },
  { rotate: 6, offset: -30 },
  { rotate: -8, offset: 25 },
];

const toScreen = ([u, v]: [number, number]) => {
  const radians = (angle * Math.PI) / 180;
  return [800 + u * Math.cos(radians) - v * Math.sin(radians), 470 + u * Math.sin(radians) + v * Math.cos(radians)];
};

export const createSvmScene = (): Scene => {
  const { element, root } = createDiagram('svm', '서포트 벡터 머신(SVM)');
  const defs = svg('defs', {}, root);
  const clip = svg('clipPath', { id: 'svm-clip' }, defs);
  svg('rect', { x: 230, y: 130, width: 1140, height: 680, rx: 24 }, clip);

  const stage = svg('g', {}, root);
  const plot = svg('g', { 'clip-path': 'url(#svm-clip)' }, stage);
  svg('rect', { class: 'svm-frame', x: 230, y: 130, width: 1140, height: 680, rx: 24 }, plot);
  const local = svg('g', { transform: `translate(800 470) rotate(${angle})` }, plot);
  const sideBlue = svg('rect', { class: 'svm-side svm-side-blue', x: -1200, y: -1200, width: 2400, height: 1200 }, local);
  const sideOrange = svg('rect', { class: 'svm-side svm-side-orange', x: -1200, y: 0, width: 2400, height: 1200 }, local);
  const road = svg('rect', { class: 'svm-road', x: -1200, width: 2400 }, local);
  const edgeTop = svg('line', { class: 'svm-edge', x1: -1200, x2: 1200 }, local);
  const edgeBottom = svg('line', { class: 'svm-edge', x1: -1200, x2: 1200 }, local);
  const boundary = svg('line', { class: 'svm-boundary', x1: -1200, x2: 1200, y1: 0, y2: 0 }, local);
  const roadLabel = text(local, -470, -14, '가장 넓은 길', { class: 'svm-road-label' });
  const candidateLines = candidates.map(({ rotate, offset }) =>
    svg('line', { class: 'svm-candidate', x1: -1200, x2: 1200, y1: 0, y2: 0, transform: `rotate(${rotate}) translate(0 ${offset})` }, local),
  );

  const points = [
    ...blue.map((point) => ({ point, kind: 'blue' })),
    ...orange.map((point) => ({ point, kind: 'orange' })),
  ].map(({ point, kind }, index) => {
    const isSupport = support.has(point.join(','));
    const ring = isSupport ? svg('circle', { class: 'svm-ring', cx: point[0], cy: point[1], r: 30 }, local) : undefined;
    const dot = svg('circle', { class: `svm-point svm-${kind}`, cx: point[0], cy: point[1], r: 15 }, local);
    return { dot, ring, isSupport, index };
  });
  const test = svg('circle', { class: 'svm-point svm-test', cx: testPoint[0], cy: testPoint[1], r: 15 }, local);
  const [testX, testY] = toScreen(testPoint);
  const testLabel = text(plot, testX + 34, testY + 10, '새 점', { class: 'svm-note' });

  const [supportX, supportY] = toScreen([150, -72]);
  const supportLabel = text(plot, supportX + 44, supportY - 30, '서포트 벡터', { class: 'svm-note svm-note-strong' });
  const fewLabel = text(stage, 800, 862, '길을 정하는 건 경계에 닿은 몇 점뿐', { class: 'svm-caption' });

  // 비교 단계: 오른쪽에 속을 알 수 없는 신경망.
  const network = svg('g', { class: 'svm-network' }, root);
  const layers = [[1080, [370, 430, 490, 550]], [1200, [340, 400, 460, 520, 580]], [1320, [430, 510]]] as const;
  for (let l = 0; l < layers.length - 1; l++) {
    const [x1, ys1] = layers[l];
    const [x2, ys2] = layers[l + 1];
    for (const y1 of ys1) {
      for (const y2 of ys2) {
        svg('line', { class: 'svm-network-edge', x1, y1, x2, y2 }, network);
      }
    }
  }
  for (const [x, ys] of layers) {
    for (const y of ys) {
      svg('circle', { class: 'svm-network-node', cx: x, cy: y, r: 13 }, network);
    }
  }
  const box = svg('g', { class: 'svm-box' }, network);
  svg('rect', { x: 1020, y: 300, width: 360, height: 320, rx: 22 }, box);
  text(box, 1200, 500, '?', { class: 'svm-box-mark' });
  text(network, 1200, 700, '신경망', { class: 'svm-compare-title' });
  const networkNote = text(network, 1200, 748, '왜 그런 답인지 안 보인다', { class: 'svm-compare-note' });
  const svmTitle = text(root, 470, 700, 'SVM', { class: 'svm-compare-title' });
  const svmNote = text(root, 470, 748, '왜 그렇게 갈랐는지 보인다', { class: 'svm-compare-note' });

  const update = (time: number) => {
    for (const { dot, ring, isSupport, index } of points) {
      const few = isSupport ? 1 : lerp(1, .22, appear(time, fewAt, .6));
      setAttributes(dot, { opacity: (appear(time, pointsAt + index * .06, .4) * few).toFixed(3) });
      if (ring) {
        setAttributes(ring, { opacity: appear(time, supportAt, .4).toFixed(3) });
      }
    }
    candidateLines.forEach((line, index) => {
      const at = candidatesAt[index];
      setAttributes(line, { opacity: (appear(time, at, .15) * (1 - appear(time, at + .45, .25))).toFixed(3) });
    });
    const width = margin * ease(progress(time, roadAt, .8));
    setAttributes(road, { y: -width, height: width * 2, opacity: width > 0 ? 1 : 0 });
    setAttributes(edgeTop, { y1: -width, y2: -width, opacity: width > 1 ? 1 : 0 });
    setAttributes(edgeBottom, { y1: width, y2: width, opacity: width > 1 ? 1 : 0 });
    setAttributes(boundary, { opacity: appear(time, roadAt, .4).toFixed(3) });
    setAttributes(roadLabel, { opacity: appear(time, roadAt + .6, .4).toFixed(3) });
    const sides = appear(time, sidesAt, .6);
    setAttributes(sideBlue, { opacity: sides.toFixed(3) });
    setAttributes(sideOrange, { opacity: sides.toFixed(3) });
    setAttributes(supportLabel, { opacity: (appear(time, supportAt, .4) * (1 - appear(time, compareAt, .3))).toFixed(3) });

    const drop = appear(time, testAt, .5);
    test.classList.toggle('svm-test-classified', time >= classifyAt);
    setAttributes(test, { opacity: drop.toFixed(3), cy: (testPoint[1] - (1 - drop) * 60).toFixed(1) });
    setAttributes(testLabel, { opacity: (drop * (1 - appear(time, fewAt, .4))).toFixed(3) });
    setAttributes(fewLabel, { opacity: (appear(time, fewAt + .3, .5) * (1 - appear(time, compareAt, .3))).toFixed(3) });

    // 비교: SVM 그림을 왼쪽으로 줄여 옮기고 오른쪽에 신경망을 놓는다.
    const compare = ease(progress(time, compareAt, .9));
    const scale = lerp(1, .56, compare);
    setAttributes(stage, { transform: `translate(${lerp(800, 470, compare).toFixed(1)} ${lerp(470, 420, compare).toFixed(1)}) scale(${scale.toFixed(3)}) translate(-800 -470)` });
    const compareOpacity = appear(time, compareAt + .4, .5).toFixed(3);
    setAttributes(network, { opacity: compareOpacity });
    setAttributes(svmTitle, { opacity: compareOpacity });
    setAttributes(svmNote, { opacity: compareOpacity });
    svmTitle.classList.toggle('svm-chosen', time >= chooseAt);
    setAttributes(box, { opacity: appear(time, blackBoxAt, .5).toFixed(3) });
    setAttributes(networkNote, { opacity: appear(time, blackBoxAt + .4, .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: '서포트 벡터 머신(SVM)',
    start,
    end,
    chapters: [
      { time: 478.4, title: '서포트 벡터 머신(SVM)' },
      { time: 480.6, title: '가장 넓은 길' },
      { time: testAt, title: '새 점도 바로 판정' },
      { time: fewAt, title: '적은 데이터로도' },
      { time: compareAt, title: '신경망 대신 SVM' },
      { time: blackBoxAt, title: '블랙박스' },
    ],
  };
};
