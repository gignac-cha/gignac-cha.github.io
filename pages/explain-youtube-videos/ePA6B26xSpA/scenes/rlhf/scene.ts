import './rlhf.scss';
import { appear, clamp, createDiagram, ease, lerp, progress, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { createSwapText } from '../../../shared/swap-text.ts';
import { backflip, createHopper, motions } from './hopper.ts';

export { createInstructGptScene } from './instruct-gpt.ts';

// 50:19 "오픈AI는 이 간극을 메우고 싶었어요" ~ 51:04 "간식 대신 사람의 점수가 쓰인 겁니다".
const start = 3019.6;
const end = 3065.3;
const at = {
  teach: 3023.4,
  step1: 3025.5,
  demo: 3026.8,
  demoEnd: 3028.2,
  step2: 3028.8,
  answers: 3029.7,
  sideBySide: 3030.8,
  rank: 3033.7,
  ranked: 3034.1,
  step3: 3035.4,
  judge: 3035.9,
  separate: 3037.2,
  step4: 3038.2,
  rise: 3039.3,
  people: 3042.2,
  forty: 3042.8,
  name: 3044.8,
  root: 3047.2,
  choose: 3050.2,
  picks: [3051.6, 3053.2],
  round2: 3052.4,
  flip: 3054,
  crouch: 3054.4,
  jump: 3054.8,
  land: 3055.7,
  learned: 3056,
  dog: 3057,
  good: 3059.4,
  treat: 3060,
  grows: 3060.8,
  here: 3062.6,
  score: 3063.4,
};

// InstructGPT 논문(2022) 그림 2 의 실제 예시를 한국어로 옮겼다.
// 질문 "Explain the moon landing to a 6 year old", 사람의 모범 답안 "Some people went to the moon...",
// 모델의 네 답 A "Explain gravity..." B "Explain war..." C "Moon is natural satellite of..." D "People went to the moon...", 순위 D > C > A = B.
const question = '6살 아이에게 달 착륙을 설명해 줘';
const demonstration = '몇몇 사람들이 달에 갔어요…';
const answers = [
  { id: 'A', text: ['중력을', '설명하면…'], rank: 2 },
  { id: 'B', text: ['전쟁을', '설명하면…'], rank: 3 },
  { id: 'C', text: ['달은 지구의', '자연 위성…'], rank: 1 },
  { id: 'D', text: ['사람들이', '달에 갔어요…'], rank: 0 },
];
const rankLabels = ['1위', '2위', '공동 3위', '공동 3위'];

const model = { x: 220, y: 450 };
const human = { x: 1420, y: 440 };
const card = { width: 180, height: 126, gap: 20, y: 400 };
const slotX = (slot: number) => 850 - (2 * card.width + 1.5 * card.gap) + slot * (card.width + card.gap) + card.width / 2;
const judge = { x: 850, y: 668 };

const arrow = (parent: Element, d: string) => svg('path', { class: 'rlhf-arrow', d }, parent);
const head = (x: number, y: number, angle: number) => {
  const size = 14;
  const f = (n: number) => n.toFixed(1);
  return `M${f(x - size * Math.cos(angle - .5))} ${f(y - size * Math.sin(angle - .5))} L${f(x)} ${f(y)} L${f(x - size * Math.cos(angle + .5))} ${f(y - size * Math.sin(angle + .5))}`;
};

export const person = (parent: Element, x: number, y: number, size: number, className = 'rlhf-person') => {
  const group = svg('g', { class: className }, parent);
  svg('circle', { cx: x, cy: y - size * .32, r: size * .2 }, group);
  svg('path', { d: `M${x - size * .3} ${y + size * .42} Q${x} ${y - size * .18} ${x + size * .3} ${y + size * .42} Z` }, group);
  return group;
};

export const createRlhfScene = (): Scene => {
  const { element, root } = createDiagram('rlhf', '사람 피드백 강화 학습(RLHF)');

  // ── 네 단계 ──
  const main = svg('g', {}, root);
  const pills = ['① 모범 답안', '② 순위 매기기', '③ 채점 모델', '④ 다듬기'].map((label, i) => {
    const group = svg('g', { class: 'rlhf-pill' }, main);
    svg('rect', { x: 430 + i * 190, y: 108, width: 176, height: 48, rx: 24 }, group);
    text(group, 518 + i * 190, 140, label);
    return group;
  });
  const stepStarts = [at.step1, at.step2, at.step3, at.step4];

  const modelBox = svg('g', { class: 'rlhf-model' }, main);
  svg('rect', { x: model.x - 120, y: model.y - 64, width: 240, height: 128, rx: 22 }, modelBox);
  text(modelBox, model.x, model.y + 4, 'GPT-3', { class: 'rlhf-model-name' });
  text(modelBox, model.x, model.y + 40, '언어 모델', { class: 'rlhf-small' });
  const meter = svg('g', {}, main);
  svg('rect', { x: model.x - 110, y: model.y + 92, width: 220, height: 18, rx: 9, class: 'rlhf-meter-track' }, meter);
  const meterFill = svg('rect', { x: model.x - 110, y: model.y + 92, height: 18, rx: 9, class: 'rlhf-meter' }, meter);
  text(meter, model.x, model.y + 146, '채점 점수', { class: 'rlhf-small' });

  const teacher = svg('g', {}, main);
  person(teacher, human.x, human.y, 120);
  const teacherLabel = text(teacher, human.x, human.y + 100, '사람이 직접 가르친다', { class: 'rlhf-label' });
  const crowd = svg('g', {}, main);
  const crowdPeople = Array.from({ length: 40 }, (_, i) => ({
    node: person(crowd, 1330 + (i % 5) * 44, 250 + Math.floor(i / 5) * 54, 40, 'rlhf-person small'),
    order: i,
  }));
  const crowdLabel = text(main, 1418, 720, '약 40명이 채점', { class: 'rlhf-label' });

  // ① 모범 답안.
  const prompt = svg('g', {}, main);
  svg('rect', { x: 450, y: 196, width: 800, height: 80, rx: 18, class: 'rlhf-prompt' }, prompt);
  text(prompt, 480, 246, '질문', { class: 'rlhf-tag' });
  text(prompt, 560, 247, question, { class: 'rlhf-prompt-text' });
  const demo = svg('g', {}, main);
  svg('rect', { x: 450, y: 330, width: 800, height: 120, rx: 18, class: 'rlhf-demo' }, demo);
  text(demo, 480, 370, '사람이 쓴 모범 답안', { class: 'rlhf-tag' });
  const demoText = text(demo, 480, 420, '', { class: 'rlhf-demo-text' });
  arrow(demo, `M${human.x - 70} ${human.y - 20} Q1300 380 1262 386 ${head(1262, 386, Math.PI)}`);
  const imitate = svg('g', {}, main);
  arrow(imitate, `M450 420 Q390 440 ${model.x + 132} ${model.y} ${head(model.x + 132, model.y, Math.PI * 1.05)}`);
  text(imitate, 400, 398, '따라 배우기', { class: 'rlhf-flow-label', 'text-anchor': 'middle' });

  // ② 모델의 네 답과 사람의 순위.
  const answerGroup = svg('g', {}, main);
  const answerCards = answers.map(({ id, text: lines, rank }) => {
    const group = svg('g', { class: 'rlhf-answer' }, answerGroup);
    svg('rect', { x: -card.width / 2, y: -card.height / 2, width: card.width, height: card.height, rx: 16 }, group);
    text(group, -card.width / 2 + 18, -card.height / 2 + 34, id, { class: 'rlhf-answer-id' });
    lines.forEach((line, i) => text(group, 0, 8 + i * 34, line, { class: 'rlhf-answer-text' }));
    const rankLabel = text(group, 0, -card.height / 2 - 16, rankLabels[rank], { class: 'rlhf-rank' });
    const bar = svg('rect', { x: -card.width / 2 + 16, y: card.height / 2 + 18, height: 14, rx: 7, class: 'rlhf-score' }, group);
    return { group, rank, rankLabel, bar };
  });
  const order = text(main, 850, 560, 'D > C > A = B', { class: 'rlhf-order' });

  // ③ 채점 모델.
  const judgeBox = svg('g', { class: 'rlhf-judge' }, main);
  arrow(judgeBox, `M850 590 L850 ${judge.y - 52} ${head(850, judge.y - 52, Math.PI / 2)}`);
  svg('rect', { x: judge.x - 150, y: judge.y - 46, width: 300, height: 92, rx: 20 }, judgeBox);
  text(judgeBox, judge.x, judge.y + 2, '채점 모델', { class: 'rlhf-judge-name' });
  const judgeSub = text(judgeBox, judge.x, judge.y + 32, '답마다 점수를 매긴다', { class: 'rlhf-small' });

  // ④ 다듬기: 모델의 답 → 채점 → 점수가 오르는 쪽으로.
  const loop = svg('g', {}, main);
  // 2차 베지어 곡선 [시작, 조절점, 끝]. 점의 위치를 직접 계산한다(숨은 장면에서도 같은 값).
  // 나가는 줄은 모델 상자 오른쪽에서, 돌아오는 줄은 점수 막대 오른쪽 끝으로(막대·'채점 점수' 글자를 지나지 않게).
  const loopOut = [{ x: model.x + 120, y: model.y + 30 }, { x: model.x + 260, y: judge.y }, { x: judge.x - 160, y: judge.y }];
  const loopBack = [{ x: judge.x - 40, y: judge.y + 52 }, { x: judge.x - 330, y: judge.y + 150 }, { x: model.x + 124, y: model.y + 104 }];
  const curve = ([a, c, b]: typeof loopOut) => `M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`;
  svg('path', { class: 'rlhf-loop', d: curve(loopOut) }, loop);
  svg('path', { class: 'rlhf-loop back', d: curve(loopBack) }, loop);
  text(loop, 520, 840, '점수가 오르는 쪽으로 다듬기', { class: 'rlhf-flow-label', 'text-anchor': 'middle' });
  const packet = svg('circle', { r: 10, class: 'rlhf-packet' }, loop);

  // 이름.
  const naming = svg('g', {}, root);
  svg('rect', { x: 330, y: 736, width: 940, height: 128, rx: 26, class: 'rlhf-name-card' }, naming);
  text(naming, 800, 796, '사람 피드백 강화 학습 · RLHF', { class: 'rlhf-name' });
  text(naming, 800, 838, 'Reinforcement Learning from Human Feedback', { class: 'rlhf-small', 'text-anchor': 'middle' });

  // ── 뿌리: 2017년, 두 동작 중 나은 쪽을 고르며 가상 로봇을 가르쳤다 ──
  const rootGroup = svg('g', {}, root);
  text(rootGroup, 800, 150, '뿌리 · 2017년 연구', { class: 'rlhf-heading' });
  const panels = [0, 1].map((i) => {
    const group = svg('g', { class: 'rlhf-clip' }, rootGroup);
    const frame = svg('rect', { rx: 20 }, group);
    const ground = svg('line', { class: 'rlhf-ground' }, group);
    const label = text(group, 0, 0, i ? '동작 B' : '동작 A', { class: 'rlhf-clip-label' });
    const check = text(group, 0, 0, '✓ 더 낫다', { class: 'rlhf-check' });
    const hopper = createHopper(group);
    return { group, frame, ground, label, check, hopper };
  });
  const chooser = person(rootGroup, 800, 760, 70);
  const chooserLabel = text(rootGroup, 800, 836, '사람이 고른다', { class: 'rlhf-label' });
  const flipCaption = text(rootGroup, 800, 790, '사람의 선택 약 900번 · 사람 시간으로 1시간이 채 안 걸렸다', { class: 'rlhf-caption' });

  // ── 강아지 훈련 ──
  const dog = svg('g', {}, root);
  text(dog, 360, 470, '🐕', { class: 'rlhf-emoji' });
  const dogLabel = createSwapText(dog, 360, 560, { class: 'rlhf-label' });
  const sit = svg('g', {}, dog);
  svg('rect', { x: 270, y: 236, width: 180, height: 56, rx: 28, class: 'rlhf-action' }, sit);
  text(sit, 360, 274, '잘했다!', { class: 'rlhf-action-text' });
  person(dog, 1240, 440, 120);
  text(dog, 1240, 540, '훈련사', { class: 'rlhf-label' });
  const treat = svg('g', {}, dog);
  const bone = text(treat, 0, 22, '🦴', { class: 'rlhf-emoji small' });
  const star = svg('g', {}, treat);
  svg('rect', { x: -58, y: -26, width: 116, height: 52, rx: 26, class: 'rlhf-score-chip' }, star);
  text(star, 0, 10, '★ 점수', { class: 'rlhf-score-chip-text' });
  const rewardLabel = createSwapText(dog, 800, 330, { class: 'rlhf-reward' });
  const chart = svg('g', {}, dog);
  svg('line', { x1: 560, y1: 790, x2: 1040, y2: 790, class: 'rlhf-axis' }, chart);
  const bars = Array.from({ length: 6 }, (_, i) => svg('rect', { x: 580 + i * 76, width: 52, rx: 6, class: 'rlhf-bar' }, chart));
  text(chart, 800, 840, '그 행동이 점점 늘어난다', { class: 'rlhf-small' });

  const update = (time: number) => {
    // ── 네 단계 ──
    const mainIn = appear(time, start, .5) * (1 - appear(time, at.root - .2, .6));
    setAttributes(main, { opacity: mainIn.toFixed(3) });
    pills.forEach((pill, i) => {
      setAttributes(pill, { opacity: appear(time, at.step1 - .3 + i * .08, .4).toFixed(3) });
      const active = time >= stepStarts[i] && (i === 3 || time < stepStarts[i + 1]);
      pill.classList.toggle('active', active || (time >= at.name && time < at.root));
      pill.classList.toggle('done', time >= stepStarts[i] && !active);
    });
    setAttributes(teacherLabel, { opacity: (appear(time, at.teach, .4) * (1 - appear(time, at.step2, .4))).toFixed(3) });

    // 사람 한 명 → 약 40명.
    const many = appear(time, at.people, .5);
    setAttributes(teacher.firstElementChild!, { opacity: (1 - many).toFixed(3) });
    crowdPeople.forEach(({ node, order: i }) => setAttributes(node, { opacity: appear(time, at.people + i * .02, .3).toFixed(3) }));
    setAttributes(crowdLabel, { opacity: appear(time, at.forty, .4).toFixed(3) });

    // ① 모범 답안.
    setAttributes(prompt, { opacity: appear(time, at.step1, .4).toFixed(3) });
    setAttributes(demo, { opacity: (appear(time, at.step1 + .3, .4) * (1 - appear(time, at.step2, .4))).toFixed(3) });
    const typed = Math.round(progress(time, at.demo, at.demoEnd - at.demo) * demonstration.length);
    const shown = demonstration.slice(0, typed);
    if (demoText.textContent !== shown) {
      demoText.textContent = shown;
    }
    setAttributes(imitate, { opacity: (appear(time, at.demoEnd, .4) * (1 - appear(time, at.step2, .4))).toFixed(3) });

    // ② 네 답이 모델에서 나와 나란히 놓이고, 사람이 순위를 매기면 순서대로 다시 선다.
    const dim = time >= at.step4 ? lerp(1, .4, appear(time, at.step4, .5)) : 1;
    setAttributes(answerGroup, { opacity: dim.toFixed(3) });
    const reorder = ease(progress(time, at.rank, .8));
    answerCards.forEach(({ group, rank, rankLabel, bar }, i) => {
      const out = ease(progress(time, at.answers + i * .18, .7));
      const x = lerp(lerp(model.x + 80, slotX(i), out), slotX(rank), reorder);
      const y = lerp(model.y, card.y, out) - Math.sin(Math.PI * reorder) * (rank < i ? 40 : -40);
      setAttributes(group, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${lerp(.5, 1, out).toFixed(3)})`, opacity: appear(time, at.answers + i * .18, .3).toFixed(3) });
      group.classList.toggle('best', time >= at.ranked && rank === 0);
      setAttributes(rankLabel, { opacity: appear(time, at.ranked + rank * .1, .3).toFixed(3) });
      const score = [1, .72, .34, .34][rank];
      setAttributes(bar, { width: ((card.width - 32) * score * ease(progress(time, at.separate, .6))).toFixed(1) });
    });
    setAttributes(order, { opacity: (appear(time, at.ranked, .4) * (1 - appear(time, at.step3, .4))).toFixed(3) });

    // ③ 채점 모델.
    setAttributes(judgeBox, { opacity: appear(time, at.judge - .3, .4).toFixed(3) });
    setAttributes(judgeSub, { opacity: appear(time, at.separate, .4).toFixed(3) });

    // ④ 다듬기: 답이 채점 모델로 가고, 점수가 돌아오며 막대가 오른다(세 바퀴).
    setAttributes(loop, { opacity: appear(time, at.step4, .4).toFixed(3) });
    const cycle = 1.5;
    const sinceLoop = time - at.step4 - .2;
    const round = Math.floor(sinceLoop / cycle);
    const phase = (sinceLoop - round * cycle) / cycle;
    const looping = sinceLoop >= 0 && time < at.root;
    if (looping) {
      const [a, c, b] = phase < .5 ? loopOut : loopBack;
      const u = ease(phase < .5 ? phase * 2 : (phase - .5) * 2);
      const point = { x: (1 - u) ** 2 * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, y: (1 - u) ** 2 * a.y + 2 * (1 - u) * u * c.y + u * u * b.y };
      setAttributes(packet, { cx: point.x.toFixed(1), cy: point.y.toFixed(1), opacity: 1 });
      packet.classList.toggle('score', phase >= .5);
    } else {
      setAttributes(packet, { opacity: 0 });
    }
    const filled = clamp((Math.max(0, round) + (sinceLoop >= 0 ? clamp((phase - .8) / .2) : 0)) / 4);
    setAttributes(meterFill, { width: (220 * lerp(.18, 1, ease(sinceLoop < 0 ? 0 : filled))).toFixed(1) });
    setAttributes(meter, { opacity: appear(time, at.step4, .4).toFixed(3) });

    // 이름.
    setAttributes(naming, { opacity: (appear(time, at.name, .4) * (1 - appear(time, at.root - .2, .5))).toFixed(3) });

    // ── 2017년: 두 동작 비교 → 공중제비 ──
    const rootIn = appear(time, at.root, .5) * (1 - appear(time, at.dog - .3, .5));
    setAttributes(rootGroup, { opacity: rootIn.toFixed(3) });
    const merge = ease(progress(time, at.flip, .6));
    panels.forEach(({ group, frame, ground, label, check, hopper }, i) => {
      const box = {
        x: lerp(i ? 860 : 240, 450, merge),
        y: 200,
        width: lerp(500, 700, merge),
        height: lerp(400, 520, merge),
      };
      setAttributes(frame, { x: box.x, y: box.y, width: box.width.toFixed(1), height: box.height.toFixed(1) });
      const groundY = box.y + box.height - 70;
      setAttributes(ground, { x1: box.x + 30, x2: box.x + box.width - 30, y1: groundY, y2: groundY });
      setAttributes(label, { x: box.x + 28, y: box.y + 44, opacity: (1 - merge).toFixed(3) });
      // 한 바퀴째: A 고꾸라짐 vs B 깡충(→ B), 두 바퀴째: A 뒤로 젖힘 vs B 벌러덩(→ A).
      const second = time >= at.round2;
      const pick = second ? 0 : 1;
      const picked = time >= (second ? at.picks[1] : at.picks[0]);
      const motion = second ? (i ? motions.topple : motions.arch) : i ? motions.hop : motions.fall;
      const local = ((time - (second ? at.round2 : at.choose - 1)) % 1.6 + 1.6) % 1.6;
      const pose = time >= at.flip ? backflip(time, at.crouch, at.jump, at.land) : motion(local);
      hopper.place({ ...pose, x: box.x + box.width / 2 + pose.x, y: groundY + pose.y });
      group.classList.toggle('picked', picked && pick === i && time < at.flip);
      group.classList.toggle('dropped', picked && pick !== i && time < at.flip);
      setAttributes(check, { x: box.x + box.width - 170, y: box.y + 44, opacity: picked && pick === i && time < at.flip ? 1 : 0 });
      setAttributes(group, { opacity: i === 1 ? (1 - merge).toFixed(3) : 1 });
    });
    const chooserIn = appear(time, at.choose - .4, .4) * (1 - appear(time, at.flip, .4));
    setAttributes(chooser, { opacity: chooserIn.toFixed(3) });
    setAttributes(chooserLabel, { opacity: chooserIn.toFixed(3) });
    setAttributes(flipCaption, { opacity: appear(time, at.learned, .5).toFixed(3) });

    // ── 강아지 훈련: 잘했을 때 간식 → 그 행동이 늘어난다. 여기서는 간식 대신 사람의 점수 ──
    setAttributes(dog, { opacity: appear(time, at.dog - .2, .5).toFixed(3) });
    dogLabel.update(time, (t) => (t < at.here ? '강아지' : '언어 모델'));
    setAttributes(sit, { opacity: appear(time, at.good, .3).toFixed(3) });
    const fly = ease(progress(time, at.treat, .7));
    const tx = lerp(1150, 450, fly);
    const ty = lerp(430, 420, fly) - Math.sin(Math.PI * fly) * 120;
    setAttributes(treat, { transform: `translate(${tx.toFixed(1)} ${ty.toFixed(1)})`, opacity: appear(time, at.treat - .2, .3).toFixed(3) });
    const swapped = appear(time, at.score, .4);
    setAttributes(bone, { opacity: (1 - swapped).toFixed(3) });
    setAttributes(star, { opacity: swapped.toFixed(3) });
    rewardLabel.update(time, (t) => (t < at.treat ? '' : t < at.score ? '보상 · 간식' : '보상 · 사람의 점수'));
    rewardLabel.toggleClass('score', time >= at.score);
    bars.forEach((bar, i) => {
      const height = (30 + i * 26) * appear(time, at.grows + i * .14, .3);
      setAttributes(bar, { y: (790 - height).toFixed(1), height: height.toFixed(1) });
    });
  };

  return {
    element,
    update,
    title: '사람 피드백 강화 학습(RLHF)',
    start,
    end,
    chapters: [
      { time: at.step1, title: '모범 답안' },
      { time: at.step2, title: '순위 매기기' },
      { time: at.step3, title: '채점 모델' },
      { time: at.step4, title: '점수가 오르는 쪽으로' },
      { time: at.root, title: '뿌리: 로봇의 공중제비' },
      { time: at.dog, title: '강아지 훈련과 간식' },
    ],
  };
};
