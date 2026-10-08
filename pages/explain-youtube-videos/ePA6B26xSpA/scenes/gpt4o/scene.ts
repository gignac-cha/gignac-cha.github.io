import './gpt4o.scss';
import { appear, between, createDiagram, lerp, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';

// 55:11 "2024년 5월 오픈AI는 GPT-4o를" ~ 55:33 "무료 사용자에게도 열렸어요".
// 예전 음성 모드의 세 모델 구성과 응답 시간(GPT-4 평균 5.4초, GPT-4o 평균 0.32초·최소 0.232초)은
// OpenAI 발표문 "Hello GPT-4o"(2024.5.13)에 적힌 그대로다.
const start = 3311.467;
const end = 3333.733;
const at = {
  name: 3312.6,
  // "o는 모든 것을 뜻하는 옴니에서 따온 글자예요"
  o: 3315.7,
  omni: 3316.4,
  // "말로 묻고, 카메라로 보여 주고, 곧바로 목소리로 대답했습니다"
  voice: 3319.0,
  camera: 3319.7,
  reply: 3321.0,
  // "예전에는 듣는 모델, 생각하는 모델, 말하는 모델이 따로 있었거든요"
  before: 3323.0,
  listen: 3323.6,
  think: 3324.2,
  speak: 3325.2,
  apart: 3326.4,
  // "GPT-4o는 이걸 하나의 모델로 합쳤습니다"
  merge: 3327.6,
  one: 3328.5,
  // "대답이 사람 대화처럼 빨라졌고 무료 사용자에게도 열렸어요"
  fast: 3330.2,
  human: 3330.6,
  free: 3332.1,
};

const band = { y: 410, height: 150 };
const merged = { x: 640, width: 320 };
const stages = [
  { title: '듣는 모델', sub: '음성 → 글', x: 330, at: at.listen },
  { title: '생각하는 모델', sub: '글 → 글 · GPT-4', x: 670, at: at.think },
  { title: '말하는 모델', sub: '글 → 음성', x: 1010, at: at.speak },
];
const stageWidth = 260;
const inputs = { x: 170, voice: 318, camera: 502 };
const output = { x: 1440, y: band.y };

// 응답 시간 막대: 0~6초.
const latency = { left: 470, right: 1400, max: 6, rows: [672, 748] };
const seconds = (value: number) => latency.left + (value / latency.max) * (latency.right - latency.left);

// 수평 접선의 곡선 위 한 점.
const curve = (x1: number, y1: number, x2: number, y2: number, t: number) => {
  const mx = (x1 + x2) / 2;
  const u = 1 - t;
  return {
    x: u ** 3 * x1 + 3 * u * u * t * mx + 3 * u * t * t * mx + t ** 3 * x2,
    y: u ** 3 * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y2,
  };
};
const curvePath = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  return `M${x1.toFixed(1)} ${y1} C ${mx.toFixed(1)} ${y1}, ${mx.toFixed(1)} ${y2}, ${x2.toFixed(1)} ${y2}`;
};

const microphone = (parent: Element, x: number, y: number) => {
  const group = svg('g', { transform: `translate(${x} ${y})` }, parent);
  svg('circle', { r: 46, class: 'omni-node' }, group);
  svg('rect', { x: -10, y: -26, width: 20, height: 34, rx: 10, class: 'omni-icon-fill' }, group);
  svg('path', { d: 'M-18 -2 a18 18 0 0 0 36 0 M0 16 V26 M-10 26 H10', class: 'omni-icon-line' }, group);
  return group;
};
const camera = (parent: Element, x: number, y: number) => {
  const group = svg('g', { transform: `translate(${x} ${y})` }, parent);
  svg('circle', { r: 46, class: 'omni-node' }, group);
  svg('rect', { x: -24, y: -15, width: 48, height: 32, rx: 6, class: 'omni-icon-line' }, group);
  svg('path', { d: 'M-10 -15 L-6 -22 H6 L10 -15', class: 'omni-icon-line' }, group);
  svg('circle', { cx: 0, cy: 1, r: 9, class: 'omni-icon-line' }, group);
  return group;
};
const speaker = (parent: Element, x: number, y: number) => {
  const group = svg('g', { transform: `translate(${x} ${y})` }, parent);
  svg('circle', { r: 46, class: 'omni-node' }, group);
  svg('path', { d: 'M-22 -9 H-12 L2 -21 V21 L-12 9 H-22 Z', class: 'omni-icon-fill' }, group);
  const waves = [10, 19].map((r) => svg('path', { d: `M${6 + r * .2} ${-r} a${r} ${r} 0 0 1 0 ${r * 2}`, class: 'omni-icon-line' }, group));
  return { group, waves };
};

