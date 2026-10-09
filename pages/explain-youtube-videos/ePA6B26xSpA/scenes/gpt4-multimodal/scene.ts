import './gpt4-multimodal.scss';
import { appear, createDiagram, lerp, setAttributes, svg, text } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';

// 53:28 "GPT-4를 내놓습니다" ~ 53:45 "다른 물건이었습니다".
// 시연은 실제 GPT-4 발표 라이브(2023.3.14)의 손그림 스케치 → 웹사이트. 스케치 글씨, 요청 문장, 코드, 완성된 페이지 글자는 그 화면 그대로 옮겼다.
// 변호사 시험 점수와 백분위는 GPT-4 기술 보고서(OpenAI, 2023) 표 1의 Uniform Bar Exam 결과.
const start = 3208.7;
const end = 3225.033;
const at = {
  model: 3208.7,
  // "이번에는 글만 읽는 모델이 아니었어요": 글 입력 다음에 사진 입력이 열린다.
  textOnly: 3210.2,
  image: 3211.7,
  // "사진을 보여주면 그 안에 내용을 이해했습니다"
  photo: 3212.4,
  understand: 3213.6,
  // "손으로 그린 웹사이트 스케치를 보여주면 실제 코드를 써 줬죠"
  sketch: 3215.1,
  prompt: 3216.1,
  code: 3217.0,
  site: 3217.8,
  // "변호사 모의 시험에서는 상위 10% 수준이라고 발표했어요"
  exam: 3218.7,
  top: 3219.9,
  ten: 3220.2,
  previous: 3220.7,
  // "불과 3년 전 GPT-3와는 다른 물건이었습니다"
  gpt3: 3222.3,
  different: 3224.0,
};

const model = { x: 620, y: 200, width: 300, height: 160 };
const ports = [
  { label: '글', y: model.y + 52, at: at.textOnly },
  { label: '사진', y: model.y + 112, at: at.image },
];

// 발표 라이브에서 찍어 보낸 노트 스케치(손글씨 그대로).
const sketchLines = [
  { content: 'My Joke website', x: 120, y: 208, className: 'mm-hand mm-hand-title' },
  { content: '[really funny joke 1]', x: 112, y: 292, className: 'mm-hand' },
  { content: '[push to reveal punchline]', x: 126, y: 334, className: 'mm-hand' },
  { content: '[same, but joke 2]', x: 112, y: 412, className: 'mm-hand' },
  { content: '[push to reveal punchline]', x: 126, y: 454, className: 'mm-hand' },
  { content: '© OpenAI 2023', x: 118, y: 532, className: 'mm-hand' },
];
// GPT-4가 알아본 부분.
const regions = [
  { label: '제목', x: 104, y: 176, width: 270, height: 46 },
  { label: '농담', x: 100, y: 264, width: 250, height: 40 },
  { label: '버튼', x: 116, y: 306, width: 300, height: 40 },
  { label: '농담', x: 100, y: 384, width: 230, height: 40 },
  { label: '버튼', x: 116, y: 426, width: 300, height: 40 },
];

// 라이브에서 보낸 요청 문장.
const promptLines = ['Write brief HTML/JS to turn this mock-up', 'into a colorful website, where the jokes', 'are replaced by two real jokes.'];

// GPT-4가 돌려준 코드 중 화면에 보였던 앞부분과 끝부분.
const codeLines = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <title>My Joke Website</title>',
  '  <style>',
  '    body {',
  '      background-color: lightblue;',
  '      font-family: Arial, sans-serif;',
  '      text-align: center;',
  '  ⋯',
  '  function revealPunchline2() {',
  '    document.getElementById("punchline2")',
  '      .style.display = "block";',
];

const panel = { x: 1040, width: 500 };
const code = { y: 128, height: 214 };
const site = { y: 362, height: 214 };

// 수험생 100명을 점수 순으로 세운 줄.
const exam = { left: 160, pitch: 12.9, y: 724, height: 46 };
const personX = (index: number) => exam.left + index * exam.pitch;
const markerX = (people: number) => personX(people) - (exam.pitch - 9) / 2;

