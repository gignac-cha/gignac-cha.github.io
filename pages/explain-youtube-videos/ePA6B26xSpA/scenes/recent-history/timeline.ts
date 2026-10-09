import { appear, lerp, setAttributes, svg, text } from '../../../shared/diagram';
import { events, landscapeAt, monthlyAt, monthlySpan, month, type TimelineEvent, yearAt } from './events';

// 가로 시간축 하나: 위에는 오픈AI, 아래에는 경쟁사. 방금 말한 사건만 밝고, 지나간 사건은 흐려진다.
// 아래 카드에는 지금 사건의 날짜·이름·설명이 나온다. 모든 값은 재생 시간만으로 정해진다.
const axis = { left: 90, right: 1510, y: 400 };
const openaiRows = [340, 286, 232, 178];
const rivalRows = [462, 522];
const today = events.find(({ id }) => id === 'today')!;

const f = (n: number) => n.toFixed(1);

const rowY = (event: TimelineEvent, row: number) => (event.lane === 'openai' ? openaiRows[row] : rivalRows[row]);

const currentAt = (time: number) => {
  let current: TimelineEvent | undefined;
  for (const event of events) {
    if (event.at <= time) {
      current = event;
    }
  }
  return current;
};

export interface View {
  from: number;
  to: number;
}

