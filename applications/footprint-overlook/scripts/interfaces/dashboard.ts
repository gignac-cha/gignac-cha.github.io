// 대시보드 오케스트레이션 계층입니다. 섹션 조립 + 기간 선택에 따른 6개 쿼리 병렬 로드 + 섹션별 상태 갱신을 담당합니다.
// 데이터 가공은 전부 순수 tools 모듈에 위임하고, 이 파일은 "언제 무엇을 그릴지"의 배선만 맡습니다.

import { computeDateRange, formatLocalDate } from '../tools/date-ranges.ts';
import { shortenHref } from '../tools/formatting.ts';
import {
  findValueForDay,
  isEmptyPeriod,
  sumDailyValues,
} from '../tools/summaries.ts';
import {
  type BotsByDayRow,
  type FootprintsByDayRow,
  type RecentFootprintRow,
  type TopOriginRow,
  type TopPageRow,
  type UniqueVisitorsByDayRow,
  fetchQuery,
  QUERY_NAMES,
} from '../tools/tracker-client.ts';
import { type BotDayValue, fillMissingBotDays, fillMissingDays, toBotFootprintSeries } from '../tools/zero-filling.ts';
import { createRangeControls } from './date-range-controls.ts';
import { createLineChart } from './line-chart.ts';
import { createEndpointBar } from './page-shells.ts';
import { createRankedBarList } from './ranked-bars.ts';
import { createRecentTable } from './recent-table.ts';
import { createSection } from './section-states.ts';
import { createSummaryCards } from './summary-cards.ts';

const DEFAULT_RANGE_DAYS = 30;
const RECENT_LIMIT = 20;

// 실패 사유에서 사용자에게 보여 줄 메시지를 뽑습니다(TrackerError.message 는 상단 스트림 원문).
function toErrorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  return String(reason);
}

