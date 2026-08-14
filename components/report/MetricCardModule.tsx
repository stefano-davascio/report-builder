'use client';

import { MetricData } from '@/types';
import { IconTrendUp, IconTrendDown } from '@/components/icons/SendiIcons';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';

interface MetricCardModuleProps {
  /**
   * Catalog compatibility: every mock entry is an array, but per the
   * atomic-module model a single metric card renders exactly one headline
   * metric — we consume `metrics[0]` and ignore the rest.
   */
  metrics: MetricData[];
  /**
   * Profiles this module covers. Threaded through from `ModuleCard` →
   * `ModuleNetworks` so the bottom-right network-logo cluster renders
   * the same way as every other module (Audience Growth, etc.).
   */
  profiles?: MockProfile[];
  /**
   * Pixel width of the card's content area (ModuleCard's padded inner
   * box). Drives the responsive stack breakpoint below — when there
   * isn't room to run value / change / networks on one row, we reflow
   * the value onto its own line and drop change + networks to a second
   * row with `justify-between`. A missing value (0) is treated as "too
   * narrow to fit" so the first paint never flashes a clipped one-row
   * layout before ResizeObserver fires.
   */
  contentWidth?: number;
}

/**
 * Threshold below which the card reflows into two rows. Chosen from the
 * measured one-row reservation:
 *
 *   value (≈ 4-char "210K" at 24 px medium) ≈ 70 px
 *   +  8 px gap
 *   +  change  ("+14K (+7.2%)" with 16 px icon + 4 px gap) ≈ 120 px
 *   +  inter-group gap (min ~16 px for visual air)
 *   +  networks  (3 × 20 px − 6 px overlap + ring ≈ 60 px, with `+N`
 *                 overflow bumping to ~80 px)
 *   ────────────────────────────────────────────────
 *   ≈ 280 – 300 px
 *
 * We pick 300 so the reflow fires a hair early, before the overlap
 * actually clips — otherwise the moment of truth happens mid-drag on a
 * resizable card and readers see a flash of mangled copy.
 */
const STACK_THRESHOLD_PX = 300;

/**
 * Second-stage threshold: below this, even the stacked layout's row 2
 * can't comfortably hold three 20 px badges next to the change
 * indicator, so the networks cluster collapses to `1 icon + +N`.
 *
 *   change indicator  (≈ 120 px for "+14K (+7.2%)" with 16 px icon)
 * + inter-group gap   (8 px from `justify-between`)
 * + three badges      (3 × 20 − 2 × 3 overlap ≈ 54 px)
 * + breathing room    (≈ 38 px so the two groups don't visually kiss)
 *   ────────────────────────────────
 *   ≈ 220 px
 *
 * Above 220 px content width we keep all three badges; below, collapse.
 */
const COMPACT_NETWORKS_THRESHOLD_PX = 220;

/**
 * Metric card body — Figma 1197:269145 (representative instance
 * 1197:269306 "Video views", verified against the variable defs).
 *
 * Figma geometry + tokens (decoded from the design-context export):
 *   • Card padding is 15 px on every side — the Frame 238 (title) sits at
 *     (15, 15) and Frame 241 (value + comparison) is anchored at
 *     `bottom: 15, left: 15`. (The parent `ModuleCard` currently pads at
 *     20 px; that's a card-level discrepancy tracked separately — this
 *     body simply anchors bottom-left inside whatever area `ModuleCard`
 *     hands it.)
 *   • Value — IBM Plex Sans **Medium**, size **24**, line-height **30**,
 *     tracking **-0.6 px**, color `#363439` (DARK/dark--tint_10).
 *   • Comparison — IBM Plex Sans Regular, size **12**, line-height **12**,
 *     tracking **1 px**, **UPPERCASE**, color = the trend's semantic
 *     shade: SUCCESS/success--shade_50 `#006B43` when up, ERROR/error
 *     (`#CE091C`, the same red as the down-trend circle) when down.
 *   • Gap between Value and Comparison — `spacings/8` (8 px).
 *   • Inside the Comparison frame — 16 px icon, 4 px gap to the label.
 *   • Bottom-right — ModuleNetworks cluster (same 20 px white-ringed
 *     platform badges every other module uses), pinned to the right edge
 *     of the same baseline row as Frame 241 via `justify-between`.
 *
 * What this component deliberately does NOT render:
 *   • The title + info-icon header row — owned by `ModuleCard`.
 *   • A surrounding border / bg — the parent card draws card chrome.
 *   • The `changeLabel` (e.g. "vs last period") — not shown in Figma.
 */
