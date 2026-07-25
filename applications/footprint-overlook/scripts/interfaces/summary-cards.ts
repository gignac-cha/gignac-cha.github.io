// The five summary cards. Arithmetic belongs to the pure tools modules; this file only renders
// values and their loading / unavailable states.

import { formatCount, formatPercentage, formatViewsPerVisitor, MISSING_TEXT } from '../tools/formatting.ts';
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
  // Bot card: bots-by-day failed or is not served by this tracker.
  showBotUnsupported(messageText: string): void;
}

export function createSummaryCards(): SummaryCardsHandle {
  const container = document.createElement('section');
  container.className = 'summary-cards';
  container.setAttribute('aria-label', '요약 지표');

  const valueElementByKey = new Map<string, HTMLElement>();
  const noteElementByKey = new Map<string, HTMLElement>();

  for (const definition of CARD_DEFINITIONS) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    if (definition.key === 'botRatio') {
      card.classList.add('summary-card-bot');
    }

    const label = document.createElement('p');
    label.className = 'summary-label';
    label.textContent = definition.label;
    card.appendChild(label);

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

    container.appendChild(card);
  }

  const setValue = (key: SummaryCardKey, text: string): void => {
    const element = valueElementByKey.get(key);
    if (element) {
      element.textContent = text;
    }
  };

  const setNote = (key: SummaryCardKey, text: string): void => {
    const element = noteElementByKey.get(key);
    if (element) {
      element.textContent = text;
    }
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
        setValue(definition.key, '…');
      }
    },
    showValues: (values) => {
      setValue('todayViews', formatCount(values.todayViews));
    },
    showPeriodSummary: (views, visitors) => {
      // All three figures come from the SAME single row, never from views summed elsewhere: a
      // total taken from footprints-by-day while the ratio's numerator comes from period-summary
      // can contradict itself the moment one of the two queries fails or lags, and "3.4 views per
      // visitor" is exactly the kind of number nobody re-derives. One source, one failure mode.
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
      // The raw counts stay visible under the percentage (e.g. "123 / 632"): a bare "19%" hides
      // whether it came from 3 page views or 30,000.
      setNote('botRatio', `${formatCount(botFootprints)} / ${formatCount(totalFootprints)}`);
    },
    showBotUnsupported: (messageText) => {
      setBotUnsupportedFlag(true);
      setValue('botRatio', '미지원');
      setNote('botRatio', messageText.length > 0 ? messageText : findDefaultNote('botRatio'));
    },
  };
}