// 대시보드 전체 요소를 만들고 초기 로드를 시작합니다.
export function createDashboard(options: { endpoint: string; onChangeEndpoint: () => void }): HTMLElement {
  const root = document.createElement('div');
  root.className = 'dashboard';

  const endpointBar = createEndpointBar({ onChange: options.onChangeEndpoint });
  endpointBar.setEndpoint(options.endpoint);
  root.appendChild(endpointBar.element);

  const rangeControls = createRangeControls({ onSelect: (days) => void loadRange(days) });
  root.appendChild(rangeControls.element);

  const summaryCards = createSummaryCards();
  root.appendChild(summaryCards.element);

  const chartSection = createSection({
    title: '일별 추이',
    subtitle: '발자국 · 고유 방문자 · 봇 발자국 (빈 날은 0 으로 채움)',
    className: 'chart-panel',
  });
  root.appendChild(chartSection.element);
  const lineChart = createLineChart();

  const rankRow = document.createElement('div');
  rankRow.className = 'rank-row';
  const pagesSection = createSection({ title: '상위 페이지', subtitle: 'top-pages', className: 'rank-panel' });
  const originsSection = createSection({ title: '상위 출처', subtitle: 'top-origins', className: 'rank-panel' });
  rankRow.appendChild(pagesSection.element);
  rankRow.appendChild(originsSection.element);
  root.appendChild(rankRow);

  const recentSection = createSection({ title: '최근 발자국', subtitle: 'recent-footprints', className: 'recent-panel' });
  root.appendChild(recentSection.element);

  // 빠른 연속 선택 시 뒤늦게 도착한 이전 요청이 화면을 덮어쓰지 않도록 토큰으로 최신 요청만 반영합니다.
  let activeRequestToken = 0;

  async function loadRange(days: number): Promise<void> {
    const requestToken = (activeRequestToken += 1);

    const today = new Date();
    const range = computeDateRange(days, today);
    const todayText = formatLocalDate(today);

    rangeControls.setActiveDays(days);
    summaryCards.showLoading();
    chartSection.showLoading('차트를 불러오는 중…');
    pagesSection.showLoading();
    originsSection.showLoading();
    recentSection.showLoading();

    const dayParameters = { from: range.from, to: range.to };
    const [footprintsResult, visitorsResult, botsResult, pagesResult, originsResult, recentResult] =
      await Promise.allSettled([
        fetchQuery<FootprintsByDayRow>(options.endpoint, QUERY_NAMES.footprintsByDay, dayParameters),
        fetchQuery<UniqueVisitorsByDayRow>(options.endpoint, QUERY_NAMES.uniqueVisitorsByDay, dayParameters),
        fetchQuery<BotsByDayRow>(options.endpoint, QUERY_NAMES.botsByDay, dayParameters),
        fetchQuery<TopPageRow>(options.endpoint, QUERY_NAMES.topPages, dayParameters),
        fetchQuery<TopOriginRow>(options.endpoint, QUERY_NAMES.topOrigins, dayParameters),
        fetchQuery<RecentFootprintRow>(options.endpoint, QUERY_NAMES.recentFootprints, { limit: RECENT_LIMIT }),
      ]);

    // 더 최신 요청이 시작됐다면 이 응답은 버립니다.
    if (requestToken !== activeRequestToken) {
      return;
    }

    // by-day 계열은 실패해도 빈 rows 로 취급해 항상 전 구간을 0 으로 채웁니다(시리즈 길이 일치 보장).
    const footprintRows = footprintsResult.status === 'fulfilled' ? footprintsResult.value.rows : [];
    const visitorRows = visitorsResult.status === 'fulfilled' ? visitorsResult.value.rows : [];
    const footprintSeries = fillMissingDays(footprintRows, range.from, range.to, 'footprints');
    const visitorSeries = fillMissingDays(visitorRows, range.from, range.to, 'visitors');

    // bots-by-day 는 실패(미지원 404 포함) 시 null 로 두어 봇 카드/시리즈를 정중히 비활성화합니다.
    const botDayValues =
      botsResult.status === 'fulfilled' ? fillMissingBotDays(botsResult.value.rows, range.from, range.to) : null;

    renderSummary({ footprintsResult, visitorsResult, botsResult, pagesResult, footprintSeries, visitorSeries, botDayValues, todayText });
    renderChart({ footprintsResult, visitorsResult, footprintSeries, visitorSeries, botDayValues });
    renderPages(pagesResult);
    renderOrigins(originsResult);
    renderRecent(recentResult);
  }

  function renderSummary(context: {
    footprintsResult: PromiseSettledResult<{ rows: FootprintsByDayRow[] }>;
    visitorsResult: PromiseSettledResult<{ rows: UniqueVisitorsByDayRow[] }>;
    botsResult: PromiseSettledResult<{ rows: BotsByDayRow[] }>;
    pagesResult: PromiseSettledResult<{ rows: TopPageRow[] }>;
    footprintSeries: ReturnType<typeof fillMissingDays>;
    visitorSeries: ReturnType<typeof fillMissingDays>;
    botDayValues: BotDayValue[] | null;
    todayText: string;
  }): void {
    summaryCards.showValues({
      totalFootprints: sumDailyValues(context.footprintSeries),
      dailyVisitorsSum: sumDailyValues(context.visitorSeries),
      todayFootprints: findValueForDay(context.footprintSeries, context.todayText),
      activePages: context.pagesResult.status === 'fulfilled' ? context.pagesResult.value.rows.length : 0,
    });

    // 개별 쿼리가 실패한 카드는 대시(—)로 되돌려 "0 처럼 보이는 오해"를 막습니다.
    if (context.footprintsResult.status === 'rejected') {
      summaryCards.showPlaceholder('totalFootprints');
      summaryCards.showPlaceholder('todayFootprints');
    }
    if (context.visitorsResult.status === 'rejected') {
      summaryCards.showPlaceholder('dailyVisitorsSum');
    }
    if (context.pagesResult.status === 'rejected') {
      summaryCards.showPlaceholder('activePages');
    }

    // 봇 비율: bots-by-day 자체의 두 필드(footprints, bot_footprints) 합으로 계산합니다(자기완결적).
    if (context.botDayValues === null) {
      summaryCards.showBotUnsupported(
        context.botsResult.status === 'rejected' ? toErrorMessage(context.botsResult.reason) : '',
      );
    } else {
      const botFootprints = context.botDayValues.reduce((total, day) => total + day.botFootprints, 0);
      const totalFootprints = context.botDayValues.reduce((total, day) => total + day.footprints, 0);
      summaryCards.showBotRatio(botFootprints, totalFootprints);
    }
  }

  function renderChart(context: {
    footprintsResult: PromiseSettledResult<unknown>;
    visitorsResult: PromiseSettledResult<unknown>;
    footprintSeries: ReturnType<typeof fillMissingDays>;
    visitorSeries: ReturnType<typeof fillMissingDays>;
    botDayValues: BotDayValue[] | null;
  }): void {
    // 두 핵심 by-day 쿼리가 모두 실패하면 상단 스트림 오류를 그대로 보여 줍니다.
    if (context.footprintsResult.status === 'rejected' && context.visitorsResult.status === 'rejected') {
      chartSection.showError(toErrorMessage(context.footprintsResult.reason));
      return;
    }
    if (isEmptyPeriod(context.footprintSeries) && isEmptyPeriod(context.visitorSeries)) {
      chartSection.showEmpty('이 기간에는 발자국이 없습니다.');
      return;
    }
    chartSection.showContent(lineChart.element);
    // bots-by-day 가 없으면 봇 시리즈는 null 로 넘겨 생략합니다.
    const botSeries = context.botDayValues === null ? null : toBotFootprintSeries(context.botDayValues);
    lineChart.render(context.footprintSeries, context.visitorSeries, botSeries);
  }

  function renderPages(pagesResult: PromiseSettledResult<{ rows: TopPageRow[] }>): void {
    if (pagesResult.status === 'rejected') {
      pagesSection.showError(toErrorMessage(pagesResult.reason));
      return;
    }
    const rows = pagesResult.value.rows;
    if (rows.length === 0) {
      pagesSection.showEmpty('상위 페이지가 없습니다.');
      return;
    }
    pagesSection.showContent(
      createRankedBarList(rows.map((row) => ({ label: shortenHref(row.href), fullLabel: row.href, value: row.footprints }))),
    );
  }

  function renderOrigins(originsResult: PromiseSettledResult<{ rows: TopOriginRow[] }>): void {
    if (originsResult.status === 'rejected') {
      originsSection.showError(toErrorMessage(originsResult.reason));
      return;
    }
    const rows = originsResult.value.rows;
    if (rows.length === 0) {
      originsSection.showEmpty('상위 출처가 없습니다.');
      return;
    }
    originsSection.showContent(
      createRankedBarList(rows.map((row) => ({ label: shortenHref(row.origin), fullLabel: row.origin, value: row.footprints }))),
    );
  }

  function renderRecent(recentResult: PromiseSettledResult<{ rows: RecentFootprintRow[] }>): void {
    if (recentResult.status === 'rejected') {
      recentSection.showError(toErrorMessage(recentResult.reason));
      return;
    }
    const rows = recentResult.value.rows;
    if (rows.length === 0) {
      recentSection.showEmpty('아직 발자국이 없습니다.');
      return;
    }
    recentSection.showContent(createRecentTable(rows));
  }

  // 초기 로드(기본 30일)를 시작합니다.
  void loadRange(DEFAULT_RANGE_DAYS);

  return root;
}
