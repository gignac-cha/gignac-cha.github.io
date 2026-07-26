// The five summary cards. Arithmetic belongs to the pure tools modules; this file only renders
// values and their loading / unavailable states.

import { formatCount, formatPercentage, formatViewsPerVisitor, MISSING_TEXT } from '../tools/formatting.ts';
import { type DeltaResult } from '../tools/period-deltas.ts';
import { computeBotRatio } from '../tools/summaries.ts';

// One card: its key, its label, and the sub-line under the value.
interface SummaryCardDefinition {
  key: SummaryCardKey;
  label: string;
  note: string;
}

// The card identifiers, as a closed union so a typo in showPlaceholder('...') is a type error
// rather than a silently ignored call.
export type SummaryCardKey = 'totalViews' | 'visitors' | 'todayViews' | 'viewsPerVisitor' | 'botRatio';

// Two cards need their wording read carefully.
// - "방문자" is a PERIOD-WIDE distinct count, straight from period-summary. The card used to show
//   the sum of the daily distinct counts, which double-counts anyone who returns on another day
//   and therefore had to carry an apologetic label; the dedicated query is what let the plain word
//   become true. The chart's per-day visitor line still is a daily distinct count, so the two
//   numbers legitimately disagree — the note says which one this is.
// - "오늘 페이지 뷰": "today" is the UTC day, because that is the bucket the tracker groups by (see
//   the module header of tools/date-ranges.ts). Saying so keeps a viewer nine hours ahead of UTC
//   from reading an empty card as data loss.
const CARD_DEFINITIONS: SummaryCardDefinition[] = [
  { key: 'totalViews', label: '총 페이지 뷰', note: '선택 기간의 전체 페이지 뷰' },
  { key: 'visitors', label: '방문자', note: '기간 전체 고유 방문자 (재방문 1명으로 계산)' },
  { key: 'todayViews', label: '오늘 페이지 뷰', note: '오늘(UTC) 하루 페이지 뷰' },
  { key: 'viewsPerVisitor', label: '방문자당 페이지 뷰', note: '페이지 뷰 / 방문자' },
  { key: 'botRatio', label: '봇 비율', note: '봇 / 총 페이지 뷰' },
];

// Values that come from the by-day queries. The other four cards have their own methods because
// each is fed by a different query and must be able to fail on its own.
export interface SummaryValues {
  todayViews: number;
}

export interface SummaryCardsHandle {
  element: HTMLElement;
  showLoading(): void;
  showValues(values: SummaryValues): void;
  // 총 페이지 뷰 + 방문자 + 방문자당 페이지 뷰, all three from period-summary's single row.
  showPeriodSummary(views: number, visitors: number): void;
  // Reverts one card to a dash when its query failed — 0 would read as a real measurement.
  showPlaceholder(key: SummaryCardKey): void;
  // Bot card: a percentage plus a "bots / total" sub-line.
  showBotRatio(botFootprints: number, totalFootprints: number): void;
  // Bot card: this tracker answered 404 — it does not serve bots-by-day at all.
  showBotUnsupported(messageText: string): void;
  // Bot card: bots-by-day failed for any OTHER reason (network, 5xx). Distinct from 미지원 on
  // purpose: "the tracker cannot do this" and "the request did not get through" call for
  // different operator reactions, and the outage case must not read as a capability gap.
  showBotFailure(messageText: string): void;
  // ▲▼% against the previous period. null ERASES the indicator, which is the case that matters:
  // the previous-period query can fail or come back empty on its own, and a stale arrow left over
  // from the last range would be read as a measurement of the current one.
  setDelta(key: SummaryCardKey, delta: DeltaResult | null): void;
  // The card's mini trend line. Fewer than two points draws nothing AND collapses the slot, so a
  // card without a sparkline is not a card with a blank strip under its note.
  setSparkline(key: SummaryCardKey, values: ReadonlyArray<number>): void;
}

const SPARKLINE_VIEWBOX_WIDTH = 100;
const SPARKLINE_VIEWBOX_HEIGHT = 24;
const SPARKLINE_BASELINE_Y = 22;
const SPARKLINE_AMPLITUDE = 20;

