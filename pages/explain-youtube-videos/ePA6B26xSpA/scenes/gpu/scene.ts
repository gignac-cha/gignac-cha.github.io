import './gpu.scss';
import { appear, createDiagram, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';

// 16:46 "아이들이 즐기던 컴퓨터 게임" ~ 17:36 "게임용 칩이 인공지능의 엔진으로".
const start = 1006.633;
const end = 1056.367;
const at = {
  game: 1006.8,
  smooth: 1009.2,
  everyPixel: 1012.2,
  compare: 1016.8,
  cpu: 1018.6,
  parallel: 1021.6,
  professor: 1024.2,
  students: 1026.8,
  network: 1031.3,
  operations: 1034,
  cuda: 1037.8,
  faster: 1045.6,
  race: 1046.1,
  weeks: 1049.8,
  day: 1050.6,
  engine: 1052.5,
};

const columns = 40;
const rows = 22;
const pixel = 22;
const screen = { x: 360, y: 150 };

const chip = { x: 800, y: 180, columns: 20, rows: 12, pitch: 34 };

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

// 게임 한 장면의 색. 해가 움직이고 언덕이 흘러가므로 매 프레임 모든 점의 색이 다시 계산된다.
const shade = (x: number, y: number, frame: number) => {
  const u = x / columns;
  const v = y / rows;
  const sunX = .2 + ((frame * .05) % .7);
  const sun = Math.hypot((u - sunX) * 1.8, v - .32) < .12;
  const hill = .62 + .1 * Math.sin(u * 7 + frame * .9) + .05 * Math.sin(u * 17 - frame * 1.7);
  const far = .55 + .06 * Math.sin(u * 4 - frame * .4);
  if (sun) {
    return '#ffd75b';
  }
  if (v > hill) {
    const shadeValue = Math.round(lerp(140, 90, (v - hill) * 2));
    return `rgb(60, ${shadeValue}, 70)`;
  }
  if (v > far) {
    return '#3b5a6e';
  }
  const sky = Math.round(lerp(70, 150, v));
  return `rgb(${sky - 30}, ${sky}, ${Math.min(sky + 70, 230)})`;
};

const person = (parent: Element, x: number, y: number, size: number) => {
  svg('circle', { cx: x, cy: y - size * .32, r: size * .2 }, parent);
  svg('path', { d: `M${x - size * .3} ${y + size * .42} Q${x} ${y - size * .18} ${x + size * .3} ${y + size * .42} Z` }, parent);
};

export const createGpuScene = (): Scene => {
  const { element, root } = createDiagram('gpu', 'GPU 병렬 연산');

  // A. 게임 화면: 수많은 점의 색을 동시에.
  const monitor = svg('g', { class: 'gpu-monitor' }, root);
  svg('rect', { x: screen.x - 24, y: screen.y - 24, width: columns * pixel + 48, height: rows * pixel + 48, rx: 18, class: 'gpu-bezel' }, monitor);
  svg('path', { d: `M760 ${screen.y + rows * pixel + 24} L740 ${screen.y + rows * pixel + 84} H860 L840 ${screen.y + rows * pixel + 24}`, class: 'gpu-stand' }, monitor);
  const pixelGroup = svg('g', {}, monitor);
  const pixels = Array.from({ length: columns * rows }, (_, i) =>
    svg('rect', { x: screen.x + (i % columns) * pixel, y: screen.y + Math.floor(i / columns) * pixel, width: pixel - 2, height: pixel - 2, rx: 2 }, pixelGroup),
  );
  const flash = svg('g', { class: 'gpu-flash' }, monitor);
  pixels.forEach((_, i) =>
    svg('rect', { x: screen.x + (i % columns) * pixel, y: screen.y + Math.floor(i / columns) * pixel, width: pixel - 2, height: pixel - 2, rx: 2 }, flash),
  );
  const everyPixel = text(root, 800, 810, '점 하나하나의 색을 동시에 계산', { class: 'gpu-caption' });

  // B. CPU: 복잡한 일을 하나씩.
  const cpu = svg('g', { class: 'gpu-cpu' }, root);
  text(cpu, 340, 140, 'CPU', { class: 'gpu-heading' });
  const cpuSub = [
    text(cpu, 340, 186, '복잡한 일을 하나씩', { class: 'gpu-sub' }),
    text(cpu, 340, 186, '뛰어난 교수 한 명', { class: 'gpu-sub' }),
  ];
  const tasks = Array.from({ length: 6 }, (_, i) => svg('rect', { x: 166 + i * 60, y: 240, width: 48, height: 48, rx: 10, class: 'gpu-task' }, cpu));
  const core = svg('rect', { x: 200, y: 330, width: 280, height: 280, rx: 28, class: 'gpu-core' }, cpu);
  const professor = svg('g', { class: 'gpu-person' }, cpu);
  person(professor, 340, 480, 150);

  // C. 신경망: 곱셈과 덧셈.
  const network = svg('g', { class: 'gpu-network' }, root);
  const netLayers = [[300, 360, 420], [250, 330, 410, 490], [320, 420]];
  const netX = [190, 360, 530];
  netLayers.forEach((ys, layer) => {
    if (layer > 0) {
      netLayers[layer - 1].forEach((y1) => ys.forEach((y2) => svg('line', { x1: netX[layer - 1], y1, x2: netX[layer], y2, class: 'gpu-net-edge' }, network)));
    }
  });
  netLayers.forEach((ys, layer) => ys.forEach((y) => svg('circle', { cx: netX[layer], cy: y, r: 18, class: 'gpu-net-node' }, network)));
  text(network, 275, 330, '×', { class: 'gpu-op' });
  text(network, 445, 300, '×', { class: 'gpu-op' });
  text(network, 360, 345, '+', { class: 'gpu-op' });
  text(network, 360, 600, '곱셈 × 덧셈 +', { class: 'gpu-sub' });
  text(network, 360, 650, '어마어마하게 반복', { class: 'gpu-sub' });

  // GPU 칩: 단순한 계산을 하는 수천 개의 작은 코어.
  const gpu = svg('g', { class: 'gpu-chip' }, root);
  const chipWidth = chip.columns * chip.pitch;
  const chipHeight = chip.rows * chip.pitch;
  const frame = svg('rect', { x: chip.x - 20, y: chip.y - 20, width: chipWidth + 32, height: chipHeight + 32, rx: 20, class: 'gpu-frame' }, gpu);
  text(gpu, chip.x - 20, 140, 'GPU', { class: 'gpu-heading gpu-left' });
  const gpuSub = [
    text(gpu, chip.x + 116, 140, '단순한 계산 수천 개 동시에', { class: 'gpu-sub gpu-left' }),
    text(gpu, chip.x + 116, 140, '초등학생 수천 명', { class: 'gpu-sub gpu-left' }),
    text(gpu, chip.x + 116, 140, '게임용 칩 → AI 엔진', { class: 'gpu-sub gpu-left gpu-engine' }),
  ];
  const cells = svg('g', { class: 'gpu-cells' }, gpu);
  const people = svg('g', { class: 'gpu-person' }, gpu);
  for (let row = 0; row < chip.rows; row++) {
    for (let column = 0; column < chip.columns; column++) {
      const x = chip.x + column * chip.pitch;
      const y = chip.y + row * chip.pitch;
      svg('rect', { x, y, width: chip.pitch - 6, height: chip.pitch - 6, rx: 5 }, cells);
      person(people, x + (chip.pitch - 6) / 2, y + (chip.pitch - 6) / 2 + 1, 24);
    }
  }

  // 신경망에서 GPU 코어로 쏟아지는 곱셈·덧셈.
  const tokens = Array.from({ length: 28 }, (_, i) => {
    const target = Math.floor(random(i + 3) * chip.columns * chip.rows);
    return {
      node: text(root, 0, 0, i % 2 ? '×' : '+', { class: 'gpu-token' }),
      tx: chip.x + (target % chip.columns) * chip.pitch + 14,
      ty: chip.y + Math.floor(target / chip.columns) * chip.pitch + 24,
      sy: lerp(260, 500, random(i * 5 + 1)),
      offset: random(i * 7 + 2),
    };
  });

  const cuda = svg('g', { class: 'gpu-cuda' }, root);
  svg('path', { d: 'M560 380 H790', class: 'gpu-arrow' }, cuda);
  svg('path', { d: 'M772 366 L790 380 L772 394', class: 'gpu-arrow' }, cuda);
  svg('rect', { x: 600, y: 350, width: 150, height: 60, rx: 14, class: 'gpu-cuda-box' }, cuda);
  text(cuda, 675, 391, 'CUDA', { class: 'gpu-cuda-text' });
  text(cuda, 675, 460, '다루기 쉽게', { class: 'gpu-sub' });

  // E. 같은 학습, 기존 vs GPU.
  const race = svg('g', { class: 'gpu-race' }, root);
  const track = { x: 330, width: 1100 };
  const lanes = [
    { y: 735, name: '기존', duration: 40, label: '몇 주', at: at.weeks },
    { y: 815, name: 'GPU', duration: 1.6, label: '하루', at: at.day },
  ].map(({ y, name, duration, label, at: labelAt }) => {
    text(race, 140, y + 12, name, { class: 'gpu-lane-name' });
    svg('rect', { x: track.x, y: y - 16, width: track.width, height: 32, rx: 16, class: 'gpu-track' }, race);
    const bar = svg('rect', { x: track.x, y: y - 16, width: 0, height: 32, rx: 16, class: `gpu-bar ${name === 'GPU' ? 'fast' : ''}` }, race);
    const finish = text(race, track.x + track.width + 20, y + 11, label, { class: 'gpu-lane-label' });
    return { bar, duration, finish, labelAt };
  });
  const times = text(race, track.x + track.width, 690, '수십 배 빠르게', { class: 'gpu-faster' });

  const update = (time: number) => {
    // A. 게임 화면
    const gameIn = appear(time, at.game, .5);
    const gameOut = appear(time, at.compare - .2, .5);
    setAttributes(monitor, { opacity: (gameIn * (1 - gameOut)).toFixed(3) });
    if (gameOut < 1) {
      const frameIndex = Math.floor(Math.max(time - at.game, 0) * (time >= at.smooth ? 12 : 0)) / 12;
      pixels.forEach((rect, i) => setAttributes(rect, { fill: shade(i % columns, Math.floor(i / columns), frameIndex) }));
    }
    const pulse = time >= at.everyPixel && time < at.compare ? Math.max(0, Math.sin((time - at.everyPixel) * Math.PI * 2.4)) : 0;
    setAttributes(flash, { opacity: (pulse * .55).toFixed(3) });
    setAttributes(everyPixel, { opacity: (appear(time, at.everyPixel) * (1 - gameOut)).toFixed(3) });

    // B. CPU
    const cpuIn = appear(time, at.cpu, .5);
    const networkIn = appear(time, at.network, .6);
    setAttributes(cpu, { opacity: (cpuIn * (1 - networkIn)).toFixed(3) });
    const busy = Math.floor((time - at.cpu) / .8);
    tasks.forEach((task, i) => setAttributes(task, { class: busy % 7 === i ? 'gpu-task active' : busy % 7 > i ? 'gpu-task done' : 'gpu-task' }));
    setAttributes(core, { class: busy >= 0 && busy % 7 < 6 ? 'gpu-core active' : 'gpu-core' });
    const professorIn = appear(time, at.professor);
    setAttributes(professor, { opacity: professorIn.toFixed(3) });
    setAttributes(cpuSub[0], { opacity: (1 - professorIn).toFixed(3) });
    setAttributes(cpuSub[1], { opacity: professorIn.toFixed(3) });

    // GPU 칩
    const gpuIn = appear(time, at.compare, .6);
    const raceIn = appear(time, at.faster, .6);
    setAttributes(gpu, { opacity: gpuIn.toFixed(3) });
    const studentsIn = appear(time, at.students);
    const engine = appear(time, at.engine, .6);
    setAttributes(people, { opacity: (studentsIn * (1 - networkIn * .7)).toFixed(3) });
    setAttributes(gpuSub[0], { opacity: (1 - studentsIn).toFixed(3) });
    setAttributes(gpuSub[1], { opacity: (studentsIn * (1 - engine)).toFixed(3) });
    setAttributes(gpuSub[2], { opacity: engine.toFixed(3) });
    // 모든 코어가 같은 순간에 함께 켜진다.
    const together = time >= at.parallel && Math.sin((time - at.parallel) * Math.PI * 3) > 0;
    const crunching = time >= at.operations && time < at.faster + 1;
    setAttributes(cells, { class: together || crunching ? 'gpu-cells lit' : 'gpu-cells' });
    setAttributes(frame, { class: engine > 0 ? 'gpu-frame engine' : 'gpu-frame' });

    // C. 신경망
    setAttributes(network, { opacity: (networkIn * (1 - raceIn)).toFixed(3) });
    tokens.forEach(({ node, tx, ty, sy, offset }) => {
      if (time < at.operations || time >= at.faster) {
        setAttributes(node, { opacity: 0 });
        return;
      }
      const phase = (((time - at.operations) * 1.4 + offset) % 1 + 1) % 1;
      setAttributes(node, {
        x: lerp(560, tx, phase).toFixed(1),
        y: lerp(sy, ty, phase).toFixed(1),
        opacity: (Math.sin(phase * Math.PI) * appear(time, at.operations, .4)).toFixed(3),
      });
    });
    setAttributes(cuda, { opacity: (appear(time, at.cuda) * (1 - raceIn)).toFixed(3) });

    // E. 경주
    setAttributes(race, { opacity: raceIn.toFixed(3) });
    lanes.forEach(({ bar, duration, finish, labelAt }) => {
      setAttributes(bar, { width: (progress(time, at.race, duration) * track.width).toFixed(1) });
      setAttributes(finish, { opacity: appear(time, labelAt, .4).toFixed(3) });
    });
    setAttributes(times, { opacity: appear(time, at.race + 1.6, .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: 'GPU 병렬 연산',
    start,
    end,
    chapters: [
      { time: at.smooth, title: '게임 화면' },
      { time: at.everyPixel, title: '점마다 동시에' },
      { time: at.compare, title: 'CPU와 GPU' },
      { time: at.professor, title: '교수 한 명 vs 초등학생 수천 명' },
      { time: at.network, title: '신경망 학습 = 곱셈·덧셈' },
      { time: at.cuda, title: 'CUDA' },
      { time: at.faster, title: '수십 배 빠르게' },
      { time: at.engine, title: 'AI 엔진' },
    ],
  };
};
