'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { ReportModule, ModuleDefinition, ChartType, Platform } from '@/types';
import {
  IconInfo,
  IconDragHandle,
} from '@/components/icons/FigmaIcons';
import { IconActivity } from '@/components/icons/SendiIcons';
import { MockProfile } from '@/lib/profile-data';
import { deriveModuleWarning } from '@/lib/profile-status';
import { ModuleWarningIcon } from './ModuleWarningIcon';
import { ChartRenderer, PieChartRenderer } from './ChartRenderer';
import { MetricCardModule } from './MetricCardModule';
import { TableModule } from './TableModule';
import { ListModule } from './ListModule';
import { AudienceGrowthModule } from './AudienceGrowthModule';
import { AudienceGrowthBarModule } from './AudienceGrowthBarModule';
import { CategoricalBarModule, TimeSeriesBarModule } from './BarChartModule';
import { AudienceGrowthLineModule, TimeSeriesLineModule } from './LineChartModule';
import { TimeSeriesAreaModule } from './AreaChartModule';
import { AudienceByGenderModule } from './AudienceByGenderModule';
import { AudienceByGenderBarModule } from './AudienceByGenderBarModule';
import { AudienceByCountryModule } from './AudienceByCountryModule';
import { AudienceByCountryBarModule } from './AudienceByCountryBarModule';
import { AudienceByCountryPieModule } from './AudienceByCountryPieModule';
import { BubbleChartModule } from './BubbleChartModule';
import { PublishingBehaviorModule } from './PublishingBehaviorModule';
import { FollowersOnlineModule } from './FollowersOnlineModule';
import {
  InteractionsByDayModule,
  InteractionsByDayLineModule,
  InteractionsByDayAreaModule,
} from './InteractionsByDayModule';
import { SummaryCardModule } from './SummaryCardModule';
import { VideoEngagementModule } from './VideoEngagementModule';
import { VideoWatchMetricsModule } from './VideoWatchMetricsModule';
import { VideoSourcesModule } from './VideoSourcesModule';
import { ModuleActions } from './ModuleActions';
import { cn } from '@/lib/utils';
import {
  MOCK_CHART_DATA,
  MOCK_METRICS,
  MOCK_TABLE_DATA,
  MOCK_TABLE_COLUMNS,
  MOCK_LIST_ITEMS,
  MOCK_LIST_DATA,
  MOCK_PIE_DATA,
  MOCK_BUBBLE_DATA,
  MOCK_INTERACTIONS_BY_DAY,
  MOCK_BEST_ENGAGING_DAY_ROWS,
  MOCK_BEST_PERFORMING_DAY_ROWS,
  MOCK_BEST_PERFORMING_DAY_SUMMARY_ROWS,
  MOCK_FOLLOWERS_ONLINE_SUMMARY_ROWS,
  MOCK_VIDEO_ENGAGEMENT_CARDS,
  MOCK_VIDEO_WATCH_METRICS_CARDS,
  MOCK_VIDEO_SOURCES_CARDS,
  CHART_COLORS,
} from '@/lib/mock-data';

interface ModuleCardProps {
  module: ReportModule;
  definition: ModuleDefinition;
  isEditMode: boolean;
  /**
   * True while this specific module is being resized via the corner
   * grip. The parent (`ReportCanvas`) flips this on at `onResizeStart`
   * and off at `onResizeStop`. We OR it into `showEditChrome` so the
   * card's hover chrome doesn't flicker off if the cursor briefly
   * slips outside the card's bounds as it grows / shrinks during a
   * drag.
   */
  isResizing?: boolean;
  onChartTypeChange: (moduleId: string, type: ChartType) => void;
  onDuplicate: (moduleId: string) => void;
  onDelete: (moduleId: string) => void;
  height: number;
  /**
   * Globally-selected profiles. The card filters these by the
   * definition's supported platforms and threads the result into any
   * sub-module that renders a Networks indicator.
   */
  selectedProfiles?: MockProfile[];
}

