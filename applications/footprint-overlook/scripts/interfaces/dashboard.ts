// Dashboard orchestration: it builds every panel, drives the tracker queries in two waves and owns
// all of the page's mutable state (selected range, highlighted visitor, recent-row limit).
//
// Four mechanisms carry most of the behaviour here and are worth naming up front, because each one
// exists to fix a failure that is invisible in a happy-path click-through:
//
// 1) Stale-while-revalidate. Every query writes its rows to browser storage keyed by the arguments
//    it was asked with (tools/swr-cache.ts). A reload paints those rows in the first frame and puts
//    the 갱신 중 badge on every panel it painted, so the screen is never blank while the network
//    answers and never silently stale either — the badge names the time the cached rows were
//    fetched and disappears the moment fresh rows land.
// 2) One query, one panel, one failure. Every request settles on its own (never Promise.all over
//    the render) and paints through a plan that owns its section, so a tracker that does not serve
//    one query costs exactly one card. A 404 is singled out by STATUS, not by looking for '404' in
//    the message: any href or query string could contain those three characters.
// 3) Request generations. A range change issues a new token and responses of an older generation
//    are dropped instead of overwriting the newer screen (tools/request-tokens.ts).
// 4) Teardown. The 60-second realtime timer and the chart's ResizeObserver outlive the DOM they
//    were created for unless something cancels them, so createDashboard hands back a teardown() and
//    the page entry point calls it before replacing the view (script.ts).
//
// Two waves, not one: the five queries behind the KPI row, the trend chart and 상위 페이지 are
// fetched first and painted as soon as they land, and the remaining ~22 follow. The split is what
// keeps the top of the page from waiting on the slowest query at the bottom of it.

import { computeDateRange, type DateRange, formatUTCDate } from '../tools/date-ranges.ts';
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
import { normalizeHighlightUUID, readHighlightedUUID, writeHighlightedUUID } from '../tools/highlight-uuid.ts';
import { computePeriodDelta, computePreviousDateRange } from '../tools/period-deltas.ts';
import { createRequestTokenGuard } from '../tools/request-tokens.ts';
import { findValueForDay, isEmptyPeriod } from '../tools/summaries.ts';
import { formatCacheTime, readQueryCache, writeQueryCache } from '../tools/swr-cache.ts';
import {
  type AccessibilitySignalRow,
  type BotsByDayRow,
  type BotsByHourRow,
  type ConnectionTypeRow,
  type DeviceCapabilityRow,
  type FootprintsByDayRow,
  type NewVsReturningByDayRow,
  type PageTransitionRow,
  type PeriodSummaryRow,
  type QueryParameters,
  type QueryResult,
  type RecentFootprintRow,
  type TopEventRow,
  type TopLandingRow,
  type TopLanguageRow,
  type TopPageRow,
  type TopPlatformRow,
  type TopReferrerRow,
  type UniqueVisitorsByDayRow,
  type UtmBreakdownRow,
  type VerifiedBotCategoryRow,
  type ViewsByColorSchemeRow,
  type ViewsByCountryRow,
  type ViewsByHourRow,
  type ViewsByMinuteRow,
  type ViewsByScreenWidthRow,
  type VisitDepthRow,
  type WeeklyRetentionRow,
  fetchQueries,
  fetchQuery,
  QUERY_NAMES,
  TrackerError,
} from '../tools/tracker-client.ts';
import { parseUrlHash, serializeUrlHash } from '../tools/url-hash-state.ts';
import {
  type DayValue,
  fillMissingBotDays,
  fillMissingDays,
  fillMissingHours,
  toBotFootprintSeries,
} from '../tools/zero-filling.ts';
import { createBotsByHourPanel } from './bot-sections.ts';
import { createRangeControls } from './date-range-controls.ts';
import { createExperienceQualityPanel } from './experience-sections.ts';
import { createGroupedRanks, type RankedGroup } from './grouped-ranks.ts';
import { createHourBars } from './hour-bars.ts';
import {
  createPageTransitionsPanel,
  createTopLandingsPanel,
  createVisitorTimelinePanel,
} from './journey-sections.ts';
import { createLineChart } from './line-chart.ts';
import { createEndpointBar } from './page-shells.ts';
import { createRankedBarList, type RankedItem } from './ranked-bars.ts';
import { createViewsByMinutePanel } from './realtime-sections.ts';
import { createRecentTable } from './recent-table.ts';
import { createErrorIndicator, createSection, type SectionHandle } from './section-states.ts';
import { createSummaryCards } from './summary-cards.ts';
import {
  createTrafficClassificationPanel,
  createUtmBreakdownPanel,
} from './traffic-sections.ts';
import {
  createNewVsReturningPanel,
  createVisitDepthPanel,
  createWeeklyRetentionTable,
} from './visitor-sections.ts';

const DEFAULT_RANGE_DAYS = 30;
const INITIAL_RECENT_LIMIT = 20;
const EXPANDED_RECENT_LIMIT = 100;
// The visitor timeline asks the tracker for one uuid's rows instead of filtering the 20 newest rows
// of the whole site, which almost never contained the selected visitor at all.
const TIMELINE_LIMIT = 100;
const TOP_LANGUAGE_LIMIT = 5;
const REALTIME_MINUTES = 30;
const REALTIME_REFRESH_MILLISECONDS = 60_000;

// A settled query, in the shape the render functions consume. It is deliberately the same shape as
// PromiseSettledResult so a cached row set and a network response are indistinguishable to every
// renderer below — that is what lets the cache paint reuse the network paint's code path instead of
// growing a second, subtly different one.
type PanelResult<Row> = PromiseSettledResult<{ rows: Row[] }>;

function toFulfilledResult<Row>(rows: Row[]): PanelResult<Row> {
  return { status: 'fulfilled', value: { rows } };
}

