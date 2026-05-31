'use client';

/**
 * Audience Growth chart — Figma frame 1026-38493 (default state),
 * 1168-213840 (hover vs. default comparison). Palette refresh from
 * Figma 1302:170369: each series owns a primary stroke color and a
 * paired subtle fill color. The area fill uses the subtle token at
 * 70% opacity (no gradient) so the three overlapping bands read as
 * flat translucent washes — matches the Figma comp exactly.
 *
 * Three overlapping area series rendered behind each other:
 *   • Net followers  — stroke #3FA40D / fill #D7F7C2 (green)
 *   • Followers      — stroke #0570DE / fill #CFF5F6 (blue)
 *   • Profile views  — stroke #ED6704 / fill #FCEDB9 (orange)
 *
 * Visual chrome (per Figma, after the pixel-perfect refinement pass):
 *   • Y-axis ticks: 12 / 18 IBM Plex Sans, DARK/dark--tint_30 (#626165).
 *   • Y-axis width: 32 px so "1k" at 12 px fits without clipping.
 *   • Y-axis tick count: responsive to chart height (see Y_TICK_COUNT).
 *   • X-axis ticks: 12 / 18 IBM Plex Sans, #626165, tickMargin 12 px.
 *   • X-axis density: responsive — we pass an **explicit** `ticks` array
 *     whose indices are evenly distributed across the 30-day range and
 *     always include Mar 2 + Apr 1. This matches Figma 1026:38774,
 *     where the widest variant shows every 2 days (16 ticks) and
 *     narrower variants drop to 7 → 6 → 4 → 3, never leaving a lopsided
 *     "Mar 26 → Apr 1" tail gap. `interval={0}` forces recharts to
 *     render every tick we pass, overriding its own collision logic.
 *   • Gridlines: horizontal only, 1 px #E8E8E9.
 *   • Legend: `justify-between` row — series swatches pinned LEFT, the
 *     ModuleNetworks platform-logo cluster pinned RIGHT. 24 px gap
 *     between series items; 20 px gap from the chart area
 *     (Figma 1168:214056 + 1026:38728 — body = chart 496 + gap 20 +
 *     legend 20). Label color DARK/dark--tint_20 (#4C4B4F). `flex-wrap`
 *     + `rowGap: 16` lets the networks cluster drop to a second row on
 *     very narrow modules instead of colliding with the series.
 */

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip } from './ModuleTooltip';
import { renderTimeSeriesXTick } from './timeSeriesChrome';
import { useChartCurveStyle } from '@/lib/chart-style-context';

/** One series entry as consumed by the area / line / bar variants. */
export interface SeriesSpec {
  key: 'netFollowers' | 'followers' | 'profileViews';
  label: string;
  /** Stroke + legend-dot color. */
  color: string;
  /** Fill swatch used by the area / bar renderers (paler tint of `color`). */
  subtle: string;
}

// Cross-network palette (Figma 1302:170369) — distinct hues so the
// three overlapping series read as separate bands.  Used by every
// `audience-growth` module not bound to a specific network.
const SERIES_CROSS_NETWORK: SeriesSpec[] = [
  { key: 'netFollowers', label: 'Net followers', color: '#3FA40D', subtle: '#D7F7C2' },
  { key: 'followers',    label: 'Followers',     color: '#0570DE', subtle: '#CFF5F6' },
  { key: 'profileViews', label: 'Profile views', color: '#ED6704', subtle: '#FCEDB9' },
];

// TikTok palette (Figma 2201:51879) — single-hue blue gradient since
// every series belongs to the same network.  Top band (Followers) is
// the darkest, bottom band (Profile views) is the lightest, so the
// stacked-area paint reads as a tonal staircase even when the bands
// don't overlap perfectly.  Strokes are picked to be visible against
// their own fill while still differentiating in the legend.
const SERIES_TIKTOK: SeriesSpec[] = [
  { key: 'netFollowers', label: 'Net followers', color: '#1F8DDC', subtle: '#9EC6EA' },
  { key: 'followers',    label: 'Followers',     color: '#0570DE', subtle: '#5B9BD5' },
  { key: 'profileViews', label: 'Profile views', color: '#7CB5EB', subtle: '#CFE4F7' },
];

