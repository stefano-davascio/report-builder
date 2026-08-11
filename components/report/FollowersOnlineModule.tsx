'use client';

/**
 * Followers Online — heat-map style bubble grid (Figma 1326:217061).
 *
 * Layout vs the other bubble modules:
 *
 *   • `BubbleChartModule` — generic, single-color, sparse points.
 *   • `PublishingBehaviorModule` — days on X, hours on Y, 3-band color.
 *   • `FollowersOnlineModule` (this) — days on Y (Mon top → Sun bottom),
 *     hours on X (12 AM left → 11 PM right, every hour, vertical labels
 *     above the plot). Color is a continuous magenta ramp encoding the
 *     value, AND bubble radius scales with value too — so peak cells
 *     read both bigger and darker, faint cells read smaller and paler.
 *
 * The legend is a gradient bar with tick labels at every 2k (0 → 16k),
 * sitting bottom-left under the chart, with the network indicator
 * pinned bottom-right. Both styling primitives (axis chrome, network
 * cluster, tooltip card) come from the same shared modules used by
 * every other chart, so visual changes there propagate here too.
 */

import { useMemo, useState } from 'react';
import {
  ScatterChart, Scatter, Cell, XAxis, YAxis, ZAxis,
  CartesianGrid, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BubblePoint } from '@/types';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
// `./ModuleTooltip` primitives aren't imported here — the Followers
// online tooltip is bespoke (Figma 3164:55836); see below.
import { COMPACT_NETWORKS_THRESHOLD_PX } from './AudienceGrowthModule';

// Mon-first labels with Mon at the TOP (reversed=true on YAxis flips
// 0=Mon to the top of the plot). The Figma comp reads top-to-bottom
// Mon → Sun, matching how a calendar week scans.
const DAY_LABELS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Map raw weekday (0=Sun…6=Sat in `BubblePoint`) to the Mon-first row
// index used for plotting.
function dayToRow(day: number): number {
  return (day + 6) % 7;
}

// Hour ticks — every hour 0…23.  Used for both the vertical
// gridlines (the rendered "cells" — always all 24 so the grid
// reads as a clean 7 × 24 heatmap) and the rotated x-axis
// labels.  At narrower module widths we thin the LABEL set to
// every-other hour (12 AM, 2 AM, 4 AM, …) so the labels don't
// overlap, while keeping all 24 gridlines in place.
const HOUR_TICKS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_TICKS_EVEN = HOUR_TICKS.filter((h) => h % 2 === 0);
/** Below this `contentWidth`, drop every other hour label.  At
 *  ~24 labels × ~14 px stride the labels start crowding around
 *  the 600 px chart-width mark; thinning to 12 keeps them
 *  readable down to ~300 px. */
const HOUR_LABEL_THIN_THRESHOLD_PX = 600;