export const createGpt4oScene = (): Scene => {
  const { element, root } = createDiagram('gpt4o', 'GPT-4o 옴니 모델');

  // 이름: "o" 는 omni.
  const nameGroup = svg('g', { opacity: 0 }, root);
  text(nameGroup, 812, 176, 'GPT-4', { class: 'omni-name' });
  const letter = text(nameGroup, 816, 176, 'o', { class: 'omni-name omni-letter' });
  text(nameGroup, 800, 216, '2024년 5월 · OpenAI', { class: 'omni-date' });
  const omniLine = svg('g', { opacity: 0 }, root);
  text(omniLine, 800, 262, 'o = omni(옴니) · 모든 것', { class: 'omni-meaning' });

  // 입력(말, 카메라)과 출력(목소리).
  const edges = svg('g', {}, root);
  const voiceEdge = svg('path', { class: 'omni-edge' }, edges);
  const cameraEdge = svg('path', { class: 'omni-edge' }, edges);
  const outputEdge = svg('path', { class: 'omni-edge' }, edges);
  const linkEdges = [0, 1].map(() => svg('path', { class: 'omni-edge' }, edges));
  const dots = svg('g', {}, root);
  const dotViews = Array.from({ length: 24 }, () => svg('circle', { r: 5, class: 'omni-dot', opacity: 0 }, dots));

  const voiceNode = microphone(root, inputs.x, inputs.voice);
  const voiceLabel = text(root, inputs.x, inputs.voice + 74, '말', { class: 'omni-node-label' });
  const voiceBars = [-24, -12, 0, 12, 24].map((dx) => svg('rect', { x: inputs.x - 64 + dx * .8 - 3 - 40, y: inputs.voice - 10, width: 6, height: 20, rx: 3, class: 'omni-wave' }, root));
  const cameraNode = camera(root, inputs.x, inputs.camera);
  const cameraLabel = text(root, inputs.x, inputs.camera + 74, '카메라', { class: 'omni-node-label' });
  const cameraOff = text(root, inputs.x + 34, inputs.camera - 30, '✕', { class: 'omni-off', opacity: 0 });
  const speakerView = speaker(root, output.x, output.y);
  const speakerLabel = text(root, output.x, output.y + 76, '목소리', { class: 'omni-node-label' });

  // 모델: 합쳐진 한 상자, 또는 따로 떨어진 세 상자.
  const boxes = stages.map(({ title, sub }) => {
    const group = svg('g', { opacity: 0 }, root);
    const box = svg('rect', { y: band.y - band.height / 2, height: band.height, rx: 22, class: 'omni-box' }, group);
    const titleView = text(group, 0, band.y - 6, title, { class: 'omni-box-title' });
    const subView = text(group, 0, band.y + 32, sub, { class: 'omni-box-sub' });
    return { group, box, titleView, subView };
  });
  const mergedLabel = svg('g', { opacity: 0 }, root);
  text(mergedLabel, merged.x + merged.width / 2, band.y + 4, 'GPT-4o', { class: 'omni-box-title omni-box-merged' });
  text(mergedLabel, merged.x + merged.width / 2, band.y + 44, '음성 · 영상 · 글을 한 번에', { class: 'omni-box-sub' });
  const textChips = [0, 1].map((i) => {
    const group = svg('g', { opacity: 0 }, root);
    const x = (stages[i].x + stageWidth + stages[i + 1].x) / 2;
    svg('rect', { x: x - 26, y: band.y - 50, width: 52, height: 32, rx: 16, class: 'omni-chip' }, group);
    text(group, x, band.y - 27, '글', { class: 'omni-chip-text' });
    return group;
  });
  const bandLabel = createSwapText(root, 800, 302, { class: 'omni-band-label' });

  const free = svg('g', { opacity: 0 }, root);
  svg('rect', { x: 800 - 150, y: band.y + band.height / 2 + 26, width: 300, height: 44, rx: 22, class: 'omni-free' }, free);
  text(free, 800, band.y + band.height / 2 + 56, '무료 사용자에게도 공개', { class: 'omni-free-text' });

  // 응답 시간.
  const latencyGroup = svg('g', { opacity: 0 }, root);
  for (let s = 0; s <= latency.max; s++) {
    svg('line', { x1: seconds(s), y1: latency.rows[0] - 34, x2: seconds(s), y2: latency.rows[1] + 30, class: s === 0 ? 'omni-axis' : 'omni-grid' }, latencyGroup);
    text(latencyGroup, seconds(s), latency.rows[1] + 60, `${s}초`, { class: 'omni-tick' });
  }
  const rows = [
    { label: '예전 음성 모드(GPT-4)', value: 5.4, note: '평균 5.4초', at: at.fast, className: 'omni-bar-old' },
    { label: 'GPT-4o', value: .32, note: '평균 0.32초 · 빠르면 0.232초', at: at.human, className: 'omni-bar-new' },
  ];
  const rowViews = rows.map(({ label, note, className }, i) => {
    const y = latency.rows[i];
    text(latencyGroup, latency.left - 22, y + 9, label, { class: 'omni-row-label' });
    const bar = svg('rect', { x: latency.left, y: y - 20, height: 40, rx: 6, class: className }, latencyGroup);
    const value = text(latencyGroup, latency.left, y + 9, note, { class: 'omni-row-value', opacity: 0 });
    return { bar, value };
  });
  const human = text(latencyGroup, latency.left, latency.rows[1] + 104, '사람끼리 대화할 때 대답이 돌아오는 시간과 비슷', { class: 'omni-human', opacity: 0 });
  text(latencyGroup, 1540, 888, '출처: OpenAI, Hello GPT-4o(2024.5)', { class: 'omni-source' });

  const update = (time: number) => {
    setAttributes(nameGroup, { opacity: appear(time, at.name, .5).toFixed(3) });
    letter.classList.toggle('lit', time >= at.o);
    setAttributes(omniLine, { opacity: appear(time, at.omni, .4).toFixed(3) });

    // 나뉜 정도: 0 = 한 상자, 1 = 세 상자.
    const split = appear(time, at.before, .7) * (1 - appear(time, at.merge, .9));
    const modelIn = appear(time, at.voice - .3, .5);
    const boxRects = stages.map(({ x, at: lit }, i) => {
      const left = lerp(merged.x, x, split);
      const width = lerp(merged.width, stageWidth, split);
      const { group, box, titleView, subView } = boxes[i];
      // 합쳐진 상태에선 가운데 상자 하나만 보인다.
      setAttributes(group, { opacity: (modelIn * (i === 1 ? 1 : split)).toFixed(3) });
      setAttributes(box, { x: left.toFixed(1), width: width.toFixed(1) });
      setAttributes(titleView, { x: (left + width / 2).toFixed(1), opacity: (split * appear(time, lit, .3)).toFixed(3) });
      setAttributes(subView, { x: (left + width / 2).toFixed(1), opacity: (split * appear(time, lit, .3)).toFixed(3) });
      box.classList.toggle('lit', split > .5 && between(time, lit, at.apart));
      return { left, right: left + width };
    });
    boxes[1].box.classList.toggle('merged', split < .5);
    setAttributes(mergedLabel, { opacity: (modelIn * (1 - split)).toFixed(3) });
    textChips.forEach((chip, i) => setAttributes(chip, { opacity: (split * appear(time, stages[i + 1].at, .3)).toFixed(3) }));
    bandLabel.update(time, (t) => (t < at.before ? '' : t < at.one ? '예전 음성 모드: 모델 셋이 따로' : 'GPT-4o: 하나의 모델로'));
    bandLabel.toggleClass('lit', time >= at.one);

    // 입력과 출력 노드.
    const left = boxRects[0].left;
    const right = boxRects[2].right;
    setAttributes(voiceNode, { opacity: appear(time, at.voice, .4).toFixed(3) });
    setAttributes(voiceLabel, { opacity: appear(time, at.voice, .4).toFixed(3) });
    setAttributes(cameraNode, { opacity: (appear(time, at.camera, .4) * lerp(1, .3, split)).toFixed(3) });
    setAttributes(cameraLabel, { opacity: (appear(time, at.camera, .4) * lerp(1, .3, split)).toFixed(3) });
    setAttributes(cameraOff, { opacity: split.toFixed(3) });
    setAttributes(speakerView.group, { opacity: appear(time, at.reply, .4).toFixed(3) });
    setAttributes(speakerLabel, { opacity: appear(time, at.reply, .4).toFixed(3) });
    setAttributes(voiceEdge, { d: curvePath(inputs.x + 50, inputs.voice, left - 6, band.y - 30), opacity: appear(time, at.voice, .4).toFixed(3) });
    setAttributes(cameraEdge, { d: curvePath(inputs.x + 50, inputs.camera, left - 6, band.y + 30), opacity: (appear(time, at.camera, .4) * lerp(1, .25, split)).toFixed(3) });
    setAttributes(outputEdge, { d: curvePath(right + 6, band.y, output.x - 50, output.y), opacity: appear(time, at.reply, .4).toFixed(3) });
    linkEdges.forEach((edge, i) => {
      setAttributes(edge, { d: `M${boxRects[i].right + 4} ${band.y} H${boxRects[i + 1].left - 4}`, opacity: (split * appear(time, stages[i + 1].at, .3)).toFixed(3) });
    });

    // 말하는 동안 소리 막대가 움직이고, 대답할 때 스피커가 울린다.
    const talking = between(time, at.voice, at.camera + .6);
    voiceBars.forEach((bar, i) => {
      const height = talking ? 14 + 22 * Math.abs(Math.sin(time * 11 + i * 1.7)) : 8;
      setAttributes(bar, { height: height.toFixed(1), y: (inputs.voice - height / 2).toFixed(1), opacity: appear(time, at.voice, .3).toFixed(3) });
    });
    const replying = between(time, at.reply + .4, at.before) || time >= at.one + .6;
    speakerView.waves.forEach((wave, i) => {
      const pulse = replying ? .35 + .65 * Math.abs(Math.sin(time * 6 - i)) : .3;
      setAttributes(wave, { opacity: pulse.toFixed(3) });
    });

    // 흐름 점: 입력 → 모델 → 출력. 세 상자일 때는 상자 사이도 지나고, 합친 뒤에는 더 빨리 흐른다.
    const fastFlow = time >= at.one;
    const speed = fastFlow ? 1.4 : .7;
    const lanes = [
      { from: { x: inputs.x + 50, y: inputs.voice }, to: { x: left - 6, y: band.y - 30 }, on: between(time, at.voice, at.before) || between(time, at.listen, at.merge) || fastFlow },
      { from: { x: inputs.x + 50, y: inputs.camera }, to: { x: left - 6, y: band.y + 30 }, on: between(time, at.camera, at.before) || fastFlow },
      { from: { x: boxRects[0].right + 4, y: band.y }, to: { x: boxRects[1].left - 4, y: band.y }, on: split > .5 && between(time, at.think, at.merge) },
      { from: { x: boxRects[1].right + 4, y: band.y }, to: { x: boxRects[2].left - 4, y: band.y }, on: split > .5 && between(time, at.speak, at.merge) },
      { from: { x: right + 6, y: band.y }, to: { x: output.x - 50, y: output.y }, on: between(time, at.reply, at.before) || between(time, at.speak + .3, at.merge) || fastFlow },
    ];
    dotViews.forEach((dot, index) => {
      const lane = lanes[index % lanes.length];
      const phase = (time * speed + Math.floor(index / lanes.length) / 5) % 1;
      const point = curve(lane.from.x, lane.from.y, lane.to.x, lane.to.y, phase);
      const fade = Math.sin(Math.PI * phase);
      setAttributes(dot, { cx: point.x.toFixed(1), cy: point.y.toFixed(1), opacity: lane.on ? (fade * .9).toFixed(3) : 0 });
    });

    setAttributes(free, { opacity: appear(time, at.free, .4).toFixed(3) });

    // 응답 시간 막대.
    setAttributes(latencyGroup, { opacity: appear(time, at.fast - .2, .4).toFixed(3) });
    rowViews.forEach(({ bar, value }, i) => {
      const grow = appear(time, rows[i].at, i === 0 ? .8 : .3);
      const width = Math.max((seconds(rows[i].value) - latency.left) * grow, 0);
      setAttributes(bar, { width: width.toFixed(1) });
      setAttributes(value, { x: (latency.left + width + 16).toFixed(1), opacity: appear(time, rows[i].at + (i === 0 ? .7 : .25), .3).toFixed(3) });
    });
    setAttributes(human, { opacity: appear(time, at.human + .4, .4).toFixed(3) });
  };

  return {
    element,
    update,
    title: 'GPT-4o 옴니 모델',
    start,
    end,
    chapters: [
      { time: at.name, title: 'GPT-4o 공개' },
      { time: at.o, title: 'o = omni, 모든 것' },
      { time: at.voice, title: '말·카메라로 묻고 목소리로 대답' },
      { time: at.before, title: '예전: 듣기·생각·말하기 모델이 따로' },
      { time: at.merge, title: '하나의 모델로 합침' },
      { time: at.fast, title: '평균 5.4초 → 0.32초' },
      { time: at.free, title: '무료 사용자에게도 공개' },
    ],
  };
};
