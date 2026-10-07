import './artificial-neuron.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';

// 3:03 "뉴런에 주목했어요" ~ 3:37 "기계가 스스로 배우지는 못했던 겁니다".
const start = 183.133;
const end = 217;

// 자막 단어 시각을 기준으로 나눈 단계.
const fire = 186; // 뉴런은 여러 곳에서 신호를 받습니다
const quiet = 191.2; // 기준을 넘지 못하면 조용히
const binary = 193.3; // 켜지거나 꺼지거나
const logic = 196.5; // 논리 계산으로 옮겨 적었습니다
const vote = 202.2; // 마을 회의의 투표함
const blank = 208.4; // 치명적인 빈칸

type Key = [number, number];

// 키 시각마다 값이 바뀌고, 바뀔 때 duration 동안 부드럽게 옮겨 간다.
const keyed = (keys: Key[], time: number, duration = .35) => {
  let index = -1;
  for (let i = 0; i < keys.length; i++) {
    if (keys[i][0] <= time) {
      index = i;
    }
  }
  if (index < 0) {
    return keys[0][1];
  }
  const [at, value] = keys[index];
  const previous = index > 0 ? keys[index - 1][1] : value;
  return lerp(previous, value, ease(progress(time, at, duration)));
};

const setText = (element: Element, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

const inputX = 330;
const inputRadius = 50;
const body = { x: 860, y: 450, r: 150 };
const meter = { x: 835, width: 50, top: 370, bottom: 530 };
const threshold = 2;
const maximum = 3;
const thresholdY = meter.bottom - ((meter.bottom - meter.top) * threshold) / maximum;
const outputX = 1300;
const outputRadius = 62;
const pulseDuration = .7;

const inputs = [
  {
    name: 'A',
    y: 270,
    active: [[start, 0], [186.4, 1], [quiet, 0], [191.4, 1], [194, 1], [logic, 1], [vote, 0], [205.5, 1], [blank, 0]] as Key[],
    pulses: [186.4, 191.4, 205.5],
    ballot: '✓',
    weight: '2',
    filledAt: 212.3,
  },
  {
    name: 'B',
    y: 450,
    active: [[start, 0], [186.6, 1], [quiet, 0], [194, 1], [194.5, 0], [195.2, 1], [195.6, 0], [logic, 1], [vote, 0], [205.8, 1], [blank, 0]] as Key[],
    pulses: [186.6, 205.8],
    ballot: '✓',
    weight: '1',
    filledAt: 212.9,
  },
  {
    name: 'C',
    y: 630,
    active: [[start, 0], [187, 1], [quiet, 0], [194, 1], [194.5, 0], [195.2, 1], [195.6, 0], [logic, 0], [blank, 0]] as Key[],
    pulses: [187],
    ballot: '✕',
    weight: '1',
    filledAt: 213.5,
  },
];

const sumKeys: Key[] = [
  [start, 0], [187.1, 1], [187.3, 2], [187.7, 3],
  [quiet, 0], [192.1, 1],
  [194, 3], [194.5, 1], [195.2, 3], [195.6, 1],
  [logic, 2],
  [vote, 0], [206.2, 1], [206.5, 2],
  [blank, 0],
];

const outputKeys: Key[] = [
  [start, 0], [190.3, 1], [quiet, 0],
  [194, 1], [194.5, 0], [195.2, 1], [195.6, 0],
  [logic, 1], [vote, 0], [207.4, 1], [blank, 0],
];

const outputPulses = [189.6, 206.7];

// 펄스 이벤트 목록 중 지금 진행 중인 것의 진행도. 없으면 -1.
const pulseAt = (events: number[], time: number) => {
  for (const at of events) {
    if (at <= time && time < at + pulseDuration) {
      return ease((time - at) / pulseDuration);
    }
  }
  return -1;
};

const createArtificialNeuron = () => {
  const { element, root } = createDiagram('artificial-neuron', '인공 뉴런');

  const inputHeader = createSwapText(root, inputX, 180, { class: 'artificial-neuron-header' });
  const network = svg('g', {}, root);

  const parts = inputs.map((input) => {
    const angle = Math.atan2(input.y - body.y, inputX - body.x);
    const from = { x: inputX + inputRadius, y: input.y };
    const to = { x: body.x + Math.cos(angle) * body.r, y: body.y + Math.sin(angle) * body.r };
    const edge = svg('line', { class: 'artificial-neuron-edge', x1: from.x, y1: from.y, x2: to.x, y2: to.y }, network);
    const node = svg('circle', { class: 'artificial-neuron-input', cx: inputX, cy: input.y, r: inputRadius }, network);
    const label = createSwapText(network, inputX, input.y + 14, { class: 'artificial-neuron-input-label' });
    const pulse = svg('circle', { class: 'artificial-neuron-pulse', r: 12, opacity: 0 }, network);
    const middle = { x: lerp(from.x, to.x, .5), y: lerp(from.y, to.y, .5) };
    const weight = svg('g', { transform: `translate(${middle.x.toFixed(1)} ${middle.y.toFixed(1)})`, opacity: 0 }, network);
    const weightBox = svg('rect', { class: 'artificial-neuron-weight', x: -40, y: -30, width: 80, height: 60, rx: 12 }, weight);
    const weightLabel = text(weight, 0, 11, '?', { class: 'artificial-neuron-weight-label' });
    return { input, from, to, edge, node, label, pulse, weight, weightBox, weightLabel, middle };
  });

  // 뉴런 몸체: 들어온 신호의 합을 채우는 막대와 기준선.
  const bodyGroup = svg('g', { opacity: 0 }, root);
  svg('circle', { class: 'artificial-neuron-body', cx: body.x, cy: body.y, r: body.r }, bodyGroup);
  const sumLabel = createSwapText(bodyGroup, meter.x + meter.width / 2, 352, { class: 'artificial-neuron-meter-label' });
  svg('rect', { class: 'artificial-neuron-meter', x: meter.x, y: meter.top, width: meter.width, height: meter.bottom - meter.top, rx: 8 }, bodyGroup);
  const fill = svg('rect', { class: 'artificial-neuron-meter-fill', x: meter.x, y: meter.bottom, width: meter.width, height: 0, rx: 8 }, bodyGroup);
  const thresholdLine = svg('line', { class: 'artificial-neuron-threshold', x1: meter.x - 18, y1: thresholdY, x2: meter.x + meter.width + 18, y2: thresholdY }, bodyGroup);
  text(bodyGroup, meter.x + meter.width + 28, thresholdY + 10, '기준', { class: 'artificial-neuron-threshold-label' });
  const bodyLabel = createSwapText(bodyGroup, body.x, body.y + body.r + 60, { class: 'artificial-neuron-body-label' });

  // 출력.
  const outputGroup = svg('g', { opacity: 0 }, root);
  svg('line', { class: 'artificial-neuron-edge', x1: body.x + body.r, y1: body.y, x2: outputX - outputRadius, y2: body.y }, outputGroup);
  const outputPulse = svg('circle', { class: 'artificial-neuron-pulse artificial-neuron-pulse-out', r: 14, opacity: 0 }, outputGroup);
  const outputNode = svg('circle', { class: 'artificial-neuron-output', cx: outputX, cy: body.y, r: outputRadius }, outputGroup);
  const outputValue = text(outputGroup, outputX, body.y + 16, '', { class: 'artificial-neuron-output-value' });
  const outputCaption = text(outputGroup, outputX, body.y + outputRadius + 58, '', { class: 'artificial-neuron-output-caption' });
  text(outputGroup, outputX, 180, '출력', { class: 'artificial-neuron-header' });

  // 아래쪽 한 줄 설명(논리식, 투표 결과, 빈칸).
  const formula = text(root, 800, 820, '', { class: 'artificial-neuron-formula', opacity: 0 });

  // 빈칸을 사람이 채우는 손.
  const cursor = svg('path', { class: 'artificial-neuron-cursor', d: 'M0 0 L0 46 L12 34 L22 56 L31 52 L21 31 L38 31 Z', opacity: 0 }, root);
  const lock = svg('g', { transform: `translate(${parts[2].middle.x.toFixed(1)} ${(parts[2].middle.y + 96).toFixed(1)})`, opacity: 0 }, root);
  svg('rect', { class: 'artificial-neuron-lock', x: -22, y: -6, width: 44, height: 36, rx: 6 }, lock);
  svg('path', { class: 'artificial-neuron-lock-shackle', d: 'M-13 -6 V-16 A13 13 0 0 1 13 -16 V-6' }, lock);

  // 단계마다 같은 그림의 이름표가 바뀐다. 바뀌는 순간은 createSwapText 가 강조한다.
  // 투표함 비유가 시작되면(vote) 이름표를 한 번에 바꾼다. 중간에 원래 이름으로 돌아갔다가 다시 바뀌지 않도록.
  const voting = (time: number) => time >= vote && time < blank;
  const headerAt = (time: number) => (voting(time) ? '주민' : '입력');
  const sumAt = (time: number) => (voting(time) ? '찬성표' : '합');
  const bodyAt = (time: number) => {
    if (voting(time)) {
      return '투표함';
    }
    return (time >= logic + 3.3 && time < vote) || time >= blank ? '인공 뉴런 · 1943' : '뉴런';
  };
  const inputAt = (input: (typeof parts)[number]['input']) => (time: number) => {
    if (time >= logic && time < vote) {
      return keyed(input.active, time, .2) > .5 ? '1' : '0';
    }
    return voting(time) ? input.ballot : input.name;
  };

  const update = (time: number) => {
    const inVote = time >= vote && time < blank;
    const inLogic = time >= logic && time < vote;
    const inBinary = time >= binary && time < logic;

    setAttributes(bodyGroup, { opacity: appear(time, start + .3, .6).toFixed(3) });
    const networkOpacity = appear(time, 185.8, .6);
    setAttributes(network, { opacity: networkOpacity.toFixed(3) });
    setAttributes(inputHeader.group, { opacity: networkOpacity.toFixed(3) });
    setAttributes(outputGroup, { opacity: networkOpacity.toFixed(3) });
    inputHeader.update(time, headerAt);

    for (const part of parts) {
      const active = keyed(part.input.active, time, .2);
      part.node.classList.toggle('on', active > .5);
      part.edge.classList.toggle('on', active > .5);
      part.label.update(time, inputAt(part.input));

      const pulse = pulseAt(part.input.pulses, time);
      setAttributes(part.pulse, {
        opacity: pulse < 0 ? 0 : 1,
        cx: lerp(part.from.x, part.to.x, Math.max(pulse, 0)).toFixed(1),
        cy: lerp(part.from.y, part.to.y, Math.max(pulse, 0)).toFixed(1),
      });

      // 무게 칸: 논리식 단계에서는 모두 1, 빈칸 단계에서는 ? 였다가 사람이 채운다.
      let weightOpacity = 0;
      let weightText = '?';
      if (inLogic) {
        weightOpacity = appear(time, 197.6, .4);
        weightText = '1';
      } else if (time >= blank) {
        weightOpacity = appear(time, 209.6, .4);
        weightText = time >= part.input.filledAt ? part.input.weight : '?';
      }
      setAttributes(part.weight, { opacity: weightOpacity.toFixed(3) });
      part.weightBox.classList.toggle('empty', weightText === '?');
      part.weightBox.classList.toggle('locked', time >= 214.6);
      setText(part.weightLabel, weightText);
    }

    const sum = keyed(sumKeys, time);
    const height = ((meter.bottom - meter.top) * sum) / maximum;
    setAttributes(fill, { y: (meter.bottom - height).toFixed(1), height: height.toFixed(1) });
    thresholdLine.classList.toggle('crossed', sum >= threshold - .01);
    sumLabel.update(time, sumAt);

    bodyLabel.update(time, bodyAt);

    const on = keyed(outputKeys, time, .2) > .5;
    outputNode.classList.toggle('on', on);
    setText(outputValue, inBinary || inLogic ? (on ? '1' : '0') : '');
    let caption = '';
    if (time >= fire && time < quiet && on) {
      caption = '신호 발사';
    } else if (time >= 192.6 && time < binary) {
      caption = '가만히';
    } else if (inBinary && time >= 194) {
      caption = on ? '켜짐' : '꺼짐';
    } else if (inVote && on) {
      caption = '통과';
    }
    setText(outputCaption, caption);
    outputCaption.classList.toggle('on', on);

    const outPulse = pulseAt(outputPulses, time);
    setAttributes(outputPulse, {
      opacity: outPulse < 0 ? 0 : 1,
      cx: lerp(body.x + body.r, outputX - outputRadius, Math.max(outPulse, 0)).toFixed(1),
      cy: body.y,
    });

    let formulaText = '';
    let formulaOpacity = 0;
    if (inLogic) {
      formulaText = '1×1 + 1×1 + 0×1 = 2  ≥  기준 2  →  1';
      formulaOpacity = appear(time, 198.3, .5);
    } else if (inVote) {
      formulaText = '찬성 2표  ≥  기준 2표  →  통과';
      formulaOpacity = appear(time, 207.4, .5);
    } else if (time >= blank) {
      formulaText = '몇 표를 줄지 사람이 정했다 · 기계는 스스로 배우지 못했다';
      formulaOpacity = appear(time, 214.6, .5);
    }
    setText(formula, formulaText);
    setAttributes(formula, { opacity: formulaOpacity.toFixed(3) });

    // 손: 211.9에 나타나 세 칸을 차례로 채운 뒤 사라진다.
    const path: Array<[number, number, number]> = [
      [211.9, 760, 820],
      [212.3, parts[0].middle.x + 18, parts[0].middle.y + 12],
      [212.9, parts[1].middle.x + 18, parts[1].middle.y + 12],
      [213.5, parts[2].middle.x + 18, parts[2].middle.y + 12],
    ];
    let x = path[0][1];
    let y = path[0][2];
    for (let i = 1; i < path.length; i++) {
      const t = ease(progress(time, path[i - 1][0], path[i][0] - path[i - 1][0]));
      if (time >= path[i - 1][0]) {
        x = lerp(path[i - 1][1], path[i][1], t);
        y = lerp(path[i - 1][2], path[i][2], t);
      }
    }
    const cursorOpacity = appear(time, 211.9, .2) * (1 - appear(time, 214, .3));
    setAttributes(cursor, { opacity: cursorOpacity.toFixed(3), transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
    setAttributes(lock, { opacity: appear(time, 214.6, .4).toFixed(3) });
  };

  return { element, update };
};

export const createArtificialNeuronScene = (): Scene => ({
  ...createArtificialNeuron(),
  title: '인공 뉴런',
  start,
  end,
  chapters: [
    { time: 186, title: '여러 곳에서 받는 신호' },
    { time: 188.1, title: '기준을 넘으면 발사' },
    { time: quiet, title: '못 넘으면 가만히' },
    { time: binary, title: '켜짐 / 꺼짐' },
    { time: logic, title: '논리 계산' },
    { time: vote, title: '투표함 비유' },
    { time: blank, title: '사람이 정한 무게' },
  ],
});