/**
 * Resolve which series palette to use for a given module network.
 * `'tiktok'` swaps to the all-blue gradient; anything else falls
 * back to the cross-network green/blue/orange tokens.
 */
export function getSeries(network?: string | null): SeriesSpec[] {
  return network === 'tiktok' ? SERIES_TIKTOK : SERIES_CROSS_NETWORK;
}

/**
 * Back-compat default export — old callers (sibling modules + tests)
 * that imported `SERIES` directly still resolve to the cross-network
 * palette without any code change.  New call sites should call
 * `getSeries(module.network)` to pick the right tokens.
 */
export const SERIES = SERIES_CROSS_NETWORK;

export type Row = {
  date: string;
  netFollowers: number;
  followers: number;
  profileViews: number;
};

// 31-day window (Mar 2 – Apr 1) — hand-picked anchor values per
// Figma 2201:51879 (TikTok comp).  The Figma comp shows visible
// day-to-day jitter (sharp peaks at Mar 22 / Mar 30, a dip
// mid-month, a final spike to ~1100 on Apr 1) which the linear
// curve type renders as visibly angular segments.  Smooth
// sine-generated data from the previous version made the linear
// vs. monotone visual difference invisible because adjacent
// days were too close in value for the interpolation choice to
// matter — these anchors fix that by mirroring the comp's
// proportions exactly.
//
// Three series, three bands:
//   • Followers     — top:    540 → 1100, with a Mar 22 peak ~890
//   • Net followers — middle: 270 → 350,  with a Mar 30 dip to ~190
//   • Profile views — bottom: 10–80, thin baseline near the x-axis
//
// Y-domain stays [0, 1200] so the followers ceiling has headroom
// without re-sizing.
const FOLLOWERS_ANCHORS = [
  540, 580, 610, 650, 670, 680, 690, 695, 700, 700,
  700, 720, 760, 810, 840, 870, 880, 890, 870, 860,
  850, 830, 810, 815, 820, 840, 860, 850, 855, 950,
  1100,
];
const NET_FOLLOWERS_ANCHORS = [
  270, 290, 310, 330, 345, 350, 350, 350, 350, 350,
  345, 380, 420, 450, 470, 480, 485, 480, 460, 440,
  410, 380, 360, 350, 320, 290, 260, 210, 190, 240,
  340,
];
const PROFILE_VIEWS_ANCHORS = [
  20, 30, 50, 60, 40, 15, 20, 30, 25, 35,
  20, 40, 60, 50, 30, 20, 35, 50, 30, 25,
  20, 50, 70, 50, 30, 20, 50, 60, 30, 50,
  35,
];

function generateData(): Row[] {
  const rows: Row[] = [];
  const start = new Date(2026, 2, 2); // Mar 2, 2026
  for (let i = 0; i < 31; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    // `day: 'numeric'` (not '2-digit') — Figma labels read "Mar 2",
    // not "Mar 02". Leading-zero days looked cramped at 12 px.
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    rows.push({
      date: label,
      netFollowers: NET_FOLLOWERS_ANCHORS[i],
      followers:    FOLLOWERS_ANCHORS[i],
      profileViews: PROFILE_VIEWS_ANCHORS[i],
    });
  }
  return rows;
}

export const DATA = generateData();

export function formatYAxis(v: number): string {
  if (v >= 1000) return `${v / 1000}k`;
  return String(v);
}

/**
 * Pick a y-axis tick count from the available chart-area pixel height.
 * Smaller modules collapse to 3 ticks (0 / 500 / 1k), wider ones
 * restore the full 100-step ladder. Recharts places ticks using this
 * count across the 0–1000 domain.
 */
export function pickYTickCount(chartH: number): number {
  if (chartH < 180) return 3;   // 0 / 600 / 1.2k
  if (chartH < 260) return 5;   // 0 / 300 / 600 / 900 / 1.2k
  if (chartH < 340) return 7;   // 0 / 200 / 400 / 600 / 800 / 1k / 1.2k
  return 13;                    // 0 / 100 / 200 / … / 1.2k
}

