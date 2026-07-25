// Dashboard orchestration: assembles the sections, loads every query for the selected range, and
// drives the per-section states. All data shaping is delegated to the pure tools modules, so this
// file only decides WHAT to draw and WHEN.

import { computeDateRange, formatUTCDate } from '../tools/date-ranges.ts';
import {
  compareWidthBuckets,
  DIRECT_REFERRER_LABEL,
  mergeDirectReferrers,
  toColorSchemeLabel,
  toCountryLabel,
  toPlatformLabel,
  toReferrerLabel,
  toWidthBucketLabel,
  UNREPORTED_LABEL,
} from '../tools/dimension-labels.ts';
import { formatCount, shortenHref, summarizeArguments, toDisplayText } from '../tools/formatting.ts';
import { createRequestTokenGuard } from '../tools/request-tokens.ts';
import {
  findValueForDay,
  isEmptyPeriod,
} from '../tools/summaries.ts';
import {
  type BotsByDayRow,
  type FootprintsByDayRow,
  type PeriodSummaryRow,
  type RecentFootprintRow,
  type TopEventRow,
  type TopLanguageRow,
  type TopPageRow,
  type TopPlatformRow,
  type TopReferrerRow,
  type UniqueVisitorsByDayRow,
  type VerifiedBotCategoryRow,
  type ViewsByColorSchemeRow,
  type ViewsByCountryRow,
  type ViewsByHourRow,
  type ViewsByScreenWidthRow,
  fetchQuery,
  QUERY_NAMES,
} from '../tools/tracker-client.ts';
import {
  type BotDayValue,
  fillMissingBotDays,
  fillMissingDays,
  fillMissingHours,
  toBotFootprintSeries,
} from '../tools/zero-filling.ts';
import { createRangeControls } from './date-range-controls.ts';
import { createGroupedRanks, type RankedGroup } from './grouped-ranks.ts';
import { createHourBars } from './hour-bars.ts';
import { createLineChart } from './line-chart.ts';
import { createEndpointBar } from './page-shells.ts';
import { createRankedBarList, type RankedItem } from './ranked-bars.ts';
import {
  normalizeHighlightUUID,
  readHighlightedUUID,
  writeHighlightedUUID,
} from '../tools/highlight-uuid.ts';
import { createRecentTable } from './recent-table.ts';
import { createSection, type SectionHandle } from './section-states.ts';
import { createSummaryCards } from './summary-cards.ts';

const DEFAULT_RANGE_DAYS = 30;
const RECENT_LIMIT = 20;
// The language list shares a panel with two other dimensions, so it is capped well below the
// tracker's default of 10 — the long tail of regional variants would push the other two groups off
// the card without adding a finding.
const TOP_LANGUAGE_LIMIT = 5;

// Extracts the message to show from a rejected load (TrackerError.message is the upstream text).
function toErrorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  return String(reason);
}

// Two panels side by side (one row of the layout), stacking on narrow screens via CSS alone.
function createPanelRow(...sections: ReadonlyArray<SectionHandle>): HTMLElement {
  const row = document.createElement('div');
  row.className = 'rank-row';
  for (const section of sections) {
    row.appendChild(section.element);
  }
  return row;
}