function getModuleContent(
  module: ReportModule,
  def: ModuleDefinition,
  contentHeight: number,
  contentWidth: number,
  profilesForModule: MockProfile[],
) {
  const { chartType, definitionId } = module;

  // Special case: Audience Growth uses a 3-series overlapping area chart
  // when in its default area mode (matches Figma frame 1026-38493).
  // `network` flows through so the variant swaps to the TikTok all-
  // blue gradient (Figma 2201:51879) when the module is bound to TikTok.
  if (definitionId === 'audience-growth' && chartType === 'area') {
    return (
      <AudienceGrowthModule
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
        network={module.network}
      />
    );
  }

  // Stacked-bar rendering of the same series when the module is
  // switched to "bar". Shares axis/tooltip/legend chrome with the area
  // rendering via imports from AudienceGrowthModule.
  if (definitionId === 'audience-growth' && chartType === 'bar') {
    return (
      <AudienceGrowthBarModule
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
        network={module.network}
      />
    );
  }

  // 3-line rendering of the same series when the module is switched
  // to "line". Same SERIES + DATA imports as the area / stacked-bar
  // variants — the only difference is the geometry.
  if (definitionId === 'audience-growth' && chartType === 'line') {
    return (
      <AudienceGrowthLineModule
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
        network={module.network}
      />
    );
  }

  // Audience by gender — bespoke donut with shadcn ChartContainer and
  // per-wedge percentage labels (Figma 1232:350200). Only overrides the
  // default PieChartRenderer when the chart type is still `pie`; if the
  // user switches the module to bar, we fall through to ChartRenderer.
  if (definitionId === 'audience-by-gender' && chartType === 'pie') {
    return <AudienceByGenderModule profiles={profilesForModule} network={module.network} />;
  }

  // Audience by country — three bespoke renderers, one per chart type:
  //   • list → ranked flag+country+percentage rows  (Figma 1233:350512)
  //   • pie  → 10-slice donut with in-slice labels  (Figma 1314:191721)
  //   • bar  → horizontal bars with in-bar labels   (Figma 1310:191707)
  // All three share the same MOCK_PIE_DATA entry (or, for the list,
  // its own AudienceByCountryModule data) so the percentages stay in
  // lockstep across visualizations.
  if (definitionId === 'audience-by-country' && chartType === 'list') {
    return <AudienceByCountryModule profiles={profilesForModule} />;
  }

  if (definitionId === 'audience-by-country' && chartType === 'pie') {
    return <AudienceByCountryPieModule profiles={profilesForModule} />;
  }

  if (definitionId === 'audience-by-country' && chartType === 'bar') {
    return (
      <AudienceByCountryBarModule
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
      />
    );
  }

  if (chartType === 'metric') {
    // Fallback key is `followers` — the canonical Cross-network single-
    // metric module in the rewritten catalog. Any metric module without
    // its own mock entry renders that placeholder (e.g. dev-only IDs).
    const metrics = MOCK_METRICS[definitionId] || MOCK_METRICS['followers'];
    return (
      <MetricCardModule
        metrics={metrics}
        profiles={profilesForModule}
        contentWidth={contentWidth}
      />
    );
  }

  if (chartType === 'table') {
    return <TableModule columns={MOCK_TABLE_COLUMNS} rows={MOCK_TABLE_DATA} />;
  }

  if (chartType === 'list') {
    // Single-period summary cards — flat 4-row label/value tables, not
    // ranked lists. Each has its own pre-formatted rows payload but
    // shares the same renderer (`SummaryCardModule`):
    //   • tiktok-best-engaging-day  → Figma 1291:123415
    //   • tiktok-best-performing-day → Figma 1339:217275
    if (definitionId === 'tiktok-best-engaging-day') {
      return (
        <SummaryCardModule
          rows={MOCK_BEST_ENGAGING_DAY_ROWS}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    if (definitionId === 'tiktok-best-performing-day') {
      return (
        <SummaryCardModule
          rows={MOCK_BEST_PERFORMING_DAY_ROWS}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    // Compact 3-row summary card (Figma 2313:51150).  Same
    // `SummaryCardModule` shell as the other best-day summaries;
    // payload is `MOCK_BEST_PERFORMING_DAY_SUMMARY_ROWS` (Total
    // published videos / Most frequent day / Most frequent time).
    if (definitionId === 'tiktok-best-performing-day-summary') {
      return (
        <SummaryCardModule
          rows={MOCK_BEST_PERFORMING_DAY_SUMMARY_ROWS}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    // Sister 2-row summary card (Figma 2313:51223).  Median
    // posting hour + weekday across the selected period.
    if (definitionId === 'tiktok-followers-online-summary') {
      return (
        <SummaryCardModule
          rows={MOCK_FOLLOWERS_ONLINE_SUMMARY_ROWS}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    // Horizontally-scrolling video-card carousel (Figma 2222:40922).
    // Bespoke renderer; not list-shaped despite living under
    // `chartType === 'list'` for catalog/preset compatibility with
    // the sister `tiktok-video-watch-metrics` / `tiktok-video-sources`
    // entries (still on `ListModule` until their dedicated renderers
    // land).
    if (definitionId === 'tiktok-video-engagement') {
      return (
        <VideoEngagementModule
          cards={MOCK_VIDEO_ENGAGEMENT_CARDS}
          contentHeight={contentHeight}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    // Sister carousel (Figma 2224:50487).  Same 240 × 479 card shell
    // as Video engagement but the summary table reports watch-time
    // metrics (3 rows × 32 px) instead of engagement counts
    // (4 rows × 24 px).
    if (definitionId === 'tiktok-video-watch-metrics') {
      return (
        <VideoWatchMetricsModule
          cards={MOCK_VIDEO_WATCH_METRICS_CARDS}
          contentHeight={contentHeight}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    // Sister carousel (Figma 2222:48693).  Same 240 × 479 card
    // shell as the other two video carousels but the thumbnail
    // gives up 72 px (249 → 177) to make room for a 7-row
    // source-attribution summary (Direct message / Follow /
    // For you / Others / Personal profile / Search / Sound).
    if (definitionId === 'tiktok-video-sources') {
      return (
        <VideoSourcesModule
          cards={MOCK_VIDEO_SOURCES_CARDS}
          contentHeight={contentHeight}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    // Keyed lookup so list-type modules each render their own payload
    // (e.g. top-posts → posts). Falls back to the legacy MOCK_LIST_ITEMS
    // for unknown ids. (`tiktok-top-videos` was previously routed here
    // but has been removed pending a redesign.)
    const items = MOCK_LIST_DATA[definitionId] || MOCK_LIST_ITEMS;
    return <ListModule items={items} />;
  }

  // Bubble chart — weekday × hour grid for Publishing Behaviour and
  // Followers Online. Renders any module whose definitionId has a
  // payload in MOCK_BUBBLE_DATA.
  //   • Publishing Behaviour (1302:170169) — sparse posts, days on X,
  //     hours on Y, three-band color (High / Mid / Low).
  //   • Followers Online    (1326:217061) — full grid, days on Y,
  //     hours on X, continuous magenta heatmap with gradient legend.
  // Anything else falls through to the generic single-color renderer.
  if (chartType === 'bubble') {
    const bubbleData = MOCK_BUBBLE_DATA[definitionId] || [];
    if (definitionId === 'tiktok-publishing-behaviour') {
      return (
        <PublishingBehaviorModule
          data={bubbleData}
          contentHeight={contentHeight}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    if (definitionId === 'tiktok-followers-online') {
      return (
        <FollowersOnlineModule
          data={bubbleData}
          contentHeight={contentHeight}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    return (
      <BubbleChartModule
        data={bubbleData}
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
      />
    );
  }

  if (chartType === 'pie') {
    // Per the product catalog, donut is folded into pie — we always render
    // the donut cutout here since it's visually cleaner at every size and
    // matches the Figma demographics cards (1026:43083). Callers that
    // need a solid pie can re-introduce a flag if/when a distinct
    // chart type is added.
    const pieData = (MOCK_PIE_DATA as Record<string, typeof MOCK_PIE_DATA['audience-demographics']>)[definitionId] || MOCK_PIE_DATA['audience-demographics'];
    return (
      <PieChartRenderer
        data={pieData}
        height={Math.max(contentHeight * 0.55, 100)}
        donut
      />
    );
  }

  // Interactions by day — bespoke stacked bar (Figma 1290:101559).
  // Three additive series (Shares / Comments / Likes) with in-bar
  // value labels. Routed BEFORE the generic categorical/time-series
  // bar fallback so the catalog's 'bar' chart type lands on the
  // correct renderer for this definition.
  if (chartType === 'bar' && definitionId === 'tiktok-interactions-by-day') {
    return (
      <InteractionsByDayModule
        data={MOCK_INTERACTIONS_BY_DAY}
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
      />
    );
  }

  // Unified bar rendering for every module that lists 'bar' in
  // `supportedChartTypes`. Two shapes:
  //   • categorical (pie-shaped data in MOCK_PIE_DATA) → one bar per
  //     category, colored from the entry — used when a pie/bar module
  //     is switched to bar (audience-by-gender, instagram-audience,
  //     tiktok-audience).
  //   • time-series (date/value data in MOCK_CHART_DATA) → single
  //     series bars over the date window (facebook-page-insights and
  //     any future line/area/bar module without a bespoke renderer).
  // Audience Growth's bar mode is already handled above by
  // AudienceGrowthBarModule (3-series stacked) and takes precedence.
  if (chartType === 'bar') {
    // Audience by gender bar variant has its own dedicated
    // module (Figma 2467:42088 with chart-type toggled) so the
    // network-aware blue palette and `Name - 54%` legend match
    // the donut variant.  Other categorical-bar consumers
    // (instagram-audience, tiktok-audience) keep going through
    // the generic `CategoricalBarModule`.
    if (definitionId === 'audience-by-gender') {
      return (
        <AudienceByGenderBarModule
          contentHeight={contentHeight}
          contentWidth={contentWidth}
          profiles={profilesForModule}
          network={module.network}
        />
      );
    }
    const pieData = (MOCK_PIE_DATA as Record<string, typeof MOCK_PIE_DATA['audience-demographics']>)[definitionId];
    if (pieData) {
      return (
        <CategoricalBarModule
          data={pieData}
          contentHeight={contentHeight}
          contentWidth={contentWidth}
          profiles={profilesForModule}
        />
      );
    }
    const seriesData = MOCK_CHART_DATA[definitionId] || MOCK_CHART_DATA['audience-growth'];
    return (
      <TimeSeriesBarModule
        data={seriesData}
        color="#0075DB"
        label={def.name}
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
      />
    );
  }

  // Interactions by day — bespoke 3-line variant (28-day Shares /
  // Comments / Likes). Routed BEFORE the generic single-series line
  // fallback so the catalog's 'line' chart type lands on the bespoke
  // multi-series renderer rather than the placeholder.
  if (chartType === 'line' && definitionId === 'tiktok-interactions-by-day') {
    return (
      <InteractionsByDayLineModule
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
      />
    );
  }

  // Unified line rendering for any module that lists 'line' in
  // `supportedChartTypes`. Audience Growth's line mode is handled
  // above (3-series). Everything else falls through to the single-
  // series TimeSeriesLineModule, which mirrors `TimeSeriesBarModule`'s
  // shape (same axis chrome, same tooltip, same legend row).
  if (chartType === 'line') {
    const seriesData = MOCK_CHART_DATA[definitionId] || MOCK_CHART_DATA['audience-growth'];
    return (
      <TimeSeriesLineModule
        data={seriesData}
        color="#0075DB"
        label={def.name}
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
      />
    );
  }

  // Interactions by day — bespoke 3-series area variant (translucent
  // overlapping bands of Shares / Comments / Likes over the 28-day
  // window). Routed BEFORE the generic single-series area fallback.
  if (chartType === 'area' && definitionId === 'tiktok-interactions-by-day') {
    return (
      <InteractionsByDayAreaModule
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
      />
    );
  }

  // Unified area rendering for any module that lists 'area' in
  // `supportedChartTypes`. Audience Growth's area mode is handled
  // above (3-series). Everything else (e.g. tiktok-video-views-by-day)
  // falls through to the single-series TimeSeriesAreaModule, which
  // mirrors `TimeSeriesBarModule` / `TimeSeriesLineModule`'s shape
  // — same axis chrome, same tooltip, same legend row — so flipping
  // chart types produces zero footer jitter.
  if (chartType === 'area') {
    const seriesData = MOCK_CHART_DATA[definitionId] || MOCK_CHART_DATA['audience-growth'];
    return (
      <TimeSeriesAreaModule
        data={seriesData}
        // colors/palette/blue/500 — matches Audience growth's
        // netFollowers stroke and Video views by day per Figma
        // 2895:69723.  Was `#0075DB`; swapped to the design-token
        // hue so the whole area-chart family reads as one blue.
        color="#0570DE"
        label={def.name}
        contentHeight={contentHeight}
        contentWidth={contentWidth}
        profiles={profilesForModule}
      />
    );
  }

  // Final catch-all — any chart type we haven't routed above falls
  // through to the legacy `ChartRenderer`. As of the standardization
  // pass on time-series modules, no production catalog entry actually
  // hits this branch (line/area/bar all have bespoke renderers above);
  // it stays as a safety net for dev-time IDs and future chart types
  // that haven't been wired yet.
  const chartData = MOCK_CHART_DATA[definitionId] || MOCK_CHART_DATA['audience-growth'];
  return (
    <ChartRenderer
      chartType={chartType}
      data={chartData}
      height={Math.max(contentHeight - 16, 80)}
      color={CHART_COLORS.primary}
      secondaryColor={CHART_COLORS.secondary}
    />
  );
}

// ─── ModuleBanner (removed) ──────────────────────────────────────────────
//
// The legacy per-module banner (`ModuleBanner` + compact
// `ModuleBannerTag`) was replaced by the two-tier warning system:
//
//   • Per-module     → `ModuleWarningIcon` (next to the title) — a
//                      compact glyph + tooltip carrying name/count of
//                      affected profiles.  No more in-card banner that
//                      occluded data.
//   • Canvas-level   → `GlobalDataWarningBanner` (top of canvas) —
//                      the "Action required" surface, but now rendered
//                      ONCE for the whole report instead of per module.
//
// See `lib/profile-status.ts` for the severity derivation and
// `components/report/ModuleWarningIcon.tsx` for the icon component.

function ModuleCardImpl({
  module,
  definition,
  isEditMode,
  isResizing = false,
  onChartTypeChange,
  onDuplicate,
  onDelete,
  height,
  selectedProfiles = [],
}: ModuleCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  // True while any dropdown inside ModuleActions (chart-type picker
  // or overflow menu) is open. We keep the chrome mounted in that
  // state so moving the cursor from the card into the portaled
  // dropdown surface doesn't unmount the dropdown mid-click.
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  // Filter globally-selected profiles to the platforms this module's
  // definition supports.  Computed early because the banner derivation
  // + contentHeight calculation both depend on it.
  //
  // `module.network` narrows that further:
  //   • A specific platform key (e.g. 'tiktok') — module was dragged from
  //     a network-specific tab; only profiles on that network count, and
  //     if there are none we render the "Select a matching profile"
  //     empty state (Figma 1916:37020).
  //   • `'cross-network'` or undefined (legacy) — keep the broad
  //     definition-driven filter.
  const platformSet = new Set<string>(definition.platforms);
  const networkBinding = module.network ?? 'cross-network';
  const profilesForModule = selectedProfiles.filter((p) => {
    if (networkBinding !== 'cross-network') return p.platform === networkBinding;
    return platformSet.has(p.platform);
  });
  // True when no profile in the user's current selection matches
  // the module — either:
  //   • the module is network-bound (e.g. TikTok) but the user has
  //     no TikTok profile selected, OR
  //   • the module is cross-network but the user has no profile
  //     selected at all (a brand-new "from scratch" report starts
  //     here).
  // Drives the blurred empty-state overlay rendered below the chart
  // content.  `NetworkMissingOverlay` differentiates the copy: a
  // specific-platform binding names the network ("…select a TikTok
  // profile."), cross-network falls back to a generic prompt.
  const isMissingNetworkMatch = profilesForModule.length === 0;

  // Warning derivation — Case 2 (reconnect / permission) takes
  // precedence over Case 1 (partial data) so a module that has both
  // statuses surfaces only the actionable red triangle, never both.
  // See `lib/profile-status.ts` for the classification rules.  The
  // returned `profiles` is the affected subset; tooltip copy keys off
  // the names + count.
  const { severity: warningSeverity, profiles: warningProfiles } =
    deriveModuleWarning(profilesForModule);

  // Figma 1168:213978 (hover) + 1168:214102 (default): every module card
  // has a 20 px inset, with the title sitting at exactly y=20. The
  // 32×32 action buttons are an ABSOLUTE overlay in the top-right —
  // they sit on top of the header row rather than inside it, so
  // mounting / unmounting them on hover is a no-op for layout. The
  // title row therefore collapses to its natural 21 px line-height; a
  // 24 px gap separates it from the content body.
  //
  // Non-content budget cases:
  //   • No banner            → 20 + 14 (title)              + 24 + 20 = 78
  //   • Full banner          → 20 + 14 + (banner 42)        + 24 + 20 = 120
  //   • Compact banner-tag   → 20 + 26 (title row grows to
  //                            tag's 26-px height)          + 24 + 20 = 90
  // (`HEADER_GAP_PX` represents the visual gap between the title row
  // and the content body.  Whether the gap is split — 12 above the
  // banner + 12 below — or contiguous, the total occupied vertical
  // space stays 24 px.)
  const HEADER_GAP_PX = 24;
  const PAD_PX = 20;

  // Track content-area pixel width via ResizeObserver. The Audience
  // Growth chart (and future responsive modules) uses this to decide
  // x-axis tick density — drop ticks when the module is narrow, show
  // the full daily series when wide.
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track card-root pixel width. ModuleActions uses this to decide its
  // own layout (normal vs compact) at the module level — NOT by
  // viewport media query, so a single module that's been shrunk by the
  // user still gets the compact actions while full-width siblings
  // keep the segmented control. Observed from the card root (not the
  // content ref) so the threshold check reads the actual outer box the
  // actions have to fit inside.
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCardWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The warning icon lives INSIDE the title row (right of the title,
  // left of the info `(i)`), so it doesn't grow the row height or
  // steal vertical budget from the chart.  The Case-2 variant is a
  // 20 px pill — taller than the 14 px regular title height — so we
  // bump the title row to 20 px when present to keep the icon
  // vertically centered with the title text (avoids a 6-px clip).
  // Case 1 is an outline 14 px glyph with no pill, so the row stays
  // at its natural height.
  const titleRowGrowsForBadge = warningSeverity === 'case2';
  const TITLE_ROW_PX = titleRowGrowsForBadge ? 20 : 14;
  const contentHeight = Math.max(
    height - (PAD_PX * 2 + TITLE_ROW_PX + HEADER_GAP_PX),
    0,
  );

  // Hover tracking lives on the grid-item (cardRef's parent), not the
  // card itself. react-grid-layout injects the resize handle as a
  // sibling of the card inside the grid-item, so a listener on the
  // card would fire `mouseleave` the moment the cursor crossed into
  // the SE-corner handle — dropping the hover chrome exactly when the
  // user is reaching for it.
  useEffect(() => {
    const card = cardRef.current;
    const gridItem = card?.parentElement;
    if (!gridItem) return;
    const enter = () => setIsHovered(true);
    const leave = () => setIsHovered(false);
    gridItem.addEventListener('mouseenter', enter);
    gridItem.addEventListener('mouseleave', leave);
    return () => {
      gridItem.removeEventListener('mouseenter', enter);
      gridItem.removeEventListener('mouseleave', leave);
    };
  }, []);

  // (`profilesForModule` + `platformSet` are computed at the top of
  // the function so the banner derivation + contentHeight calc can
  // both read them.)

  // Chrome (drag handle, actions, hover border/shadow, resize grip) is
  // driven by hover OR active resize — NOT by edit-mode alone. A
  // module in edit mode but not being interacted with reads as a clean
  // card. `isResizing` is latched by the parent ReportCanvas for the
  // module being resized, so the chrome stays visible even when the
  // cursor slips outside the card's (changing) bounds mid-drag.
  const showEditChrome =
    isEditMode && (isHovered || isResizing || actionsMenuOpen);

  return (
    <div
      ref={cardRef}
      className={cn(
        '@container relative bg-white rounded-[8px] border h-full flex flex-col overflow-hidden p-[20px] transition-[border-color,box-shadow] duration-150',
        showEditChrome
          ? 'border-[#4D36FF] shadow-[0px_4px_8px_0px_rgba(32,30,36,0.1),0px_8px_16px_0px_rgba(32,30,36,0.1)]'
          : 'border-[#E8E8E9]',
      )}
    >
      {/* Drag handle — absolute overlay in the top-left padding gutter.
          Figma 1182:232748 (DotsSixVertical). The 8×13 visible grip
          sits inside the card's 20 px left padding: 6 px from the card
          border, 6 px to the title's x=20 start (6 + 8 + 6 = 20), so
          the title position is invariant. The 24×24 tile is offset to
          x=−2 to land the grip at card x=6; the 2 px overhang is
          clipped by the card's `overflow-hidden`.
          Vertical centering math:
            • Card padding-top = 20.
            • Title row height varies: 14 px when title-only (h3
              `leading-none`), or 20 px when the compact banner tag
              shares the row (the tag locks the row to its own 20 px).
              `items-center` on the row places the title's visual
              center at row-y = row-height / 2.
            • Title visual center in card-y = 20 + row-height / 2.
            • The grip's visual center inside the 24-tile is at
              tile-y = 11.5.
            • Drag-handle `top` = title-center-y − 11.5.
          For a 14-px row → 27 − 11.5 = 15.5.
          For a 20-px row → 30 − 11.5 = 18.5.
          Color is DARK/dark--tint_30 (#626165). */}
      {isEditMode && showEditChrome && (
        <div
          className="drag-handle absolute left-[-2px] flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
          style={{ top: titleRowGrowsForBadge ? 18.5 : 15.5 }}
          aria-hidden="true"
        >
          <IconDragHandle size={24} color="#626165" />
        </div>
      )}

      {/* Module actions — absolute overlay, right-aligned at card's
          20 px inset. Absolute positioning is load-bearing: the 28×28
          buttons must NOT participate in the flex flow, otherwise
          mounting them on hover would push the title row taller and
          change the padding-top the user perceives. With this overlay,
          the title always sits at exactly y=20 regardless of hover
          state, chart type, or screen size.
          Vertical center on the title: title line-box is 14 px starting
          at y=20 (center y=27). Action row is 28 px tall, so top =
          27 − 14 = 13 px centers the row on the title. Row extends
          y=13→41; content starts at y=58 (20 pt + 14 title + 24 gap),
          clearance 17 px. */}
      {showEditChrome && (
        <div className="absolute top-[13px] right-[20px] z-10 flex items-center">
          <ModuleActions
            supportedChartTypes={definition.supportedChartTypes}
            currentChartType={module.chartType}
            onChartTypeChange={(type) => onChartTypeChange(module.id, type)}
            onDuplicate={() => onDuplicate(module.id)}
            onDelete={() => onDelete(module.id)}
            cardWidth={cardWidth}
            onMenuOpenChange={setActionsMenuOpen}
          />
        </div>
      )}

      {/* Title row — natural 21 px line-height, no compensating
          `h-[52px]` / `items-center`. Title's top edge sits at
          card-top + 20 (card padding) = exactly 20 px. Figma
          1168:213980 — `gap-[4px] items-center`.
          Order per Figma 1197:269951:
            title  →  info (i)  →  ModuleWarningIcon
          The warning sits AFTER the info icon so the title's
          paired-info affordance stays adjacent to the title text
          and the warning reads as a distinct attention marker. */}
      <div className="flex items-center gap-[4px] min-w-0 flex-shrink-0">
        {/* Figma 1026:38625 — IBM Plex Sans Regular 14 / 21, DARK/dark--tint_10 (#363439). */}
        <h3 className="text-[14px] font-normal text-[#363439] leading-none truncate">
          {definition.name}
        </h3>
        {/* Figma 1026:38626 — info icon, 16-px tile, stroke
            `DARK/dark--tint_30 (#626165)` per the Figma variable
            binding (NOT the title's #363439 — the icon reads softer
            than the label so it doesn't compete with the metric
            title).  Renders at the library default stroke-width of
            1.5.  Was overridden to 1 to match Figma, but 1 CSS-px
            with `non-scaling-stroke` = 1 device px on DPR=1
            displays which anti-aliased to a barely-visible line;
            1.5 renders consistently across both retina and
            non-retina screens. */}
        <button
          type="button"
          className="flex-shrink-0 flex items-center justify-center"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <IconInfo
            size={16}
            color="#626165"
          />
        </button>
        {warningSeverity !== null && (
          <ModuleWarningIcon
            severity={warningSeverity}
            profiles={warningProfiles}
          />
        )}
      </div>

      {/* Content — 24 px gap from title to chart.  Padding is owned
          by the card root (`p-[20px]`); this child only contributes
          the header→body gap via `pt-[24px]`.  No more banner-
          conditional `pt-[12px]` branch: the new ModuleWarningIcon
          lives in the title row above and doesn't carve out vertical
          space below the row. */}
      <div
        ref={contentRef}
        className={cn(
          // `relative` makes the empty-state overlay below position
          // against the content box (so it covers only the chart area
          // and not the title row).
          'relative flex-1 min-h-0 overflow-hidden pt-[24px]',
        )}
      >
        {getModuleContent(module, definition, contentHeight, contentWidth, profilesForModule)}
        {isMissingNetworkMatch && (
          <NetworkMissingOverlay network={networkBinding} />
        )}
      </div>
    </div>
  );
}

/**
 * Display label for each canonical `Platform` key, as used in body
 * copy ("Data will appear here if you select a Facebook profile.").
 * Kept here rather than in `lib/profile-data` because the empty-state
 * is currently the only consumer; if more strings appear later this
 * map should move to a shared `lib/platform-labels.ts`.
 *
 * Google Analytics is the one entry that doesn't read naturally with
 * the trailing "profile" noun, so its label is left as "Google
 * Analytics" — the sentence still parses ("…select a Google Analytics
 * profile.") and matches how the filter chip itself is labelled.
 */
const NETWORK_DISPLAY_LABEL: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  'google-analytics': 'Google Analytics',
  x: 'X',
  threads: 'Threads',
  bluesky: 'Bluesky',
};

/**
 * Empty-state overlay rendered over a module's chart area when no
 * profile in the user's current selection matches the module.
 * Figma 1916:37020.
 *
 * Two cases:
 *   • Network-bound module (e.g. TikTok) with no profile on that
 *     network selected → body names the platform
 *     ("…select a TikTok profile.").
 *   • Cross-network module with NO profiles selected at all (the
 *     fresh "Start from scratch" report state) → generic copy
 *     ("…select a compatible profile.") since there's no single
 *     platform to point at.
 *
 * The chart skeleton (axes / mock data / legend) still renders
 * underneath — we don't blank it out — so the overlay's translucent
 * white wash + `backdrop-blur` creates the "data is there but
 * locked behind a profile selection" feel.
 *
 * Positioning is `absolute inset-0`; the parent provides `relative`
 * and `overflow-hidden` so the overlay clips to the rounded content
 * area instead of bleeding past the card chrome.
 */
function NetworkMissingOverlay({
  network,
}: {
  network: Platform | 'cross-network';
}) {
  const bodyCopy =
    network === 'cross-network'
      ? 'Data will appear here if you select a compatible profile.'
      : `Data will appear here if you select a ${NETWORK_DISPLAY_LABEL[network]} profile.`;
  return (
    <div
      // BRAND/light @ 80% alpha + 5 px backdrop blur per Figma
      // 1916:37020. `rounded-[6px]` matches the card's inner content
      // radius; without it the overlay corners square off where the
      // surrounding card has 6 px rounding.
      className="absolute inset-0 flex flex-col items-center justify-center gap-[16px] bg-[rgba(255,255,255,0.8)] backdrop-blur-[5px] rounded-[6px]"
      // Block pointer events from bleeding into the chart underneath
      // (e.g. Recharts tooltip hover), which would feel wrong given
      // the chart isn't actionable in this state.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <IconActivity size={32} color="#4D36FF" />
      <div className="flex flex-col items-center max-w-[345px] px-[16px] text-center">
        <p className="text-[16px] leading-[24px] font-medium text-[#201E24]">
          Select a matching profile to see data
        </p>
        <p className="text-[14px] leading-[21px] font-normal text-[#626165]">
          {bodyCopy}
        </p>
      </div>
    </div>
  );
}

/**
 * Memoized so the card only re-renders when its own props actually change.
 * Critical during live drag: when a sibling is shifted, only that sibling's
 * `module` reference gets a new object; cards whose layout is unchanged
 * skip the render, which keeps Recharts' ResponsiveContainer from
 * re-measuring every frame (previously the cause of a max-update-depth
 * loop in AudienceGrowthModule's YAxis).
 */
export const ModuleCard = memo(ModuleCardImpl);