/**
 * Pick an x-axis tick count from the available chart-area pixel width.
 * We choose from a fixed set whose (count − 1) divides 30 evenly, so
 * every tick lands on an integer data index and the gaps stay uniform.
 *
 *   count  step    visible dates
 *   ─────  ──────  ────────────────────────────────────────────────
 *     3    15 d    Mar 2, Mar 17, Apr 1
 *     4    10 d    Mar 2, Mar 12, Mar 22, Apr 1
 *     6     6 d    Mar 2, Mar 8, Mar 14, Mar 20, Mar 26, Apr 1
 *     7     5 d    Mar 2, Mar 7, Mar 12, Mar 17, Mar 22, Mar 27, Apr 1
 *    16     2 d    every other day (matches wide Figma variant)
 *
 * Count = 5 is intentionally skipped (30 ÷ 4 = 7.5 breaks even steps).
 */
export function pickXTickCount(w: number): number {
  if (w < 360) return 3;
  if (w < 480) return 4;
  if (w < 680) return 6;
  if (w < 980) return 7;
  return 16;
}

/**
 * Build an explicit ticks array (date-string values) evenly distributed
 * across the 31-point data window. Always anchors both endpoints so the
 * last gap is never disproportionately wide.
 */
export function computeXTicks(data: Row[], count: number): string[] {
  const last = data.length - 1;
  const ticks: string[] = [];
  for (let i = 0; i < count; i++) {
    // Integer index by construction — (count − 1) divides 30 for every
    // count in pickXTickCount's table.
    const idx = Math.round((i * last) / (count - 1));
    ticks.push(data[idx].date);
  }
  return ticks;
}

interface AudienceGrowthModuleProps {
  contentHeight: number;
  /**
   * Pixel width of the chart's content area — passed from the ModuleCard
   * via ResizeObserver. Used to decide whether to reserve legend-row
   * space for the Networks indicator (always visible) and also
   * surfaced via recharts' ResponsiveContainer; the axis tick density
   * is driven by recharts' own minTickGap math on top of this width.
   */
  contentWidth?: number;
  /**
   * Profiles from the global selection bar that match this module's
   * supported platforms. Rendered as an overlap-avatar cluster on the
   * right side of the legend row.
   */
  profiles?: MockProfile[];
  /**
   * Module's network binding from `ReportModule.network`.  Drives the
   * series palette via `getSeries` — TikTok gets the all-blue
   * gradient; anything else falls back to the cross-network green /
   * blue / orange.  Optional so cross-network callers can omit it.
   */
  network?: string | null;
}

// Legend row — Figma 1026:38728 body (845×536): chart = 496, then a
// 20 px gap, then a 20 px legend row (516 + 20 = 536). Total reserve
// below the chart is 40 px.
export const LEGEND_ROW_H = 20;
export const LEGEND_TOP_GAP = 20;
export const LEGEND_RESERVE = LEGEND_ROW_H + LEGEND_TOP_GAP;

/**
 * Dynamic gap between legend series items. Figma anchors the widest
 * variant at `gap-6` (24 px) and the narrowest at 4 px — anything
 * tighter than 4 px reads as a mistake, so at that floor we let the
 * items break onto the next line instead (handled by `flex-wrap` on
 * the series container).
 *
 * Four steps keep the fall-off perceptible without feeling jittery as
 * the card is resized: 24 → 16 → 8 → 4.
 */
export function pickSeriesGap(contentW: number): number {
  if (contentW >= 500) return 24;
  if (contentW >= 450) return 16;
  if (contentW >= 400) return 8;
  return 4;
}

/**
 * Collapse the network cluster to `1 icon + +N` below this content
 * width. Same intent as `MetricCardModule`'s two-stage collapse — on
 * medium-narrow cards, three 20 px badges can technically fit next to
 * the legend's 3-item run, but they crowd the right padding once the
 * series gap has already ratcheted down to 4 px. Pick this threshold
 * to fire once the series has hit its tightest spacing AND the cluster
 * would otherwise need to wrap anyway.
 */
export const COMPACT_NETWORKS_THRESHOLD_PX = 400;