function formatHourLong(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ── Color ramp ─────────────────────────────────────────────────────────────
// Blue palette (Figma 2899:71022) — 10 stops from `blue/50`
// (#cff5f6, pale cyan) to `blue/800` (#003262, deep navy).
// Stops are placed at the EXACT positions surfaced by the Figma
// legend gradient (denser packing toward the dark end than a
// uniform 10 %-step ramp) so the visual density of the bubbles
// matches the design 1:1.  Linear interpolation between adjacent
// stops keeps the gradient smooth at any value while landing on
// design tokens at each marked t.
const COLOR_STOPS: Array<[number, [number, number, number]]> = [
  [0.000, [207, 245, 246]], // blue/50  #cff5f6 — hold until 9.4 %
  [0.094, [207, 245, 246]], // blue/50  #cff5f6
  [0.181, [162, 229, 239]], // blue/100 #a2e5ef
  [0.282, [117, 213, 232]], // blue/200 #75d5e8
  [0.381, [  6, 185, 239]], // blue/300 #06b9ef
  [0.506, [  0, 150, 235]], // blue/400 #0096eb
  [0.598, [  5, 112, 222]], // blue/500 #0570de
  [0.737, [  0,  85, 188]], // blue/600 #0055bc
  [0.851, [  4,  67, 140]], // blue/700 #04438c
  [1.000, [  0,  50,  98]], // blue/800 #003262
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function colorRamp(t: number): string {
  const tt = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < COLOR_STOPS.length - 1 && tt > COLOR_STOPS[i + 1][0]) i++;
  const [t0, c0] = COLOR_STOPS[i];
  const [t1, c1] = COLOR_STOPS[Math.min(i + 1, COLOR_STOPS.length - 1)];
  const seg = t1 === t0 ? 0 : (tt - t0) / (t1 - t0);
  const r = Math.round(lerp(c0[0], c1[0], seg));
  const g = Math.round(lerp(c0[1], c1[1], seg));
  const b = Math.round(lerp(c0[2], c1[2], seg));
  return `rgb(${r}, ${g}, ${b})`;
}

// CSS linear-gradient using the same 5 stops, for the legend bar.
const LEGEND_GRADIENT_CSS = `linear-gradient(to right, ${
  COLOR_STOPS.map(([stop, [r, g, b]]) =>
    `rgb(${r}, ${g}, ${b}) ${(stop * 100).toFixed(0)}%`,
  ).join(', ')
})`;

// ── Tooltip ────────────────────────────────────────────────────────────────
// Figma 3164:55836 — a bespoke single-row card
// `[dot] Fri - 18:00        120`.  Distinct from the shared
// `ModuleTooltipCard` chrome because:
//   • no title row above the values — the day-hour label lives
//     inline with the dot on the left, value pins to the right
//     via `justify-between`
//   • the dot is a fixed brand-blue (colors/palette/blue/500,
//     #0570DE) rather than the per-cell ramp color — the design
//     wanted a single accent color, not the per-value hue
//   • hour format is 24-hour (`18:00`) not 12-hour (`6 PM`)
//   • drop-shadow, padding, and dot size come from the Figma
//     "Is Floating" surface tokens directly

interface FollowersTooltipPayload {
  payload?: BubblePoint & { t: number };
}

// Fixed dot color per Figma 3164:55836 — brand blue-500.  Doesn't
// track the per-cell ramp; the design wanted one accent color for
// the tooltip regardless of the underlying value's ramp hue.
const TOOLTIP_DOT_COLOR = '#0570DE';

// "Is Floating" drop-shadow token from the Figma design's
// tooltip surface — two stacked shadows for a soft floating feel.
const TOOLTIP_SHADOW =
  '0 4px 8px rgba(32,30,36,0.1), 0 8px 16px rgba(32,30,36,0.1)';

/**
 * Format an hour (0-23) as a 24-hour clock label like `18:00`
 * per the Figma tooltip label.  Distinct from `formatHourLong`
 * (which renders `6 PM` for the x-axis ticks) — the tooltip needs
 * the fuller, zero-padded 24-hour form.
 */
function formatHour24(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function FollowersTooltip({ active, payload }: {
  active?: boolean;
  payload?: FollowersTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const dayLabel = DAY_LABELS_MON_FIRST[dayToRow(p.day)];
  return (
    <div
      className="bg-white rounded-[6px] flex items-center justify-between gap-3"
      style={{
        border: '1px solid #E8E8E9',
        boxShadow: TOOLTIP_SHADOW,
        padding: '8px 12px',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
    >
      <div className="flex items-center" style={{ gap: 6 }}>
        <span
          aria-hidden="true"
          className="flex-shrink-0 rounded-full"
          style={{ width: 10, height: 10, background: TOOLTIP_DOT_COLOR }}
        />
        <span
          className="whitespace-nowrap"
          style={{
            color: '#626165',
            fontSize: 12,
            lineHeight: '18px',
            fontWeight: 400,
          }}
        >
          {dayLabel} - {formatHour24(p.hour)}
        </span>
      </div>
      <span
        className="whitespace-nowrap"
        style={{
          color: '#201E24',
          fontSize: 12,
          lineHeight: '18px',
          fontWeight: 500,
        }}
      >
        {p.value.toLocaleString()}
      </span>
    </div>
  );
}

// ── Legend bar ─────────────────────────────────────────────────────────────
// Reserves a fixed footprint (gradient + tick label row) below the
// chart. 12 px label · 4 px gap · 10 px gradient · 4 px gap · 14 px
// tick row = 44 px, plus the 16 px gap from the chart = 60 px total
// reserved height.
const LEGEND_BAR_H = 10;
const LEGEND_TOP_GAP = 16;
const LEGEND_RESERVE = 60;

// 0 → 16k legend axis with a tick every 2k. Numbers chosen to match
// the Figma comp exactly. We render 'k' suffixes for 1000+ to keep the
// row compact at every reasonable card width.
const LEGEND_TICKS = [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000];

function formatLegendTick(v: number): string {
  if (v === 0) return '0.0';
  if (v < 10000) return `${(v / 1000).toFixed(1)}k`;
  return `${Math.round(v / 1000)}k`;
}

function LegendGradient({ width }: { width: number }) {
  return (
    <div className="flex flex-col" style={{ width }}>
      <div
        className="text-[#626165]"
        style={{
          fontSize: 12,
          lineHeight: '14px',
          fontFamily: 'IBM Plex Sans, sans-serif',
          marginBottom: 4,
        }}
      >
        Value →
      </div>
      <div
        style={{
          height: LEGEND_BAR_H,
          borderRadius: LEGEND_BAR_H / 2,
          background: LEGEND_GRADIENT_CSS,
        }}
        aria-hidden="true"
      />
      <div
        className="flex justify-between text-[#626165]"
        style={{
          marginTop: 4,
          fontSize: 11,
          lineHeight: '14px',
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}
      >
        {LEGEND_TICKS.map((v) => (
          <span key={v}>{formatLegendTick(v)}</span>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface FollowersOnlineModuleProps {
  data: BubblePoint[];
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function FollowersOnlineModule({
  data,
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: FollowersOnlineModuleProps) {
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 220);

  // Crosshair hover state — tracks the {day, hour} the user is
  // pointing at so we can hide every cell that isn't in the same
  // row OR column.  `cx` / `cy` are the hovered point's pixel
  // coordinates inside the chart, used to position the tooltip
  // directly over the bubble (default Recharts behavior anchored
  // to (0,0) on ScatterChart because `cursor={false}` strips the
  // active-coordinate fallback).
  const [hovered, setHovered] = useState<{
    day: number;
    hour: number;
    cx: number;
    cy: number;
    /** Chart's pixel width at the time of hover — drives the
     *  right-edge flip below so the tooltip doesn't get clipped
     *  by the module card's `overflow: hidden` when hovering a
     *  bubble in the rightmost (11 PM) column. */
    chartW: number;
  } | null>(null);
  /** Rough max width of the Followers-online tooltip — "Sat · 11 PM"
   *  + a 16k value at 12 px = ~120 px including padding.  Used to
   *  predict if a right-of-bubble anchor would overflow. */
  const TOOLTIP_EST_WIDTH = 130;

  // Decorate every point with row coordinate + a normalized intensity
  // `t` in [0,1] used both for the cell fill and the tooltip swatch.
  // `maxValue` is the legend's logical top (16k) so the ramp & legend
  // bar always agree on scale, even if a stray data point comes in
  // hotter than the design assumes.
  const decorated = useMemo(() => {
    const max = LEGEND_TICKS[LEGEND_TICKS.length - 1];
    return data.map((p) => ({
      ...p,
      row: dayToRow(p.day),
      t:   max > 0 ? p.value / max : 0,
    }));
  }, [data]);

  // Legend bar width — capped so it doesn't stretch absurdly on huge
  // cards but expands on smaller ones to keep the 9 tick labels from
  // colliding. Falls back to 320 when contentWidth is unknown.
  const legendWidth = contentWidth > 0
    ? Math.min(Math.max(contentWidth - 80, 240), 420)
    : 320;

  // Pick the label-tick set based on the available width.  Below
  // the threshold, drop every other hour label (12 AM / 2 AM /
  // 4 AM / …).  Gridlines stay at full 24-hour density via the
  // separate `HOUR_TICKS.map(...)` reference-line pass.
  const xAxisLabelTicks =
    contentWidth > 0 && contentWidth < HOUR_LABEL_THIN_THRESHOLD_PX
      ? HOUR_TICKS_EVEN
      : HOUR_TICKS;

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 36, right: 16, left: 0, bottom: 0 }}>
            {/* Pale grid lines at every interior hour and every interior
                day. CartesianGrid is disabled so the outer plot edges
                stay open (no closing box around the heatmap). */}
            <CartesianGrid stroke="#E8E8E9" strokeWidth={1} horizontal={false} vertical={false} />
            {HOUR_TICKS.map((h) => (
              <ReferenceLine
                key={`v-${h}`}
                x={h}
                stroke="#F0EFF1"
                strokeWidth={1}
                ifOverflow="visible"
              />
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <ReferenceLine
                key={`h-${r}`}
                y={r}
                stroke="#F0EFF1"
                strokeWidth={1}
                ifOverflow="visible"
              />
            ))}
            <XAxis
              type="number"
              dataKey="hour"
              orientation="top"
              domain={[-0.5, 23.5]}
              ticks={xAxisLabelTicks}
              tickFormatter={formatHourLong}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              // Rotate labels 90° counter-clockwise so they read
              // bottom→top. `textAnchor: 'start'` pins the bottom of
              // the rotated text to the tick line.
              tick={{
                fontSize: 11,
                fill: '#626165',
                fontFamily: 'IBM Plex Sans, sans-serif',
                angle: -90,
                textAnchor: 'start',
              }}
              interval={0}
              height={36}
            />
            <YAxis
              type="number"
              dataKey="row"
              domain={[-0.5, 6.5]}
              ticks={[0, 1, 2, 3, 4, 5, 6]}
              tickFormatter={(v: number) => DAY_LABELS_MON_FIRST[v] ?? ''}
              tickLine={false}
              axisLine={false}
              width={40}
              reversed
              tick={{
                fontSize: 12,
                fill: '#626165',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
              interval={0}
            />
            {/* ZAxis range (in **area** units) — 18 → r≈2.4 px,
                600 → r≈13.8 px. Mapped linearly across the legend's
                full 0 → 16k range so a peak-value cell renders at the
                top of the size scale and a floor-value cell as a
                small but visible dot. */}
            <ZAxis
              type="number"
              dataKey="value"
              domain={[0, LEGEND_TICKS[LEGEND_TICKS.length - 1]]}
              range={[18, 600]}
            />
            <Tooltip
              // Suppress the dashed crosshair cursor — the bubble
              // crosshair highlight (Cell hide) carries the
              // row/column callout already, so an extra dashed
              // line reads as visual noise.
              cursor={false}
              content={<FollowersTooltip />}
              // Pin the tooltip directly over the hovered bubble.
              // Without `position`, Recharts ScatterChart anchors
              // the tooltip to (0,0) (top-left of the plot) when
              // `cursor={false}` strips the active-coordinate
              // fallback; passing the bubble's `cx` / `cy` puts
              // the card right on the cell instead.  Offset
              // slightly up-right so the tooltip nose doesn't
              // overlap the bubble itself.
              position={
                hovered
                  ? {
                      // Right-edge flip: when a right-of-bubble
                      // anchor would push past the chart's right
                      // edge, position the tooltip to the LEFT of
                      // the bubble instead.  Otherwise the module
                      // card's `overflow: hidden` clips the
                      // tooltip when hovering bubbles in the
                      // rightmost (11 PM) column.
                      x:
                        hovered.cx + 12 + TOOLTIP_EST_WIDTH > hovered.chartW
                          ? Math.max(0, hovered.cx - 12 - TOOLTIP_EST_WIDTH)
                          : hovered.cx + 12,
                      y: hovered.cy - 12,
                    }
                  : undefined
              }
            />
            {/* Mouse hover on individual `<Scatter>` points fires
                `onMouseEnter` with the raw data payload — that's how
                we get the hovered `{day, hour}` for the crosshair
                highlight.  `onMouseLeave` clears it so the dim
                state ends when the cursor leaves the chart. */}
            <Scatter
              data={decorated}
              isAnimationActive={false}
              onMouseEnter={(item, _i, e) => {
                // Recharts' Scatter passes a `ScatterPointItem`
                // whose `.payload` is the raw data row we fed in
                // (the `decorated` entry) and whose `.cx` / `.cy`
                // are the bubble's pixel coordinates inside the
                // chart.  We pull both: payload drives the
                // crosshair (`day` + `hour`), coordinates drive
                // the tooltip's anchored position.  We also walk
                // up to the parent SVG to read the chart width,
                // which the tooltip-position calc uses for the
                // right-edge flip.
                const p = item.payload as { day?: number; hour?: number } | undefined;
                if (
                  p &&
                  typeof p.day === 'number' &&
                  typeof p.hour === 'number' &&
                  typeof item.cx === 'number' &&
                  typeof item.cy === 'number'
                ) {
                  const target = e?.target as SVGElement | null;
                  const svg = target?.ownerSVGElement ?? target?.closest?.('svg');
                  const chartW = svg
                    ? (svg as SVGSVGElement).getBoundingClientRect().width
                    : 0;
                  setHovered({ day: p.day, hour: p.hour, cx: item.cx, cy: item.cy, chartW });
                }
              }}
              onMouseLeave={() => setHovered(null)}
            >
              {decorated.map((p, i) => {
                const c = colorRamp(p.t);
                // Crosshair highlight — when a cell is hovered, any
                // cell NOT sharing its day OR hour is hidden
                // entirely (opacity 0) so only the active row +
                // column remain visible.  `pointer-events: none` on
                // the hidden cells means cursor movements through
                // their footprint don't re-trigger hover and shift
                // the crosshair to a different row/column.
                const hidden =
                  hovered !== null &&
                  p.day !== hovered.day &&
                  p.hour !== hovered.hour;
                return (
                  <Cell
                    key={i}
                    fill={c}
                    stroke={c}
                    fillOpacity={hidden ? 0 : 1}
                    strokeOpacity={hidden ? 0 : 1}
                    style={hidden ? { pointerEvents: 'none' } : undefined}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row — gradient bar (left), networks (right). Same wrap
          + paddingTop rhythm as the other chart modules so the footer
          aligns across the canvas. */}
      <div
        className="flex flex-wrap items-end justify-between w-full flex-shrink-0"
        style={{ paddingTop: LEGEND_TOP_GAP, rowGap: 16 }}
      >
        <LegendGradient width={legendWidth} />
        <ModuleNetworks
          profiles={profiles}
          maxVisible={contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX ? 1 : 3}
        />
      </div>
    </div>
  );
}
