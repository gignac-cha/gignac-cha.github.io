import './vanishing-gradient.scss';
import { appear, between, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 7:11 "그런데 여기서 또 한 벽이" ~ 7:39 "멍청해지는 이상한 상황이었습니다".
const start = 431.4;
const end = 459.467;

const deeperAt = 434.8; // 층을 조금만 더 깊이 쌓으면
const stallAt = 435.4; // 학습이 멈춰 버렸거든요
const nameAt = 437.6; // 기울기 소실
const gameAt = 439.8; // 옮겨 말하기 게임
const whisperAt = 441.8; // 줄이 길어질수록 앞사람의 말이 점점 희미해지잖아요
const signalAt = 447.6; // 뒤에서 보낸 고쳐야 할 신호가 앞으로 갈수록 작아졌어요
const frontAt = 450.8; // 맨 앞쪽 층에는 거의 아무 신호도
const stuckAt = 453.5; // 앞쪽 층은 사실상 배우지 못했던 거죠
const dumberAt = 456.4; // 깊이 쌓을수록 오히려 멍청해지는

const count = 8;
const left = 190;
const right = 1410;
const columnX = (index: number) => lerp(left, right, index / (count - 1));
// 뒤(출력 쪽)에서 앞으로 한 층 건널 때마다 신호가 절반으로 준다.
const magnitude = (index: number) => .5 ** (count - 1 - index);
const baseline = 380;
const barHeight = 190;
const nodeRows = [470, 540, 610];

const setText = (element: Element, content: string) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
};

// 거꾸로 흐르는 신호 하나: at 부터 duration 동안 맨 뒤 층에서 맨 앞 층까지.
const wave = (time: number, at: number, duration: number) => {
  const u = (time - at) / duration;
  if (u <= 0 || u >= 1.15) {
    return undefined;
  }
  const position = Math.min(u, 1) * (count - 1);
  return { x: lerp(right, left, Math.min(u, 1)), strength: .5 ** position, reached: count - 1 - position };
};