export function AudienceGrowthModule({
  contentHeight,
  contentWidth = 0,
  profiles = [],
  network,
}: AudienceGrowthModuleProps) {
  const series = getSeries(network);
  const curveType = useChartCurveStyle();
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);
  const yTickCount = pickYTickCount(chartH);
  // Plot width ≈ content width minus the y-axis gutter (32 px). Fall
  // back to content width on the first render (before ResizeObserver
  // has reported) so we don't flash the smallest tick count.
  const plotW = contentWidth > 0 ? contentWidth - 32 : 0;
  const xTickCount = pickXTickCount(plotW);
  const xTicks = computeXTicks(DATA, xTickCount);

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={DATA}
            // Horizontal margins are zero so the plot area fills the
            // module's content width edge-to-edge (y-axis gutter at the
            // left is handled by YAxis's own `width`). The outermost
            // ticks would normally clip because recharts centers their
            // labels, so we supply a custom tick renderer below that
            // anchors the first label to `start` and the last to `end`.
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke="#E8E8E9"
              strokeWidth={1}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              // Explicit ticks with even step so the visual rhythm is
              // uniform — recharts' built-in "preserveStartEnd" strategy
              // left a lopsided Mar 26 → Apr 1 tail on medium widths.
              // `interval={0}` keeps every tick we pass.
              ticks={xTicks}
              interval={0}
              tickMargin={12}
              // Custom tick: 12 / 18 IBM Plex Sans, DARK/dark--tint_30.
              // First label → `start`-anchored, last → `end`-anchored so
              // they hug the plot's edges and we can run margins at 0.
              // Middle ticks keep recharts' default middle anchor.
              // Shared with every other time-series module via
              // `./timeSeriesChrome` so the tick chrome stays in lockstep.
              tick={renderTimeSeriesXTick(xTicks)}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#626165', fontFamily: 'IBM Plex Sans, sans-serif' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              // Widened from 28 → 32 so "1.2k" at 12 px doesn't clip.
              width={32}
              domain={[0, 1200]}
              // Height-driven density: few ticks when short, full
              // ladder when tall. Recharts picks nice round values
              // across [0, 1000] given a tickCount.
              tickCount={yTickCount}
            />
            <Tooltip content={<ModuleTooltip />} cursor={{ stroke: '#C4C3C6', strokeDasharray: '3 3' }} />
            {/* Render largest area first so smaller series sit on top. */}
            {series.map((s) => (
              <Area
                key={s.key}
                type={curveType}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={1.5}
                fill={s.subtle}
                fillOpacity={0.7}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: s.color }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row — Figma 1168:214056. `justify-between` pins the
          series swatches to the LEFT edge and the ModuleNetworks
          cluster to the RIGHT edge of the content area. `flex-wrap`
          + `rowGap: 16` lets the networks cluster drop to a second
          line on very narrow cards instead of overlapping the series.
          20 px gap above (paddingTop), 20 px row height — see
          LEGEND_* constants above. */}
      <div
        className="flex flex-wrap items-center justify-between w-full flex-shrink-0"
        style={{ paddingTop: LEGEND_TOP_GAP, rowGap: 16 }}
      >
        {/* LEFT: series swatches. Gap is width-driven (24 → 4 px —
            see `pickSeriesGap`) and the container itself wraps so
            items fall to a new line once the 4 px floor is hit.
            12 × 12 dots; label uses DARK/dark--tint_20 (#4C4B4F),
            12 / 16 with 0.3 px tracking (Label-Helper). */}
        <div
          className="flex flex-wrap items-center"
          style={{ columnGap: pickSeriesGap(contentWidth), rowGap: 8 }}
        >
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span
                className="text-[#4C4B4F]"
                style={{
                  fontSize: 12,
                  lineHeight: '16px',
                  letterSpacing: '0.3px',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* RIGHT: networks indicator. Collapses to `1 icon + +N` on
            narrow cards (see `COMPACT_NETWORKS_THRESHOLD_PX`) so the
            cluster stays inside the card's right padding. */}
        <ModuleNetworks
          profiles={profiles}
          maxVisible={contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX ? 1 : 3}
        />
      </div>
    </div>
  );
}
