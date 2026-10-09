import './diffusion.scss';
import { appear, between, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';
import { withThree } from '../../../shared/three-scene';
import earthUrl from './earth.png';
import { diffusedAt, inkClock, inkParticles, inkPosition, surface, tank, unit } from './ink';
import { gaussian, paintStep } from './noise';
import { at, end, start } from './timing';

// 잉크 확산은 실제 브라운 운동(무작위 걸음)으로, 사진에 뿌리는 잡음은 DDPM 의 실제 잡음 일정으로 계산한다.
// 사진: 아폴로 17호가 찍은 지구(NASA, 퍼블릭 도메인)를 96×96 으로 줄였다.

// 사진을 잡음으로 바꿔 가는 사슬. 실제 DDPM 단계 번호(0 = 원래 사진, 1000 = 순수한 잡음).
const chain = [0, 100, 250, 400, 600, 1000];
const forwardAt = [at.photo, at.noise, at.noise + .6, at.noise + 1.2, at.noise + 1.8, at.noise + 2.5];
// 거꾸로: "한 겹씩"에서 한 단계, "여러 단계에 나눠 조금씩"에서 나머지를 차례로 걷어낸다.
const reverseAt = [at.steps + 1.5, at.steps + 1.0, at.steps + .5, at.steps, at.peel];
// DDPM 이 나온 뒤 한 번 더 처음부터 걷어낸다.
const replayAt = [at.ddpm + 2.6, at.ddpm + 2.1, at.ddpm + 1.6, at.ddpm + 1.1, at.ddpm + .6];
const FRAME = 190;
const frameX = (i: number) => 160 + i * 256;
const FRAME_TOP = 340;
const SIZE = 96;

// 대리석 덩어리 → 조각상(흉상). 같은 순서의 점끼리 섞어, 깎을수록 덩어리가 흉상 모양에 가까워진다.
// [흉상의 점, 덩어리의 점] (가로 110 × 세로 150, 왼쪽 위가 원점). 오른쪽 절반은 좌우를 뒤집어 만든다.
const bustLeft: Array<[[number, number], [number, number]]> = [
  [[0, 150], [0, 150]],
  [[0, 134], [0, 138]],
  [[12, 134], [0, 130]],
  [[12, 128], [0, 122]],
  [[14, 112], [0, 108]],
  [[20, 100], [0, 94]],
  [[32, 93], [0, 80]],
  [[44, 89], [0, 66]],
  [[46, 80], [0, 52]],
  [[44, 72], [0, 40]],
  [[36, 64], [0, 28]],
  [[32, 52], [0, 16]],
  [[31, 40], [0, 6]],
  [[34, 28], [0, 0]],
  [[42, 20], [24, 0]],
];
const bustPairs: Array<[[number, number], [number, number]]> = [
  ...bustLeft,
  [[55, 16], [55, 0]],
  ...bustLeft.slice().reverse().map(([[sx, sy], [bx, by]]): [[number, number], [number, number]] => [[110 - sx, sy], [110 - bx, by]]),
];
const BUST = { width: 110, height: 150, top: 632 };
// 깎은 정도 c(0 = 덩어리, 1 = 조각상)의 윤곽. 중간 단계에는 끌 자국처럼 면이 울퉁불퉁하다.
const carvedOutline = (c: number) =>
  bustPairs
    .map(([[sx, sy], [bx, by]], k) => {
      const rough = 5 * 4 * c * (1 - c) * (unit(k * 3 + 1) - .5);
      return `${(lerp(bx, sx, c) + rough).toFixed(1)},${(lerp(by, sy, c) + rough * .6).toFixed(1)}`;
    })
    .join(' ');
// 대리석: 오른쪽(덩어리)부터 왼쪽(조각상)으로, 잡음을 걷어내는 칸마다 한 번씩 끌로 깎아 낸다.
const carveAt = [2834.77, 2834.44, 2834.11, 2833.78, 2833.45, 2833.0];
const CHIPS = 7;

// SVG 판은 Three.js 판 안에 한 벌 더 만들어지므로, <defs> 의 id 가 겹치지 않게 판마다 번호를 붙인다.
let instances = 0;

// ink3d: true 면 수조와 잉크를 그리지 않는다(Three.js 판이 그 자리에 입체 수조를 얹는다). 글자와 되감기 표시는 그대로 둔다.
export const createDiffusionSvg = ({ ink3d = false } = {}): Scene => {
  const { element, root } = createDiagram('diffusion', '확산 모델');
  instances += 1;
  const id = (name: string) => `diffusion-${name}-${instances}`;
  const defs = svg('defs', {}, root);
  const blur = svg('filter', { id: id('ink-blur'), x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  // 갓 떨어진 잉크는 경계가 또렷하고, 번질수록 흐려진다(update 에서 stdDeviation 을 바꾼다).
  const blurAmount = svg('feGaussianBlur', { stdDeviation: 1.6 }, blur);
  const clip = svg('clipPath', { id: id('tank-clip') }, defs);
  svg('rect', { x: tank.left, y: surface, width: tank.right - tank.left, height: tank.bottom - surface, rx: 6 }, clip);
  const marbleFill = svg('linearGradient', { id: id('marble'), x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  svg('stop', { offset: 0, 'stop-color': '#f3f1ec' }, marbleFill);
  svg('stop', { offset: .55, 'stop-color': '#dedad2' }, marbleFill);
  svg('stop', { offset: 1, 'stop-color': '#b9b4aa' }, marbleFill);

  // 1) 물속에 퍼지는 잉크.
  const inkScene = svg('g', {}, root);
  const tankView = svg('g', { display: ink3d ? 'none' : 'inline' }, inkScene);
  svg('rect', { class: 'diffusion-water', x: tank.left, y: surface, width: tank.right - tank.left, height: tank.bottom - surface, rx: 6 }, tankView);
  const haze = svg('rect', { class: 'diffusion-haze', x: tank.left, y: surface, width: tank.right - tank.left, height: tank.bottom - surface, rx: 6 }, tankView);
  const inkLayer = svg('g', { 'clip-path': `url(#${id('tank-clip')})` }, tankView);
  const inkCloud = svg('g', { filter: `url(#${id('ink-blur')})` }, inkLayer);
  const particles = inkParticles.map(() => svg('circle', { class: 'diffusion-ink', r: 5 }, inkCloud));
  const ripple = svg('ellipse', { class: 'diffusion-ripple', cx: 800, cy: surface, rx: 0, ry: 0 }, tankView);
  svg('path', { class: 'diffusion-glass', d: `M ${tank.left} ${tank.top} V ${tank.bottom} H ${tank.right} V ${tank.top}` }, tankView);
  const dropShape = 'M 0 -26 C 9 -12 15 -4 15 6 A 15 15 0 0 1 -15 6 C -15 -4 -9 -12 0 -26 Z';
  const drop = svg('path', { class: 'diffusion-drop', d: dropShape }, tankView);
  // 거꾸로 돌려 다 모이면 다시 한 방울이 된다.
  const gatheredDrop = svg('path', { class: 'diffusion-drop', d: dropShape, transform: `translate(800 ${surface + 26})` }, tankView);
  const rewind = svg('g', { class: 'diffusion-rewind' }, inkScene);
  svg('path', { d: 'M 1200 455 l 26 -18 v 36 z M 1228 455 l 26 -18 v 36 z' }, rewind);
  text(rewind, 1228, 520, '거꾸로', { class: 'diffusion-rewind-label' });

  // 2) 사진 → 잡음, 잡음 → 사진 사슬.
  const chainScene = svg('g', {}, root);
  const forwardArrows = chain.slice(1).map((_, i) => {
    const group = svg('g', { class: 'diffusion-step diffusion-step-forward' }, chainScene);
    const x1 = frameX(i) + FRAME / 2 - 26;
    const x2 = frameX(i + 1) - FRAME / 2 + 26;
    svg('line', { x1, y1: 660, x2: x2 - 10, y2: 660 }, group);
    svg('path', { d: `M ${x2} 660 l -14 -8 v 16 z` }, group);
    return group;
  });
  const forwardCaption = text(chainScene, 800, 712, '잡음을 조금씩 더한다', { class: 'diffusion-arrow-caption' });
  const backwardArrows = chain.slice(1).map((_, i) => {
    const group = svg('g', { class: 'diffusion-step diffusion-step-backward' }, chainScene);
    const x1 = frameX(i + 1) - FRAME / 2 + 26;
    const x2 = frameX(i) + FRAME / 2 - 26;
    svg('line', { x1, y1: 308, x2: x2 + 10, y2: 308 }, group);
    svg('path', { d: `M ${x2} 308 l 14 -8 v 16 z` }, group);
    return group;
  });
  const backwardCaption = text(chainScene, 800, 268, '신경망: 잡음을 한 겹씩 걷어낸다', { class: 'diffusion-arrow-caption diffusion-arrow-caption-network' });

  const frames = chain.map((step) => {
    const group = svg('g', {}, chainScene);
    const border = svg('rect', { class: 'diffusion-frame', x: -FRAME / 2, y: 0, width: FRAME, height: FRAME, rx: 6 }, group);
    const picture = svg('image', { class: 'diffusion-picture', x: -FRAME / 2, y: 0, width: FRAME, height: FRAME, preserveAspectRatio: 'none' }, group);
    const label = text(group, 0, FRAME + 34, `t = ${step}`, { class: 'diffusion-step-label' });
    return { group, border, picture, label, shown: NaN };
  });
  const marble = text(chainScene, frameX(5), FRAME_TOP + FRAME + 72, '대리석 덩어리', { class: 'diffusion-metaphor' });
  const statue = text(chainScene, frameX(0), FRAME_TOP + FRAME + 72, '조각상', { class: 'diffusion-metaphor' });
  // 칸마다 아래에 대리석을 놓는다: 맨 오른쪽(순수한 잡음)은 덩어리, 왼쪽으로 갈수록 깎여 맨 왼쪽(사진)은 흉상.
  const sculpture = svg('g', {}, chainScene);
  const carvings = chain.map((_, i) => {
    const group = svg('g', { transform: `translate(${frameX(i) - BUST.width / 2} ${BUST.top})` }, sculpture);
    const clipPath = svg('clipPath', { id: id(`carve-${i}`) }, defs);
    const clipShape = svg('polygon', {}, clipPath);
    const stone = svg('polygon', { class: 'diffusion-marble', style: `fill: url(#${id('marble')})` }, group);
    const veins = svg('g', { 'clip-path': `url(#${id(`carve-${i}`)})` }, group);
    svg('path', { class: 'diffusion-marble-vein', d: 'M -6 34 C 28 52, 42 22, 66 62 S 96 104, 120 94' }, veins);
    svg('path', { class: 'diffusion-marble-vein diffusion-marble-vein-thin', d: 'M 8 152 C 24 120, 58 130, 68 98 S 92 72, 118 42' }, veins);
    const plinth = svg('line', { class: 'diffusion-marble-line', x1: 12, y1: 134, x2: 98, y2: 134 }, group);
    const chips = Array.from({ length: CHIPS }, () => svg('path', { class: 'diffusion-marble-chip', d: 'M 0 -6 L 6 3 L -5 4 Z' }, sculpture));
    return { group, clipShape, stone, plinth, chips, outline: '' };
  });
  // 끌: 덩어리에서 조각상 쪽으로 옮겨 가며 칸마다 한 번씩 내리친다.
  const chisel = svg('g', {}, sculpture);
  svg('rect', { class: 'diffusion-chisel-handle', x: -7, y: -70, width: 14, height: 44, rx: 5 }, chisel);
  svg('path', { class: 'diffusion-chisel-blade', d: 'M -5 -28 H 5 L 3 0 H -3 Z' }, chisel);
  const once = svg('g', { class: 'diffusion-once' }, chainScene);
  svg('path', { class: 'diffusion-once-arc', d: `M ${frameX(5)} ${FRAME_TOP - 8} C ${frameX(5) - 160} 40, ${frameX(0) + 160} 40, ${frameX(0) + 10} ${FRAME_TOP - 12}` }, once);
  svg('path', { class: 'diffusion-once-head', d: `M ${frameX(0) + 10} ${FRAME_TOP - 12} l 2 -20 l 14 12 z` }, once);
  text(once, 800, 96, '한 번에', { class: 'diffusion-once-label' });
  const cross = svg('g', { class: 'diffusion-cross' }, once);
  svg('line', { x1: 778, y1: 106, x2: 822, y2: 150 }, cross);
  svg('line', { x1: 822, y1: 106, x2: 778, y2: 150 }, cross);

  // 3) 빠진 조각: 그리는 손은 있는데 말을 알아듣는 귀가 없다.
  const missing = svg('g', {}, root);
  const prompt = svg('g', {}, missing);
  svg('rect', { class: 'diffusion-prompt', x: 560, y: 150, width: 480, height: 64, rx: 32 }, prompt);
  text(prompt, 800, 192, '“고양이를 그려 줘”', { class: 'diffusion-prompt-text' });
  const promptMark = text(missing, 1078, 196, '?', { class: 'diffusion-prompt-mark' });
  const hand = svg('g', {}, missing);
  svg('rect', { class: 'diffusion-chip diffusion-chip-ok', x: 470, y: 704, width: 300, height: 58, rx: 29 }, hand);
  text(hand, 620, 742, '그리는 손 ✓', { class: 'diffusion-chip-text' });
  const ear = svg('g', {}, missing);
  svg('rect', { class: 'diffusion-chip diffusion-chip-missing', x: 830, y: 704, width: 300, height: 58, rx: 29 }, ear);
  text(ear, 980, 742, '알아듣는 귀 ✕', { class: 'diffusion-chip-text' });

  const caption = createSwapText(root, 800, 830, { class: 'diffusion-caption' });
  const captions: Array<[number, string]> = [
    [at.physics, '물리학에서 온 아이디어'],
    [2798.1, '물속에 퍼지는 잉크 한 방울'],
    [2802.6, '천천히 번져 나간다'],
    [at.cloudy, '결국 물 전체가 뿌옇게'],
    [at.reverse, '이 과정을 거꾸로 돌린다면?'],
    [2811.5, '잉크 방울이 다시 모인다'],
    [at.photo, '이걸 그림에 적용하면'],
    [2815.4, '멀쩡한 사진에 잡음을 조금씩'],
    [at.static, '지지직 화면 (순수한 잡음)'],
    [at.network, '신경망에게 반대 과정을 가르친다'],
    [at.peel, '잡음을 한 겹씩 걷어낸다'],
    [at.once, '한 번에 다 걷지 않고'],
    [at.steps, '여러 단계에 나눠 조금씩'],
    [at.name, '확산 모델'],
    [at.marble, '대리석 덩어리에서 조각상을 깎아내듯'],
    [at.king, '그 시절 그림 생성의 왕은 GAN'],
    [at.ganSharp, 'GAN: 선명한 얼굴 사진'],
    [at.ganHard, '하지만 학습이 까다롭고 자주 삐걱'],
    [2851.2, '2020년의 반전'],
    [at.simple, '훨씬 단순하고 튼튼하게: DDPM'],
    [at.quality, '결과물이 GAN과 겨룰 만큼'],
    [at.missing, '아직 빠진 조각 하나'],
    [2865.1, '그림을 그리는 손은 생겼는데'],
    [at.speech, '말을 알아듣는 귀가 없었다'],
  ];
  const captionAt = (time: number) => {
    let current = '';
    for (const [time0, label] of captions) {
      if (time >= time0) {
        current = label;
      }
    }
    return current;
  };
  const note = createSwapText(root, 800, 872, { class: 'diffusion-note' });
  const noteAt = (time: number) =>
    time >= at.missing ? '' : time >= at.quality ? 'CIFAR-10 FID 3.17 · 낮을수록 진짜 같음, 당시 최고 기록' : time >= at.simple + .4 ? '학습 목표는 하나: 섞인 잡음을 맞혀라' : time >= at.steps ? 'DDPM은 1000단계로 나눈다' : '';

  // 사진과 잡음(ε): 사진은 불러온 뒤 −1~1 로 바꿔 둔다.
  const noise = gaussian(2020, SIZE * SIZE * 3);
  const pixels = new ImageData(SIZE, SIZE);
  // 단계마다 그린 그림을 PNG 로 바꿔 각 칸의 <image> 에 넣는다(바뀔 때만).
  const painter = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE }).getContext('2d')!;
  let photo: Float32Array | undefined;
  let lastTime = start;
  const image = new Image();
  image.src = earthUrl;
  image.decode().then(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, SIZE, SIZE);
    const data = context.getImageData(0, 0, SIZE, SIZE).data;
    photo = new Float32Array(SIZE * SIZE * 3);
    for (let p = 0, c = 0; p < data.length; p += 4, c += 3) {
      for (let k = 0; k < 3; k++) {
        photo[c + k] = (data[p + k] / 255) * 2 - 1;
      }
    }
    frames.forEach((frame) => (frame.shown = NaN));
    update(lastTime);
  });

  // i 번째 칸에 지금 보이는 단계 번호.
  // 앞으로: 앞 칸의 그림이 옮겨 와 잡음이 더해진다. 거꾸로: 한 단계 위(더 흐린) 그림에서 차례가 오면 걷어낸다.
  const stepShown = (time: number, i: number) => {
    if (time < at.backward || i === chain.length - 1) {
      return i === 0 ? 0 : lerp(chain[i - 1], chain[i], ease(progress(time, forwardAt[i] + .15, .55)));
    }
    const [from, peelAt] = time < at.ddpm ? [at.backward, reverseAt[i]] : [at.ddpm, replayAt[i]];
    const blurred = lerp(chain[i], chain[i + 1], ease(progress(time, from, .45)));
    return lerp(blurred, chain[i], ease(progress(time, peelAt, .45)));
  };

  const update = (time: number) => {
    lastTime = time;
    // 잉크.
    const inkShown = appear(time, at.physics, .6) * (1 - appear(time, at.picture, .6));
    setAttributes(inkScene, { opacity: inkShown.toFixed(3) });
    const landed = time >= at.land;
    const fall = progress(time, at.drop, at.land - at.drop);
    setAttributes(drop, {
      transform: `translate(800 ${lerp(200, surface + 6, fall * fall).toFixed(1)})`,
      opacity: (appear(time, at.ink, .4) * (landed ? 0 : 1)).toFixed(3),
    });
    const e = inkClock(time);
    const amount = diffusedAt(e);
    if (inkShown > 0 && landed && !ink3d) {
      // 진한 잉크는 작고 또렷한 점이 촘촘히 모여 있고, 번질수록 점이 커지고 흐려져 옅은 구름이 된다.
      const radius = (4.5 + 15 * Math.sqrt(amount)).toFixed(2);
      inkParticles.forEach((particle, p) => {
        const [x, y] = inkPosition(particle, e);
        setAttributes(particles[p], { cx: x.toFixed(1), cy: y.toFixed(1), r: radius });
      });
      setAttributes(blurAmount, { stdDeviation: (1.6 + 12 * Math.sqrt(amount)).toFixed(2) });
    }
    // 다시 다 모이면 잉크 구름 대신 한 방울로 바꿔 보여 준다.
    const regathered = appear(time, at.gather + at.gathered - .25, .25);
    setAttributes(inkCloud, { opacity: (landed ? lerp(.95, .5, amount) * (1 - regathered) : 0).toFixed(3) });
    setAttributes(gatheredDrop, { opacity: regathered.toFixed(3) });
    setAttributes(haze, { opacity: (landed ? .36 * amount ** 1.5 : 0).toFixed(3) });
    // 수면에 닿는 순간 퍼지는 물결.
    const wave = progress(e, 0, 1.1);
    setAttributes(ripple, {
      rx: (12 + 150 * ease(wave)).toFixed(1),
      ry: (3 + 9 * ease(wave)).toFixed(1),
      opacity: (landed && wave < 1 ? .8 * (1 - wave) * (1 - regathered) : 0).toFixed(3),
    });
    setAttributes(rewind, { opacity: (appear(time, at.reverse, .3) * (1 - appear(time, at.gather + at.gathered, .4))).toFixed(3) });

    // 사슬.
    const chainShown = appear(time, at.photo - .3, .6) * lerp(1, .5, appear(time, at.missing, .6));
    const resting = appear(time, at.rest, .8) * (1 - appear(time, at.turn, .6));
    setAttributes(chainScene, { opacity: (chainShown * lerp(1, .32, resting)).toFixed(3) });
    frames.forEach((frame, i) => {
      const enter = i === 0 ? appear(time, at.photo, .5) : appear(time, forwardAt[i], .3);
      const slide = i === 0 ? 1 : ease(progress(time, forwardAt[i], .45));
      const x = i === 0 ? frameX(0) : lerp(frameX(i - 1), frameX(i), slide);
      // 거꾸로 걷어낼 때: 아직 차례가 안 온 칸은 흐리게.
      const waiting = i < chain.length - 1 ? appear(time, at.backward, .5) * (1 - appear(time, reverseAt[i], .3)) : 0;
      const waitingAgain = i < chain.length - 1 ? appear(time, at.ddpm, .4) * (1 - appear(time, replayAt[i], .3)) : 0;
      setAttributes(frame.group, { transform: `translate(${x.toFixed(1)} ${FRAME_TOP})`, opacity: (enter * lerp(1, .16, Math.max(waiting, waitingAgain))).toFixed(3) });
      const active =
        (i < chain.length - 1 && (between(time, reverseAt[i], reverseAt[i] + .6) || between(time, replayAt[i], replayAt[i] + .6))) ||
        (i === chain.length - 1 && between(time, at.static, at.static + .9));
      frame.border.classList.toggle('diffusion-frame-active', active);
      frame.border.classList.toggle('diffusion-frame-done', i === 0 && time >= at.quality && time < at.missing);
      const step = stepShown(time, i);
      if (photo && !(Math.abs(step - frame.shown) <= .05)) {
        frame.shown = step;
        paintStep(pixels, photo, noise, step);
        painter.putImageData(pixels, 0, 0);
        frame.picture.setAttribute('href', painter.canvas.toDataURL());
      }
      setAttributes(frame.label, { opacity: appear(time, (i === 0 ? at.photo : forwardAt[i]) + .3, .3).toFixed(3) });
    });
    // 대리석을 깎는 동안에는 아래의 '잡음을 더한다' 화살표를 비켜 둔다.
    const sculpted = appear(time, at.marble - .4, .4) * (1 - appear(time, at.turn, .5));
    forwardArrows.forEach((arrow, i) => setAttributes(arrow, { opacity: (appear(time, forwardAt[i + 1], .3) * lerp(1, .35, appear(time, at.backward, .5)) * (1 - sculpted)).toFixed(3) }));
    setAttributes(forwardCaption, { opacity: (appear(time, at.noise, .4) * lerp(1, .35, appear(time, at.backward, .5)) * (1 - appear(time, at.missing, .4)) * (1 - sculpted)).toFixed(3) });
    setAttributes(sculpture, { opacity: sculpted.toFixed(3) });
    if (sculpted > 0) {
      carvings.forEach((carving, i) => {
        // 칸 i 의 목표(0 = 덩어리 … 1 = 조각상). 차례가 오면 바로 오른쪽 칸의 모양에서 시작해 끌질 한 번에 깎인다.
        const target = (chain.length - 1 - i) / (chain.length - 1);
        const before = Math.max(target - 1 / (chain.length - 1), 0);
        const cut = i === chain.length - 1 ? 1 : ease(progress(time, carveAt[i], .3));
        const outline = carvedOutline(lerp(before, target, cut));
        if (outline !== carving.outline) {
          carving.outline = outline;
          carving.stone.setAttribute('points', outline);
          carving.clipShape.setAttribute('points', outline);
        }
        setAttributes(carving.group, { opacity: appear(time, carveAt[i], i === chain.length - 1 ? .4 : .18).toFixed(3) });
        setAttributes(carving.plinth, { opacity: (i === 0 ? cut : 0).toFixed(3) });
        // 깎일 때 튀는 대리석 조각: 양옆으로 튀어 올랐다가 떨어지며 사라진다.
        carving.chips.forEach((chip, k) => {
          const age = time - carveAt[i];
          const flying = i < chain.length - 1 && age >= 0 && age <= .9;
          if (!flying) {
            setAttributes(chip, { opacity: 0 });
            return;
          }
          const side = k % 2 === 0 ? 1 : -1;
          const x0 = frameX(i) + side * (30 + 22 * unit(i * 31 + k));
          const y0 = BUST.top + 22 + 70 * unit(i * 31 + k + 7);
          const vx = side * (60 + 110 * unit(i * 31 + k + 13));
          const vy = -(90 + 140 * unit(i * 31 + k + 19));
          setAttributes(chip, {
            transform: `translate(${(x0 + vx * age).toFixed(1)} ${(y0 + vy * age + 450 * age * age).toFixed(1)}) rotate(${(side * age * 520).toFixed(0)}) scale(${(.7 + .6 * unit(i * 31 + k + 23)).toFixed(2)})`,
            opacity: (1 - age / .9).toFixed(3),
          });
        });
      });
      const first = carveAt[chain.length - 2];
      const last = carveAt[0];
      const travel = clamp((time - first) / (last - first));
      const lift = 12 * Math.abs(Math.sin((Math.PI * (time - first)) / (carveAt[chain.length - 3] - first)));
      setAttributes(chisel, {
        transform: `translate(${(lerp(frameX(chain.length - 2), frameX(0), travel) + 50).toFixed(1)} ${(BUST.top + 44 - lift).toFixed(1)}) rotate(32)`,
        opacity: (appear(time, first - .3, .2) * (1 - appear(time, last + .25, .3))).toFixed(3),
      });
    }
    backwardArrows.forEach((arrow, i) => {
      setAttributes(arrow, { opacity: appear(time, at.backward + (4 - i) * .08, .3).toFixed(3) });
      arrow.classList.toggle('diffusion-step-active', between(time, reverseAt[i], reverseAt[i] + .6) || between(time, replayAt[i], replayAt[i] + .6));
    });
    setAttributes(backwardCaption, { opacity: (appear(time, at.network, .4) * (1 - appear(time, at.missing, .4))).toFixed(3) });
    setAttributes(once, { opacity: (appear(time, at.once, .35) * (1 - appear(time, at.steps + .2, .4))).toFixed(3) });
    setAttributes(cross, { opacity: appear(time, at.notOnce, .2).toFixed(3) });
    setAttributes(marble, { opacity: (appear(time, at.marble, .4) * (1 - appear(time, at.turn, .5))).toFixed(3) });
    setAttributes(statue, { opacity: (appear(time, carveAt[0] + .1, .3) * (1 - appear(time, at.turn, .5))).toFixed(3) });

    // 빠진 조각.
    setAttributes(missing, { opacity: appear(time, at.missing, .5).toFixed(3) });
    setAttributes(prompt, { opacity: appear(time, at.speech, .4).toFixed(3) });
    setAttributes(promptMark, { opacity: appear(time, at.ear, .3).toFixed(3) });
    setAttributes(hand, { opacity: appear(time, at.hand, .4).toFixed(3) });
    setAttributes(ear, { opacity: appear(time, at.ear, .4).toFixed(3) });

    caption.update(time, captionAt);
    note.update(time, noteAt);
  };

  return {
    element,
    update,
    title: '확산 모델',
    start,
    end,
    chapters: [
      { time: 2797.8, title: '물속에 퍼지는 잉크' },
      { time: at.reverse, title: '거꾸로 돌리면' },
      { time: at.photo, title: '사진에 잡음 뿌리기' },
      { time: at.network, title: '신경망이 잡음을 걷어낸다' },
      { time: at.steps, title: '여러 단계로 조금씩' },
      { time: at.king, title: '그 시절의 왕, GAN' },
      { time: at.turn, title: 'DDPM' },
      { time: at.missing, title: '말을 알아듣는 귀' },
    ],
  };
};

export const createDiffusionScene = (): Scene =>
  withThree(createDiffusionSvg(), () => import('./three').then(({ createDiffusionThree }) => createDiffusionThree));
