import './gan.scss';
import { appear, between, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram';
import { drawFace, FACE_HEIGHT, FACE_WIDTH, faceImage, faceOutline, faces, random } from './face';

export interface GanTimeline {
  name: number;
  cards: number;
  generator: number;
  firstFake: number;
  police: number;
  real: number;
  verdict: number;
  feedback: number;
  // 위조범과 경찰이 번갈아 실력을 올리는 순간들.
  rounds: Array<[number, 'forge' | 'police']>;
  indistinguishable: number;
  faces: number;
  gather: number;
  formed: number;
  nobody: number;
  judge: number;
  brush: number;
  early: number;
  yearly: number;
}

const hex = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
const mix = (from: string, to: string, t: number) => {
  const a = hex(from);
  const b = hex(to);
  return `#${a.map((value, i) => Math.round(lerp(value, b[i], t)).toString(16).padStart(2, '0')).join('')}`;
};

const setText = (element: Element, value: string) => {
  if (element.textContent !== value) {
    element.textContent = value;
  }
};

const GRAY = '#6c6c74';
const GREEN = '#4fd18b';

const createCard = (parent: Element, x: number, y: number, title: string, subtitle: string, kind: string) => {
  const width = 330;
  const group = svg('g', { class: `gan-card gan-card-${kind}` }, parent);
  svg('rect', { class: 'gan-card-box', x, y, width, height: 210, rx: 22 }, group);
  text(group, x + width / 2, y + 76, title, { class: 'gan-card-title' });
  text(group, x + width / 2, y + 116, subtitle, { class: 'gan-card-subtitle' });
  text(group, x + 36, y + 174, '실력', { class: 'gan-card-meter-label' });
  svg('rect', { class: 'gan-meter-track', x: x + 108, y: y + 158, width: width - 144, height: 16, rx: 8 }, group);
  const meter = svg('rect', { class: 'gan-meter-fill', x: x + 108, y: y + 158, width: 0, height: 16, rx: 8 }, group);
  return { group, meter, meterWidth: width - 144 };
};

const createBill = (parent: Element, seed: number) => {
  const group = svg('g', {}, parent);
  const base = svg('rect', { x: -150, y: -75, width: 300, height: 150, rx: 12, 'stroke-width': 3 }, group);
  const border = svg('rect', { x: -138, y: -63, width: 276, height: 126, rx: 8, fill: 'none', 'stroke-width': 1.5 }, group);
  const portrait = svg('g', { fill: 'none', 'stroke-width': 2.5 }, group);
  svg('circle', { cx: 78, cy: 0, r: 42 }, portrait);
  svg('circle', { cx: 78, cy: -10, r: 13 }, portrait);
  svg('path', { d: 'M52 30 Q78 2 104 30' }, portrait);
  const value = text(group, -124, -12, '10000', { class: 'gan-bill-value' });
  const waves = svg('path', {
    d: 'M-128 30 Q-112 18 -96 30 T-64 30 T-32 30 T0 30 M-128 48 Q-112 36 -96 48 T-64 48 T-32 48 T0 48',
    fill: 'none',
    'stroke-width': 2,
  }, group);
  const noise = svg('g', {}, group);
  const next = random(seed);
  for (let i = 0; i < 34; i++) {
    svg('circle', { cx: (next() - .5) * 280, cy: (next() - .5) * 130, r: 2 + next() * 5, class: 'gan-noise' }, noise);
  }
  return { group, base, border, portrait, value, waves, noise };
};

type Bill = ReturnType<typeof createBill>;

// quality 0이면 엉터리, 1이면 진짜와 구별할 수 없다.
const paintBill = (bill: Bill, quality: number) => {
  const color = mix(GRAY, GREEN, quality);
  setAttributes(bill.base, { stroke: color, fill: color, 'fill-opacity': (.06 + .1 * quality).toFixed(3) });
  setAttributes(bill.border, { stroke: color, opacity: quality.toFixed(3) });
  setAttributes(bill.portrait, { stroke: color, opacity: (.15 + .85 * quality).toFixed(3) });
  setAttributes(bill.waves, { stroke: color, opacity: quality.toFixed(3) });
  setAttributes(bill.value, {
    // 다이어그램 공통 text 색을 이기도록 인라인 style로 칠한다.
    style: `fill: ${color}`,
    opacity: (.35 + .65 * quality).toFixed(3),
    transform: `translate(${((1 - quality) * 10).toFixed(1)} ${((1 - quality) * -6).toFixed(1)}) rotate(${((1 - quality) * -7).toFixed(1)} -60 -20)`,
  });
  setAttributes(bill.noise, { opacity: ((1 - quality) * .9).toFixed(3) });
  setAttributes(bill.group, { transform: `rotate(${((1 - quality) * -4).toFixed(2)}) scale(${(.94 + .06 * quality).toFixed(3)})` });
};

const createBadge = (parent: Element) => {
  const group = svg('g', { class: 'gan-badge' }, parent);
  svg('circle', { r: 26 }, group);
  const glyph = text(group, 0, 11, '', { class: 'gan-badge-glyph' });
  return { group, glyph };
};

const paintBadge = (badge: ReturnType<typeof createBadge>, state: 'pass' | 'caught' | 'unsure') => {
  for (const name of ['pass', 'caught', 'unsure']) {
    badge.group.classList.toggle(name, name === state);
  }
  setText(badge.glyph, state === 'pass' ? '✓' : state === 'caught' ? '✕' : '?');
};

const createChip = (parent: Element, x: number, y: number, label: string, kind: string) => {
  const group = svg('g', { class: `gan-chip gan-chip-${kind}` }, parent);
  const width = label.length * 26 + 56;
  svg('rect', { x: x - width / 2, y: y - 28, width, height: 56, rx: 28 }, group);
  text(group, x, y + 10, label, {});
  return group;
};

const slotSize = (morph: number) => ({ width: lerp(300, 170, morph), height: lerp(150, 204, morph) });

export const createGan = (timeline: GanTimeline) => {
  const { element, root } = createDiagram('gan', '생성적 적대 신경망(GAN)');

  // 0. 이름
  const name = svg('g', { class: 'gan-name' }, root);
  text(name, 800, 440, '생성적 적대 신경망', { class: 'gan-name-title' });
  text(name, 800, 506, 'Generative Adversarial Network', { class: 'gan-name-subtitle' });

  // 1. 위조범과 경찰이 겨루는 장치
  const machine = svg('g', {}, root);
  const feedback = svg('path', { class: 'gan-feedback', d: 'M1355 540 V742 H245 V662' }, machine);
  const feedbackHead = svg('path', { class: 'gan-feedback-head', d: 'M229 680 L245 660 L261 680' }, machine);
  const feedbackLabel = text(machine, 800, 798, '들킬 때마다 수법을 고친다', { class: 'gan-feedback-label' });
  const feedbackLength = 202 + 1110 + 80;

  const generator = createCard(machine, 80, 440, '위조범', '생성자', 'generator');
  const police = createCard(machine, 1190, 330, '경찰', '판별자', 'police');

  const toFake = svg('path', { class: 'gan-arrow' }, machine);
  const realToPolice = svg('path', { class: 'gan-arrow' }, machine);
  const fakeToPolice = svg('path', { class: 'gan-arrow' }, machine);

  const createSlot = (cx: number, cy: number, caption: string, kind: string, seed: number) => {
    const group = svg('g', { class: `gan-slot gan-slot-${kind}`, transform: `translate(${cx} ${cy})` }, machine);
    const frame = svg('rect', { class: 'gan-slot-frame', rx: 14 }, group);
    const bill = createBill(group, seed);
    const face = svg('g', {}, group);
    const label = text(group, 0, 0, caption, { class: 'gan-slot-caption' });
    const badge = createBadge(group);
    return { group, frame, bill, face, label, badge, cx, cy };
  };
  const real = createSlot(790, 280, '진짜', 'real', 3);
  const fake = createSlot(790, 545, '가짜', 'fake', 7);

  // 진짜 쪽 얼굴은 완성된 그림, 가짜 쪽은 잡음 점에서 얼굴로 모여든다.
  const scale = 170 / FACE_WIDTH;
  const realFace = drawFace(real.face, faces[1]);
  setAttributes(realFace, { transform: `scale(${scale}) translate(${-FACE_WIDTH / 2} ${-FACE_HEIGHT / 2})` });
  const generated = svg('g', { transform: `scale(${scale}) translate(${-FACE_WIDTH / 2} ${-FACE_HEIGHT / 2})` }, fake.face);
  svg('rect', { width: FACE_WIDTH, height: FACE_HEIGHT, fill: '#1a1b20' }, generated);
  const generatedFace = drawFace(generated, faces[0]);
  const next = random(11);
  const targets = faceOutline(faces[0]);
  const dots = [
    ...targets.map((target) => ({ target, delay: next() * .8 })),
    // 얼굴로 모이지 않고 사라지는 잡음
    ...Array.from({ length: 50 }, () => ({ target: undefined, delay: next() * .8 })),
  ].map(({ target, delay }) => ({
    element: svg('circle', { r: 3.6, class: 'gan-dot' }, generated),
    start: [8 + next() * 184, 8 + next() * 224] as [number, number],
    target,
    delay,
  }));
  const nobody = text(fake.group, 0, 150, '세상에 없는 얼굴', { class: 'gan-nobody' });

  const judgeChip = createChip(machine, 1355, 284, '심판 · 고양이일까 개일까', 'judge');
  const brushChip = createChip(machine, 245, 394, '붓 · 새 그림을 그린다', 'brush');

  // 2. 해마다 커지고 선명해진 그림
  const growth = svg('g', { class: 'gan-growth' }, root);
  const heights = [72, 120, 186, 276];
  const widths = heights.map((height) => (height * FACE_WIDTH) / FACE_HEIGHT);
  const gap = 84;
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * 3;
  let left = 800 - total / 2;
  const baseline = 585;
  const thumbnails = heights.map((height, index) => {
    const width = widths[index];
    const group = svg('g', { transform: `translate(${left.toFixed(1)} ${baseline - height})` }, growth);
    left += width + gap;
    svg('rect', { class: 'gan-thumb-frame', x: -4, y: -4, width: width + 8, height: height + 8, rx: 6 }, group);
    if (index < 3) {
      const image = svg('image', { width, height, preserveAspectRatio: 'none', class: 'gan-thumb-pixels' }, group);
      image.setAttribute('href', faceImage(faces[0], [8, 16, 32][index], index < 2));
    } else {
      const face = drawFace(group, faces[0]);
      setAttributes(face, { transform: `scale(${width / FACE_WIDTH})` });
    }
    return group;
  });
  const firstLabel = text(growth, 800 - total / 2 + widths[0] / 2, baseline + 56, '작고 흐릿한 흑백', { class: 'gan-growth-label' });
  const yearly = svg('g', {}, growth);
  svg('path', { class: 'gan-growth-arrow', d: `M${800 - total / 2} ${baseline + 40} H${800 + total / 2} M${800 + total / 2 - 18} ${baseline + 28} L${800 + total / 2} ${baseline + 40} L${800 + total / 2 - 18} ${baseline + 52}` }, yearly);
  text(yearly, 800, baseline + 100, '해마다 더 크고 더 선명하게', { class: 'gan-growth-caption' });

  // 위조범과 경찰의 실력. 번갈아 상대보다 조금씩 앞서 나간다.
  const levels = (time: number) => {
    let forge = .1;
    let watch = .22;
    let forgeTarget = forge;
    let watchTarget = watch;
    for (const [at, who] of timeline.rounds) {
      const t = ease(progress(time, at, .4));
      if (who === 'forge') {
        const from = forgeTarget;
        forgeTarget = Math.min(watchTarget + .08, .96);
        forge += (forgeTarget - from) * t;
      } else {
        const from = watchTarget;
        watchTarget = Math.min(forgeTarget + .08, .98);
        watch += (watchTarget - from) * t;
      }
    }
    return { forge, watch };
  };

  const update = (time: number) => {
    const nameIn = appear(time, timeline.name, .6) * (1 - appear(time, timeline.cards - .3, .5));
    setAttributes(name, { opacity: nameIn.toFixed(3) });

    const growthIn = appear(time, timeline.early - .3, .6);
    setAttributes(machine, { opacity: ((1 - growthIn) * appear(time, timeline.cards, .6)).toFixed(3) });

    // 카드
    setAttributes(generator.group, { opacity: appear(time, timeline.cards + .6, .5).toFixed(3) });
    setAttributes(police.group, { opacity: appear(time, timeline.cards + 1.8, .5).toFixed(3) });
    generator.group.classList.toggle('focus', between(time, timeline.generator, timeline.police) || time >= timeline.brush);
    police.group.classList.toggle('focus', between(time, timeline.police, timeline.verdict) || between(time, timeline.judge, timeline.brush));
    police.group.classList.toggle('dim', time >= timeline.brush);

    const { forge, watch } = levels(time);
    setAttributes(generator.meter, { width: (generator.meterWidth * forge).toFixed(1) });
    setAttributes(police.meter, { width: (police.meterWidth * watch).toFixed(1) });

    // 지폐 → 얼굴
    const morph = ease(progress(time, timeline.faces, .8));
    const size = slotSize(morph);
    const quality = clamp((forge - .1) / .84);
    for (const slot of [real, fake]) {
      setAttributes(slot.frame, { x: (-size.width / 2).toFixed(1), y: (-size.height / 2).toFixed(1), width: size.width.toFixed(1), height: size.height.toFixed(1), opacity: morph.toFixed(3) });
      setAttributes(slot.bill.group, { opacity: (1 - morph).toFixed(3) });
      setAttributes(slot.face, { opacity: morph.toFixed(3) });
      setAttributes(slot.label, { x: (-size.width / 2).toFixed(1), y: (-size.height / 2 - 18).toFixed(1) });
      setAttributes(slot.badge.group, { transform: `translate(${(size.width / 2).toFixed(1)} ${(-size.height / 2).toFixed(1)})` });
    }
    paintBill(real.bill, 1);
    paintBill(fake.bill, quality);

    const fakeIn = appear(time, timeline.firstFake, .6);
    setAttributes(fake.group, { opacity: fakeIn.toFixed(3), transform: `translate(${(fake.cx - (1 - fakeIn) * 260).toFixed(1)} ${fake.cy})` });
    setAttributes(real.group, { opacity: appear(time, timeline.real, .6).toFixed(3) });

    // 화살표
    const edge = 790 + size.width / 2 + 14;
    setAttributes(toFake, { d: `M420 545 H${(790 - size.width / 2 - 14).toFixed(1)}`, opacity: appear(time, timeline.firstFake - .5, .5).toFixed(3) });
    const toPolice = appear(time, timeline.real + 1.2, .5);
    setAttributes(realToPolice, { d: `M${edge.toFixed(1)} 280 L1178 400`, opacity: toPolice.toFixed(3) });
    setAttributes(fakeToPolice, { d: `M${edge.toFixed(1)} 545 L1178 470`, opacity: toPolice.toFixed(3) });

    // 판정: 실력이 앞선 쪽이 이긴다. 끝내는 경찰도 구별하지 못한다.
    const verdictIn = appear(time, timeline.verdict, .3) * (1 - morph);
    const unsure = time >= timeline.indistinguishable;
    paintBadge(real.badge, unsure ? 'unsure' : 'pass');
    paintBadge(fake.badge, unsure ? 'unsure' : forge > watch ? 'pass' : 'caught');
    setAttributes(real.badge.group, { opacity: verdictIn.toFixed(3) });
    setAttributes(fake.badge.group, { opacity: verdictIn.toFixed(3) });

    // 되먹임 화살표
    const drawn = ease(progress(time, timeline.feedback, 1.3));
    setAttributes(feedback, { 'stroke-dasharray': feedbackLength, 'stroke-dashoffset': ((1 - drawn) * feedbackLength).toFixed(1), opacity: drawn > 0 ? 1 : 0 });
    setAttributes(feedbackHead, { opacity: progress(time, timeline.feedback + 1.1, .3).toFixed(3) });
    setAttributes(feedbackLabel, { opacity: appear(time, timeline.feedback + .6, .6).toFixed(3) });

    // 잡음 점이 눈·코·입으로 모여든다
    const formed = appear(time, timeline.formed, 1.2);
    for (const dot of dots) {
      const t = ease(progress(time, timeline.gather + dot.delay, 1.6));
      const [x, y] = dot.target
        ? [lerp(dot.start[0], dot.target[0], t), lerp(dot.start[1], dot.target[1], t)]
        : dot.start;
      const fade = dot.target ? 1 - formed : 1 - t;
      setAttributes(dot.element, { cx: x.toFixed(1), cy: y.toFixed(1), opacity: (fade * .9).toFixed(3) });
    }
    setAttributes(generatedFace, { opacity: formed.toFixed(3) });
    setAttributes(nobody, { opacity: appear(time, timeline.nobody, .5).toFixed(3) });

    // 심판에서 붓으로
    setAttributes(judgeChip, { opacity: appear(time, timeline.judge, .5).toFixed(3) });
    setAttributes(brushChip, { opacity: appear(time, timeline.brush, .5).toFixed(3) });

    // 해마다 커지고 선명해진 그림
    setAttributes(growth, { opacity: growthIn.toFixed(3) });
    thumbnails.forEach((thumbnail, index) => {
      const at = index === 0 ? timeline.early : timeline.yearly + (index - 1) * .7;
      const shown = appear(time, at, .5);
      setAttributes(thumbnail, { opacity: shown.toFixed(3) });
    });
    setAttributes(firstLabel, { opacity: (appear(time, timeline.early + 1.2, .5) * (1 - appear(time, timeline.yearly, .4))).toFixed(3) });
    setAttributes(yearly, { opacity: appear(time, timeline.yearly + .6, .6).toFixed(3) });
  };

  return { element, update };
};