async function toSettledResult<Row>(request: Promise<QueryResult<Row>>): Promise<PanelResult<Row>> {
  try {
    const result = await request;
    return { status: 'fulfilled', value: { rows: result.rows } };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
}

// The tracker answers 404 when it does not serve a query name at all, which is what an older worker
// deployment looks like to a newer viewer. It is detected through TrackerError.status: the previous
// version searched the MESSAGE for '404', which also matched an upstream error text that merely
// quoted a path or a status of its own.
function toErrorMessage(reason: unknown): string {
  if (reason instanceof TrackerError) {
    if (reason.status === 404) {
      return '트래커가 아직 이 쿼리를 지원하지 않습니다 (404).';
    }
    return reason.message;
  }
  if (reason instanceof Error) {
    return reason.message;
  }
  return String(reason);
}

function toResultErrorMessage(result: PanelResult<unknown>): string {
  return result.status === 'rejected' ? toErrorMessage(result.reason) : '데이터를 불러오지 못했습니다.';
}

// One query bound to the panel(s) it paints. The two preparation steps are separate because a panel
// can be fed by several queries: every cache hit paints first, and only the sections that no cached
// query reached are replaced by a skeleton (see preparePanelPlans).
interface PanelPlan {
  sections: SectionHandle[];
  paintFromCache(): boolean;
  fetchAndPaint(): Promise<void>;
}

export interface DashboardHandle {
  element: HTMLElement;
  // Cancels the realtime timer, the chart's ResizeObserver and any in-flight response, so a view
  // switch does not leave a detached dashboard polling the tracker forever.
  teardown: () => void;
}

export function createDashboard(options: { endpoint: string; onChangeEndpoint: () => void }): DashboardHandle {
  const root = document.createElement('div');
  root.className = 'dashboard';

  let recentLimit = INITIAL_RECENT_LIMIT;
  let filterOnlyThisVisitor = false;
  let activeRangeDays: number | null = DEFAULT_RANGE_DAYS;
  let activeCustomRange: DateRange | null = null;
  let highlightedUUID = readHighlightedUUID();

  // Parse initial state from the hash if present. The endpoint is never read from it (see the
  // security rule in tools/url-hash-state.ts).
  const hashState = parseUrlHash(window.location.hash);
  if (hashState.rangeDays !== undefined) {
    activeRangeDays = hashState.rangeDays;
  }
  if (hashState.dateRange) {
    activeRangeDays = null;
    activeCustomRange = hashState.dateRange;
  }
  if (hashState.highlightUUID !== undefined) {
    highlightedUUID = hashState.highlightUUID;
    writeHighlightedUUID(highlightedUUID);
  }

  const endpointBar = createEndpointBar({
    onChange: options.onChangeEndpoint,
    onRefresh: () => void loadDashboard(true),
  });
  endpointBar.setEndpoint(options.endpoint);
  root.appendChild(endpointBar.element);

  const rangeControls = createRangeControls({
    onSelectPreset: (days) => {
      activeRangeDays = days;
      activeCustomRange = null;
      rangeControls.setActiveDays(days);
      updateUrlHash();
      void loadDashboard(false);
    },
    onSelectCustom: (from, to) => {
      activeRangeDays = null;
      activeCustomRange = { from, to };
      rangeControls.setActiveDays(null);
      rangeControls.setCustomDates(from, to);
      updateUrlHash();
      void loadDashboard(false);
    },
  });
  if (activeRangeDays !== null) {
    rangeControls.setActiveDays(activeRangeDays);
  } else if (activeCustomRange) {
    rangeControls.setCustomDates(activeCustomRange.from, activeCustomRange.to);
  }
  root.appendChild(rangeControls.element);

  const summaryCards = createSummaryCards();
  root.appendChild(summaryCards.element);

  const chartSection = createSection({
    title: '일별 추이',
    subtitle: '페이지 뷰 · 방문자 · 봇 (UTC 기준, 빈 날은 0 으로 채움)',
    className: 'chart-panel dashboard-full-width',
  });
  root.appendChild(chartSection.element);
  const lineChart = createLineChart();

  const pagesSection = createSection({ title: '상위 페이지', subtitle: 'top-pages', className: 'rank-panel' });
  const referrersSection = createSection({ title: '유입 경로', subtitle: 'top-referrers · document.referrer', className: 'rank-panel' });
  root.appendChild(pagesSection.element);
  root.appendChild(referrersSection.element);

  const countriesSection = createSection({ title: '국가별 방문', subtitle: 'views-by-country · cf.country', className: 'rank-panel' });
  const hoursSection = createSection({ title: '시간대 분포', subtitle: 'views-by-hour · 24개 구간 (UTC/KST 전환 가능)', className: 'rank-panel' });
  root.appendChild(countriesSection.element);
  root.appendChild(hoursSection.element);

  const platformsSection = createSection({ title: '플랫폼·기기', subtitle: 'top-platforms · User-Agent Client Hints', className: 'rank-panel' });
  // 색 구성표 moved out of 방문 환경 and into 경험 품질: dark-mode preference is a rendering
  // condition of the visit, like the connection type and the reduced-motion preference, while this
  // panel answers "which browser, in which language, on how wide a screen".
  const environmentSection = createSection({ title: '방문 환경', subtitle: 'top-languages · views-by-screen-width', className: 'rank-panel' });
  root.appendChild(platformsSection.element);
  root.appendChild(environmentSection.element);

  const eventsSection = createSection({ title: '이벤트', subtitle: 'top-events · footprint(...) 호출 인자', className: 'rank-panel' });
  const botCategoriesSection = createSection({ title: '봇 분류', subtitle: 'verified-bot-categories · Cloudflare 검증 봇', className: 'rank-panel' });
  root.appendChild(eventsSection.element);
  root.appendChild(botCategoriesSection.element);

  const trafficClassSection = createSection({ title: '유입 분류', subtitle: 'Direct / Search / Social / AI / Other', className: 'rank-panel' });
  const utmSection = createSection({ title: 'UTM 파라미터', subtitle: 'utm-breakdown · source / medium / campaign', className: 'rank-panel' });
  root.appendChild(trafficClassSection.element);
  root.appendChild(utmSection.element);

  const newVsReturningSection = createSection({ title: '신규 vs 재방문', subtitle: 'new-vs-returning-by-day', className: 'rank-panel' });
  const visitDepthSection = createSection({ title: '방문 깊이', subtitle: 'visit-depth · 세션당 페이지 뷰', className: 'rank-panel' });
  root.appendChild(newVsReturningSection.element);
  root.appendChild(visitDepthSection.element);

  const retentionSection = createSection({ title: '주별 리텐션 매트릭스', subtitle: 'weekly-retention · 코호트 잔존율', className: 'rank-panel dashboard-full-width' });
  root.appendChild(retentionSection.element);

  const topLandingsSection = createSection({ title: '상위 랜딩 페이지', subtitle: 'top-landings', className: 'rank-panel' });
  const pageTransitionsSection = createSection({ title: '페이지 이동 경로', subtitle: 'page-transitions (상위 20)', className: 'rank-panel' });
  root.appendChild(topLandingsSection.element);
  root.appendChild(pageTransitionsSection.element);

  const timelineSection = createSection({ title: '방문자 타임라인', subtitle: 'recent-footprints · uuid 필터 · 시간순', className: 'rank-panel dashboard-full-width' });
  root.appendChild(timelineSection.element);

  const experienceQualitySection = createSection({
    title: '경험 품질',
    subtitle: 'connection-types · device-capabilities · accessibility-signals · views-by-color-scheme',
    className: 'rank-panel',
  });
  const botsByHourSection = createSection({ title: '봇 시간대 분포', subtitle: 'bots-by-hour · UTC', className: 'rank-panel' });
  root.appendChild(experienceQualitySection.element);
  root.appendChild(botsByHourSection.element);

  const realtimeSection = createSection({ title: '준실시간 활동', subtitle: 'views-by-minute · 최근 30분 활동', className: 'rank-panel dashboard-full-width' });
  root.appendChild(realtimeSection.element);

  const recentSection = createSection({ title: '최근 조회', subtitle: 'recent-footprints', className: 'recent-panel dashboard-full-width' });
  root.appendChild(recentSection.element);

  const requestTokenGuard = createRequestTokenGuard();
  let latestRequestToken = 0;
  let recentRows: RecentFootprintRow[] = [];
  let realtimeTimerId: number | null = null;

  // The two rows behind the ▲▼% indicators. Both are held because they arrive in different waves:
  // the current period lands with wave 1 and the previous one with wave 2, and whichever arrives
  // second must be able to complete the pair without re-reading the other's response.
  let currentPeriodSummaryRow: PeriodSummaryRow | null = null;
  let previousPeriodSummaryRow: PeriodSummaryRow | null = null;

  // A panel fed by more than one query (방문 환경, 경험 품질) has to keep what already arrived so a
  // later response can re-render the panel WITH it instead of replacing it.
  interface EnvironmentState {
    languages: PanelResult<TopLanguageRow> | null;
    screenWidths: PanelResult<ViewsByScreenWidthRow> | null;
  }
  // 'unsupported' marks a dimension the tracker's own catalog does not list — a version gap, not
  // a failure. It never becomes a plan (no request, no 404), and renders as a muted note.
  interface ExperienceQualityState {
    colorSchemes: PanelResult<ViewsByColorSchemeRow> | null;
    connectionTypes: PanelResult<ConnectionTypeRow> | 'unsupported' | null;
    deviceCapabilities: PanelResult<DeviceCapabilityRow> | 'unsupported' | null;
    accessibilitySignals: PanelResult<AccessibilitySignalRow> | 'unsupported' | null;
  }
  let environmentState: EnvironmentState = { languages: null, screenWidths: null };
  let experienceQualityState: ExperienceQualityState = {
    colorSchemes: null,
    connectionTypes: null,
    deviceCapabilities: null,
    accessibilitySignals: null,
  };

  // What the tracker itself says it serves (GET /queries). The dashboard ships ahead of the
  // worker — panels for queries the deployed worker does not have yet must not fire the request
  // at all: the inevitable 404 renders as a red error card and logs a console error for what is a
  // known version gap. null means the catalog could not be read, in which case NOTHING is gated
  // and behavior is exactly the pre-capability one (a wrong guess here must fail open).
  let supportedQueryNames: Set<string> | null = null;
  let recentUuidParameterSupported = false;
  const capabilityPromise = (async () => {
    try {
      const catalog = await fetchQueries(options.endpoint);
      if (catalog.length > 0) {
        supportedQueryNames = new Set(catalog.map((descriptor) => descriptor.name));
        const recentDescriptor = catalog.find((descriptor) => descriptor.name === QUERY_NAMES.recentFootprints);
        recentUuidParameterSupported =
          recentDescriptor?.parameters.some((parameter) => parameter.name === 'uuid') ?? false;
      }
    } catch {
      // Catalog unreachable: leave capability unknown and gate nothing.
    }
  })();

  function isQueryUnsupported(queryName: string): boolean {
    return supportedQueryNames !== null && !supportedQueryNames.has(queryName);
  }

  const UNSUPPORTED_PANEL_TEXT = '이 트래커 버전에는 아직 없는 지표입니다 — 트래커를 업데이트하면 자동으로 표시됩니다.';

  // The 갱신 중 badge is reference-counted per section: 방문 환경 and 경험 품질 are painted by
  // several queries, and the first one to answer must not clear a badge the others still owe.
  const pendingRefreshBySection = new Map<SectionHandle, { count: number; storedAt: number }>();

  function markSectionRefreshing(section: SectionHandle, storedAt: number): void {
    const pending = pendingRefreshBySection.get(section);
    // The OLDEST cached timestamp is the honest one to show: the panel is only as fresh as its
    // stalest ingredient.
    const nextStoredAt = pending === undefined ? storedAt : Math.min(pending.storedAt, storedAt);
    pendingRefreshBySection.set(section, { count: (pending?.count ?? 0) + 1, storedAt: nextStoredAt });
    section.setRefreshing(formatCacheTime(nextStoredAt));
  }

  function clearSectionRefreshing(section: SectionHandle): void {
    const pending = pendingRefreshBySection.get(section);
    if (pending === undefined) {
      return;
    }
    if (pending.count <= 1) {
      pendingRefreshBySection.delete(section);
      section.setRefreshing(null);
      return;
    }
    pendingRefreshBySection.set(section, { count: pending.count - 1, storedAt: pending.storedAt });
  }

  // A refresh that died while the panel is showing cached rows: the cached render stays (stale
  // data the tracker really served beats an error card that hides it), so the badge must flip to
  // 갱신 실패 instead of vanishing. The map entry is kept at count 0 on purpose — the next load's
  // clearAllRefreshBadges() still finds and clears this badge.
  function markSectionRefreshFailed(section: SectionHandle): void {
    const pending = pendingRefreshBySection.get(section);
    if (pending === undefined) {
      return;
    }
    pendingRefreshBySection.set(section, { count: 0, storedAt: pending.storedAt });
    section.setRefreshing(formatCacheTime(pending.storedAt), 'failed');
  }

  function clearAllRefreshBadges(): void {
    for (const section of pendingRefreshBySection.keys()) {
      section.setRefreshing(null);
    }
    pendingRefreshBySection.clear();
  }

  function readCachedRows<Row>(queryName: string, cacheKey: string, bypassCache: boolean): { storedAt: number; rows: Row[] } | null {
    return bypassCache ? null : readQueryCache<Row>(queryName, cacheKey);
  }

  function storeSettledRows<Row>(
    queryName: string,
    cacheKey: string,
    result: PanelResult<Row>,
    timestamp: number,
  ): void {
    if (result.status === 'fulfilled') {
      writeQueryCache(queryName, cacheKey, result.value.rows, { timestamp });
    }
  }

  // Builds the plan factory for one load generation, so every plan it produces already knows which
  // request token it belongs to and whether this load is allowed to read the cache.
  function createPlanFactory(context: { requestToken: number; bypassCache: boolean }) {
    return function createPanelPlan<Row>(definition: {
      queryName: string;
      parameters: QueryParameters;
      cacheKey: string;
      sections: SectionHandle[];
      render: (result: PanelResult<Row>) => void;
    }): PanelPlan {
      // The tracker's catalog says this query does not exist there: no request is made (so no 404
      // error card, no console noise) and the panel states the version gap as a quiet empty state.
      // Only single-owner sections may flow through here — the experience-quality dimensions share
      // one section and are gated in buildWave2Plans instead, before a plan is even created.
      if (isQueryUnsupported(definition.queryName)) {
        return {
          sections: definition.sections,
          paintFromCache: () => {
            for (const section of definition.sections) {
              section.showEmpty(UNSUPPORTED_PANEL_TEXT);
            }
            return true;
          },
          fetchAndPaint: async () => {},
        };
      }

      let markedSections: SectionHandle[] = [];

      return {
        sections: definition.sections,
        paintFromCache: () => {
          const cached = readCachedRows<Row>(definition.queryName, definition.cacheKey, context.bypassCache);
          if (cached === null) {
            return false;
          }
          definition.render(toFulfilledResult(cached.rows));
          markedSections = [...definition.sections];
          for (const section of markedSections) {
            markSectionRefreshing(section, cached.storedAt);
          }
          return true;
        },
        fetchAndPaint: async () => {
          const result = await toSettledResult(
            fetchQuery<Row>(options.endpoint, definition.queryName, definition.parameters),
          );
          if (!requestTokenGuard.isCurrent(context.requestToken)) {
            return;
          }
          storeSettledRows(definition.queryName, definition.cacheKey, result, Date.now());
          // A failed refresh on a panel that painted from the cache keeps the cached render: the
          // whole point of the cache is surviving exactly this moment, and replacing real (if
          // stale) rows with an error card would undo it. The 갱신 실패 badge carries the bad news.
          if (result.status === 'rejected' && markedSections.length > 0) {
            for (const section of markedSections) {
              markSectionRefreshFailed(section);
            }
            markedSections = [];
            return;
          }
          for (const section of markedSections) {
            clearSectionRefreshing(section);
          }
          markedSections = [];
          definition.render(result);
        },
      };
    };
  }

  // Cache paints run before any skeleton so a panel that several queries feed is not blanked by the
  // one ingredient that happened to miss the cache.
  function preparePanelPlans(plans: ReadonlyArray<PanelPlan>): void {
    const paintedSections = new Set<SectionHandle>();
    for (const plan of plans) {
      if (plan.paintFromCache()) {
        for (const section of plan.sections) {
          paintedSections.add(section);
        }
      }
    }
    const skeletonSections = new Set<SectionHandle>();
    for (const plan of plans) {
      for (const section of plan.sections) {
        if (!paintedSections.has(section)) {
          skeletonSections.add(section);
        }
      }
    }
    for (const section of skeletonSections) {
      section.showSkeleton();
    }
  }

  function updateUrlHash(): void {
    const state = {
      rangeDays: activeRangeDays ?? undefined,
      dateRange: activeCustomRange ?? undefined,
      highlightUUID: highlightedUUID ?? undefined,
    };
    const hash = serializeUrlHash(state);
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash.length > 0 ? hash : window.location.pathname);
    }
  }

  function applyHighlight(uuidValue: string | null): void {
    highlightedUUID = uuidValue !== null && uuidValue === highlightedUUID ? null : uuidValue;
    writeHighlightedUUID(highlightedUUID);
    updateUrlHash();
    renderRecentContent();
    void loadVisitorTimeline(false);
  }

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
      status.textContent = `${matchCount}행 강조 중 (${recentRows.length}건 중)`;
      bar.appendChild(status);

      const filterToggle = document.createElement('button');
      filterToggle.type = 'button';
      filterToggle.className = 'highlight-clear-button';
      filterToggle.textContent = filterOnlyThisVisitor ? '전체 보기' : '이 방문자만 보기';
      filterToggle.addEventListener('click', () => {
        filterOnlyThisVisitor = !filterOnlyThisVisitor;
        renderRecentContent();
      });
      bar.appendChild(filterToggle);

      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'highlight-clear-button';
      clearButton.textContent = '해제';
      clearButton.addEventListener('click', () => {
        filterOnlyThisVisitor = false;
        applyHighlight(null);
      });
      bar.appendChild(clearButton);
    }

    return bar;
  }

  function renderRecentContent(): void {
    const container = document.createElement('div');
    container.appendChild(createHighlightBar());

    if (filterOnlyThisVisitor && highlightedUUID !== null) {
      const notice = document.createElement('p');
      notice.className = 'panel-subtitle recent-filter-notice';
      // Says "within the rows on screen" on purpose: this filter never re-queries the tracker, so
      // it can only narrow the page it already has.
      notice.textContent = `표시 중인 ${recentRows.length}건 내 필터링 중입니다.`;
      container.appendChild(notice);
    }

    const rowsToDisplay = filterOnlyThisVisitor && highlightedUUID !== null
      ? recentRows.filter((row) => row.uuid === highlightedUUID)
      : recentRows;

    container.appendChild(
      createRecentTable(rowsToDisplay, {
        highlightedUUID,
        onToggleHighlight: (uuidValue) => applyHighlight(uuidValue),
        canLoadMore: recentLimit < EXPANDED_RECENT_LIMIT,
        nextLimit: EXPANDED_RECENT_LIMIT,
        // "더 보기" costs ONE request. It used to call loadDashboard(), which re-ran all 27 queries
        // to widen a single table.
        onLoadMore: (nextLimit) => {
          recentLimit = nextLimit;
          void createRecentFootprintsPlan({ requestToken: latestRequestToken, bypassCache: true }).fetchAndPaint();
        },
      }),
    );
    recentSection.showContent(container);
  }

  function renderRecentFootprints(result: PanelResult<RecentFootprintRow>): void {
    if (result.status === 'rejected') {
      recentSection.showError(toErrorMessage(result.reason));
      return;
    }
    recentRows = result.value.rows;
    renderRecentContent();
  }

  function createRecentFootprintsPlan(context: { requestToken: number; bypassCache: boolean }): PanelPlan {
    const requestedLimit = recentLimit;
    return createPlanFactory(context)<RecentFootprintRow>({
      queryName: QUERY_NAMES.recentFootprints,
      parameters: { limit: requestedLimit },
      // recent-footprints ignores from/to, so its cache entry is keyed by the only argument that
      // changes its rows. Mixing the date range in here would have stored one copy of the same
      // answer per range the operator ever looked at.
      cacheKey: `recent:${requestedLimit}`,
      sections: [recentSection],
      render: (result) => {
        // "더 보기" can be clicked while the first request for the smaller page is still in flight,
        // and both belong to the same load generation, so the request token cannot separate them.
        // The limit the request was made with can.
        if (requestedLimit !== recentLimit) {
          return;
        }
        renderRecentFootprints(result);
      },
    });
  }

  function renderVisitorTimeline(uuidValue: string, result: PanelResult<RecentFootprintRow>): void {
    if (result.status === 'rejected') {
      timelineSection.showError(toErrorMessage(result.reason));
      return;
    }
    // Filter client-side EVEN THOUGH the request may have carried ?uuid=: a tracker deployed
    // before that parameter existed silently ignores it and answers with the whole site's recent
    // rows — observed live, where the panel then presented other visitors' rows under this
    // visitor's title. Against a new tracker this filter is a no-op; against an old one it is the
    // difference between a correct timeline and a confidently wrong one.
    const visitorRows = result.value.rows.filter((row) => row.uuid === uuidValue);
    if (visitorRows.length === 0) {
      timelineSection.showEmpty(`선택된 방문자 [${uuidValue}] 의 최근 기록이 없습니다.`);
      return;
    }
    timelineSection.showContent(
      createVisitorTimelinePanel(uuidValue, visitorRows, () => applyHighlight(null)),
    );
  }

  // The timeline asks the tracker for the highlighted uuid instead of filtering the recent table:
  // that table holds the 20 newest rows of the WHOLE site, so a visitor who stopped browsing an
  // hour ago produced an empty timeline even though the tracker still had every one of their rows.
  function createVisitorTimelinePlan(
    uuidValue: string,
    context: { requestToken: number; bypassCache: boolean },
  ): PanelPlan {
    return createPlanFactory(context)<RecentFootprintRow>({
      queryName: QUERY_NAMES.recentFootprints,
      // The uuid parameter is sent only when the tracker's catalog declares it. An old tracker
      // ignores unknown parameters rather than rejecting them, so sending it anyway would not
      // break — but the response would be unfiltered, and caching THAT under a per-uuid key would
      // poison the cache for the day the tracker upgrades. renderVisitorTimeline filters
      // client-side either way.
      parameters: recentUuidParameterSupported
        ? { uuid: uuidValue, limit: TIMELINE_LIMIT }
        : { limit: TIMELINE_LIMIT },
      cacheKey: `timeline:${uuidValue}:${TIMELINE_LIMIT}`,
      sections: [timelineSection],
      render: (result) => {
        // The highlight can change while this request is in flight — clicking a second uuid, or
        // clearing it — and the request token cannot tell those apart because they belong to the
        // same load generation. The uuid the request was made for is the identity that matters.
        if (uuidValue !== highlightedUUID) {
          return;
        }
        renderVisitorTimeline(uuidValue, result);
      },
    });
  }

  async function loadVisitorTimeline(bypassCache: boolean): Promise<void> {
    if (highlightedUUID === null) {
      clearSectionRefreshing(timelineSection);
      timelineSection.showEmpty('방문자 UUID가 선택되었을 때 해당 방문자의 타임라인을 표시합니다.');
      return;
    }
    const uuidValue = highlightedUUID;
    const plan = createVisitorTimelinePlan(uuidValue, {
      requestToken: latestRequestToken,
      bypassCache,
    });
    preparePanelPlans([plan]);
    await plan.fetchAndPaint();
  }

  function renderPeriodDeltas(): void {
    if (currentPeriodSummaryRow === null || previousPeriodSummaryRow === null) {
      // null erases the indicator rather than drawing 0%: an arrow left over from the previous
      // range would be read as a measurement of this one.
      summaryCards.setDelta('totalViews', null);
      summaryCards.setDelta('visitors', null);
      return;
    }
    summaryCards.setDelta(
      'totalViews',
      computePeriodDelta(currentPeriodSummaryRow.views, previousPeriodSummaryRow.views),
    );
    summaryCards.setDelta(
      'visitors',
      computePeriodDelta(currentPeriodSummaryRow.visitors, previousPeriodSummaryRow.visitors),
    );
  }

  // The three states every single-query panel has, in one place: a failure is an error card naming
  // the reason, a successful response with no rows is the empty state (a fact about the period, not
  // a fault), and anything else is content. Writing them out per panel is how "데이터가 없습니다"
  // ended up standing in for a failed request.
  function renderPanelContent<Row>(
    section: SectionHandle,
    result: PanelResult<Row>,
    emptyText: string,
    toContent: (rows: Row[]) => HTMLElement,
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
    section.showContent(toContent(rows));
  }

  function renderRankedPanel<Row>(
    section: SectionHandle,
    result: PanelResult<Row>,
    emptyText: string,
    toItems: (rows: Row[]) => RankedItem[],
  ): void {
    renderPanelContent(section, result, emptyText, (rows) => createRankedBarList(toItems(rows)));
  }

  function renderEnvironment(): void {
    const groups: RankedGroup[] = [];
    const failureMessages: string[] = [];

    const languagesResult = environmentState.languages;
    if (languagesResult?.status === 'fulfilled') {
      groups.push({
        title: '상위 언어',
        emptyText: '언어 데이터가 없습니다.',
        items: languagesResult.value.rows.map((row) => ({
          label: toDisplayText(row.language, UNREPORTED_LABEL),
          fullLabel: toDisplayText(row.language, UNREPORTED_LABEL),
          value: row.views,
          isUnreported: row.language === null,
        })),
      });
    } else if (languagesResult?.status === 'rejected') {
      failureMessages.push(`상위 언어: ${toErrorMessage(languagesResult.reason)}`);
    }

    const screenWidthsResult = environmentState.screenWidths;
    if (screenWidthsResult?.status === 'fulfilled') {
      groups.push({
        title: '화면 폭',
        emptyText: '화면 폭 데이터가 없습니다.',
        items: [...screenWidthsResult.value.rows]
          .sort((left, right) => compareWidthBuckets(left.width_bucket, right.width_bucket))
          .map((row) => ({
            label: toWidthBucketLabel(row.width_bucket),
            fullLabel: toDisplayText(row.width_bucket, UNREPORTED_LABEL),
            value: row.views,
            isUnreported: row.width_bucket === null,
          })),
      });
    } else if (screenWidthsResult?.status === 'rejected') {
      failureMessages.push(`화면 폭: ${toErrorMessage(screenWidthsResult.reason)}`);
    }

    if (groups.length === 0) {
      if (failureMessages.length > 0) {
        environmentSection.showError(failureMessages.join(' · '));
      }
      // Otherwise nothing has answered yet and the skeleton stays.
      return;
    }
    if (failureMessages.length === 0) {
      environmentSection.showContent(createGroupedRanks(groups));
      return;
    }
    // A dimension that failed is dropped from the panel rather than drawn as an empty group, but it
    // is not dropped SILENTLY: without this line the panel would look complete while quietly
    // missing a dimension the reader has no way to notice is absent.
    const container = document.createElement('div');
    container.appendChild(createErrorIndicator(failureMessages.join(' · ')));
    container.appendChild(createGroupedRanks(groups));
    environmentSection.showContent(container);
  }

  function renderExperienceQuality(): void {
    const container = document.createElement('div');
    const failureMessages: string[] = [];

    const colorSchemesResult = experienceQualityState.colorSchemes;
    if (colorSchemesResult?.status === 'fulfilled') {
      container.appendChild(
        createGroupedRanks([
          {
            title: '색 구성표',
            emptyText: '색 구성표 데이터가 없습니다.',
            items: colorSchemesResult.value.rows.map((row) => ({
              label: toColorSchemeLabel(row.color_scheme),
              fullLabel: toDisplayText(row.color_scheme, UNREPORTED_LABEL),
              value: row.views,
              isUnreported: row.color_scheme === null,
            })),
          },
        ]),
      );
    } else if (colorSchemesResult?.status === 'rejected') {
      failureMessages.push(`색 구성표: ${toErrorMessage(colorSchemesResult.reason)}`);
    }

    // A dimension can be in FOUR states now: pending (null), fulfilled, rejected (a real
    // failure — alert line), or 'unsupported' (the tracker's catalog does not list the query —
    // a quiet version-gap note, deliberately NOT styled as an error: nothing is broken).
    const connectionTypesResult = experienceQualityState.connectionTypes;
    const deviceCapabilitiesResult = experienceQualityState.deviceCapabilities;
    const accessibilitySignalsResult = experienceQualityState.accessibilitySignals;
    const dimensionEntries = [
      { title: '연결 유형', state: connectionTypesResult },
      { title: '기기 메모리', state: deviceCapabilitiesResult },
      { title: '접근성 선호', state: accessibilitySignalsResult },
    ] as const;
    const unsupportedTitles: string[] = [];
    for (const entry of dimensionEntries) {
      if (entry.state === 'unsupported') {
        unsupportedTitles.push(entry.title);
      } else if (entry.state?.status === 'rejected') {
        failureMessages.push(`${entry.title}: ${toErrorMessage(entry.state.reason)}`);
      }
    }

    const toRows = <Row,>(state: PanelResult<Row> | 'unsupported' | null): Row[] =>
      state !== 'unsupported' && state?.status === 'fulfilled' ? state.value.rows : [];

    // createExperienceQualityPanel draws its three dimensions as one block, so a dimension that
    // failed can only be handed an empty array — its group then reads "데이터가 없습니다", which is
    // why the failure notice is inserted ABOVE the block (and carries role="alert"): the reader has
    // to see WHY the group is empty before reading the group.
    const hasAnyDimension = dimensionEntries.some(
      (entry) => entry.state !== 'unsupported' && entry.state?.status === 'fulfilled',
    );
    if (hasAnyDimension) {
      container.appendChild(
        createExperienceQualityPanel({
          connectionTypes: toRows(connectionTypesResult),
          deviceCapabilities: toRows(deviceCapabilitiesResult),
          accessibilitySignals: toRows(accessibilitySignalsResult),
        }),
      );
    }

    if (unsupportedTitles.length > 0) {
      const note = document.createElement('p');
      note.className = 'dimension-unsupported-note';
      note.textContent = `${unsupportedTitles.join(' · ')} — ${UNSUPPORTED_PANEL_TEXT}`;
      container.appendChild(note);
    }

    if (container.childElementCount === 0) {
      if (failureMessages.length > 0) {
        experienceQualitySection.showError(failureMessages.join(' · '));
      }
      return;
    }
    if (failureMessages.length > 0) {
      container.insertBefore(createErrorIndicator(failureMessages.join(' · ')), container.firstChild);
    }
    experienceQualitySection.showContent(container);
  }

  interface Wave1Results {
    periodSummary: PanelResult<PeriodSummaryRow>;
    footprintsByDay: PanelResult<FootprintsByDayRow>;
    uniqueVisitorsByDay: PanelResult<UniqueVisitorsByDayRow>;
    botsByDay: PanelResult<BotsByDayRow>;
    topPages: PanelResult<TopPageRow>;
  }

  function paintWave1(results: Wave1Results, range: DateRange, todayText: string): void {
    const footprintSeries: DayValue[] | null =
      results.footprintsByDay.status === 'fulfilled'
        ? fillMissingDays(results.footprintsByDay.value.rows, range.from, range.to, 'footprints')
        : null;
    const visitorSeries: DayValue[] | null =
      results.uniqueVisitorsByDay.status === 'fulfilled'
        ? fillMissingDays(results.uniqueVisitorsByDay.value.rows, range.from, range.to, 'visitors')
        : null;

    // 오늘 페이지 뷰. A failed query shows the dash, never 0: 0 is a measurement.
    if (footprintSeries === null) {
      summaryCards.showPlaceholder('todayViews');
    } else {
      summaryCards.showValues({ todayViews: findValueForDay(footprintSeries, todayText) });
    }

    if (results.periodSummary.status === 'fulfilled' && results.periodSummary.value.rows.length > 0) {
      currentPeriodSummaryRow = results.periodSummary.value.rows[0];
      summaryCards.showPeriodSummary(currentPeriodSummaryRow.views, currentPeriodSummaryRow.visitors);
    } else {
      currentPeriodSummaryRow = null;
      summaryCards.showPlaceholder('totalViews');
      summaryCards.showPlaceholder('visitors');
      summaryCards.showPlaceholder('viewsPerVisitor');
    }
    // The pair may now be complete (or may have just lost its current half), so the arrows are
    // recomputed here rather than only when the previous period answers.
    renderPeriodDeltas();

    if (results.botsByDay.status === 'fulfilled') {
      const botDayValues = fillMissingBotDays(results.botsByDay.value.rows, range.from, range.to);
      const botFootprints = botDayValues.reduce((sum, day) => sum + day.botFootprints, 0);
      const totalFootprints = botDayValues.reduce((sum, day) => sum + day.footprints, 0);
      summaryCards.showBotRatio(botFootprints, totalFootprints);
      const botSeries = toBotFootprintSeries(botDayValues);
      renderDailyChart(results, footprintSeries, visitorSeries, botSeries);
    } else if (results.botsByDay.reason instanceof TrackerError && results.botsByDay.reason.status === 404) {
      // bots-by-day is the one query an older tracker is most likely not to serve, and its own card
      // says so instead of the whole KPI row reading as broken. 미지원 is reserved for the 404
      // verdict — an outage answering the same way would turn every network blip into a claimed
      // capability gap (observed: server down rendered 미지원).
      summaryCards.showBotUnsupported(toErrorMessage(results.botsByDay.reason));
      renderDailyChart(results, footprintSeries, visitorSeries, null);
    } else {
      summaryCards.showBotFailure(toErrorMessage(results.botsByDay.reason));
      renderDailyChart(results, footprintSeries, visitorSeries, null);
    }

    summaryCards.setSparkline('totalViews', footprintSeries?.map((dayValue) => dayValue.value) ?? []);
    summaryCards.setSparkline('visitors', visitorSeries?.map((dayValue) => dayValue.value) ?? []);

    renderRankedPanel(pagesSection, results.topPages, '상위 페이지가 없습니다.', (rows) =>
      rows.map((row) => ({
        label: shortenHref(row.href),
        fullLabel: toDisplayText(row.href, '값 없음 (href 미기록)'),
        value: row.footprints,
        // A null href is a view whose page was never reported — a measurement gap, so it folds into
        // the footnote instead of ranking as if it were a page.
        isUnreported: row.href === null,
      })),
    );
  }

  function renderDailyChart(
    results: Wave1Results,
    footprintSeries: DayValue[] | null,
    visitorSeries: DayValue[] | null,
    botSeries: DayValue[] | null,
  ): void {
    // A failed series is an error card, not an empty chart: "이 기간에는 데이터가 없습니다" would
    // state that the site had no traffic, which is not what a failed request means.
    if (footprintSeries === null) {
      chartSection.showError(toResultErrorMessage(results.footprintsByDay));
      return;
    }
    if (visitorSeries === null) {
      chartSection.showError(toResultErrorMessage(results.uniqueVisitorsByDay));
      return;
    }
    if (isEmptyPeriod(footprintSeries) && isEmptyPeriod(visitorSeries)) {
      chartSection.showEmpty('이 기간에는 데이터가 없습니다.');
      return;
    }
    chartSection.showContent(lineChart.element);
    lineChart.render(footprintSeries, visitorSeries, botSeries);
  }

  // The experience-quality dimensions share one section with color-scheme, so the generic
  // unsupported stub in createPlanFactory (which quiets a WHOLE section) would blank the
  // dimensions that do work. An unsupported dimension instead marks its slot in the aggregated
  // state — renderExperienceQuality prints it as a muted note — and produces no plan at all.
  function markExperienceDimensionUnsupported(
    dimension: 'connectionTypes' | 'deviceCapabilities' | 'accessibilitySignals',
  ): PanelPlan[] {
    experienceQualityState = { ...experienceQualityState, [dimension]: 'unsupported' };
    return [];
  }

  function buildWave2Plans(context: {
    requestToken: number;
    bypassCache: boolean;
    rangeKey: string;
    dayParameters: QueryParameters;
    previousRange: DateRange | null;
  }): PanelPlan[] {
    const createPanelPlan = createPlanFactory(context);
    const { rangeKey, dayParameters } = context;

    const plans: PanelPlan[] = [
      createPanelPlan<TopReferrerRow>({
        queryName: QUERY_NAMES.topReferrers,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [referrersSection, trafficClassSection],
        render: (result) => {
          renderRankedPanel(referrersSection, result, '유입 경로 데이터가 없습니다.', (rows) =>
            mergeDirectReferrers(rows).map((row) => ({
              label: toReferrerLabel(row.referrer),
              fullLabel: toDisplayText(row.referrer, DIRECT_REFERRER_LABEL),
              value: row.views,
              // No isUnreported flag anywhere in this list: mergeDirectReferrers keys the merged
              // bucket null to mean DIRECT traffic (a typed URL, a bookmark, a stripped referrer),
              // which is ordinary reported traffic and must never fold into the 미보고 footnote.
            })),
          );
          if (result.status === 'rejected') {
            trafficClassSection.showError(toErrorMessage(result.reason));
            return;
          }
          if (result.value.rows.length === 0) {
            trafficClassSection.showEmpty('분류할 유입 데이터가 없습니다.');
            return;
          }
          trafficClassSection.showContent(createTrafficClassificationPanel(result.value.rows));
        },
      }),

      createPanelPlan<ViewsByCountryRow>({
        queryName: QUERY_NAMES.viewsByCountry,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [countriesSection],
        render: (result) =>
          renderRankedPanel(countriesSection, result, '국가 데이터가 없습니다.', (rows) =>
            rows.map((row) => ({
              label: toCountryLabel(row.country),
              fullLabel: `${toCountryLabel(row.country)} (${toDisplayText(row.country)}) · 방문자 ${formatCount(row.visitors)}`,
              value: row.views,
              isUnreported: row.country === null,
            })),
          ),
      }),

      createPanelPlan<ViewsByHourRow>({
        queryName: QUERY_NAMES.viewsByHour,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [hoursSection],
        render: (result) => {
          if (result.status === 'rejected') {
            hoursSection.showError(toErrorMessage(result.reason));
            return;
          }
          // The only panel that gets the UTC/KST switch: it is the one whose whole subject is the
          // hour of day. The bot histogram reads against the site's UTC-labelled traffic.
          hoursSection.showContent(
            createHourBars(fillMissingHours(result.value.rows, 'views'), { timezoneToggle: true }),
          );
        },
      }),

      createPanelPlan<TopPlatformRow>({
        queryName: QUERY_NAMES.topPlatforms,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [platformsSection],
        render: (result) =>
          renderRankedPanel(platformsSection, result, '플랫폼 데이터가 없습니다.', (rows) =>
            rows.map((row) => ({
              label: toPlatformLabel(row.platform, row.mobile),
              fullLabel: `${toPlatformLabel(row.platform, row.mobile)} · mobile=${String(row.mobile)}`,
              value: row.views,
              // No Client Hints at all — the platform was never reported, not a platform named "미보고".
              isUnreported: row.platform === null,
            })),
          ),
      }),

      createPanelPlan<TopLanguageRow>({
        queryName: QUERY_NAMES.topLanguages,
        parameters: { ...dayParameters, limit: TOP_LANGUAGE_LIMIT },
        // The limit belongs in this key and only in this key: it changes how many rows come back.
        cacheKey: `${rangeKey}:limit:${TOP_LANGUAGE_LIMIT}`,
        sections: [environmentSection],
        render: (result) => {
          environmentState = { ...environmentState, languages: result };
          renderEnvironment();
        },
      }),

      createPanelPlan<ViewsByScreenWidthRow>({
        queryName: QUERY_NAMES.viewsByScreenWidth,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [environmentSection],
        render: (result) => {
          environmentState = { ...environmentState, screenWidths: result };
          renderEnvironment();
        },
      }),

      createPanelPlan<TopEventRow>({
        queryName: QUERY_NAMES.topEvents,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [eventsSection],
        render: (result) =>
          renderRankedPanel(eventsSection, result, '수집된 이벤트가 없습니다.', (rows) =>
            rows.map((row) => ({
              label: summarizeArguments(row.arguments),
              fullLabel: toDisplayText(row.arguments),
              value: row.views,
              // arguments is non-null by construction: the worker filters '[]' out.
            })),
          ),
      }),

      createPanelPlan<VerifiedBotCategoryRow>({
        queryName: QUERY_NAMES.verifiedBotCategories,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [botCategoriesSection],
        render: (result) =>
          renderRankedPanel(botCategoriesSection, result, '검증된 봇 트래픽이 없습니다.', (rows) =>
            rows.map((row) => ({
              label: row.category,
              fullLabel: row.category,
              value: row.views,
              // The worker excludes the null/empty category, so every row here is a real verdict.
            })),
          ),
      }),

      createPanelPlan<UtmBreakdownRow>({
        queryName: QUERY_NAMES.utmBreakdown,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [utmSection],
        render: (result) =>
          renderPanelContent(utmSection, result, 'UTM 파라미터가 붙은 유입이 없습니다.', createUtmBreakdownPanel),
      }),

      createPanelPlan<NewVsReturningByDayRow>({
        queryName: QUERY_NAMES.newVsReturningByDay,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [newVsReturningSection],
        render: (result) =>
          renderPanelContent(newVsReturningSection, result, '이 기간에는 방문자가 없습니다.', createNewVsReturningPanel),
      }),

      createPanelPlan<VisitDepthRow>({
        queryName: QUERY_NAMES.visitDepth,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [visitDepthSection],
        render: (result) =>
          renderPanelContent(visitDepthSection, result, '이 기간에는 방문자가 없습니다.', createVisitDepthPanel),
      }),

      createPanelPlan<WeeklyRetentionRow>({
        queryName: QUERY_NAMES.weeklyRetention,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [retentionSection],
        render: (result) =>
          renderPanelContent(retentionSection, result, '리텐션 데이터가 없습니다.', createWeeklyRetentionTable),
      }),

      createPanelPlan<TopLandingRow>({
        queryName: QUERY_NAMES.topLandings,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [topLandingsSection],
        render: (result) =>
          renderPanelContent(topLandingsSection, result, '랜딩 페이지 데이터가 없습니다.', createTopLandingsPanel),
      }),

      createPanelPlan<PageTransitionRow>({
        queryName: QUERY_NAMES.pageTransitions,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [pageTransitionsSection],
        render: (result) =>
          renderPanelContent(pageTransitionsSection, result, '페이지 이동 기록이 없습니다.', createPageTransitionsPanel),
      }),

      createPanelPlan<ViewsByColorSchemeRow>({
        queryName: QUERY_NAMES.viewsByColorScheme,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [experienceQualitySection],
        render: (result) => {
          experienceQualityState = { ...experienceQualityState, colorSchemes: result };
          renderExperienceQuality();
        },
      }),

      ...(isQueryUnsupported(QUERY_NAMES.connectionTypes)
        ? markExperienceDimensionUnsupported('connectionTypes')
        : [
            createPanelPlan<ConnectionTypeRow>({
              queryName: QUERY_NAMES.connectionTypes,
              parameters: dayParameters,
              cacheKey: rangeKey,
              sections: [experienceQualitySection],
              render: (result) => {
                experienceQualityState = { ...experienceQualityState, connectionTypes: result };
                renderExperienceQuality();
              },
            }),
          ]),

      ...(isQueryUnsupported(QUERY_NAMES.deviceCapabilities)
        ? markExperienceDimensionUnsupported('deviceCapabilities')
        : [
            createPanelPlan<DeviceCapabilityRow>({
              queryName: QUERY_NAMES.deviceCapabilities,
              parameters: dayParameters,
              cacheKey: rangeKey,
              sections: [experienceQualitySection],
              render: (result) => {
                experienceQualityState = { ...experienceQualityState, deviceCapabilities: result };
                renderExperienceQuality();
              },
            }),
          ]),

      ...(isQueryUnsupported(QUERY_NAMES.accessibilitySignals)
        ? markExperienceDimensionUnsupported('accessibilitySignals')
        : [
            createPanelPlan<AccessibilitySignalRow>({
              queryName: QUERY_NAMES.accessibilitySignals,
              parameters: dayParameters,
              cacheKey: rangeKey,
              sections: [experienceQualitySection],
              render: (result) => {
                experienceQualityState = { ...experienceQualityState, accessibilitySignals: result };
                renderExperienceQuality();
              },
            }),
          ]),

      createPanelPlan<BotsByHourRow>({
        queryName: QUERY_NAMES.botsByHour,
        parameters: dayParameters,
        cacheKey: rangeKey,
        sections: [botsByHourSection],
        render: (result) => {
          if (result.status === 'rejected') {
            botsByHourSection.showError(toErrorMessage(result.reason));
            return;
          }
          botsByHourSection.showContent(createBotsByHourPanel(result.value.rows));
        },
      }),

      createPanelPlan<ViewsByMinuteRow>({
        queryName: QUERY_NAMES.viewsByMinute,
        parameters: { minutes: REALTIME_MINUTES },
        // Not range-scoped: this query always answers about the last REALTIME_MINUTES minutes. A
        // cached paint here is only ever a placeholder for the request that is already in flight,
        // and the 갱신 중 badge names the time it was captured.
        cacheKey: `minutes:${REALTIME_MINUTES}`,
        sections: [realtimeSection],
        render: (result) => {
          if (result.status === 'rejected') {
            realtimeSection.showError(toErrorMessage(result.reason));
            return;
          }
          realtimeSection.showContent(createViewsByMinutePanel(result.value.rows));
        },
      }),

      createRecentFootprintsPlan(context),
    ];

    if (context.previousRange !== null) {
      const previousRange = context.previousRange;
      plans.push(
        createPanelPlan<PeriodSummaryRow>({
          queryName: QUERY_NAMES.periodSummary,
          parameters: { from: previousRange.from, to: previousRange.to },
          cacheKey: `${previousRange.from}:${previousRange.to}`,
          // The KPI cards carry no 갱신 중 badge of their own, so this plan owns no section: it
          // paints the ▲▼% indicators through renderPeriodDeltas.
          sections: [],
          render: (result) => {
            previousPeriodSummaryRow =
              result.status === 'fulfilled' && result.value.rows.length > 0 ? result.value.rows[0] : null;
            renderPeriodDeltas();
          },
        }),
      );
    }

    if (highlightedUUID !== null) {
      plans.push(createVisitorTimelinePlan(highlightedUUID, context));
    }

    return plans;
  }

  function stopRealtimeRefresh(): void {
    if (realtimeTimerId !== null) {
      window.clearInterval(realtimeTimerId);
      realtimeTimerId = null;
    }
  }

  // 준실시간 활동 is the only panel that refreshes on its own. The timer is owned here (not by the
  // panel factory) precisely so it can be cancelled: a re-render must not stack a second interval
  // on the first, and a torn-down dashboard must not keep polling from a detached DOM tree.
  function startRealtimeRefresh(requestToken: number): void {
    stopRealtimeRefresh();
    realtimeTimerId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void toSettledResult(
        fetchQuery<ViewsByMinuteRow>(options.endpoint, QUERY_NAMES.viewsByMinute, { minutes: REALTIME_MINUTES }),
      ).then((result) => {
        if (!requestTokenGuard.isCurrent(requestToken) || result.status === 'rejected') {
          // A failed background refresh leaves the last good strip on screen: this panel already
          // repaints every 60 seconds, and turning one dropped request into an error card would
          // erase 30 minutes of readable history over a blip.
          return;
        }
        writeQueryCache(QUERY_NAMES.viewsByMinute, `minutes:${REALTIME_MINUTES}`, result.value.rows);
        realtimeSection.showContent(createViewsByMinutePanel(result.value.rows));
      });
    }, REALTIME_REFRESH_MILLISECONDS);
  }

  async function loadDashboard(bypassCache: boolean): Promise<void> {
    const requestToken = requestTokenGuard.issue();
    latestRequestToken = requestToken;
    stopRealtimeRefresh();

    const today = new Date();
    const todayText = formatUTCDate(today);

    let range: DateRange;
    if (activeRangeDays !== null) {
      range = computeDateRange(activeRangeDays, today);
    } else if (activeCustomRange) {
      range = activeCustomRange;
    } else {
      range = computeDateRange(DEFAULT_RANGE_DAYS, today);
    }

    // The cache key is the range alone. It used to carry the recent-row limit as well, which made
    // every query's entry miss the moment "더 보기" was clicked once.
    const rangeKey = `${range.from}:${range.to}`;
    const dayParameters: QueryParameters = { from: range.from, to: range.to };
    // null (not a throw) when the range cannot be parsed; the deltas are then simply not shown.
    const previousRange = computePreviousDateRange(range.from, range.to);

    // Every state that belongs to the OLD range is dropped before anything paints, so a delta or a
    // half-filled multi-query panel from the previous range cannot survive into this one.
    clearAllRefreshBadges();
    currentPeriodSummaryRow = null;
    previousPeriodSummaryRow = null;
    renderPeriodDeltas();
    environmentState = { languages: null, screenWidths: null };
    experienceQualityState = {
      colorSchemes: null,
      connectionTypes: null,
      deviceCapabilities: null,
      accessibilitySignals: null,
    };

    const wave1CacheEntries = {
      periodSummary: readCachedRows<PeriodSummaryRow>(QUERY_NAMES.periodSummary, rangeKey, bypassCache),
      footprintsByDay: readCachedRows<FootprintsByDayRow>(QUERY_NAMES.footprintsByDay, rangeKey, bypassCache),
      uniqueVisitorsByDay: readCachedRows<UniqueVisitorsByDayRow>(QUERY_NAMES.uniqueVisitorsByDay, rangeKey, bypassCache),
      botsByDay: readCachedRows<BotsByDayRow>(QUERY_NAMES.botsByDay, rangeKey, bypassCache),
      topPages: readCachedRows<TopPageRow>(QUERY_NAMES.topPages, rangeKey, bypassCache),
    };
    const wave1CachedEntries = Object.values(wave1CacheEntries);
    const isWave1Cached = wave1CachedEntries.every((entry) => entry !== null);

    if (isWave1Cached) {
      // The KPI row, the chart and 상위 페이지 are one reading of the period, so they are painted
      // from the cache together or not at all — a chart from the cache beside KPI cards from a
      // skeleton would be two different answers to the same question.
      const oldestStoredAt = Math.min(...wave1CachedEntries.map((entry) => entry?.storedAt ?? Date.now()));
      paintWave1(
        {
          periodSummary: toFulfilledResult(wave1CacheEntries.periodSummary?.rows ?? []),
          footprintsByDay: toFulfilledResult(wave1CacheEntries.footprintsByDay?.rows ?? []),
          uniqueVisitorsByDay: toFulfilledResult(wave1CacheEntries.uniqueVisitorsByDay?.rows ?? []),
          botsByDay: toFulfilledResult(wave1CacheEntries.botsByDay?.rows ?? []),
          topPages: toFulfilledResult(wave1CacheEntries.topPages?.rows ?? []),
        },
        range,
        todayText,
      );
      markSectionRefreshing(chartSection, oldestStoredAt);
      markSectionRefreshing(pagesSection, oldestStoredAt);
      // The KPI cards have no badge, so the endpoint bar carries the cached timestamp for them.
      endpointBar.setLastUpdated(formatCacheTime(oldestStoredAt));
    } else {
      summaryCards.showLoading();
      chartSection.showSkeleton();
      pagesSection.showSkeleton();
    }

    // Capability must be known before wave-2 plans exist: gating decisions (skip the request or
    // not) are made at plan-construction time. The catalog request was fired when the dashboard
    // mounted, so this await costs nothing except on the very first load.
    await capabilityPromise;
    if (!requestTokenGuard.isCurrent(requestToken)) {
      return;
    }

    // Wave 2's cached rows are painted now, before wave 1's network round trip, so a reload fills
    // the whole page in the first frame instead of filling the top and leaving the rest grey.
    const wave2Plans = buildWave2Plans({
      requestToken,
      bypassCache,
      rangeKey,
      dayParameters,
      previousRange,
    });
    preparePanelPlans(wave2Plans);

    // No highlighted visitor means no timeline query at all, so this panel states why it is empty
    // instead of sitting under a skeleton that nothing will ever replace.
    if (highlightedUUID === null) {
      timelineSection.showEmpty('방문자 UUID가 선택되었을 때 해당 방문자의 타임라인을 표시합니다.');
    }

    const [periodSummaryResult, footprintsResult, visitorsResult, botsResult, topPagesResult] = await Promise.all([
      toSettledResult(fetchQuery<PeriodSummaryRow>(options.endpoint, QUERY_NAMES.periodSummary, dayParameters)),
      toSettledResult(fetchQuery<FootprintsByDayRow>(options.endpoint, QUERY_NAMES.footprintsByDay, dayParameters)),
      toSettledResult(fetchQuery<UniqueVisitorsByDayRow>(options.endpoint, QUERY_NAMES.uniqueVisitorsByDay, dayParameters)),
      toSettledResult(fetchQuery<BotsByDayRow>(options.endpoint, QUERY_NAMES.botsByDay, dayParameters)),
      toSettledResult(fetchQuery<TopPageRow>(options.endpoint, QUERY_NAMES.topPages, dayParameters)),
    ]);
    if (!requestTokenGuard.isCurrent(requestToken)) {
      return;
    }

    const nowTimestamp = Date.now();
    endpointBar.setLastUpdated(formatCacheTime(nowTimestamp));

    storeSettledRows(QUERY_NAMES.periodSummary, rangeKey, periodSummaryResult, nowTimestamp);
    storeSettledRows(QUERY_NAMES.footprintsByDay, rangeKey, footprintsResult, nowTimestamp);
    storeSettledRows(QUERY_NAMES.uniqueVisitorsByDay, rangeKey, visitorsResult, nowTimestamp);
    storeSettledRows(QUERY_NAMES.botsByDay, rangeKey, botsResult, nowTimestamp);
    storeSettledRows(QUERY_NAMES.topPages, rangeKey, topPagesResult, nowTimestamp);

    // Same stale-beats-error rule as the plan factory: a wave-1 query that died falls back to the
    // rows this load already painted from the cache, and the 갱신 실패 badge reports it. With no
    // cache the rejection passes through and paintWave1 draws the per-panel error cards.
    function withCachedFallback<Row>(
      result: PanelResult<Row>,
      cached: { storedAt: number; rows: Row[] } | null,
    ): { result: PanelResult<Row>; usedCache: boolean } {
      if (result.status === 'rejected' && cached !== null) {
        return { result: toFulfilledResult(cached.rows), usedCache: true };
      }
      return { result, usedCache: false };
    }
    const periodSummaryFinal = withCachedFallback(periodSummaryResult, wave1CacheEntries.periodSummary);
    const footprintsFinal = withCachedFallback(footprintsResult, wave1CacheEntries.footprintsByDay);
    const visitorsFinal = withCachedFallback(visitorsResult, wave1CacheEntries.uniqueVisitorsByDay);
    const botsFinal = withCachedFallback(botsResult, wave1CacheEntries.botsByDay);
    const topPagesFinal = withCachedFallback(topPagesResult, wave1CacheEntries.topPages);
    const wave1KeptCache = [periodSummaryFinal, footprintsFinal, visitorsFinal, botsFinal, topPagesFinal]
      .some((entry) => entry.usedCache);

    if (wave1KeptCache) {
      markSectionRefreshFailed(chartSection);
      markSectionRefreshFailed(pagesSection);
    } else {
      clearSectionRefreshing(chartSection);
      clearSectionRefreshing(pagesSection);
    }
    paintWave1(
      {
        periodSummary: periodSummaryFinal.result,
        footprintsByDay: footprintsFinal.result,
        uniqueVisitorsByDay: visitorsFinal.result,
        botsByDay: botsFinal.result,
        topPages: topPagesFinal.result,
      },
      range,
      todayText,
    );

    await Promise.all(wave2Plans.map((plan) => plan.fetchAndPaint()));
    if (!requestTokenGuard.isCurrent(requestToken)) {
      return;
    }

    // Every plan of this load generation has settled, so any badge still reference-counted above
    // zero is a leak (observed live: a '갱신 중' badge stuck for minutes on a mixed-fate panel).
    // Count-zero entries are '갱신 실패' badges and stay until the next load re-marks them.
    for (const [section, pending] of [...pendingRefreshBySection]) {
      if (pending.count > 0) {
        pendingRefreshBySection.delete(section);
        section.setRefreshing(null);
      }
    }

    // No 60-second poll for a tracker that does not serve views-by-minute — each tick would be
    // another guaranteed 404 in the console.
    if (!isQueryUnsupported(QUERY_NAMES.viewsByMinute)) {
      startRealtimeRefresh(requestToken);
    }
  }

  function teardown(): void {
    // A fresh token invalidates every response still in flight, so nothing paints into a detached
    // tree after the view has been replaced.
    requestTokenGuard.issue();
    stopRealtimeRefresh();
    lineChart.teardown();
  }

  void loadDashboard(false);
  return { element: root, teardown };
}