export const createGpt4MultimodalScene = (): Scene => {
  const { element, root } = createDiagram('gpt4-multimodal', 'GPT-4 멀티모달');

  // 시연: 스케치 → GPT-4 → 코드 → 웹사이트.
  const demo = svg('g', {}, root);
  const sketch = svg('g', {}, demo);
  // 노트 한 장을 살짝 기울여 줄여 놓는다(아래 시험 그림과 겹치지 않게).
  const paper = svg('g', { transform: 'translate(40 4) scale(.86) rotate(-2.5 255 360)' }, sketch);
  svg('rect', { x: 84, y: 140, width: 342, height: 440, rx: 6, class: 'mm-paper' }, paper);
  svg('rect', { x: 100, y: 160, width: 310, height: 404, class: 'mm-pen' }, paper);
  svg('line', { x1: 100, y1: 234, x2: 410, y2: 230, class: 'mm-pen' }, paper);
  for (const { content, x, y, className } of sketchLines) {
    text(paper, x, y, content, { class: className });
  }
  const regionViews = regions.map(({ label, x, y, width, height }) => {
    const group = svg('g', { opacity: 0 }, paper);
    svg('rect', { x, y, width, height, rx: 6, class: 'mm-region' }, group);
    svg('rect', { x: x + width - 4, y: y - 14, width: 62, height: 28, rx: 14, class: 'mm-region-tag' }, group);
    text(group, x + width + 27, y + 6, label, { class: 'mm-region-text' });
    return group;
  });
  const sketchCaption = svg('g', { opacity: 0 }, demo);
  text(sketchCaption, 259, 556, '손으로 그린 웹사이트 스케치', { class: 'mm-caption' });
  text(sketchCaption, 259, 586, 'GPT-4 발표 라이브 시연 · 2023.3.14', { class: 'mm-caption-sub' });
  const photoArrow = svg('path', { d: 'M420 300 C 460 300, 476 312, 512 312', class: 'mm-arrow', opacity: 0 }, demo);

  const promptGroup = svg('g', { opacity: 0 }, demo);
  svg('rect', { x: 560, y: 404, width: 420, height: 128, rx: 16, class: 'mm-prompt' }, promptGroup);
  text(promptGroup, 584, 438, '요청', { class: 'mm-prompt-label' });
  promptLines.forEach((line, i) => text(promptGroup, 584, 468 + i * 24, line, { class: 'mm-prompt-text' }));

  const codeArrow = svg('path', { d: `M${model.x + model.width + 6} ${model.y + 70} C 980 ${model.y + 70}, 990 ${code.y + 90}, ${panel.x - 8} ${code.y + 90}`, class: 'mm-arrow', opacity: 0 }, demo);
  const codeGroup = svg('g', { opacity: 0 }, demo);
  svg('rect', { x: panel.x, y: code.y, width: panel.width, height: code.height, rx: 14, class: 'mm-code' }, codeGroup);
  const codeViews = codeLines.map((line, i) => text(codeGroup, panel.x + 20, code.y + 30 + i * 14.6, line, { class: 'mm-code-text', opacity: 0 }));

  const siteGroup = svg('g', { opacity: 0 }, demo);
  svg('rect', { x: panel.x, y: site.y, width: panel.width, height: site.height, rx: 14, class: 'mm-browser' }, siteGroup);
  [0, 1, 2].forEach((i) => svg('circle', { cx: panel.x + 20 + i * 16, cy: site.y + 15, r: 5, class: 'mm-browser-dot' }, siteGroup));
  svg('rect', { x: panel.x + 6, y: site.y + 30, width: panel.width - 12, height: site.height - 36, rx: 8, class: 'mm-page' }, siteGroup);
  const center = panel.x + panel.width / 2;
  text(siteGroup, center, site.y + 62, 'My Joke Website', { class: 'mm-page-title' });
  const jokes = [
    { question: "Joke 1: Why don't scientists trust atoms?", punchline: 'Because they make up everything!', y: site.y + 88 },
    { question: "Joke 2: What's a skeleton's least favorite room in the house?", punchline: 'The living room!', y: site.y + 148 },
  ];
  const jokeViews = jokes.map(({ question, punchline, y }) => {
    text(siteGroup, center, y, question, { class: 'mm-page-text' });
    const button = svg('rect', { x: center - 52, y: y + 8, width: 104, height: 22, class: 'mm-page-button' }, siteGroup);
    text(siteGroup, center, y + 23, 'Reveal Punchline', { class: 'mm-page-button-text' });
    const answer = text(siteGroup, center, y + 48, punchline, { class: 'mm-page-text', opacity: 0 });
    return { button, answer };
  });

  // GPT-4 와 입력 칸.
  const modelGroup = svg('g', {}, root);
  const modelBox = svg('rect', { x: model.x, y: model.y, width: model.width, height: model.height, rx: 22, class: 'mm-model' }, modelGroup);
  text(modelGroup, model.x + model.width / 2 + 30, model.y + 86, 'GPT-4', { class: 'mm-model-name' });
  text(modelGroup, model.x + model.width / 2 + 30, model.y + 124, '2023년 3월', { class: 'mm-model-date' });
  const portViews = ports.map(({ label, y }) => {
    const group = svg('g', { opacity: 0 }, modelGroup);
    const pill = svg('rect', { x: model.x - 40, y: y - 20, width: 96, height: 40, rx: 20, class: 'mm-port' }, group);
    text(group, model.x + 8, y + 8, label, { class: 'mm-port-text' });
    return { group, pill };
  });

  // 3년 전 GPT-3: 글만 읽었다.
  const ghost = svg('g', { opacity: 0 }, root);
  svg('rect', { x: model.x, y: 430, width: model.width, height: 104, rx: 22, class: 'mm-ghost' }, ghost);
  text(ghost, model.x + model.width / 2 + 30, 474, 'GPT-3', { class: 'mm-ghost-name' });
  text(ghost, model.x + model.width / 2 + 30, 506, '2020년 · 글만', { class: 'mm-model-date' });
  svg('rect', { x: model.x - 40, y: 462, width: 96, height: 40, rx: 20, class: 'mm-port mm-port-ghost' }, ghost);
  text(ghost, model.x + 8, 490, '글', { class: 'mm-port-text' });
  svg('path', { d: `M${model.x + model.width + 24} 482 C ${model.x + model.width + 70} 470, ${model.x + model.width + 70} 330, ${model.x + model.width + 24} 300`, class: 'mm-arrow mm-arrow-years' }, ghost);
  text(ghost, model.x + model.width + 70, 400, '3년', { class: 'mm-years' });

  // 변호사 모의시험: 수험생 100명을 점수 순으로.
  const examGroup = svg('g', { opacity: 0 }, root);
  text(examGroup, exam.left, 680, '미국 변호사 모의시험(UBE) · 수험생 100명을 점수 순으로 세우면', { class: 'mm-exam-heading' });
  text(examGroup, exam.left, exam.y + exam.height + 34, '낮은 점수', { class: 'mm-exam-axis' });
  text(examGroup, personX(99) + 9, exam.y + exam.height + 34, '높은 점수', { class: 'mm-exam-axis mm-end' });
  const people = Array.from({ length: 100 }, (_, i) => svg('rect', { x: personX(i), y: exam.y, width: 9, height: exam.height, rx: 4, class: 'mm-person', opacity: 0 }, examGroup));
  const topBracket = svg('g', { opacity: 0 }, examGroup);
  svg('path', { d: `M${personX(90)} ${exam.y - 12} V${exam.y - 22} H${personX(99) + 9} V${exam.y - 12}`, class: 'mm-bracket' }, topBracket);
  text(topBracket, (personX(90) + personX(99) + 9) / 2, exam.y - 34, '상위 10%', { class: 'mm-exam-top' });
  const gpt4Marker = svg('g', { opacity: 0 }, examGroup);
  svg('line', { x1: markerX(90), y1: exam.y - 6, x2: markerX(90), y2: exam.y + exam.height + 52, class: 'mm-marker' }, gpt4Marker);
  text(gpt4Marker, markerX(90) - 12, exam.y + exam.height + 80, 'GPT-4 · 298/400점', { class: 'mm-marker-text mm-end' });
  const gpt35Marker = svg('g', { opacity: 0 }, examGroup);
  svg('line', { x1: markerX(10), y1: exam.y - 6, x2: markerX(10), y2: exam.y + exam.height + 52, class: 'mm-marker mm-marker-dim' }, gpt35Marker);
  text(gpt35Marker, markerX(10) + 12, exam.y + exam.height + 80, 'GPT-3.5(ChatGPT) · 213/400점 · 하위 10%', { class: 'mm-marker-text mm-marker-dim-text' });
  text(examGroup, 1540, 884, '출처: GPT-4 기술 보고서(OpenAI, 2023)', { class: 'mm-source' });

  const update = (time: number) => {
    // 시연은 시험 이야기로 넘어가면 물러난다.
    const examIn = appear(time, at.exam, .5);
    const back = appear(time, at.gpt3, .5);
    setAttributes(demo, { opacity: (lerp(1, .32, examIn)).toFixed(3) });
    setAttributes(modelGroup, { opacity: (appear(time, at.model, .5) * lerp(lerp(1, .45, examIn), 1, back)).toFixed(3) });

    portViews.forEach(({ group, pill }, i) => {
      setAttributes(group, { opacity: appear(time, ports[i].at, .4).toFixed(3) });
      // 새로 열린 사진 칸과, "다른 물건"에서 두 입력 칸을 노랗게 강조한다.
      const fresh = i === 1 && time >= at.image && time < at.photo + .4;
      const highlight = time >= at.different;
      pill.classList.toggle('lit', fresh || highlight);
    });
    modelBox.classList.toggle('lit', time >= at.different);

    // 사진이 들어오고, 알아본 부분이 표시된다.
    const slide = appear(time, at.photo, .6);
    setAttributes(sketch, { transform: `translate(${lerp(-460, 0, slide).toFixed(1)} 0)`, opacity: slide.toFixed(3) });
    setAttributes(photoArrow, { opacity: appear(time, at.photo + .5, .3).toFixed(3) });
    regionViews.forEach((group, i) => setAttributes(group, { opacity: appear(time, at.understand + i * .12, .25).toFixed(3) }));
    setAttributes(sketchCaption, { opacity: appear(time, at.sketch, .4).toFixed(3) });
    setAttributes(promptGroup, { opacity: (appear(time, at.prompt, .4) * (1 - appear(time, at.gpt3 - .4, .3))).toFixed(3) });

    // 코드가 한 줄씩 써지고, 이어서 페이지가 뜬다.
    setAttributes(codeArrow, { opacity: appear(time, at.code - .2, .3).toFixed(3) });
    setAttributes(codeGroup, { opacity: appear(time, at.code - .2, .3).toFixed(3) });
    codeViews.forEach((line, i) => setAttributes(line, { opacity: appear(time, at.code + i * .065, .12).toFixed(3) }));
    setAttributes(siteGroup, { opacity: appear(time, at.site, .35).toFixed(3) });
    // 버튼을 누르면 펀치라인이 나온다.
    jokeViews.forEach(({ button, answer }, i) => {
      const press = at.site + .45 + i * .45;
      button.classList.toggle('pressed', time >= press && time < press + .15);
      setAttributes(answer, { opacity: appear(time, press + .1, .25).toFixed(3) });
    });

    // 변호사 모의시험.
    setAttributes(examGroup, { opacity: (examIn * lerp(1, .5, back)).toFixed(3) });
    people.forEach((person, i) => {
      setAttributes(person, { opacity: appear(time, at.exam + .1 + i * .006, .25).toFixed(3) });
      person.classList.toggle('top', i >= 90 && time >= at.ten);
    });
    setAttributes(gpt4Marker, { opacity: appear(time, at.top, .35).toFixed(3) });
    setAttributes(topBracket, { opacity: appear(time, at.ten, .35).toFixed(3) });
    setAttributes(gpt35Marker, { opacity: appear(time, at.previous, .4).toFixed(3) });

    setAttributes(ghost, { opacity: appear(time, at.gpt3, .5).toFixed(3) });
  };

  return {
    element,
    update,
    title: 'GPT-4 멀티모달',
    start,
    end,
    chapters: [
      { time: at.model, title: 'GPT-4 공개' },
      { time: at.textOnly, title: '글에 이어 사진도 읽는다' },
      { time: at.photo, title: '사진 속 내용 이해' },
      { time: at.sketch, title: '손그림 스케치 → 웹사이트 코드' },
      { time: at.exam, title: '변호사 모의시험 상위 10%' },
      { time: at.gpt3, title: '3년 전 GPT-3와 비교' },
    ],
  };
};
