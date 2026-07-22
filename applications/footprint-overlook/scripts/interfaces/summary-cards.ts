// 요약 카드 5장(기간 총 발자국 수 / 일별 고유 방문자 합 / 오늘 발자국 / 활성 페이지 수 / 봇 비율)입니다.
// 값 계산은 순수 tools 모듈이 맡고, 여기서는 표시와 로딩/에러 상태만 다룹니다.

import { formatCount, formatPercentage } from '../tools/formatting.ts';
import { computeBotRatio } from '../tools/summaries.ts';

// 카드 하나의 정의(키·라벨·보조 설명).
interface SummaryCardDefinition {
  key: string;
  label: string;
  note: string;
}

// 고유 방문자 카드의 라벨은 "합산은 과대집계"라는 점을 정직하게 드러냅니다.
const CARD_DEFINITIONS: SummaryCardDefinition[] = [
  { key: 'totalFootprints', label: '기간 총 발자국 수', note: '선택 기간의 일별 발자국 합계' },
  { key: 'dailyVisitorsSum', label: '일별 고유 방문자 합', note: '일별 고유 방문자를 더한 값 (교차일 중복 포함)' },
  { key: 'todayFootprints', label: '오늘 발자국', note: '오늘 하루 발자국 수' },
  { key: 'activePages', label: '활성 페이지 수', note: '기간 내 발자국이 찍힌 상위 페이지 수' },
  { key: 'botRatio', label: '봇 비율', note: '봇 발자국 / 총 발자국' },
];

// 요약 카드가 표시할 값 묶음입니다(봇 비율은 별도 메서드로 세팅).
export interface SummaryValues {
  totalFootprints: number;
  dailyVisitorsSum: number;
  todayFootprints: number;
  activePages: number;
}

export interface SummaryCardsHandle {
  element: HTMLElement;
  showLoading(): void;
  showValues(values: SummaryValues): void;
  // 특정 카드만 값을 세팅할 수 없을 때(개별 쿼리 실패) 대시 표시로 되돌립니다.
  showPlaceholder(key: keyof SummaryValues): void;
  // 봇 비율 카드: 퍼센트 값 + "봇수 / 총합" 서브라인. 데이터가 없으면 '—'.
  showBotRatio(botFootprints: number, totalFootprints: number): void;
  // 봇 비율 카드: bots-by-day 쿼리 실패/미지원 시 안내.
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
    value.textContent = '—';
    card.appendChild(value);
    valueElementByKey.set(definition.key, value);

    const note = document.createElement('p');
    note.className = 'summary-note';
    note.textContent = definition.note;
    card.appendChild(note);
    noteElementByKey.set(definition.key, note);

    container.appendChild(card);
  }

  const setValue = (key: string, text: string): void => {
    const element = valueElementByKey.get(key);
    if (element) {
      element.textContent = text;
    }
  };

  const setNote = (key: string, text: string): void => {
    const element = noteElementByKey.get(key);
    if (element) {
      element.textContent = text;
    }
  };

  const defaultBotNote = CARD_DEFINITIONS.find((definition) => definition.key === 'botRatio')?.note ?? '';

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
      setValue('totalFootprints', formatCount(values.totalFootprints));
      setValue('dailyVisitorsSum', formatCount(values.dailyVisitorsSum));
      setValue('todayFootprints', formatCount(values.todayFootprints));
      setValue('activePages', formatCount(values.activePages));
    },
    showPlaceholder: (key) => setValue(key, '—'),
    showBotRatio: (botFootprints, totalFootprints) => {
      setBotUnsupportedFlag(false);
      if (totalFootprints <= 0) {
        setValue('botRatio', '—');
        setNote('botRatio', '이 기간에는 발자국이 없습니다.');
        return;
      }
      setValue('botRatio', formatPercentage(computeBotRatio(botFootprints, totalFootprints)));
      // 서브라인에 원시 카운트를 정직하게 노출합니다(예: "123 / 632").
      setNote('botRatio', `${formatCount(botFootprints)} / ${formatCount(totalFootprints)}`);
    },
    showBotUnsupported: (messageText) => {
      setBotUnsupportedFlag(true);
      setValue('botRatio', '미지원');
      setNote('botRatio', messageText.length > 0 ? messageText : defaultBotNote);
    },
  };
}
