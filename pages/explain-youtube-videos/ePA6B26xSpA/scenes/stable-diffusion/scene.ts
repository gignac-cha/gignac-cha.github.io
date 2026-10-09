import './stable-diffusion.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';

// 49:02 "스테빌리티 AI가 스테이블 디퓨전을 공개한 거예요" ~ 49:33 "주인공이 GAN에서 확산으로 바뀝니다".
const start = 2942.6;
const end = 2974.1;
const at = {
  open: 2944.8,
  download: 2945.6,
  edit: 2946.2,
  origin: 2948.4,
  secret: 2951.8,
  image: 2952.4,
  squeeze: 2952.8,
  latent: 2953.7,
  diffuse: 2954.2,
  decode: 2955.4,
  big: 2956.1,
  small: 2956.7,
  ratio: 2957.4,
  center: 2958.5,
  without: 2959.4,
  home: 2961.5,
  card: 2963.4,
  crowd: 2964.8,
  weeks: 2967.9,
  variants: [2968.4, 2968.8, 2969.2, 2969.5, 2969.8],
  lead: 2971.3,
  swap: 2973,
};

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

// 예시 그림(산과 해) 24×24 픽셀.
const side = 24;
const landscape = (x: number, y: number): [number, number, number] => {
  const sun = Math.hypot(x - 17, y - 6);
  const ridge = 13 + 3 * Math.sin(x * .55) + 2 * Math.sin(x * 1.3 + 1);
  const far = 11 + 2 * Math.sin(x * .35 + 2);
  if (y > 19) return [62 + y * 2, 140 - y, 70];
  if (y > ridge) return [70, 110 + (y - ridge) * 6, 82];
  if (y > far) return [96, 104, 140];
  if (sun < 3) return [255, 214, 92];
  return [70 + y * 5, 120 + y * 6, 210];
};
const pixel = (x: number, y: number) => landscape(Math.min(x, side - 1), Math.min(y, side - 1));
const rgb = ([r, g, b]: [number, number, number]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

// 요약본(8×8, 채널 4개): 3×3 칸 평균. 실제 잠재 공간처럼 색이 어긋난 흐릿한 축소판.
const latentSide = 8;
const latentColor = (x: number, y: number, channel: number): [number, number, number] => {
  let sum = [0, 0, 0];
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const [r, g, b] = pixel(x * 3 + dx, y * 3 + dy);
      sum = [sum[0] + r, sum[1] + g, sum[2] + b];
    }
  }
  const [r, g, b] = sum.map((v) => v / 9);
  const shifts: [number, number, number][] = [[g, b, r], [b * .8, r * .6, g], [r * .5, g * .9, b * .7], [b, g * .5, r * .8]];
  return shifts[channel];
};

// 잡음 양: 처음 0.45초 동안 잡음이 차오르고, 이어서 단계마다 한 칸씩 걷힌다.
const denoising = (noising: number, step: number, steps: number) => (noising < 1 ? ease(noising) : 1 - step / steps);

const big = { x: 160, y: 236, cell: 15 };
const latent = { x: 700, y: 356, cell: 15 };
const output = { x: 1080, y: 236, cell: 15 };
const imageSize = side * big.cell;
const latentSize = latentSide * latent.cell;

const arrow = (parent: Element, x1: number, y1: number, x2: number, y2: number) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 14;
  const f = (n: number) => n.toFixed(1);
  const left = [x2 - head * Math.cos(angle - .5), y2 - head * Math.sin(angle - .5)];
  const right = [x2 - head * Math.cos(angle + .5), y2 - head * Math.sin(angle + .5)];
  return svg('path', { class: 'sd-arrow', d: `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} M${f(left[0])} ${f(left[1])} L${f(x2)} ${f(y2)} L${f(right[0])} ${f(right[1])}` }, parent);
};

const person = (parent: Element, x: number, y: number, size: number) => {
  const group = svg('g', { class: 'sd-person' }, parent);
  svg('circle', { cx: x, cy: y - size * .32, r: size * .2 }, group);
  svg('path', { d: `M${x - size * .3} ${y + size * .42} Q${x} ${y - size * .18} ${x + size * .3} ${y + size * .42} Z` }, group);
  return group;
};