export function MetricCardModule({
  metrics,
  profiles = [],
  contentWidth = 0,
}: MetricCardModuleProps) {
  const metric = metrics[0];
  if (!metric) return null;

  const isUp = metric.change >= 0;
  // `change` is already signed; only positive values need an explicit `+`
  // (JS number→string drops the leading `+`). Preserve caller precision —
  // integer percents render as "-2%", fractional as "+19.22%".
  const pct = `${isUp ? '+' : ''}${metric.change}%`;
  const comparison = metric.changeAbsolute
    ? `${metric.changeAbsolute} (${pct})`
    : pct;

  // Comparison label color mirrors the trend indicator's semantic fill so
  // the message reads as a single unit: green-up / red-down. Hex values
  // are the Figma variable tokens — DO NOT substitute Tailwind defaults.
  const comparisonColor = isUp ? 'text-[#006B43]' : 'text-[#CE091C]';

  // Pre-ResizeObserver render: default to the stacked layout so the
  // first paint is never the clipping one-row variant on a narrow card.
  const stack = contentWidth > 0 && contentWidth < STACK_THRESHOLD_PX;
  // Two-stage collapse — only drop to a single badge when row 2
  // genuinely can't fit three. At medium-narrow widths the stack layout
  // still shows the full cluster.
  const compactNetworks =
    contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX;

  // Shared inner atoms — kept as locals so the two layout branches below
  // share one source of truth (same fonts, same colors, same gaps).
  const valueEl = (
    <span className="text-[24px] @min-[200px]:text-[48px] leading-[30px] font-medium tracking-[-0.6px] text-[#363439] whitespace-nowrap">
      {metric.value}
    </span>
  );

  const changeEl = (
    <div className="flex items-center gap-[4px] flex-shrink-0">
      {isUp ? <IconTrendUp size={16} /> : <IconTrendDown size={16} />}
      <span
        className={`${comparisonColor} text-[12px] leading-[12px] font-normal tracking-[1px] uppercase whitespace-nowrap`}
      >
        {comparison}
      </span>
    </div>
  );

  if (stack) {
    // Narrow layout — value on its own row, change + networks pushed to
    // a second row via `justify-between`. `gap-[8px]` vertically matches
    // the horizontal rhythm in the wide variant. The content still
    // anchors to the bottom of the card (ModuleCard provides the chrome
    // + title above), which is why the outer wrapper keeps
    // `justify-end` — the value/change pair rides the card's baseline
    // just as it does on wide cards.
    return (
      <div className="flex flex-col justify-end h-full gap-[8px]">
        <div className="flex items-center min-w-0">{valueEl}</div>
        <div className="flex items-center justify-between gap-[8px]">
          {changeEl}
          {/* Two-stage collapse — cluster shows the full 3-badge set
              until row 2 genuinely can't hold it (see
              `COMPACT_NETWORKS_THRESHOLD_PX`), then falls back to
              `1 icon + +N`. This preserves the at-a-glance network
              signal on medium-narrow cards and only simplifies when
              the cluster would crowd the card's right padding. */}
          <ModuleNetworks
            profiles={profiles}
            maxVisible={compactNetworks ? 1 : 3}
          />
        </div>
      </div>
    );
  }

  // Wide layout — Figma 1197:269145 baseline row: Frame 241 (value +
  // comparison) pinned LEFT, ModuleNetworks pinned RIGHT. Only used
  // when there's actually room for everything on one line; the
  // threshold above guards against mid-resize clipping.
  return (
    <div className="flex flex-col justify-end h-full">
      <div className="flex items-center justify-between gap-[8px]">
        <div className="flex items-center gap-[8px] min-w-0">
          {valueEl}
          {changeEl}
        </div>
        <ModuleNetworks profiles={profiles} />
      </div>
    </div>
  );
}