const createVanishingGradient = () => {
  const { element, root } = createDiagram('vanishing-gradient', '기울기 소실');
  const caption = text(root, 800, 120, '', { class: 'vanishing-gradient-caption', opacity: 0 });

  // 고칠 신호 막대.
  const barsGroup = svg('g', { opacity: 0 }, root);
  svg('line', { class: 'vanishing-gradient-baseline', x1: left - 70, y1: baseline, x2: right + 70, y2: baseline }, barsGroup);
  text(barsGroup, left - 70, baseline - barHeight - 34, '고칠 신호', { class: 'vanishing-gradient-axis' });
  const bars = Array.from({ length: count }, (_, index) =>
    svg('rect', { class: 'vanishing-gradient-bar', x: columnX(index) - 30, y: baseline, width: 60, height: 0, rx: 6 }, barsGroup),
  );
  const values = Array.from({ length: count }, (_, index) =>
    text(barsGroup, columnX(index), baseline - 16, '', { class: 'vanishing-gradient-value', opacity: 0 }),
  );
  const nearZero = svg('g', { opacity: 0 }, barsGroup);
  svg('rect', { class: 'vanishing-gradient-zero', x: columnX(0) - 60, y: baseline - barHeight - 10, width: columnX(2) - columnX(0) + 120, height: barHeight + 20, rx: 16 }, nearZero);
  text(nearZero, (columnX(0) + columnX(2)) / 2, baseline - barHeight / 2 + 12, '거의 0', { class: 'vanishing-gradient-zero-label' });

  // 층.
  const layers = Array.from({ length: count }, (_, index) => {
    const group = svg('g', { opacity: 0 }, root);
    const x = columnX(index);
    const frame = svg('rect', { class: 'vanishing-gradient-layer', x: x - 40, y: nodeRows[0] - 44, width: 80, height: nodeRows[2] - nodeRows[0] + 88, rx: 20 }, group);
    const nodes = nodeRows.map((y) => svg('circle', { class: 'vanishing-gradient-node', cx: x, cy: y, r: 20 }, group));
    text(group, x, nodeRows[2] + 90, `${index + 1}`, { class: 'vanishing-gradient-index' });
    return { group, frame, nodes };
  });
  const edgeLayer = svg('g', {}, root);
  const edges = Array.from({ length: count - 1 }, (_, index) =>
    svg('line', { class: 'vanishing-gradient-edge', x1: columnX(index) + 40, y1: nodeRows[1], x2: columnX(index + 1) - 40, y2: nodeRows[1], opacity: 0 }, edgeLayer),
  );
  const ends = svg('g', { opacity: 0 }, root);
  text(ends, columnX(0), nodeRows[2] + 140, '맨 앞', { class: 'vanishing-gradient-end' });
  text(ends, columnX(count - 1), nodeRows[2] + 140, '출력 쪽', { class: 'vanishing-gradient-end' });

  // 옮겨 말하기: 층마다 받은 말이 점점 흐려진다.
  const whispers = Array.from({ length: count }, (_, index) => {
    const group = svg('g', { opacity: 0 }, root);
    svg('rect', { class: 'vanishing-gradient-whisper', x: columnX(index) - 58, y: baseline - 92, width: 116, height: 60, rx: 16 }, group);
    const word = text(group, columnX(index), baseline - 50, '고쳐!', { class: 'vanishing-gradient-whisper-text' });
    return { group, word };
  });

  // 거꾸로 흐르는 신호.
  const pulse = svg('circle', { class: 'vanishing-gradient-pulse', cy: nodeRows[1], r: 0, opacity: 0 }, root);
  const stall = text(root, columnX(3), nodeRows[0] - 70, '멈춤', { class: 'vanishing-gradient-stall', opacity: 0 });

  // 배우는 층과 못 배우는 층.
  const verdicts = svg('g', { opacity: 0 }, root);
  text(verdicts, (columnX(0) + columnX(2)) / 2, 820, '배우지 못함', { class: 'vanishing-gradient-verdict frozen' });
  text(verdicts, (columnX(count - 3) + columnX(count - 1)) / 2, 820, '배움', { class: 'vanishing-gradient-verdict learning' });

  const update = (time: number) => {
    // 처음엔 네 층, 더 깊이 쌓으면 앞쪽에 네 층이 더 붙는다.
    const layerAt = (index: number) => (index >= 4 ? start : deeperAt + (3 - index) * .15);
    layers.forEach(({ group }, index) => setAttributes(group, { opacity: appear(time, layerAt(index), .4).toFixed(3) }));
    edges.forEach((edge, index) => setAttributes(edge, { opacity: appear(time, layerAt(index), .4).toFixed(3) }));
    setAttributes(ends, { opacity: appear(time, deeperAt + .6, .4).toFixed(3) });

    // 신호: 학습이 멈추는 장면(짧게), 귓속말, 본격 설명.
    const runs = [
      wave(time, stallAt, 1.6),
      wave(time, whisperAt, 2.4),
      wave(time, signalAt, 2.8),
    ].filter((run) => run !== undefined);
    const run = runs[runs.length - 1];
    if (run) {
      setAttributes(pulse, { opacity: Math.max(run.strength, .04).toFixed(3), cx: run.x.toFixed(1), r: (26 * Math.sqrt(run.strength) + 2).toFixed(1) });
    } else {
      setAttributes(pulse, { opacity: 0 });
    }
    setAttributes(stall, { opacity: (appear(time, stallAt + 1, .3) * (1 - appear(time, nameAt, .3))).toFixed(3) });

    // 귓속말: 신호가 지나간 층부터 '고쳐!'가 보이고, 앞으로 갈수록 흐리다.
    const inGame = between(time, gameAt, signalAt - .3);
    whispers.forEach(({ group, word }, index) => {
      const reached = time >= whisperAt + ((count - 1 - index) / (count - 1)) * 2.4;
      const visible = inGame ? appear(time, gameAt, .4) * (1 - appear(time, signalAt - .8, .4)) : 0;
      setAttributes(group, { opacity: (visible * (index === count - 1 || reached ? 1 : .25)).toFixed(3) });
      setAttributes(word, { opacity: (reached || index === count - 1 ? Math.max(magnitude(index) ** .6, .06) : 0).toFixed(3) });
    });

    // 막대: 본격 설명에서 신호가 닿을 때마다 그 층의 막대가 자란다.
    setAttributes(barsGroup, { opacity: appear(time, signalAt - .4, .4).toFixed(3) });
    bars.forEach((bar, index) => {
      const at = signalAt + ((count - 1 - index) / (count - 1)) * 2.8;
      const height = barHeight * magnitude(index) * ease(progress(time, at, .4));
      setAttributes(bar, { y: (baseline - height).toFixed(1), height: height.toFixed(1) });
      bar.classList.toggle('front', index < 3);
      const label = magnitude(index) >= .1 ? String(magnitude(index)).replace(/^0/, '') : '';
      setText(values[index], label);
      setAttributes(values[index], { y: (baseline - barHeight * magnitude(index) - 16).toFixed(1), opacity: appear(time, at, .3).toFixed(3) });
    });
    setAttributes(nearZero, { opacity: appear(time, frontAt + .6, .4).toFixed(3) });

    // 앞쪽 층은 얼어붙고, 뒤쪽 층만 배운다.
    const stuck = time >= stuckAt;
    layers.forEach(({ frame, nodes }, index) => {
      frame.classList.toggle('frozen', stuck && index < 3);
      frame.classList.toggle('learning', stuck && index >= count - 3);
      frame.classList.toggle('highlight', between(time, frontAt, stuckAt) && index < 3);
      for (const node of nodes) {
        node.classList.toggle('frozen', stuck && index < 3);
        node.classList.toggle('learning', stuck && index >= count - 3);
      }
    });
    setAttributes(verdicts, { opacity: appear(time, stuckAt + .6, .4).toFixed(3) });

    let captionText = '';
    let captionOpacity = 0;
    if (between(time, deeperAt, nameAt)) {
      captionText = '층을 더 깊이 쌓으면 학습이 멈춘다';
      captionOpacity = appear(time, deeperAt, .4);
    } else if (between(time, nameAt, gameAt)) {
      captionText = '기울기 소실';
      captionOpacity = appear(time, nameAt, .4);
    } else if (between(time, gameAt, signalAt)) {
      captionText = '옮겨 말할수록 흐려지는 말';
      captionOpacity = appear(time, gameAt, .4);
    } else if (between(time, signalAt, dumberAt)) {
      captionText = '앞으로 갈수록 작아지는 신호';
      captionOpacity = appear(time, signalAt, .4);
    } else if (time >= dumberAt) {
      captionText = '깊이 쌓을수록 오히려 멍청해진다';
      captionOpacity = appear(time, dumberAt, .4);
    }
    setText(caption, captionText);
    setAttributes(caption, { opacity: captionOpacity.toFixed(3) });
    caption.classList.toggle('warning', time >= dumberAt || between(time, deeperAt, gameAt));
  };

  return { element, update };
};

export const createVanishingGradientScene = (): Scene => ({
  ...createVanishingGradient(),
  title: '기울기 소실',
  start,
  end,
  chapters: [
    { time: deeperAt, title: '더 깊이 쌓으면 멈춤' },
    { time: nameAt, title: '기울기 소실' },
    { time: gameAt, title: '옮겨 말하기 게임' },
    { time: signalAt, title: '작아지는 신호' },
    { time: frontAt, title: '맨 앞쪽은 거의 0' },
    { time: stuckAt, title: '앞쪽 층은 못 배움' },
    { time: dumberAt, title: '깊을수록 멍청해짐' },
  ],
});
