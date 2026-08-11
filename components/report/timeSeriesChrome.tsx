'use client';

/**
 * Shared visual chrome for the single-series time-series modules
 * (line, area, bar). Extracted so the four renderings — and the
 * 3-series multi-line variants — stay byte-for-byte consistent and
 * a future tweak (axis color, legend gap, tick anchor logic, etc.)
 * lands in exactly one place.
 *
 * Two exports:
 *
 *   • `renderTimeSeriesXTick(xTicks)` — XAxis `tick` renderer that
 *     anchors the first label `start` and the last `end` so the
 *     outermost dates don't clip the plot edges. Used by every
 *     date-axis chart in the report.
 *
 *   • `<TimeSeriesLegend />` — single-series footer (swatch + label
 *     LEFT, networks indicator RIGHT). Wraps + collapses identically
 *     to the area / bar / line modules' inline legends so flipping
 *     chart types produces zero footer jitter.
 *
 * Multi-series modules (Audience Growth, Interactions by day) keep
 * their own legend rows since they need to render N swatches; they
 * still reuse `renderTimeSeriesXTick` for x-axis parity.
 */

import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip, type TooltipPayloadEntry } from './ModuleTooltip';
import {
  LEGEND_TOP_GAP,
  pickSeriesGap,
  COMPACT_NETWORKS_THRESHOLD_PX,
} from './AudienceGrowthModule';

// ── XAxis tick renderer ───────────────────────────────────────────────────
// Recharts' `tick` prop accepts a render function whose props shape is
// `XAxisTickContentProps` (not publicly re-exported and varies between
// minor versions). We type the param as `any` so we don't pin to a
// specific Recharts internal — the four fields we read are stable.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RechartsTickProps = any;

// Recognizes date-string labels of the form "<Mon> <day>" — the shape
// every time-series chart in the report emits from `generateData()`.
// If a tick value doesn't match (e.g. hour labels like "12 AM"), we
// leave it as-is and skip the month-strip rule.
const DATE_TICK_RE =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)$/;

/**
 * Build a tick renderer for an XAxis whose `ticks` prop is `xTicks`.
 *
 * Two responsibilities:
 *   1. Anchor endpoints — the first tick anchors `start`, the last
 *      `end` so we can run zero horizontal margin without the
 *      outermost labels overflowing the plot edges.
 *   2. Month-prefix rule (Figma 2895:68528) — for `<Mon> <day>`
 *      date ticks, the first tick and any tick whose month differs
 *      from the previous tick show the full "<Mon> <day>" (e.g.
 *      "Mar 4", "Apr 1"); every other tick shows just the day
 *      number ("8", "12", "16"…).  This cuts axis clutter without
 *      losing the month transition.  Non-date labels (e.g. hour
 *      strings on Followers online) pass through untouched.
 *
 * Caller passes the same `xTicks` array it gave to `<XAxis ticks=…>`
 * so the renderer can look up the previous tick by index and detect
 * month boundaries.
 */
export function renderTimeSeriesXTick(xTicks: string[]) {
  return (props: RechartsTickProps) => {
    const { x, y, payload, index } = props;
    const isFirst = index === 0;
    const isLast = index === xTicks.length - 1;
    const anchor: 'start' | 'middle' | 'end' = isFirst ? 'start' : isLast ? 'end' : 'middle';

    const rawValue = String(payload?.value ?? '');
    const match = rawValue.match(DATE_TICK_RE);
    let displayValue = rawValue;
    if (match) {
      const currentMonth = match[1];
      const day = match[2];
      const prevValue = index > 0 ? xTicks[index - 1] : null;
      const prevMatch = prevValue ? prevValue.match(DATE_TICK_RE) : null;
      const prevMonth = prevMatch ? prevMatch[1] : null;
      // Show the month prefix ONLY on the first tick or when the
      // month changed since the last tick (e.g. "Apr 1" after
      // "Mar 30").  Every other tick drops to the bare day number.
      displayValue = isFirst || currentMonth !== prevMonth ? rawValue : day;
    }

    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor={anchor}
        fill="#626165"
        fontSize={12}
        fontFamily="IBM Plex Sans, sans-serif"
      >
        {displayValue}
      </text>
    );
  };
}

// ── Single-series legend row ─────────────────────────────────────────────
// Layout: swatch + label LEFT, ModuleNetworks RIGHT, `justify-between`,
// `flex-wrap` so the cluster drops to a second line on very narrow
// modules. Visual rules match Audience Growth (Figma 1168:214056):
//   • 12 × 12 dot
//   • 12 / 16 IBM Plex Sans, DARK/dark--tint_20 (#4C4B4F), 0.3 px tracking
//   • column gap 24 → 16 → 8 → 4 px (`pickSeriesGap`)
//   • paddingTop 20 px, rowGap 16 px on wrap
//   • networks collapse to `1 + +N` below 400 px content width
interface TimeSeriesLegendProps {
  color: string;
  label: string;
  contentWidth: number;
  profiles: MockProfile[];
}

export function TimeSeriesLegend({
  color,
  label,
  contentWidth,
  profiles,
}: TimeSeriesLegendProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between w-full flex-shrink-0"
      style={{ paddingTop: LEGEND_TOP_GAP, rowGap: 16 }}
    >
      <div
        className="flex flex-wrap items-center"
        style={{ columnGap: pickSeriesGap(contentWidth), rowGap: 8 }}
      >
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
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
            {label}
          </span>
        </div>
      </div>
      <ModuleNetworks
        profiles={profiles}
        maxVisible={contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX ? 1 : 3}
      />
    </div>
  );
}

// ── Single-series tooltip ────────────────────────────────────────────────
// Layout: one row of [dot] [date] [value] — no separate title row, no
// series-name text. The date (Recharts `label`) is what the user reads
// on hover; repeating the series name underneath it is redundant when
// the legend swatch already names the series.
//
// Multi-series charts (Audience Growth, Interactions by day) need
// per-series rows AND a date title, so they stay on the default
// `<ModuleTooltip />` shape.
//
// Recharts can call `content` either as a React element or a function
// that receives the live `{active, payload, label}` props. We use the
// function form so we can close over `label` inside the row's `getName`
// callback (which only sees per-row entries, not the tooltip-level
// date label).

// Recharts injects active/payload/label on the tooltip content prop —
// using `any` here matches the tick-renderer convention above and
// avoids pinning to non-public Recharts internals.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TooltipContentProps = any;

/**
 * Drop-in `<Tooltip content={…}>` value for single-series time-series
 * charts. Renders one row: dot · date · value.
 */
export function singleSeriesTooltipContent(props: TooltipContentProps) {
  const { active, payload, label } = props as {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
    label?: string | number;
  };
  return (
    <ModuleTooltip
      active={active}
      payload={payload}
      label={label}
      title={false}
      // Replace the per-row series name (e.g. "Video Views") with the
      // date that Recharts surfaces as `label`. The closure captures
      // `label` so we don't need to thread it through getName's
      // entry-only signature.
      getName={() => label ?? null}
    />
  );
}

// Re-exported so the time-series modules don't need to import directly
// from AudienceGrowthModule for these constants.
export { LEGEND_TOP_GAP, pickSeriesGap, COMPACT_NETWORKS_THRESHOLD_PX };
