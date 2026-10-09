import './batch-normalization.scss';
import { appear, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';

// 31:26 "같은 해 또 하나의 중요한 요령이 구글에서" ~ 31:49 "훈련할 수 있게 됐습니다".
const start = 1886.6;
const end = 1909.5;

const at = {
  name: 1890.9, // 배치 정규화라고 불리는 기법
  layers: 1892.6, // 층을 지날 때마다
  equal: 1894.4, // 숫자들의 크기를 고르게 맞춰 주는 방법
  choir: 1896.1, // 합창단에서
  loud: 1897.1, // 누구는 너무 크게 부르고
  quiet: 1898.5, // 누구는 너무 작게 불러요
  collapse: 1900.4, // 화음이 금방 무너지잖아요
  tune: 1902.2, // 중간중간 음량을 맞춰 주면
  stable: 1903.7, // 훨씬 안정적으로 노래할 수 있죠
  train: 1905.4, // 이 덕분에 깊은 신경망을
  faster: 1906.8, // 더 빠르고
  steady: 1907.9, // 안정적으로 훈련할 수 있게
};

const captions: Array<[number, string]> = [
  [start, '층을 지날수록 커지는 숫자'],
  [at.name, '배치 정규화'],
  [at.layers, '층을 지날 때마다'],
  [at.equal, '숫자들의 크기를 고르게 맞춘다'],
  [at.choir, '합창단'],
  [at.loud, '누구는 너무 크게'],
  [at.quiet, '누구는 너무 작게'],
  [at.collapse, '화음이 무너진다'],
  [at.tune, '중간중간 음량을 맞추면'],
  [at.stable, '안정적인 화음'],
  [at.train, '깊은 신경망 훈련'],
  [at.faster, '더 빠르게'],
  [at.steady, '더 안정적으로'],
];
const captionAt = (time: number) => {
  let current = '';
  for (const [from, content] of captions) {
    if (from <= time) {
      current = content;
    }
  }
  return current;
};

const phases = {
  layers: { from: start, to: at.choir - .3 },
  choir: { from: at.choir - .3, to: at.train - .2 },
  training: { from: at.train - .2, to: end + 1 },
};
const visible = (time: number, { from, to }: { from: number; to: number }) => appear(time, from, .5) * (1 - appear(time, to - .5, .5));

// 시드를 고정한 정규분포 난수. 장면을 만들 때 한 번만 계산한다.
const createRandom = (seed: number) => {
  let state = seed;
  const uniform = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return (state + .5) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
};

// 실제로 계산하는 작은 신경망: 특징 12개, 한 묶음(배치) 32개, 층 3개(+ 입력).
// 층마다 가중치가 조금씩 크게 잡혀 있어 정규화 없이 지나면 숫자가 점점 커지고, 특징마다 크기도 제각각이 된다.
const features = 12;
const batch = 32;
const layerCount = 3;
const normal = createRandom(7);
const input = Array.from({ length: batch }, () => Array.from({ length: features }, () => normal()));
const weights = Array.from({ length: layerCount }, () =>
  Array.from({ length: features }, () => {
    // 특징(행)마다 다른 크기: 어떤 특징은 크게, 어떤 특징은 작게 증폭된다.
    const gain = 1.7 * Math.exp(normal() * .55);
    return Array.from({ length: features }, () => (normal() * gain) / Math.sqrt(features));
  }),
);
const multiply = (values: number[], matrix: number[][]) => matrix.map((row) => row.reduce((sum, weight, i) => sum + weight * values[i], 0));
const statistics = (rows: number[][]) =>
  Array.from({ length: features }, (_, f) => {
    const column = rows.map((row) => row[f]);
    const mean = column.reduce((a, b) => a + b, 0) / column.length;
    const std = Math.sqrt(column.reduce((a, b) => a + (b - mean) ** 2, 0) / column.length);
    return { mean, std };
  });
// 배치 정규화: 특징마다 묶음의 평균을 빼고 표준편차로 나눈다.
const normalize = (rows: number[][]) => {
  const stats = statistics(rows);
  return rows.map((row) => row.map((value, f) => (value - stats[f].mean) / stats[f].std));
};
// 0번은 입력(이미 고른 크기), 1~3번은 층을 지난 값.
const raw: number[][][] = [input];
const normalized: number[][][] = [input];
{
  let plain = input;
  let tuned = input;
  for (let layer = 0; layer < layerCount; layer++) {
    plain = plain.map((row) => multiply(row, weights[layer]));
    tuned = normalize(tuned.map((row) => multiply(row, weights[layer])));
    raw.push(plain);
    normalized.push(tuned);
  }
}
const rawStd = raw.map((rows) => statistics(rows).map(({ std }) => std));
const stripCount = layerCount + 1;

// ── 1. 층마다 숫자 분포 ─────────────────────────────────────────────────────
const strips = { top: 230, bottom: 760, width: 150 };
const stripX = (layer: number) => lerp(300, 1300, layer / (stripCount - 1));
const stripMid = (strips.top + strips.bottom) / 2;
// 화면 높이의 절반을 값 ±4 로 잡는다(정규화하면 거의 다 이 안에 든다). 벗어나면 가장자리에 붙인다.
const valueY = (value: number) => stripMid - (value / 4) * ((strips.bottom - strips.top) / 2);
const clampY = (y: number) => Math.min(Math.max(y, strips.top), strips.bottom);

// ── 2. 합창단: 셋째 층의 특징 12개 = 가수 12명, 음량 = 묶음 안에서의 표준편차 ─────────────
const choirLayer = 3;
const choirStd = rawStd[choirLayer];
const choirMax = Math.max(...choirStd);
const singerX = (i: number) => lerp(250, 1350, i / (features - 1));
const singerY = 720;
const volumeBottom = 660;
const volumeHeight = 250;
const loudest = choirStd.map((std, i) => ({ std, i })).sort((a, b) => b.std - a.std);
const loudSet = new Set(loudest.slice(0, 3).map(({ i }) => i));
const quietSet = new Set(loudest.slice(-3).map(({ i }) => i));
// 가수마다 음 하나(도·미·솔·도). 파형은 모두의 소리를 더한 것.
const pitches = [1, 1.25, 1.5, 2];
const wave = { left: 250, right: 1350, mid: 300, half: 70 };

// ── 3. 학습 곡선 (Ioffe & Szegedy 2015: 같은 정확도까지 학습 단계 14분의 1) ──────────────
const chart = { left: 300, right: 1300, top: 250, bottom: 700 };
const target = .72;
// 정확도 곡선 모양. 배치 정규화 없이는 끝(x=1)에서야, 배치 정규화로는 1/14 지점에서 같은 정확도에 닿는다.
const accuracy = (x: number, reach: number, top: number) => top * (1 - Math.exp((Math.log(1 - target / top) * x) / reach));

const createBatchNormalization = () => {
  const { element, root } = createDiagram('batch-normalization', '배치 정규화');
  const caption = createSwapText(root, 800, 140, { class: 'bn-caption' });

  // 1. 층마다 숫자 분포
  const layersGroup = svg('g', { opacity: 0 }, root);
  const stripGroups = Array.from({ length: stripCount }, (_, layer) => {
    const group = svg('g', { opacity: 0 }, layersGroup);
    const x = stripX(layer);
    svg('rect', { class: 'bn-strip', x: x - strips.width / 2, y: strips.top, width: strips.width, height: strips.bottom - strips.top, rx: 16 }, group);
    svg('line', { class: 'bn-zero', x1: x - strips.width / 2, x2: x + strips.width / 2, y1: stripMid, y2: stripMid }, group);
    text(group, x, strips.bottom + 44, layer === 0 ? '입력' : `${layer}층`, { class: 'bn-layer-label' });
    const dots = raw[layer].flatMap((row, b) =>
      row.map((_, f) => svg('circle', { class: 'bn-dot', cx: x - strips.width / 2 + 14 + ((b * features + f) % 61) * ((strips.width - 28) / 60), cy: stripMid, r: 3.2 }, group)),
    );
    const overflow = text(group, x, strips.top - 14, '', { class: 'bn-overflow' });
    return { group, x, dots, overflow };
  });
  // 층(1~3층)을 지난 뒤마다 정규화한다.
  const tuners = Array.from({ length: layerCount }, (_, index) => {
    const group = svg('g', { opacity: 0 }, layersGroup);
    const x = stripX(index + 1) + strips.width / 2 + 6;
    svg('rect', { class: 'bn-tuner', x, y: stripMid - 34, width: 62, height: 68, rx: 12 }, group);
    text(group, x + 31, stripMid + 9, 'BN', { class: 'bn-tuner-text' });
    return group;
  });
  const formula = text(layersGroup, 800, 850, '특징마다 (값 − 묶음 평균) ÷ 묶음 표준편차', { class: 'bn-formula', opacity: 0 });

  // 2. 합창단
  const choir = svg('g', { opacity: 0 }, root);
  svg('line', { class: 'bn-wave-axis', x1: wave.left, x2: wave.right, y1: wave.mid, y2: wave.mid }, choir);
  svg('rect', { class: 'bn-wave-frame', x: wave.left, y: wave.mid - wave.half - 20, width: wave.right - wave.left, height: (wave.half + 20) * 2, rx: 14 }, choir);
  const wavePath = svg('path', { class: 'bn-wave' }, choir);
  const waveLabel = text(choir, wave.left, wave.mid - wave.half - 34, '모두의 소리를 더한 화음', { class: 'bn-wave-label' });
  const singers = Array.from({ length: features }, (_, i) => {
    const group = svg('g', {}, choir);
    const x = singerX(i);
    const bar = svg('rect', { class: 'bn-volume', x: x - 22, y: volumeBottom, width: 44, height: 0, rx: 8 }, group);
    svg('circle', { class: 'bn-singer', cx: x, cy: singerY, r: 30 }, group);
    const mouth = svg('ellipse', { class: 'bn-mouth', cx: x, cy: singerY + 10, rx: 9, ry: 4 }, group);
    svg('path', { class: 'bn-body', d: `M${x - 34},${singerY + 92}Q${x},${singerY + 26} ${x + 34},${singerY + 92}Z` }, group);
    return { group, bar, mouth, x };
  });
  const volumeLine = svg('line', { class: 'bn-volume-line', x1: 200, x2: 1400, opacity: 0 }, choir);

  // 3. 학습 곡선
  const training = svg('g', { opacity: 0 }, root);
  svg('path', { class: 'bn-axis', d: `M${chart.left},${chart.top - 20}V${chart.bottom}H${chart.right + 20}` }, training);
  text(training, chart.left - 16, chart.top, '정확도', { class: 'bn-axis-label', 'text-anchor': 'end' });
  text(training, chart.right + 20, chart.bottom + 40, '학습 단계 →', { class: 'bn-axis-label', 'text-anchor': 'end' });
  const targetY = chart.bottom - target * (chart.bottom - chart.top);
  svg('line', { class: 'bn-target', x1: chart.left, x2: chart.right, y1: targetY, y2: targetY }, training);
  // 배치 정규화 곡선이 이 높이에서 오른쪽 끝까지 이어지므로, 글자는 선과 겹치지 않게 조금 더 위에 둔다.
  text(training, chart.right, targetY - 24, '같은 정확도', { class: 'bn-target-label', 'text-anchor': 'end' });
  const curvePath = (reach: number, top: number) => {
    const points = Array.from({ length: 141 }, (_, i) => {
      const x = i / 140;
      return `${lerp(chart.left, chart.right, x).toFixed(1)},${(chart.bottom - accuracy(x, reach, top) * (chart.bottom - chart.top)).toFixed(1)}`;
    });
    return `M${points.join('L')}`;
  };
  const plain = svg('path', { class: 'bn-curve plain', d: curvePath(1, .735), pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, training);
  const tuned = svg('path', { class: 'bn-curve tuned', d: curvePath(1 / 14, .74), pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, training);
  const plainLabel = text(training, chart.right - 10, chart.bottom - accuracy(1, 1, .735) * (chart.bottom - chart.top) + 44, '배치 정규화 없이', { class: 'bn-curve-label plain', 'text-anchor': 'end', opacity: 0 });
  const tunedLabel = text(training, chart.left + 220, chart.top - 4, '배치 정규화', { class: 'bn-curve-label tuned', opacity: 0 });
  const reachX = lerp(chart.left, chart.right, 1 / 14);
  const reachMarks = svg('g', { opacity: 0 }, training);
  svg('line', { class: 'bn-reach', x1: reachX, x2: reachX, y1: targetY, y2: chart.bottom }, reachMarks);
  svg('line', { class: 'bn-reach plain', x1: chart.right, x2: chart.right, y1: targetY, y2: chart.bottom }, reachMarks);
  text(reachMarks, reachX, chart.bottom + 40, '1/14', { class: 'bn-reach-label' });
  text(reachMarks, chart.right, chart.bottom + 76, '1', { class: 'bn-reach-label plain' });
  const note = text(training, 800, 820, '같은 정확도까지 학습 단계 14분의 1 (구글, 2015)', { class: 'bn-note', opacity: 0 });

  const update = (time: number) => {
    caption.update(time, captionAt);

    // 1. 층마다: 처음엔 그대로 지나 점점 퍼지고, "고르게 맞춰"에서 층마다 차례로 정규화된다.
    setAttributes(layersGroup, { opacity: visible(time, phases.layers).toFixed(3) });
    stripGroups.forEach(({ group, dots, overflow }, layer) => {
      setAttributes(group, { opacity: appear(time, start + .2 + layer * .5, .4).toFixed(3) });
      const tune = layer === 0 ? 0 : ease(progress(time, at.equal + (layer - 1) * .3, .7));
      let outside = 0;
      raw[layer].forEach((row, b) =>
        row.forEach((value, f) => {
          const y = lerp(valueY(value), valueY(normalized[layer][b][f]), tune);
          if (y < strips.top || y > strips.bottom) {
            outside++;
          }
          const dot = dots[b * features + f];
          setAttributes(dot, { cy: clampY(y).toFixed(1) });
          dot.classList.toggle('outside', y < strips.top || y > strips.bottom);
          dot.classList.toggle('tuned', layer > 0 && tune > .5);
        }),
      );
      const content = outside > 0 ? `↕ ${outside}개 넘침` : '';
      if (overflow.textContent !== content) {
        overflow.textContent = content;
      }
    });
    tuners.forEach((group, layer) => setAttributes(group, { opacity: appear(time, at.layers + layer * .25, .3).toFixed(3) }));
    setAttributes(formula, { opacity: appear(time, at.equal + .4, .4).toFixed(3) });

    // 2. 합창단: 가수마다 음량이 제각각이다가 "음량을 맞춰 주면"에서 고르게 된다.
    setAttributes(choir, { opacity: visible(time, phases.choir).toFixed(3) });
    const tune = ease(progress(time, at.tune, .9));
    const volumes = choirStd.map((std) => lerp(std / choirMax, .55, tune));
    singers.forEach(({ group, bar, mouth }, i) => {
      setAttributes(group, { opacity: appear(time, at.choir + i * .04, .3).toFixed(3) });
      const height = volumes[i] * volumeHeight;
      setAttributes(bar, { y: (volumeBottom - height).toFixed(1), height: height.toFixed(1) });
      const loud = loudSet.has(i) && time >= at.loud && time < at.tune;
      const quiet = quietSet.has(i) && time >= at.quiet && time < at.tune;
      bar.classList.toggle('loud', loud);
      bar.classList.toggle('quiet', quiet);
      bar.classList.toggle('tuned', tune > .5);
      // 입 크기도 음량을 따라 움직인다.
      const open = 3 + volumes[i] * 14 * (.6 + .4 * Math.abs(Math.sin(time * 7 + i)));
      setAttributes(mouth, { ry: open.toFixed(1) });
    });
    setAttributes(volumeLine, { y1: (volumeBottom - .55 * volumeHeight).toFixed(1), y2: (volumeBottom - .55 * volumeHeight).toFixed(1), opacity: appear(time, at.tune + .6, .4).toFixed(3) });
    // 화음: 큰 소리는 파형 틀을 넘어 잘리고, 맞춘 뒤에는 틀 안에서 고르게 흐른다.
    const points: string[] = [];
    const total = volumes.reduce((a, b) => a + b, 0);
    for (let k = 0; k <= 220; k++) {
      const u = k / 220;
      let y = 0;
      volumes.forEach((volume, i) => {
        y += volume * Math.sin(2 * Math.PI * (pitches[i % pitches.length] * (u * 6 + time * .8) + i * .37));
      });
      // 맞추기 전에는 큰 목소리에 끌려 음량이 출렁이고 틀을 넘어 잘린다.
      const wobble = 1 + (1 - tune) * .7 * Math.sin(time * 4.3 + u * 11);
      const scaled = (y / total) * wave.half * lerp(5.2, 2.4, tune) * wobble;
      const clipped = Math.max(-wave.half - 20, Math.min(wave.half + 20, scaled));
      points.push(`${lerp(wave.left, wave.right, u).toFixed(1)},${(wave.mid - clipped).toFixed(1)}`);
    }
    setAttributes(wavePath, { d: `M${points.join('L')}` });
    const broken = time >= at.collapse && time < at.tune + .6;
    wavePath.classList.toggle('broken', broken);
    wavePath.classList.toggle('stable', time >= at.tune + .6);
    setAttributes(waveLabel, { opacity: appear(time, at.choir + .4, .4).toFixed(3) });

    // 3. 학습 곡선
    setAttributes(training, { opacity: visible(time, phases.training).toFixed(3) });
    setAttributes(plain, { 'stroke-dashoffset': (1 - ease(progress(time, at.train, 1.4))).toFixed(4) });
    setAttributes(plainLabel, { opacity: appear(time, at.train + 1, .4).toFixed(3) });
    setAttributes(tuned, { 'stroke-dashoffset': (1 - ease(progress(time, at.faster, 1.2))).toFixed(4) });
    setAttributes(tunedLabel, { opacity: appear(time, at.faster + .3, .4).toFixed(3) });
    setAttributes(reachMarks, { opacity: appear(time, at.faster + .6, .4).toFixed(3) });
    setAttributes(note, { opacity: appear(time, at.steady, .4).toFixed(3) });
  };

  return { element, update };
};

export const createBatchNormalizationScene = (): Scene => ({
  ...createBatchNormalization(),
  title: '배치 정규화',
  start,
  end,
  chapters: [
    { time: start, title: '층을 지날수록 커지는 숫자' },
    { time: at.equal, title: '크기를 고르게 맞추기' },
    { time: at.choir, title: '합창단 비유' },
    { time: at.tune, title: '음량 맞추기' },
    { time: at.train, title: '더 빠르고 안정적인 학습' },
  ],
});