// view(time): 그 순간 축이 보여 주는 구간. zoom(time): 확대 보기로 얼마나 들어갔는지(0~1, 이름표 줄 배치에 쓴다).
export const createTimeline = (root: SVGElement, view: (time: number) => View, zoom: (time: number) => number) => {
  const clip = svg('clipPath', { id: `rh-clip-${Math.random().toString(36).slice(2, 8)}` }, root);
  svg('rect', { x: 60, y: 90, width: 1480, height: 510 }, clip);
  const stage = svg('g', { 'clip-path': `url(#${clip.id})` }, root);

  // 범례.
  const legend = svg('g', { class: 'rh-legend' }, root);
  svg('circle', { cx: 1316, cy: 64, r: 6, class: 'rh-swatch openai' }, legend);
  text(legend, 1330, 70, '오픈AI', {});
  svg('circle', { cx: 1416, cy: 64, r: 6, class: 'rh-swatch rival' }, legend);
  text(legend, 1430, 70, '경쟁사', {});

  // 2026년: "바로 지금".
  const band = svg('rect', { y: 96, height: 500, class: 'rh-band' }, stage);
  const bandLabel = text(stage, 0, 122, '2026 · 바로 지금', { class: 'rh-band-label' });

  // 축과 달 눈금.
  const line = svg('path', { class: 'rh-axis', d: `M${axis.left} ${axis.y} L${axis.right} ${axis.y}` }, stage);
  const ticks = Array.from({ length: 18 }, (_, i) => {
    const at = 6 + i;
    const year = 2025 + Math.floor(at / 12);
    const monthOfYear = (at % 12) + 1;
    const group = svg('g', { class: monthOfYear === 1 ? 'rh-tick year' : 'rh-tick' }, stage);
    const mark = svg('path', {}, group);
    const label = text(group, 0, axis.y + 28, monthOfYear === 1 ? `${year}.1` : String(monthOfYear), { 'text-anchor': 'middle' });
    return { at, mark, label, year, monthOfYear };
  });

  // "거의 매달 새 모델".
  const monthly = svg('g', { class: 'rh-monthly' }, stage);
  const monthlyPath = svg('path', {}, monthly);
  const monthlyLabel = text(monthly, 0, 150, '거의 매달 새 모델', { 'text-anchor': 'middle' });

  // 사건. 줄기·점·이름표를 층으로 나눠, 위 줄로 가는 줄기가 아래 줄 이름표를 덮지 않게 한다.
  const stemLayer = svg('g', {}, stage);
  const markLayer = svg('g', {}, stage);
  const labelLayer = svg('g', {}, stage);
  const views = events
    .filter(({ id }) => id !== 'today')
    .map((event) => {
      const className = `rh-event ${event.lane} ${event.kind}`;
      const parts = [stemLayer, markLayer, labelLayer].map((layer) => svg('g', { class: className }, layer));
      const stem = svg('path', { class: 'rh-stem' }, parts[0]);
      const mark = event.span ? svg('rect', { class: 'rh-span', height: 10, rx: 5, y: axis.y - 5 }, parts[1]) : svg('circle', { class: 'rh-dot', cy: axis.y, r: 7 }, parts[1]);
      const label = event.label === false ? undefined : parts[2];
      const date = label && event.dateLabel ? text(label, 0, 0, event.dateLabel.split(' · ')[0], { class: 'rh-date', 'text-anchor': 'middle' }) : undefined;
      const name = label ? text(label, 0, 0, typeof event.label === 'string' ? event.label : event.title, { class: 'rh-name', 'text-anchor': 'middle' }) : undefined;
      return { event, parts, stem, mark, label, date, name };
    });

  // 오늘.
  const todayMark = svg('g', { class: 'rh-today' }, stage);
  const todayLine = svg('path', {}, todayMark);
  const todayLabel = text(todayMark, 0, axis.y - 12, '오늘', {});

  // 지금 사건 카드.
  const card = svg('g', { class: 'rh-card' }, root);
  svg('rect', { x: 300, y: 614, width: 1000, height: 226, rx: 20, class: 'rh-card-box' }, card);
  svg('rect', { x: 300, y: 634, width: 6, height: 186, rx: 3, class: 'rh-card-stripe' }, card);
  const cardDate = text(card, 340, 656, '', { class: 'rh-card-date' });
  const cardTitle = text(card, 340, 702, '', { class: 'rh-card-title' });
  const cardNotes = [746, 782, 818].map((y) => text(card, 340, y, '', { class: 'rh-card-note' }));
  let shown: TimelineEvent | undefined;

  return (time: number) => {
    const { from, to } = view(time);
    const x = (at: number) => axis.left + ((at - from) / (to - from)) * (axis.right - axis.left);
    const z = zoom(time);
    const landscape = appear(time, landscapeAt, .6);
    const current = currentAt(time);

    // 2026 띠.
    const bandX = Math.max(x(month(2026, 1, 1)), 60);
    setAttributes(band, { x: f(bandX), width: f(Math.max(1540 - bandX, 0)), opacity: (appear(time, yearAt, .6) * .9).toFixed(3) });
    setAttributes(bandLabel, { x: f(bandX + 14), opacity: (appear(time, yearAt, .5) * lerp(1, .55, appear(time, yearAt + 3, .8))).toFixed(3) });
    bandLabel.classList.toggle('glow', time >= yearAt && time < yearAt + 2);

    setAttributes(line, { d: `M${axis.left} ${axis.y} L${axis.right} ${axis.y}` });
    for (const tick of ticks) {
      const tx = x(tick.at);
      const visible = tx > 70 && tx < 1530;
      setAttributes(tick.mark, { d: `M${f(tx)} ${axis.y} L${f(tx)} ${axis.y + (tick.monthOfYear === 1 ? 14 : 8)}`, opacity: tx >= axis.left && tx <= axis.right ? 1 : 0 });
      setAttributes(tick.label, { x: f(tx), opacity: visible ? 1 : 0 });
    }

    // 매달 새 모델(확대 보기에서는 화면 밖).
    const m0 = x(monthlySpan[0]);
    const m1 = x(monthlySpan[1]);
    setAttributes(monthlyPath, { d: `M${f(m0)} 168 L${f(m0)} 160 L${f(m1)} 160 L${f(m1)} 168` });
    setAttributes(monthlyLabel, { x: f((m0 + m1) / 2) });
    setAttributes(monthly, { opacity: (appear(time, monthlyAt, .4) * (1 - z) * lerp(1, .5, landscape)).toFixed(3) });

    for (const { event, parts, stem, mark, label, date, name } of views) {
      const shownAmount = appear(time, event.at, .4);
      const isCurrent = current?.id === event.id && landscape === 0;
      const base = time < event.at ? 0 : isCurrent ? 1 : lerp(.36, .85, landscape);
      for (const part of parts) {
        setAttributes(part, { opacity: (shownAmount * base).toFixed(3) });
        part.classList.toggle('current', isCurrent);
      }

      const ex = x(event.date);
      if (event.span) {
        setAttributes(mark, { x: f(x(event.span[0])), width: f(Math.max(x(event.span[1]) - x(event.span[0]), 4)) });
      } else {
        setAttributes(mark, { cx: f(ex), r: isCurrent ? 10 : 7 });
      }
      if (!label || !name) {
        setAttributes(stem, { d: '' });
        continue;
      }
      const y = lerp(rowY(event, event.row), rowY(event, event.zoomRow ?? event.row), z);
      // 나타날 때 축 쪽에서 살짝 밀려 나온다.
      const slide = (1 - shownAmount) * (event.lane === 'openai' ? 14 : -14);
      if (event.lane === 'openai') {
        setAttributes(name, { x: f(ex), y: f(y + slide) });
        if (date) {
          setAttributes(date, { x: f(ex), y: f(y - 24 + slide) });
        }
        setAttributes(stem, { d: `M${f(ex)} ${axis.y - 8} L${f(ex)} ${f(y + 10 + slide)}` });
      } else {
        if (date) {
          setAttributes(date, { x: f(ex), y: f(y + slide) });
        }
        setAttributes(name, { x: f(ex), y: f(y + 26 + slide) });
        setAttributes(stem, { d: `M${f(ex)} ${axis.y + 8} L${f(ex)} ${f(y - 18 + slide)}` });
      }
    }

    // 오늘(9월 29일이 "바로 어제").
    const tx = x(today.date);
    setAttributes(todayLine, { d: `M${f(tx)} ${axis.y - 26} L${f(tx)} ${axis.y + 26}` });
    setAttributes(todayLabel, { x: f(tx + 10) });
    setAttributes(todayMark, { opacity: appear(time, today.at, .4).toFixed(3) });

    // 카드.
    if (current !== shown) {
      shown = current;
      card.setAttribute('class', `rh-card ${current?.lane ?? ''} ${current?.kind ?? ''}`);
      cardDate.textContent = current?.dateLabel ?? '';
      cardTitle.textContent = current?.title ?? '';
      cardNotes.forEach((note, i) => (note.textContent = current?.notes[i]?.text ?? ''));
    }
    setAttributes(card, { opacity: current ? appear(time, current.at, .35).toFixed(3) : '0' });
    cardNotes.forEach((note, i) => {
      const at = current?.notes[i]?.at;
      setAttributes(note, { opacity: at === undefined ? '0' : appear(time, Math.max(at, current!.at), .3).toFixed(3) });
    });
  };
};