export function createSummaryCards(): SummaryCardsHandle {
  const container = document.createElement('section');
  container.className = 'summary-cards';
  container.setAttribute('aria-label', '요약 지표');

  const cardElementByKey = new Map<string, HTMLElement>();
  const valueElementByKey = new Map<string, HTMLElement>();
  const noteElementByKey = new Map<string, HTMLElement>();
  const deltaElementByKey = new Map<string, HTMLElement>();
  const sparklineContainerByKey = new Map<string, HTMLElement>();

  for (const definition of CARD_DEFINITIONS) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    if (definition.key === 'botRatio') {
      card.classList.add('summary-card-bot');
    }

    const labelRow = document.createElement('div');
    labelRow.className = 'summary-card-head';
    labelRow.style.display = 'flex';
    labelRow.style.alignItems = 'center';
    labelRow.style.justifyContent = 'space-between';

    const label = document.createElement('p');
    label.className = 'summary-label';
    label.textContent = definition.label;
    labelRow.appendChild(label);

    const deltaSpan = document.createElement('span');
    deltaSpan.className = 'summary-delta';
    labelRow.appendChild(deltaSpan);
    deltaElementByKey.set(definition.key, deltaSpan);

    card.appendChild(labelRow);

    const value = document.createElement('p');
    value.className = 'summary-value';
    value.textContent = MISSING_TEXT;
    card.appendChild(value);
    valueElementByKey.set(definition.key, value);

    const note = document.createElement('p');
    note.className = 'summary-note';
    note.textContent = definition.note;
    card.appendChild(note);
    noteElementByKey.set(definition.key, note);

    // Built now, mounted only once a series arrives. The container carries a fixed height, so an
    // empty one under every card is a blank strip that makes the whole KPI row taller than its
    // content — and leaving it in the DOM "but hidden" would depend on the stylesheet never giving
    // it a `display`, which is not a promise this file can keep.
    const sparklineContainer = document.createElement('div');
    sparklineContainer.className = 'summary-sparkline';
    sparklineContainerByKey.set(definition.key, sparklineContainer);

    cardElementByKey.set(definition.key, card);
    container.appendChild(card);
  }

  const setValue = (key: SummaryCardKey, text: string): void => {
    const element = valueElementByKey.get(key);
    if (element !== undefined) {
      element.textContent = text;
    }
  };

  const setNote = (key: SummaryCardKey, text: string): void => {
    const element = noteElementByKey.get(key);
    if (element !== undefined) {
      element.textContent = text;
    }
  };

  // The loading state of a value is a skeleton bar, not '…': the ellipsis is a different WIDTH
  // from the number that replaces it, so every card reflowed the moment the first response landed.
  const setValueSkeleton = (key: SummaryCardKey): void => {
    const element = valueElementByKey.get(key);
    if (element === undefined) {
      return;
    }
    element.textContent = '';
    const skeleton = document.createElement('span');
    skeleton.className = 'skeleton-block skeleton-summary-value';
    skeleton.style.display = 'block';
    skeleton.style.height = '30px';
    skeleton.style.width = '70%';
    element.appendChild(skeleton);
  };

  const findDefaultNote = (key: SummaryCardKey): string =>
    CARD_DEFINITIONS.find((definition) => definition.key === key)?.note ?? '';

  const setBotUnsupportedFlag = (isUnsupported: boolean): void => {
    const botCard = valueElementByKey.get('botRatio')?.closest('.summary-card');
    botCard?.classList.toggle('is-unsupported', isUnsupported);
  };

  return {
    element: container,
    showLoading: () => {
      for (const definition of CARD_DEFINITIONS) {
        setValueSkeleton(definition.key);
        const deltaElement = deltaElementByKey.get(definition.key);
        if (deltaElement !== undefined) {
          deltaElement.textContent = '';
          deltaElement.className = 'summary-delta';
        }
      }
    },
    showValues: (values) => {
      setValue('todayViews', formatCount(values.todayViews));
    },
    showPeriodSummary: (views, visitors) => {
      setValue('totalViews', formatCount(views));
      setValue('visitors', formatCount(visitors));
      setValue('viewsPerVisitor', formatViewsPerVisitor(views, visitors));
      setNote(
        'viewsPerVisitor',
        visitors > 0 ? `${formatCount(views)} / ${formatCount(visitors)}` : findDefaultNote('viewsPerVisitor'),
      );
    },
    showPlaceholder: (key) => setValue(key, MISSING_TEXT),
    showBotRatio: (botFootprints, totalFootprints) => {
      setBotUnsupportedFlag(false);
      if (totalFootprints <= 0) {
        setValue('botRatio', MISSING_TEXT);
        setNote('botRatio', '이 기간에는 데이터가 없습니다.');
        return;
      }
      setValue('botRatio', formatPercentage(computeBotRatio(botFootprints, totalFootprints)));
      setNote('botRatio', `${formatCount(botFootprints)} / ${formatCount(totalFootprints)}`);
    },
    showBotUnsupported: (messageText) => {
      setBotUnsupportedFlag(true);
      setValue('botRatio', '미지원');
      setNote('botRatio', messageText.length > 0 ? messageText : findDefaultNote('botRatio'));
    },
    showBotFailure: (messageText) => {
      setBotUnsupportedFlag(false);
      setValue('botRatio', MISSING_TEXT);
      setNote('botRatio', messageText.length > 0 ? messageText : findDefaultNote('botRatio'));
    },
    setDelta: (key, delta) => {
      const element = deltaElementByKey.get(key);
      if (element === undefined) {
        return;
      }
      if (delta === null) {
        element.textContent = '';
        element.className = 'summary-delta';
        return;
      }
      element.textContent = delta.text;
      element.className = `summary-delta delta-${delta.direction}`;
    },
    setSparkline: (key, values) => {
      const element = sparklineContainerByKey.get(key);
      if (element === undefined) {
        return;
      }
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      // One point is not a trend, and zero points is a card whose query failed.
      if (values.length < 2) {
        element.remove();
        return;
      }

      // No width/height attributes: the svg is sized by CSS (.kpi-sparkline) so the line stretches
      // to whatever the card is, instead of forcing a fixed pixel width that overflowed the card on
      // a 375px screen.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'kpi-sparkline');
      svg.setAttribute('viewBox', `0 0 ${SPARKLINE_VIEWBOX_WIDTH} ${SPARKLINE_VIEWBOX_HEIGHT}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      // The numbers are already on the card and in the trend chart; the line is decoration.
      svg.setAttribute('aria-hidden', 'true');

      const maximumValue = Math.max(...values, 1);
      const points = values
        .map((value, index) => {
          const x = (index / (values.length - 1)) * SPARKLINE_VIEWBOX_WIDTH;
          const y = SPARKLINE_BASELINE_Y - (value / maximumValue) * SPARKLINE_AMPLITUDE;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${points}`);
      svg.appendChild(path);
      element.appendChild(svg);

      const card = cardElementByKey.get(key);
      if (card !== undefined && element.parentElement === null) {
        card.appendChild(element);
      }
    },
  };
}
