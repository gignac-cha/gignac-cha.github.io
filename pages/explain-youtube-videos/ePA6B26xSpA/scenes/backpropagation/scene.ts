import './backpropagation.scss';
import { appear, between, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import type { Scene } from '../../../shared/scenes';
import { createSwapText } from '../../../shared/swap-text';

// 6:10 "주제는 오차를 거꾸로 전파해 배우는 법" ~ 7:02 "스스로 쓸모 있는 특징을 찾아냈거든요".
// 그 뒤 "학계의 분위기는 다시 달아올랐습니다"부터는 역사 이야기라 장면을 끈다.
const start = 370.8;
const end = 422.633;

// 처음 소개: 앞으로 흐르고, 출력에서 틀리고, 거꾸로 흐른다.
const introForward = 371.3;
const introError = 372.4;
const introBackward = 372.6;

// 식당 주방 비유.
const kitchenAt = 381.9; // 식당 주방으로 비유해
const complaintAt = 384.4; // 손님이 음식이 너무 짜다고
const traceAt = 388.4; // 거꾸로 따져 봅니다
const blameAt = [395.4, 393.2, 390.3]; // 재료 손질 · 소스 · 간 순서의 책임 시각
const shareAt = 398.6; // 틀린 만큼 책임을 뒤에서부터 나눠 줍니다
const fixAt = 401.4; // 각자 자기 몫만큼 조금씩 고치는

// 신경망으로 돌아와서.
const networkAt = 403.4; // 신경망의 역전파가 바로 이 방식
const errorAt = 406.2; // 출력에서 틀린 정도를 계산해서
const climbAt = 407.7; // 층을 거슬러 올라갑니다
const contributionAt = 409.5; // 각 연결이 얼마나 잘못에 기여했는지
const adjustAt = 411.4; // 조금씩 고치죠
const deepAt = 412.8; // 여러 겹의 신경망을 드디어 가르칠 수
const xorAt = 416.8; // XOR 문제도 풀 수 있게
const featureAt = 420.4; // 숨은 층이 스스로 쓸모 있는 특징을

// 설명이 쉬는 구간: 논문 역사, 비유에서 신경망으로 넘어가는 "바로 이것".
// 끝난 단계가 아직 진행 중처럼 보이지 않도록 이때는 도식을 비활성 색으로 둔다.
const restWindows: Array<[number, number]> = [[374.8, 381.3], [403.6, 405.7]];

const columns = [
  { x: 250, count: 3, kitchen: '재료 손질', layer: '입력' },
  { x: 590, count: 3, kitchen: '소스', layer: '숨은 층' },
  { x: 930, count: 3, kitchen: '간', layer: '숨은 층' },
  { x: 1270, count: 1, kitchen: '접시', layer: '출력' },
];
const rows = [300, 450, 600];
const blame = [.18, .5, 1];
const hop = .45;

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const setText = (element: Element, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

// 열 사이를 한 칸씩 건너는 신호. 앞으로는 왼쪽 열부터, 거꾸로는 오른쪽 열부터 출발한다.
const hopProgress = (time: number, at: number, column: number, backward: boolean) => {
  const order = backward ? columns.length - 2 - column : column;
  const u = (time - at - order * hop) / hop;
  return u > 0 && u < 1 ? ease(u) : -1;
};

const createBackpropagation = () => {
  const { element, root } = createDiagram('backpropagation', '역전파');
  // 제목을 뺀 도식 전체. 설명이 쉬는 구간에는 통째로 회색으로 가라앉힌다.
  const body = svg('g', {}, root);
  const caption = text(body, 800, 110, '', { class: 'backpropagation-caption', opacity: 0 });

  const nodes = columns.map((column) =>
    Array.from({ length: column.count }, (_, index) => ({ x: column.x, y: column.count === 1 ? rows[1] : rows[index] })),
  );

  // 연결: 굵기가 곧 무게. 고칠 때마다 조금씩 바뀐다.
  const edgeLayer = svg('g', {}, body);
  const edges = nodes.slice(0, -1).flatMap((from, column) =>
    from.flatMap((a, i) =>
      nodes[column + 1].map((b, j) => {
        const seed = column * 31 + i * 7 + j;
        const weights = [1.5 + random(seed) * 6, 0, 0];
        weights[1] = Math.max(1.2, weights[0] + (random(seed + 100) - .5) * 4 * blame[column + 1 > 2 ? 2 : column + 1]);
        weights[2] = Math.max(1.2, weights[1] + (random(seed + 200) - .5) * 4 * blame[column + 1 > 2 ? 2 : column + 1]);
        const line = svg('line', { class: 'backpropagation-edge', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, edgeLayer);
        const forward = svg('circle', { class: 'backpropagation-pulse-forward', r: 9, opacity: 0 }, edgeLayer);
        const backward = svg('circle', { class: 'backpropagation-pulse-backward', r: 10, opacity: 0 }, edgeLayer);
        return { a, b, column, line, forward, backward, weights };
      }),
    ),
  );

  const nodeElements = nodes.map((column, index) =>
    column.map((node) => svg('circle', { class: `backpropagation-node ${index === columns.length - 1 ? 'output' : ''}`, cx: node.x, cy: node.y, r: index === columns.length - 1 ? 58 : 42 }, body)),
  );
  const tints = nodes.map((column, index) =>
    column.map((node) => svg('circle', { class: 'backpropagation-tint', cx: node.x, cy: node.y, r: index === columns.length - 1 ? 58 : 42, opacity: 0 }, body)),
  );
  const output = nodes[columns.length - 1][0];
  const outputMark = text(body, output.x, output.y + 14, '', { class: 'backpropagation-output-mark' });

  // 열 이름과 책임 막대.
  const labels = columns.map((column) => createSwapText(body, column.x, 740, { class: 'backpropagation-label' }));
  const bars = columns.slice(0, -1).map((column) => {
    svg('rect', { class: 'backpropagation-bar-track', x: column.x - 110, y: 770, width: 220, height: 18, rx: 9, opacity: 0 }, body);
    return svg('rect', { class: 'backpropagation-bar', x: column.x - 110, y: 770, width: 0, height: 18, rx: 9 }, body);
  });
  const barTracks = [...body.querySelectorAll('.backpropagation-bar-track')];
  const barCaption = text(body, columns[0].x - 150, 785, '책임', { class: 'backpropagation-bar-caption', opacity: 0 });

  // 손님의 불평.
  const complaint = svg('g', { opacity: 0 }, body);
  svg('path', { class: 'backpropagation-bubble', d: 'M1360 300 h190 a18 18 0 0 1 18 18 v64 a18 18 0 0 1 -18 18 h-150 l-36 34 l6 -34 h-10 a18 18 0 0 1 -18 -18 v-64 a18 18 0 0 1 18 -18 z' }, complaint);
  text(complaint, 1452, 362, '너무 짜요', { class: 'backpropagation-bubble-text' });

  // 오차 표시.
  const errorLabel = text(body, output.x, output.y + 110, '오차', { class: 'backpropagation-error', opacity: 0 });

  // XOR 미니 평면.
  const xor = svg('g', { opacity: 0, transform: 'translate(1370 150)' }, body);
  svg('rect', { class: 'backpropagation-xor-plane', x: 0, y: 0, width: 190, height: 190, rx: 14 }, xor);
  // 점 (0,1)·(1,0)만 가두는 띠: x + y 가 0.5 와 1.5 사이.
  svg('polygon', { class: 'backpropagation-xor-band', points: '0,0 47,0 190,143 190,190 143,190 0,47' }, xor);
  svg('line', { class: 'backpropagation-xor-line', x1: 0, y1: 47, x2: 143, y2: 190 }, xor);
  svg('line', { class: 'backpropagation-xor-line', x1: 47, y1: 0, x2: 190, y2: 143 }, xor);
  for (const [x, y, on] of [[48, 48, 1], [142, 142, 1], [48, 142, 0], [142, 48, 0]]) {
    svg('circle', { class: `backpropagation-xor-dot ${on ? 'on' : 'off'}`, cx: x, cy: y, r: 14 }, xor);
  }
  text(xor, 95, 240, 'XOR ✓', { class: 'backpropagation-xor-label' });

  // 숨은 층이 찾은 특징.
  const feature = svg('g', { opacity: 0 }, body);
  svg('rect', { class: 'backpropagation-feature-frame', x: columns[1].x - 80, y: 230, width: columns[2].x - columns[1].x + 160, height: 440, rx: 28 }, feature);
  text(feature, (columns[1].x + columns[2].x) / 2, 210, '스스로 찾은 특징', { class: 'backpropagation-feature-label' });

  const update = (time: number) => {
    const inKitchen = time >= kitchenAt && time < networkAt;
    setAttributes(root, { opacity: appear(time, start, .5).toFixed(3) });
    const resting = Math.max(0, ...restWindows.map(([from, to]) => appear(time, from, .6) * (1 - appear(time, to - .5, .5))));
    setAttributes(body, { opacity: lerp(1, .4, resting).toFixed(3) });
    const filter = `grayscale(${resting.toFixed(3)})`;
    if (body.style.filter !== filter) {
      body.style.filter = filter;
    }

    // 열 이름: 주방 비유 동안만 주방 역할로.
    labels.forEach((label, index) => {
      label.update(time, (at) => (at >= kitchenAt && at < networkAt ? columns[index].kitchen : columns[index].layer));
      label.toggleClass('kitchen', inKitchen);
    });

    // 앞으로 흐르는 신호.
    const forwardRuns = [introForward, deepAt + .2, 425];
    // 거꾸로 흐르는 신호.
    const backwardRuns = [introBackward, traceAt, shareAt, climbAt];
    for (const edge of edges) {
      let forward = -1;
      for (const at of forwardRuns) {
        forward = Math.max(forward, hopProgress(time, at, edge.column, false));
      }
      setAttributes(edge.forward, {
        opacity: forward < 0 ? 0 : 1,
        cx: lerp(edge.a.x, edge.b.x, Math.max(forward, 0)).toFixed(1),
        cy: lerp(edge.a.y, edge.b.y, Math.max(forward, 0)).toFixed(1),
      });
      let backward = -1;
      for (const at of backwardRuns) {
        backward = Math.max(backward, hopProgress(time, at, edge.column, true));
      }
      setAttributes(edge.backward, {
        opacity: backward < 0 ? 0 : 1,
        cx: lerp(edge.b.x, edge.a.x, Math.max(backward, 0)).toFixed(1),
        cy: lerp(edge.b.y, edge.a.y, Math.max(backward, 0)).toFixed(1),
      });

      // 굵기: 주방에서 한 번, 신경망에서 한 번 조금씩 고친다.
      const first = ease(progress(time, fixAt, 1.4));
      const second = ease(progress(time, adjustAt, 1));
      const width = lerp(lerp(edge.weights[0], edge.weights[1], first), edge.weights[2], second);
      setAttributes(edge.line, { 'stroke-width': width.toFixed(2) });
      const share = blame[Math.min(edge.column + 1, 2)];
      const blamed = between(time, contributionAt, adjustAt + 1) ? share : 0;
      edge.line.classList.toggle('blamed', blamed > 0);
      if (edge.line.style.getPropertyValue('--blame') !== String(blamed)) {
        edge.line.style.setProperty('--blame', String(blamed));
      }
      edge.line.classList.toggle('fixing', between(time, fixAt, fixAt + 1.4) || between(time, adjustAt, adjustAt + 1));
    }

    // 출력이 틀렸을 때: 소개, 손님 불평, 오차 계산.
    const wrong = between(time, introError, 376) || between(time, complaintAt, networkAt) || between(time, errorAt, adjustAt + 1);
    const right = time >= deepAt + 1.6;
    nodeElements[columns.length - 1][0].classList.toggle('wrong', wrong);
    nodeElements[columns.length - 1][0].classList.toggle('right', right && !wrong);
    setText(outputMark, wrong ? '✕' : right ? '✓' : '');
    outputMark.classList.toggle('wrong', wrong);
    setAttributes(complaint, { opacity: (appear(time, complaintAt + .6, .4) * (1 - appear(time, networkAt, .4))).toFixed(3) });
    setAttributes(errorLabel, { opacity: (appear(time, errorAt, .4) * (1 - appear(time, adjustAt + 1, .4))).toFixed(3) });

    // 책임: 뒤에서부터 크게, 앞으로 갈수록 작게.
    const kitchenBlame = (index: number) => appear(time, blameAt[index], .6) * (1 - appear(time, networkAt, .4));
    const networkBlame = appear(time, contributionAt, .5) * (1 - appear(time, adjustAt + 1, .4));
    const introBlame = (index: number) => appear(time, introBackward + (2 - index) * hop + hop, .3) * (1 - appear(time, 376, .6));
    const introVisible = appear(time, introBackward, .3) * (1 - appear(time, 376, .6));
    const kitchenVisible = appear(time, traceAt, .4) * (1 - appear(time, networkAt, .4));
    const trackOpacity = Math.max(introVisible, kitchenVisible, networkBlame);
    bars.forEach((bar, index) => {
      const amount = Math.max(kitchenBlame(index), networkBlame, introBlame(index)) * blame[index];
      setAttributes(bar, { width: (220 * amount).toFixed(1) });
      setAttributes(barTracks[index], { opacity: trackOpacity.toFixed(3) });
      for (const tint of tints[index]) {
        setAttributes(tint, { opacity: (amount * .75).toFixed(3) });
      }
    });
    setAttributes(barCaption, { opacity: trackOpacity.toFixed(3) });

    // 고친 사람은 잠깐 초록으로.
    nodeElements.slice(0, -1).forEach((column, index) => {
      const fixing = between(time, fixAt, fixAt + 1.4) || between(time, adjustAt, adjustAt + 1);
      for (const node of column) {
        node.classList.toggle('fixing', fixing && blame[index] > 0);
      }
    });

    // 위쪽 한 줄.
    let captionText = '';
    let captionOpacity = 0;
    if (between(time, start, kitchenAt)) {
      captionText = '오차를 거꾸로 전파해 배운다';
      captionOpacity = appear(time, introBackward, .4);
    } else if (between(time, shareAt, networkAt)) {
      captionText = '틀린 만큼 책임을 뒤에서부터 나눈다';
      captionOpacity = appear(time, shareAt, .4);
    } else if (between(time, climbAt, deepAt)) {
      captionText = '연결마다 기여한 만큼 조금씩 고친다';
      captionOpacity = appear(time, contributionAt, .4);
    } else if (time >= deepAt) {
      captionText = '여러 겹의 신경망도 가르칠 수 있다';
      captionOpacity = appear(time, deepAt, .4);
    }
    setText(caption, captionText);
    setAttributes(caption, { opacity: captionOpacity.toFixed(3) });
    caption.classList.toggle('solved', time >= deepAt);

    setAttributes(xor, { opacity: appear(time, xorAt + .4, .5).toFixed(3) });
    setAttributes(feature, { opacity: appear(time, featureAt, .5).toFixed(3) });
    nodeElements.slice(1, 3).forEach((column) => column.forEach((node) => node.classList.toggle('feature', time >= featureAt)));
  };

  return { element, update };
};

export const createBackpropagationScene = (): Scene => ({
  ...createBackpropagation(),
  title: '역전파',
  start,
  end,
  chapters: [
    { time: introBackward, title: '오차를 거꾸로 전파' },
    { time: kitchenAt, title: '식당 주방 비유' },
    { time: complaintAt, title: '너무 짜요' },
    { time: blameAt[2], title: '뒤에서부터 책임 나누기' },
    { time: fixAt, title: '자기 몫만큼 고치기' },
    { time: networkAt, title: '신경망의 역전파' },
    { time: deepAt, title: '여러 겹도 학습' },
    { time: xorAt, title: 'XOR도 풀림' },
    { time: featureAt, title: '숨은 층의 특징' },
  ],
});
