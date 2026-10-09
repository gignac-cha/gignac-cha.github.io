import './alphafold.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';
import { withThree } from '../../../shared/three-scene';
import { at, count, drugAtoms, end, mixRgb, phase, pocketCenter, rainbow, residueColors, residues, rgb, SCALE, start, truth as truthPositions, view } from './model';
import { drug, drugBonds, pocket, rmsd, sequence } from './protein';

// 45:26 "이번 상대는 바둑이 아니라 단백질" ~ 46:24 "AI가 과학의 한복판으로 걸어 들어간 순간이었습니다".
// 실제 단백질(사람 DHFR, PDB 1U72)과 실제 약(메토트렉세이트), 실제 알파폴드 예측(AlphaFold DB)을 그대로 그린다.
const elementClass: Record<string, string> = { C: 'af-atom-c', N: 'af-atom-n', O: 'af-atom-o' };

const formatCount = (value: number) => Math.round(value).toLocaleString('en-US');
const setText = (element: Element, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

// protein3d: Three.js 판이 단백질과 약을 입체로 그릴 때는 SVG 의 구슬·끈·약을 숨긴다(글자와 나머지는 그대로).
export const createAlphaFoldSvg = ({ protein3d = false } = {}): Scene => {
  const { element, root } = createDiagram('alphafold', '단백질 구조 예측(알파폴드)');
  const defs = svg('defs', {}, root);
  const blur = svg('filter', { id: 'af-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  svg('feGaussianBlur', { stdDeviation: 22 }, blur);

  const stage = svg('g', {}, root);
  const protein = svg('g', {}, stage);
  const pocketGlow = svg('circle', { class: 'af-pocket-glow', r: 70, filter: 'url(#af-glow)' }, protein);
  // 끈(α탄소를 잇는 굵은 선)은 먼 마디부터 그리고, 구슬은 그 위에 얹는다.
  const segmentLayer = svg('g', {}, protein);
  const segments = Array.from({ length: count - 1 }, () => svg('line', { class: 'af-segment' }, segmentLayer));
  const beadLayer = svg('g', {}, protein);
  const beads = Array.from({ length: count }, (_, i) => svg('circle', { class: 'af-bead', fill: rainbow(i) }, beadLayer));
  const truth = svg('polyline', { class: 'af-truth' }, protein);
  const pocketRings = pocket.map((i) => ({ i, ring: svg('circle', { class: 'af-pocket-ring', r: 11 }, protein) }));

  const medicine = svg('g', {}, stage);
  const bondLines = drugBonds.map(([a, b]) => ({ a, b, line: svg('line', { class: 'af-drug-bond' }, medicine) }));
  const atoms = drug.map(({ element: kind }) => svg('circle', { class: `af-atom ${elementClass[kind] ?? 'af-atom-c'}`, r: 6.5 }, medicine));
  const drugLabel = text(stage, 0, 0, '메토트렉세이트 (항암제)', { class: 'af-label af-label-drug' });
  const pocketLabel = text(stage, 0, 0, '주머니 = 열쇠 구멍', { class: 'af-label af-label-pocket' });

  // 서열(끈)과 물음표.
  const sequenceGroup = svg('g', {}, stage);
  text(sequenceGroup, 140, 318, '아미노산 서열 (끈)', { class: 'af-heading' });
  // 한 줄 27글자(약 450px)로 끊어 가운데 화살표(x 660~)와 넉넉히 떨어뜨린다.
  const perRow = 27;
  const lines = Array.from({ length: Math.ceil(count / perRow) }, (_, row) => {
    const line = text(sequenceGroup, 140, 362 + row * 38, '', { class: 'af-sequence' });
    for (let k = row * perRow; k < Math.min(count, (row + 1) * perRow); k++) {
      const letter = svg('tspan', { fill: rainbow(k) }, line);
      letter.textContent = sequence[k];
    }
    return line;
  });
  const structureHeading = text(stage, 1170, 250, '접힌 모양 (3차원 구조)', { class: 'af-heading af-heading-center' });
  const arrow = svg('g', {}, stage);
  svg('line', { class: 'af-arrow', x1: 660, y1: 470, x2: 905, y2: 470 }, arrow);
  svg('path', { class: 'af-arrow-head', d: 'M 905 470 l -18 -11 v 22 z' }, arrow);
  const question = text(stage, 782, 445, '?', { class: 'af-question' });
  const model = svg('g', {}, stage);
  svg('rect', { class: 'af-model', x: 690, y: 432, width: 186, height: 76, rx: 16 }, model);
  text(model, 783, 481, '알파폴드 2', { class: 'af-model-text' });

  const accuracy = text(stage, 1170, 700, `실험 구조와 평균 ${rmsd.toFixed(2)} Å 차이`, { class: 'af-accuracy' });
  const legend = svg('g', {}, stage);
  [[0, 83, 214], [101, 203, 243], [255, 219, 19], [255, 125, 69]].forEach((color, k) =>
    svg('circle', { cx: 1006 + k * 15, cy: 742, r: 6, fill: `rgb(${color.join(',')})` }, legend),
  );
  text(legend, 1062, 749, '알파폴드 예측 (색 = 확신도)', { class: 'af-legend' });
  svg('line', { class: 'af-truth-sample', x1: 1000, y1: 774, x2: 1050, y2: 774 }, legend);
  text(legend, 1062, 781, '실험으로 밝힌 구조', { class: 'af-legend' });
  const casp = text(stage, 800, 160, 'CASP14 전체 중앙값 GDT 92.4 · 90 이상이면 실험 수준', { class: 'af-note' });

  // 2억 개: 점 하나 = 구조 100만 개.
  const database = svg('g', {}, stage);
  const counter = text(database, 800, 224, '0', { class: 'af-counter' });
  const dots = Array.from({ length: 200 }, (_, k) => {
    const column = k % 20;
    const row = Math.floor(k / 20);
    const shade = (Math.sin(k * 12.9898) * 43758.5453) % 1;
    return svg('circle', { class: 'af-dot', cx: 420 + column * 40, cy: 290 + row * 38, r: 13, fill: `hsl(214, 85%, ${(46 + Math.abs(shade) * 18).toFixed(0)}%)` }, database);
  });
  text(database, 800, 700, '● 하나 = 단백질 구조 100만 개', { class: 'af-legend af-legend-center' });

  const source = text(root, 56, 868, '실제 구조: 사람 DHFR + 메토트렉세이트 (PDB 1U72)', { class: 'af-source' });
  const caption = createSwapText(root, 800, 832, { class: 'af-caption' });
  const captionAt = (time: number) => {
    const steps: Array<[number, string]> = [
      [at.protein, '단백질'],
      [at.machine, '몸속에서 일하는 작은 기계'],
      [at.beads, '아미노산 186개가 꿰어진 끈'],
      [at.fold, '저절로 접혀 정해진 모양이 된다'],
      [at.function, '그 모양이 곧 기능'],
      [at.medicine, '모양을 알면 약을 설계할 수 있다'],
      [at.lock, '열쇠 구멍에 꼭 맞는 열쇠'],
      [at.problem, '끈만 보고 접힌 모양을 맞히기는 어렵다'],
      [at.experiment, '실험으로는 구조 하나에 몇 년'],
      [at.decades, '반세기 가까이 풀지 못한 문제'],
      [at.contest, 'CASP14 · 2020년 말 단백질 구조 예측 대회'],
      [at.alphafold, '알파폴드 2'],
      [at.accuracy, '실험과 견줄 만한 정확도'],
      [at.count, '단백질 구조 2억 개 이상 공개'],
      [at.free, '전 세계 누구나 무료로'],
    ];
    let current = '';
    for (const [time0, label] of steps) {
      if (time >= time0) {
        current = label;
      }
    }
    return current;
  };

  if (protein3d) {
    for (const hidden of [segmentLayer, beadLayer, truth, medicine, ...pocketRings.map(({ ring }) => ring)]) {
      hidden.style.display = 'none';
    }
  }

  let order: number[] = [];
  const update = (time: number) => {
    const { cx, cy, scale } = view(time);
    const state = phase(time);
    const project = ([x, y]: [number, number, number]) => ({ x: cx + x * scale, y: cy - y * scale });
    setAttributes(protein, { opacity: state.shown.toFixed(3) });

    // 단백질(구슬과 끈). 모양을 모를 땐 흐리게, 알파폴드가 예측하면 확신도 색으로 칠한다.
    if (!protein3d && state.shown > 0) {
      const screen = residues(time).map(({ position, fold }) => ({ ...project(position), z: position[2], f: fold }));
      const colors = residueColors(time);
      const cues = screen.map(({ z, f }) => lerp(1, .4 + .6 * clamp((z + 22) / 44), f));
      const dim = lerp(1, .4, state.unknown);
      screen.forEach(({ x, y, f }, i) => {
        setAttributes(beads[i], {
          cx: x.toFixed(1),
          cy: y.toFixed(1),
          r: ((lerp(8, 3.6, f) * scale) / SCALE).toFixed(2),
          fill: rgb(colors[i]),
          opacity: (cues[i] * dim).toFixed(3),
        });
        if (i < count - 1) {
          const n = screen[i + 1];
          setAttributes(segments[i], {
            x1: x.toFixed(1),
            y1: y.toFixed(1),
            x2: n.x.toFixed(1),
            y2: n.y.toFixed(1),
            stroke: rgb(mixRgb(colors[i], colors[i + 1], .5)),
            'stroke-width': ((lerp(2.5, 7.5, f) * scale) / SCALE).toFixed(2),
            opacity: (((cues[i] + cues[i + 1]) / 2) * dim).toFixed(3),
          });
        }
      });
      // 깊이 순서(먼 것부터). 순서가 바뀔 때만 다시 붙인다.
      const next = screen.map((_, i) => i).sort((a, b) => screen[a].z - screen[b].z);
      if (next.some((value, k) => value !== order[k])) {
        order = next;
        for (const i of order) {
          beadLayer.append(beads[i]);
          if (i < count - 1) {
            segmentLayer.append(segments[i]);
          }
        }
      }
      for (const { i, ring } of pocketRings) {
        setAttributes(ring, { cx: screen[i].x.toFixed(1), cy: screen[i].y.toFixed(1), opacity: state.pocket.toFixed(3) });
      }

      // 실험 구조(정답)를 예측 위에 겹쳐 본다.
      const truthPoints = truthPositions(time).map((position) => {
        const { x, y } = project(position);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      setAttributes(truth, { points: truthPoints.join(' '), opacity: state.truth.toFixed(3) });

      const atomScreen = drugAtoms(time).map(project);
      setAttributes(medicine, { opacity: state.medicine.toFixed(3) });
      atoms.forEach((atom, k) => setAttributes(atom, { cx: atomScreen[k].x.toFixed(1), cy: atomScreen[k].y.toFixed(1) }));
      for (const { a, b, line } of bondLines) {
        setAttributes(line, { x1: atomScreen[a].x.toFixed(1), y1: atomScreen[a].y.toFixed(1), x2: atomScreen[b].x.toFixed(1), y2: atomScreen[b].y.toFixed(1) });
      }
    }

    // 주머니(열쇠 구멍)와 약 이름. Three.js 판은 입체 위치에 맞춰 이 자리를 다시 옮긴다.
    const pocketScreen = project(pocketCenter(time));
    setAttributes(pocketGlow, { cx: pocketScreen.x.toFixed(1), cy: pocketScreen.y.toFixed(1), opacity: (state.pocket * (.45 + .25 * appear(time, at.lock, .3) - .4 * appear(time, at.key + .9, .4))).toFixed(3) });
    setAttributes(pocketLabel, { x: (pocketScreen.x + 150).toFixed(1), y: (pocketScreen.y - 155).toFixed(1), opacity: (appear(time, at.lock, .4) * (1 - appear(time, at.problem - .6, .4))).toFixed(3) });
    const drugCentroid = drugAtoms(time).map(project).reduce((sum, { x, y }) => ({ x: sum.x + x / drug.length, y: sum.y + y / drug.length }), { x: 0, y: 0 });
    setAttributes(drugLabel, { x: drugCentroid.x.toFixed(1), y: (drugCentroid.y + 110).toFixed(1), opacity: (state.medicine * (1 - appear(time, at.key + .6, .4))).toFixed(3) });

    // 끈만 보고 → ? → 접힌 모양, 그리고 알파폴드.
    const problem = appear(time, at.problem, .5) * (1 - appear(time, at.released, .6));
    lines.forEach((line, row) => setAttributes(line, { opacity: (appear(time, at.problem + .2 + row * .08, .3) * problem).toFixed(3) }));
    setAttributes(sequenceGroup, { opacity: problem.toFixed(3) });
    setAttributes(structureHeading, { opacity: problem.toFixed(3) });
    setAttributes(arrow, { opacity: (appear(time, at.unknown - .3, .4) * problem).toFixed(3) });
    setAttributes(question, { opacity: (appear(time, at.unknown, .3) * (1 - appear(time, at.alphafold, .3)) * problem).toFixed(3) });
    setAttributes(model, { opacity: (appear(time, at.alphafold, .4) * problem).toFixed(3) });
    setAttributes(accuracy, { opacity: (appear(time, at.accuracy, .5) * problem).toFixed(3) });
    setAttributes(legend, { opacity: (appear(time, at.compare, .5) * problem).toFixed(3) });
    setAttributes(casp, { opacity: (appear(time, at.accuracy + .6, .5) * problem).toFixed(3) });

    // 2억 개 넘는 구조 공개.
    const released = appear(time, at.released + .3, .5);
    setAttributes(database, { opacity: released.toFixed(3) });
    dots.forEach((dot, k) => {
      const pop = appear(time, at.released + .4 + (k / dots.length) * 2.2, .3);
      setAttributes(dot, { opacity: pop.toFixed(3), r: (13 * (.4 + .6 * pop)).toFixed(2) });
    });
    const counted = ease(progress(time, at.count, 1.8)) * 200_000_000;
    setText(counter, `${formatCount(counted)}${time >= at.count + 1.8 ? '+' : ''}`);

    setText(source, time >= at.compare ? '예측: AlphaFold DB AF-P00374 · 실험: PDB 1U72 (사람 DHFR)' : '실제 구조: 사람 DHFR + 메토트렉세이트 (PDB 1U72)');
    setAttributes(source, { opacity: (appear(time, at.protein, .6) * (1 - appear(time, at.released, .5))).toFixed(3) });

    // 노벨상 이야기(인물)로 넘어가면 쉬게 둔다.
    setAttributes(stage, { opacity: lerp(1, .3, appear(time, at.rest, .8)).toFixed(3) });
    caption.update(time, captionAt);
  };

  return {
    element,
    update,
    title: '단백질 구조 예측(알파폴드)',
    start,
    end,
    chapters: [
      { time: at.protein, title: '단백질' },
      { time: at.string, title: '아미노산 구슬이 꿰어진 끈' },
      { time: at.fold, title: '저절로 접힌다' },
      { time: at.function, title: '모양이 기능을 정한다' },
      { time: at.lock, title: '열쇠 구멍과 열쇠' },
      { time: at.problem, title: '끈만 보고 모양 맞히기' },
      { time: at.contest, title: '구조 예측 대회 CASP14' },
      { time: at.alphafold, title: '알파폴드 2' },
      { time: at.released, title: '2억 개 구조 공개' },
    ],
  };
};

export const createAlphaFoldScene = (): Scene =>
  withThree(createAlphaFoldSvg(), () => import('./three').then(({ createAlphaFoldThree }) => createAlphaFoldThree));