// Builds the whole dashboard and starts the initial load.
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
    subtitle: '페이지 뷰 · 방문자 · 봇 (UTC 기준, 빈 날은 0 으로 채움)',
    className: 'chart-panel',
  });
  root.appendChild(chartSection.element);
  const lineChart = createLineChart();

  const pagesSection = createSection({ title: '상위 페이지', subtitle: 'top-pages', className: 'rank-panel' });
  // The referrer is what the BROWSER reported as the previous page (document.referrer), which is a
  // different question from the `origin` column the old 상위 오리진 panel showed — that one came
  // from the request's Origin header and only ever named the tracked site itself. This panel
  // replaces it because "where do readers come from" is the question that was actually being asked
  // of the old one.
  const referrersSection = createSection({
    title: '유입 경로',
    subtitle: 'top-referrers · document.referrer',
    className: 'rank-panel',
  });
  root.appendChild(createPanelRow(pagesSection, referrersSection));

  const countriesSection = createSection({
    title: '국가별 방문',
    subtitle: 'views-by-country · cf.country',
    className: 'rank-panel',
  });
  const hoursSection = createSection({
    title: '시간대 분포 (UTC)',
    subtitle: 'views-by-hour · 24개 구간, 빈 시간은 0 으로 채움',
    className: 'rank-panel',
  });
  root.appendChild(createPanelRow(countriesSection, hoursSection));

  const platformsSection = createSection({
    title: '플랫폼·기기',
    subtitle: 'top-platforms · User-Agent Client Hints',
    className: 'rank-panel',
  });
  const environmentSection = createSection({
    title: '방문 환경',
    subtitle: 'views-by-color-scheme · top-languages · views-by-screen-width',
    className: 'rank-panel',
  });
  root.appendChild(createPanelRow(platformsSection, environmentSection));

  const eventsSection = createSection({
    title: '이벤트',
    subtitle: 'top-events · footprint(...) 호출 인자',
    className: 'rank-panel',
  });
  const botCategoriesSection = createSection({
    title: '봇 분류',
    subtitle: 'verified-bot-categories · Cloudflare 검증 봇',
    className: 'rank-panel',
  });
  root.appendChild(createPanelRow(eventsSection, botCategoriesSection));

  const recentSection = createSection({ title: '최근 조회', subtitle: 'recent-footprints', className: 'recent-panel' });
  root.appendChild(recentSection.element);

  const rankedSections = [
    pagesSection,
    referrersSection,
    countriesSection,
    hoursSection,
    platformsSection,
    environmentSection,
    eventsSection,
    botCategoriesSection,
  ];

  // Only the newest load may paint: rapid preset clicks otherwise let an earlier range's
  // responses land last and overwrite the screen.
  const requestTokenGuard = createRequestTokenGuard();

  async function loadRange(days: number): Promise<void> {
    const requestToken = requestTokenGuard.issue();

    // The whole time axis is UTC — the collector stamps received_at in UTC and the tracker
    // buckets days from that string, so "today" here must be the UTC day or the newest bar and
    // the today card would drift by the viewer's offset (nine hours in KST).
    const today = new Date();
    const range = computeDateRange(days, today);
    const todayText = formatUTCDate(today);

    rangeControls.setActiveDays(days);
    summaryCards.showLoading();
    chartSection.showLoading('차트를 불러오는 중…');
    for (const section of rankedSections) {
      section.showLoading();
    }
    recentSection.showLoading();

    // include_owner is deliberately never sent, here or anywhere else: the client cannot express
    // it at all (see QueryParameters in tools/tracker-client.ts), which is what makes "the
    // operator's own visits are excluded" a property of the viewer rather than a habit at each of
    // these fifteen call sites.
    const dayParameters = { from: range.from, to: range.to };
    // Promise.allSettled, not Promise.all: one failing query must not blank the other fourteen
    // sections. Each result is unwrapped independently below.
    const [
      footprintsResult,
      visitorsResult,
      botsResult,
      periodSummaryResult,
      pagesResult,
      referrersResult,
      countriesResult,
      hoursResult,
      platformsResult,
      colorSchemesResult,
      languagesResult,
      screenWidthsResult,
      eventsResult,
      botCategoriesResult,
      recentResult,
    ] = await Promise.allSettled([
      fetchQuery<FootprintsByDayRow>(options.endpoint, QUERY_NAMES.footprintsByDay, dayParameters),
      fetchQuery<UniqueVisitorsByDayRow>(options.endpoint, QUERY_NAMES.uniqueVisitorsByDay, dayParameters),
      fetchQuery<BotsByDayRow>(options.endpoint, QUERY_NAMES.botsByDay, dayParameters),
      fetchQuery<PeriodSummaryRow>(options.endpoint, QUERY_NAMES.periodSummary, dayParameters),
      fetchQuery<TopPageRow>(options.endpoint, QUERY_NAMES.topPages, dayParameters),
      fetchQuery<TopReferrerRow>(options.endpoint, QUERY_NAMES.topReferrers, dayParameters),
      fetchQuery<ViewsByCountryRow>(options.endpoint, QUERY_NAMES.viewsByCountry, dayParameters),
      fetchQuery<ViewsByHourRow>(options.endpoint, QUERY_NAMES.viewsByHour, dayParameters),
      fetchQuery<TopPlatformRow>(options.endpoint, QUERY_NAMES.topPlatforms, dayParameters),
      fetchQuery<ViewsByColorSchemeRow>(options.endpoint, QUERY_NAMES.viewsByColorScheme, dayParameters),
      fetchQuery<TopLanguageRow>(options.endpoint, QUERY_NAMES.topLanguages, {
        ...dayParameters,
        limit: TOP_LANGUAGE_LIMIT,
      }),
      fetchQuery<ViewsByScreenWidthRow>(options.endpoint, QUERY_NAMES.viewsByScreenWidth, dayParameters),
      fetchQuery<TopEventRow>(options.endpoint, QUERY_NAMES.topEvents, dayParameters),
      fetchQuery<VerifiedBotCategoryRow>(options.endpoint, QUERY_NAMES.verifiedBotCategories, dayParameters),
      fetchQuery<RecentFootprintRow>(options.endpoint, QUERY_NAMES.recentFootprints, { limit: RECENT_LIMIT }),
    ]);

    // A newer load started while these were in flight: discard them.
    if (!requestTokenGuard.isCurrent(requestToken)) {
      return;
    }

    // A failed by-day query is treated as empty rows so the two series still span the full window
    // and stay index-aligned with each other and with the x-axis labels.
    const footprintRows = footprintsResult.status === 'fulfilled' ? footprintsResult.value.rows : [];
    const visitorRows = visitorsResult.status === 'fulfilled' ? visitorsResult.value.rows : [];
    const footprintSeries = fillMissingDays(footprintRows, range.from, range.to, 'footprints');
    const visitorSeries = fillMissingDays(visitorRows, range.from, range.to, 'visitors');

    // bots-by-day is optional: null (rather than an empty series) marks "no bot data", which
    // disables the card and the third line instead of drawing a flat zero that reads as "no bots".
    const botDayValues =
      botsResult.status === 'fulfilled' ? fillMissingBotDays(botsResult.value.rows, range.from, range.to) : null;

    renderSummary({ footprintsResult, botsResult, periodSummaryResult, footprintSeries, botDayValues, todayText });
    renderChart({ footprintsResult, visitorsResult, footprintSeries, visitorSeries, botDayValues });

    renderRankedPanel(pagesSection, pagesResult, '상위 페이지가 없습니다.', (rows) =>
      // href is nullable (GROUP BY over a column the collector may have stored as null), so the
      // label and the tooltip both go through the formatters rather than the raw value.
      rows.map((row) => ({
        label: shortenHref(row.href),
        fullLabel: toDisplayText(row.href, '값 없음 (href 미기록)'),
        value: row.footprints,
      })),
    );

    renderRankedPanel(referrersSection, referrersResult, '유입 경로 데이터가 없습니다.', (rows) =>
      // Folded first: the tracker returns '' and NULL as two rows that both mean "direct or
      // suppressed", so drawing them unmerged would produce two identically labelled bars.
      mergeDirectReferrers(rows).map((row) => ({
        label: toReferrerLabel(row.referrer),
        fullLabel: toDisplayText(row.referrer, DIRECT_REFERRER_LABEL),
        value: row.views,
      })),
    );

    renderRankedPanel(countriesSection, countriesResult, '국가 데이터가 없습니다.', (rows) =>
      // The bar length is views; the distinct-visitor count rides along in the tooltip, because a
      // country with many views from one visitor tells a different story from the same bar built
      // out of fifty.
      rows.map((row) => ({
        label: toCountryLabel(row.country),
        fullLabel: `${toCountryLabel(row.country)} (${toDisplayText(row.country)}) · 방문자 ${formatCount(row.visitors)}`,
        value: row.views,
      })),
    );

    renderHours(hoursResult);

    renderRankedPanel(platformsSection, platformsResult, '플랫폼 데이터가 없습니다.', (rows) =>
      rows.map((row) => ({
        label: toPlatformLabel(row.platform, row.mobile),
        fullLabel: `${toPlatformLabel(row.platform, row.mobile)} · mobile=${String(row.mobile)}`,
        value: row.views,
      })),
    );

    renderEnvironment({ colorSchemesResult, languagesResult, screenWidthsResult });

    renderRankedPanel(eventsSection, eventsResult, '수집된 이벤트가 없습니다.', (rows) =>
      // `arguments` arrives as the JSON array string the library sent; summarizeArguments turns it
      // into a readable line and the tooltip keeps the raw text for anything it truncated.
      rows.map((row) => ({
        label: summarizeArguments(row.arguments),
        fullLabel: toDisplayText(row.arguments),
        value: row.views,
      })),
    );

    renderRankedPanel(botCategoriesSection, botCategoriesResult, '검증된 봇 트래픽이 없습니다.', (rows) =>
      // The only dimension with no null bucket: the tracker filters the empty category away, so
      // every row here is a category Cloudflare actually verified.
      rows.map((row) => ({
        label: row.category,
        fullLabel: row.category,
        value: row.views,
      })),
    );

    renderRecent(recentResult);
  }

  function renderSummary(context: {
    footprintsResult: PromiseSettledResult<{ rows: FootprintsByDayRow[] }>;
    botsResult: PromiseSettledResult<{ rows: BotsByDayRow[] }>;
    periodSummaryResult: PromiseSettledResult<{ rows: PeriodSummaryRow[] }>;
    footprintSeries: ReturnType<typeof fillMissingDays>;
    botDayValues: BotDayValue[] | null;
    todayText: string;
  }): void {
    summaryCards.showValues({
      todayViews: findValueForDay(context.footprintSeries, context.todayText),
    });

    // A card whose query failed reverts to a dash: 0 would read as a real measurement.
    if (context.footprintsResult.status === 'rejected') {
      summaryCards.showPlaceholder('todayViews');
    }

    // period-summary answers with exactly one row and feeds THREE cards — 총 페이지 뷰, 방문자,
    // 방문자당 페이지 뷰 — so they always agree or fail together (summing footprints-by-day for
    // the total instead would let the total and the ratio's numerator diverge on partial
    // failure). A fulfilled response with no row at all is treated like a failure rather than
    // like zeros — an aggregate query that returns nothing has told us nothing, and "0 visitors"
    // is a claim.
    const summaryRow = context.periodSummaryResult.status === 'fulfilled'
      ? context.periodSummaryResult.value.rows[0]
      : undefined;
    if (summaryRow === undefined) {
      summaryCards.showPlaceholder('totalViews');
      summaryCards.showPlaceholder('visitors');
      summaryCards.showPlaceholder('viewsPerVisitor');
    } else {
      summaryCards.showPeriodSummary(summaryRow.views, summaryRow.visitors);
    }

    // The bot ratio is computed from the two columns of bots-by-day alone, never by dividing by
    // footprints-by-day: a self-contained pair cannot disagree with itself if one query fails.
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
    // Only when BOTH core series failed is the chart an error; one surviving series is still a
    // chart worth drawing.
    if (context.footprintsResult.status === 'rejected' && context.visitorsResult.status === 'rejected') {
      chartSection.showError(toErrorMessage(context.footprintsResult.reason));
      return;
    }
    if (isEmptyPeriod(context.footprintSeries) && isEmptyPeriod(context.visitorSeries)) {
      chartSection.showEmpty('이 기간에는 데이터가 없습니다.');
      return;
    }
    chartSection.showContent(lineChart.element);
    const botSeries = context.botDayValues === null ? null : toBotFootprintSeries(context.botDayValues);
    lineChart.render(context.footprintSeries, context.visitorSeries, botSeries);
  }

  // The one shape every ranked panel shares: rejected -> the upstream message, no rows -> a
  // panel-specific empty sentence, otherwise the bars. Written once so a panel added later cannot
  // quietly skip the failure isolation the allSettled above exists for.
  function renderRankedPanel<Row>(
    section: SectionHandle,
    result: PromiseSettledResult<{ rows: Row[] }>,
    emptyText: string,
    toItems: (rows: Row[]) => RankedItem[],
  ): void {
    if (result.status === 'rejected') {
      section.showError(toErrorMessage(result.reason));
      return;
    }
    const rows = result.value.rows;
    if (rows.length === 0) {
      section.showEmpty(emptyText);
      return;
    }
    section.showContent(createRankedBarList(toItems(rows)));
  }

  function renderHours(hoursResult: PromiseSettledResult<{ rows: ViewsByHourRow[] }>): void {
    if (hoursResult.status === 'rejected') {
      hoursSection.showError(toErrorMessage(hoursResult.reason));
      return;
    }
    // Zero-filled to all 24 bins before the emptiness test: the response is sparse, so "no rows"
    // and "every bin is zero" are the same period, and both must reach the empty state rather than
    // drawing 24 flat bars that look like a rendering bug.
    const hourValues = fillMissingHours(hoursResult.value.rows, 'views');
    if (hourValues.every((bin) => bin.value === 0)) {
      hoursSection.showEmpty('이 기간에는 데이터가 없습니다.');
      return;
    }
    hoursSection.showContent(createHourBars(hourValues));
  }

  // 방문 환경 is the one panel fed by three queries, so its failure isolation is finer-grained
  // than the others': each group is dropped on its own, and only a panel with nothing left to show
  // falls back to the error state.
  function renderEnvironment(context: {
    colorSchemesResult: PromiseSettledResult<{ rows: ViewsByColorSchemeRow[] }>;
    languagesResult: PromiseSettledResult<{ rows: TopLanguageRow[] }>;
    screenWidthsResult: PromiseSettledResult<{ rows: ViewsByScreenWidthRow[] }>;
  }): void {
    const groups: RankedGroup[] = [];

    if (context.colorSchemesResult.status === 'fulfilled') {
      groups.push({
        title: '색 구성표',
        emptyText: '색 구성표 데이터가 없습니다.',
        items: context.colorSchemesResult.value.rows.map((row) => ({
          label: toColorSchemeLabel(row.color_scheme),
          fullLabel: toDisplayText(row.color_scheme, UNREPORTED_LABEL),
          value: row.views,
        })),
      });
    }

    if (context.languagesResult.status === 'fulfilled') {
      groups.push({
        title: '상위 언어',
        emptyText: '언어 데이터가 없습니다.',
        items: context.languagesResult.value.rows.map((row) => ({
          label: toDisplayText(row.language, UNREPORTED_LABEL),
          fullLabel: toDisplayText(row.language, UNREPORTED_LABEL),
          value: row.views,
        })),
      });
    }

    if (context.screenWidthsResult.status === 'fulfilled') {
      groups.push({
        title: '화면 폭',
        emptyText: '화면 폭 데이터가 없습니다.',
        // Sorted narrow-to-wide rather than by count: this is a distribution over an ORDERED
        // dimension, and ranking it by size would scramble the only axis it has. The rows arrive
        // ordered by views (the query ranks every dimension the same way), so the sort happens
        // here — on a copy, because the response array is not this function's to mutate.
        items: [...context.screenWidthsResult.value.rows]
          .sort((left, right) => compareWidthBuckets(left.width_bucket, right.width_bucket))
          .map((row) => ({
            label: toWidthBucketLabel(row.width_bucket),
            fullLabel: toDisplayText(row.width_bucket, UNREPORTED_LABEL),
            value: row.views,
          })),
      });
    }

    if (groups.length === 0) {
      // All three rejected. They went to the same tracker over the same connection, so the first
      // message describes the failure as well as concatenating three copies of it would.
      const rejections = [context.colorSchemesResult, context.languagesResult, context.screenWidthsResult].filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      environmentSection.showError(
        rejections.length > 0 ? toErrorMessage(rejections[0].reason) : '방문 환경 데이터를 불러오지 못했습니다.',
      );
      return;
    }
    if (groups.every((group) => group.items.length === 0)) {
      environmentSection.showEmpty('방문 환경 데이터가 없습니다.');
      return;
    }
    environmentSection.showContent(createGroupedRanks(groups));
  }

  // Visitor highlighting state. The uuid survives reloads via storage; the rows are kept so a
  // highlight change repaints WITHOUT refetching — the toggle only changes presentation, and a
  // network round trip per click would reorder rows mid-interaction.
  let highlightedUUID = readHighlightedUUID();
  let recentRows: RecentFootprintRow[] = [];

  function applyHighlight(uuidValue: string | null): void {
    // Clicking the already-highlighted visitor toggles the highlight off.
    highlightedUUID = uuidValue !== null && uuidValue === highlightedUUID ? null : uuidValue;
    writeHighlightedUUID(highlightedUUID);
    renderRecentContent();
  }

  // The control bar above the table: paste a uuid (change event, so typing does not re-render
  // away the focused input) or clear the current one. Rebuilt on every render because the panel
  // body is replaced wholesale by the section state machine anyway.
  function createHighlightBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'recent-highlight-bar';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'highlight-input';
    input.placeholder = 'uuid 를 붙여넣으면 해당 방문자를 강조합니다';
    input.setAttribute('aria-label', '강조할 방문자 uuid');
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = highlightedUUID ?? '';
    input.addEventListener('change', () => {
      const normalized = normalizeHighlightUUID(input.value);
      applyHighlight(normalized.length > 0 ? normalized : null);
    });
    bar.appendChild(input);

    if (highlightedUUID !== null) {
      const matchCount = recentRows.filter((row) => row.uuid === highlightedUUID).length;
      const status = document.createElement('span');
      status.className = 'highlight-status';
      status.textContent = `${matchCount}행 강조 중`;
      bar.appendChild(status);

      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'highlight-clear-button';
      clearButton.textContent = '해제';
      clearButton.addEventListener('click', () => applyHighlight(null));
      bar.appendChild(clearButton);
    }

    return bar;
  }

  function renderRecentContent(): void {
    const container = document.createElement('div');
    container.appendChild(createHighlightBar());
    container.appendChild(
      createRecentTable(recentRows, {
        highlightedUUID,
        onToggleHighlight: (uuidValue) => applyHighlight(uuidValue),
      }),
    );
    recentSection.showContent(container);
  }

  function renderRecent(recentResult: PromiseSettledResult<{ rows: RecentFootprintRow[] }>): void {
    if (recentResult.status === 'rejected') {
      recentSection.showError(toErrorMessage(recentResult.reason));
      return;
    }
    recentRows = recentResult.value.rows;
    if (recentRows.length === 0) {
      recentSection.showEmpty('아직 조회 기록이 없습니다.');
      return;
    }
    renderRecentContent();
  }

  // Initial load (30 days by default).
  void loadRange(DEFAULT_RANGE_DAYS);

  return root;
}