const fileCard = (parent: Element, x: number, y: number) => {
  const group = svg('g', { class: 'sd-file', transform: `translate(${x} ${y})` }, parent);
  svg('path', { d: 'M-70 -90 H40 L70 -60 V90 H-70 Z' }, group);
  svg('path', { d: 'M40 -90 V-60 H70', class: 'sd-file-fold' }, group);
  text(group, 0, -10, '모델', { class: 'sd-file-title' });
  text(group, 0, 26, '가중치 전체', { class: 'sd-file-sub' });
  return group;
};

export const createStableDiffusionScene = (): Scene => {
  const { element, root } = createDiagram('stable-diffusion', '스테이블 디퓨전(Stable Diffusion)');

  // 1) 공개: 모델 파일을 통째로 내려받아 고쳐 쓴다.
  const release = svg('g', {}, root);
  text(release, 800, 196, 'Stable Diffusion', { class: 'sd-heading' });
  text(release, 800, 238, '2022년 8월 · Stability AI 공개', { class: 'sd-caption', 'text-anchor': 'middle' });
  const download = svg('g', {}, release);
  fileCard(download, 520, 500);
  arrow(download, 640, 500, 900, 500);
  const bar = svg('rect', { x: 660, y: 540, height: 14, rx: 7, class: 'sd-bar' }, download);
  svg('rect', { x: 660, y: 540, width: 220, height: 14, rx: 7, class: 'sd-bar-track' }, download);
  download.append(bar);
  text(download, 770, 470, '누구나 내려받기', { class: 'sd-caption', 'text-anchor': 'middle' });
  const laptop = svg('g', { class: 'sd-laptop', transform: 'translate(1080 500)' }, download);
  svg('rect', { x: -120, y: -100, width: 240, height: 150, rx: 12 }, laptop);
  svg('path', { d: 'M-150 60 H150 L130 80 H-130 Z' }, laptop);
  text(laptop, 0, -10, '내 컴퓨터', { class: 'sd-file-sub' });
  const copy = svg('g', {}, laptop);
  svg('rect', { x: -48, y: 8, width: 96, height: 30, rx: 8, class: 'sd-chip' }, copy);
  text(copy, 0, 30, '모델', { class: 'sd-chip-text' });
  const edit = text(laptop, 0, 128, '✎ 고쳐 쓰기', { class: 'sd-edit' });
  const origin = text(release, 800, 720, '바탕 기술: 잠재 확산 모델 · 독일 LMU 뮌헨 연구팀(2021)', { class: 'sd-caption', 'text-anchor': 'middle' });

  // 2) 비결: 그림을 요약본으로 압축하고, 요약본 위에서 확산을 돌린다.
  const secret = svg('g', {}, root);
  text(secret, 800, 160, '비결 · 압축한 공간에서 확산', { class: 'sd-title' });
  const original = svg('g', {}, secret);
  const drawImage = (parent: Element, x0: number, y0: number) => {
    for (let k = 0; k < side * side; k++) {
      const x = k % side;
      const y = Math.floor(k / side);
      svg('rect', { x: x0 + x * big.cell, y: y0 + y * big.cell, width: big.cell + .4, height: big.cell + .4, fill: rgb(pixel(x, y)) }, parent);
    }
    svg('rect', { x: x0, y: y0, width: imageSize, height: imageSize, class: 'sd-frame' }, parent);
  };
  drawImage(original, big.x, big.y);
  // 압축: 원본의 복사본이 깔때기를 지나 요약본 크기로 줄어든다.
  const ghost = svg('g', {}, secret);
  drawImage(ghost, 0, 0);
  const encoder = svg('g', {}, secret);
  svg('path', { d: `M${big.x + imageSize + 20} ${big.y} L${latent.x - 30} ${latent.y} V${latent.y + latentSize} L${big.x + imageSize + 20} ${big.y + imageSize} Z`, class: 'sd-funnel' }, encoder);
  text(encoder, (big.x + imageSize + latent.x) / 2 - 5, big.y + imageSize / 2 + 10, '압축', { class: 'sd-funnel-text' });

  const summary = svg('g', {}, secret);
  const layers = [3, 2, 1, 0].map((channel) => {
    const offset = channel * 10;
    const layer = svg('g', { transform: `translate(${offset} ${-offset})` }, summary);
    const cells = Array.from({ length: latentSide * latentSide }, (_, k) => {
      const x = k % latentSide;
      const y = Math.floor(k / latentSide);
      return { rect: svg('rect', { x: latent.x + x * latent.cell, y: latent.y + y * latent.cell, width: latent.cell + .4, height: latent.cell + .4 }, layer), color: latentColor(x, y, channel), k };
    });
    svg('rect', { x: latent.x, y: latent.y, width: latentSize, height: latentSize, class: 'sd-frame' }, layer);
    return { channel, cells };
  });
  const loop = svg('g', { class: 'sd-loop' }, secret);
  const loopCenter = { x: latent.x + latentSize / 2 + 15, y: latent.y - 92 };
  const loopArc = svg('path', { d: `M${loopCenter.x - 46} ${loopCenter.y + 18} A50 50 0 1 1 ${loopCenter.x + 46} ${loopCenter.y + 18}` }, loop);
  svg('path', { d: `M${loopCenter.x + 34} ${loopCenter.y + 8} L${loopCenter.x + 46} ${loopCenter.y + 20} L${loopCenter.x + 58} ${loopCenter.y + 6}`, class: 'sd-loop-head' }, loop);
  text(loop, loopCenter.x, loopCenter.y + 10, '확산', { class: 'sd-loop-text' });
  const loopSpinner = svg('circle', { r: 7, class: 'sd-loop-dot' }, loop);

  const decoder = svg('g', {}, secret);
  svg('path', { d: `M${latent.x + latentSize + 60} ${latent.y} L${output.x - 20} ${output.y} V${output.y + imageSize} L${latent.x + latentSize + 60} ${latent.y + latentSize} Z`, class: 'sd-funnel' }, decoder);
  text(decoder, (latent.x + latentSize + 60 + output.x - 20) / 2 + 5, output.y + imageSize / 2 + 10, '복원', { class: 'sd-funnel-text' });
  const result = svg('g', {}, secret);
  drawImage(result, output.x, output.y);

  const bigLabel = svg('g', {}, secret);
  text(bigLabel, big.x + imageSize / 2, big.y + imageSize + 50, '원본 512×512×3', { class: 'sd-label' });
  text(bigLabel, big.x + imageSize / 2, big.y + imageSize + 92, '786,432개 숫자', { class: 'sd-number' });
  const smallLabel = svg('g', {}, secret);
  text(smallLabel, latent.x + latentSize / 2 + 15, latent.y + latentSize + 50, '요약본 64×64×4', { class: 'sd-label' });
  text(smallLabel, latent.x + latentSize / 2 + 15, latent.y + latentSize + 92, '16,384개 숫자', { class: 'sd-number accent' });
  const ratio = text(secret, latent.x + latentSize / 2 + 15, latent.y + latentSize + 136, '48분의 1', { class: 'sd-ratio' });
  const outLabel = text(secret, output.x + imageSize / 2, output.y + imageSize + 50, '그림 512×512', { class: 'sd-label' });

  // 3) 큰 데이터센터 없이, 게임용 그래픽 카드 한 장.
  const hardware = svg('g', {}, root);
  const datacenter = svg('g', { class: 'sd-datacenter' }, hardware);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const x = 180 + c * 84;
      const y = 300 + r * 120;
      svg('rect', { x, y, width: 70, height: 104, rx: 6 }, datacenter);
      for (let l = 0; l < 4; l++) {
        svg('circle', { cx: x + 14, cy: y + 18 + l * 22, r: 4, class: 'sd-led' }, datacenter);
      }
    }
  }
  text(hardware, 400, 700, '큰 데이터센터', { class: 'sd-label' });
  const cross = svg('g', { class: 'sd-cross' }, hardware);
  svg('path', { d: 'M150 270 L650 670 M650 270 L150 670' }, cross);
  const gpu = svg('g', { class: 'sd-gpu', transform: 'translate(1110 470)' }, hardware);
  svg('rect', { x: -230, y: -90, width: 460, height: 180, rx: 18 }, gpu);
  [-110, 110].forEach((x) => {
    svg('circle', { cx: x, cy: 0, r: 66, class: 'sd-fan' }, gpu);
    svg('circle', { cx: x, cy: 0, r: 16, class: 'sd-fan-hub' }, gpu);
  });
  svg('rect', { x: -160, y: 90, width: 250, height: 18, class: 'sd-pcie' }, gpu);
  const blades = [-110, 110].map((x) => svg('path', { class: 'sd-blades', d: Array.from({ length: 5 }, (_, i) => `M${x} 0 L${x + 58 * Math.cos((i * 2 * Math.PI) / 5)} ${58 * Math.sin((i * 2 * Math.PI) / 5)}`).join(' ') }, gpu));
  text(gpu, 0, 170, '집의 게임용 그래픽 카드 한 장', { class: 'sd-label' });
  const vram = text(hardware, 1110, 690, 'VRAM 10GB 미만에서 실행', { class: 'sd-number accent' });

  // 4) 전 세계가 달려들어 몇 주 만에 앱과 변형 모델이 쏟아진다.
  const spread = svg('g', {}, root);
  fileCard(spread, 800, 440);
  const people = Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + .2;
    const radius = 250 + (i % 2) * 50;
    const x = 800 + Math.cos(angle) * radius * 1.45;
    const y = 450 + Math.sin(angle) * radius * .82;
    const line = svg('line', { x1: 800, y1: 440, x2: x.toFixed(1), y2: y.toFixed(1), class: 'sd-spoke' }, spread);
    return { node: person(spread, x, y, 44), line, at: at.crowd + random(i * 5 + 1) * 1.6 };
  });
  spread.append(...people.map(({ node }) => node));
  const crowdLabel = text(spread, 800, 860, '전 세계 개발자 · 예술가', { class: 'sd-caption', 'text-anchor': 'middle' });
  const variantNames = ['웹 UI', '데스크톱 앱', '그림 도구 플러그인', '화풍 변형 모델', '내 사진으로 추가 학습'];
  const variantSpots = [[420, 250], [1180, 250], [330, 640], [1270, 640], [800, 760]];
  const variants = variantNames.map((name, i) => {
    const group = svg('g', { class: 'sd-variant', transform: `translate(${variantSpots[i][0]} ${variantSpots[i][1]})` }, spread);
    const width = name.length * 26 + 50;
    svg('rect', { x: -width / 2, y: -30, width, height: 60, rx: 30 }, group);
    text(group, 0, 10, name);
    return group;
  });

  // 5) 그림 생성의 주인공: GAN → 확산.
  const lead = svg('g', {}, root);
  text(lead, 800, 420, '그림 생성의 주인공', { class: 'sd-caption sd-lead-caption', 'text-anchor': 'middle' });
  const leader = createSwapText(lead, 800, 520, { class: 'sd-lead' });

  const update = (time: number) => {
    // 1) 공개.
    const releaseIn = appear(time, start, .4) * (1 - appear(time, at.secret - .3, .5));
    setAttributes(release, { opacity: releaseIn.toFixed(3) });
    setAttributes(download, { opacity: appear(time, at.open, .4).toFixed(3) });
    setAttributes(bar, { width: (220 * ease(progress(time, at.download, .9))).toFixed(1) });
    setAttributes(copy, { opacity: appear(time, at.download + .9, .3).toFixed(3) });
    setAttributes(edit, { opacity: appear(time, at.edit + .4, .4).toFixed(3) });
    setAttributes(origin, { opacity: appear(time, at.origin, .5).toFixed(3) });

    // 2) 비결.
    const secretIn = appear(time, at.secret - .1, .5) * (1 - appear(time, at.center - .2, .5));
    setAttributes(secret, { opacity: secretIn.toFixed(3) });
    setAttributes(original, { opacity: appear(time, at.image, .4).toFixed(3) });
    // 압축: 깔때기가 보이고, 원본의 복사본이 요약본 자리로 줄어들며 사라진다.
    const squeeze = ease(progress(time, at.squeeze, .9));
    setAttributes(encoder, { opacity: appear(time, at.squeeze, .4).toFixed(3) });
    const shrink = lerp(1, latentSize / imageSize, squeeze);
    setAttributes(ghost, {
      transform: `translate(${lerp(big.x, latent.x, squeeze).toFixed(1)} ${lerp(big.y, latent.y, squeeze).toFixed(1)}) scale(${shrink.toFixed(4)})`,
      opacity: time >= at.squeeze && squeeze < 1 ? (.85 * (1 - squeeze * squeeze)).toFixed(3) : 0,
    });
    // 크기 비교 때 원본은 흐리게.
    original.classList.toggle('faded', time >= at.small);

    const summaryIn = appear(time, at.latent - .3, .5);
    setAttributes(summary, { opacity: summaryIn.toFixed(3) });
    // 확산: 요약본이 잡음이 됐다가 한 단계씩 걷힌다.
    const steps = 10;
    const noising = progress(time, at.diffuse, .45);
    const denoise = progress(time, at.diffuse + .45, 1.1);
    const step = Math.floor(denoise * steps);
    const noiseAmount = time < at.diffuse ? 0 : denoising(noising, step, steps);
    for (const { channel, cells } of layers) {
      for (const { rect, color, k } of cells) {
        const n = 30 + random(k * 3.3 + channel * 11 + step * 7.1) * 200;
        const c: [number, number, number] = [lerp(color[0], n, noiseAmount), lerp(color[1], n * .95, noiseAmount), lerp(color[2], n * 1.05, noiseAmount)];
        setAttributes(rect, { fill: rgb(c) });
      }
    }
    setAttributes(loop, { opacity: appear(time, at.diffuse, .3).toFixed(3) });
    const spinning = progress(time, at.diffuse, 1.6);
    const angle = Math.PI * .8 - spinning * Math.PI * 2 * 2.2;
    setAttributes(loopSpinner, {
      cx: (loopCenter.x + 50 * Math.cos(angle)).toFixed(1),
      cy: (loopCenter.y + 50 * -Math.sin(angle)).toFixed(1),
      opacity: spinning > 0 && spinning < 1 ? 1 : 0,
    });
    loopArc.classList.toggle('active', spinning > 0 && spinning < 1);
    setAttributes(decoder, { opacity: appear(time, at.decode, .4).toFixed(3) });
    setAttributes(result, { opacity: appear(time, at.decode + .2, .5).toFixed(3) });
    setAttributes(outLabel, { opacity: appear(time, at.decode + .2, .5).toFixed(3) });
    setAttributes(bigLabel, { opacity: appear(time, at.big, .4).toFixed(3) });
    setAttributes(smallLabel, { opacity: appear(time, at.small, .4).toFixed(3) });
    setAttributes(ratio, { opacity: appear(time, at.ratio, .4).toFixed(3) });

    // 3) 하드웨어.
    const hardwareIn = appear(time, at.center - .1, .5) * (1 - appear(time, at.crowd - .3, .5));
    setAttributes(hardware, { opacity: hardwareIn.toFixed(3) });
    const crossed = appear(time, at.without, .4);
    setAttributes(cross, { opacity: crossed.toFixed(3) });
    datacenter.classList.toggle('off', time >= at.without);
    setAttributes(gpu, { opacity: appear(time, at.home, .5).toFixed(3) });
    const spin = Math.max(0, time - at.home) * 360 * 1.5;
    blades.forEach((blade, i) => setAttributes(blade, { transform: `rotate(${(spin % 360).toFixed(1)} ${i ? 110 : -110} 0)` }));
    setAttributes(vram, { opacity: appear(time, at.card, .4).toFixed(3) });

    // 4) 퍼져 나감.
    setAttributes(spread, { opacity: (appear(time, at.crowd - .2, .5) * (1 - appear(time, at.lead - .4, .5))).toFixed(3) });
    people.forEach(({ node, line, at: shownAt }) => {
      const shown = appear(time, shownAt, .4);
      setAttributes(node, { opacity: shown.toFixed(3) });
      setAttributes(line, { opacity: (shown * .5).toFixed(3) });
    });
    setAttributes(crowdLabel, { opacity: appear(time, at.crowd + .4, .4).toFixed(3) });
    variants.forEach((group, i) => {
      const pop = appear(time, at.variants[i], .35);
      const [x, y] = variantSpots[i];
      setAttributes(group, { opacity: pop.toFixed(3), transform: `translate(${x} ${y}) scale(${lerp(.7, 1, pop).toFixed(3)})` });
    });

    // 5) 주인공 교체.
    setAttributes(lead, { opacity: appear(time, at.lead - .2, .5).toFixed(3) });
    leader.update(time, (t) => (t < at.lead ? '' : t < at.swap ? 'GAN' : '확산 모델'));
    leader.toggleClass('diffusion', time >= at.swap);
  };

  return {
    element,
    update,
    title: '스테이블 디퓨전(Stable Diffusion)',
    start,
    end,
    chapters: [
      { time: start, title: '통째로 공개' },
      { time: at.secret, title: '압축한 공간에서 확산' },
      { time: at.center, title: '그래픽 카드 한 장' },
      { time: at.crowd, title: '쏟아진 앱과 변형 모델' },
      { time: at.lead, title: 'GAN에서 확산으로' },
    ],
  };
};
