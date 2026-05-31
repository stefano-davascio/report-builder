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
import { ModuleTooltipCard, ModuleTooltipRow } from './ModuleTooltip';
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

// Hour ticks — every hour 0…23. Vertical labels keep this readable
// even at the 24-tick crush.
const HOUR_TICKS = Array.from({ length: 24 }, (_, i) => i);

function formatHourLong(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ── Color ramp ─────────────────────────────────────────────────────────────
// Stripe magenta palette (Figma 1290:101428) — 10 evenly-spaced stops
// from `magenta/0` (#fff5fa) to `magenta/800` (#68052b). Linear
// interpolation between adjacent stops keeps the gradient smooth at
// any value while staying perfectly aligned with the design system
// tokens at the marked t values.
const COLOR_STOPS: Array<[number, [number, number, number]]> = [
  [0.000, [255, 245, 250]], // magenta/0   #fff5fa
  [0.111, [255, 231, 242]], // magenta/50  #ffe7f2
  [0.222, [255, 204, 223]], // magenta/100 #ffccdf
  [0.333, [255, 177, 205]], // magenta/200 #ffb1cd
  [0.444, [254, 135, 161]], // magenta/300 #fe87a1
  [0.556, [252,  82, 106]], // magenta/400 #fc526a
  [0.667, [223,  27,  65]], // magenta/500 #df1b41
  [0.778, [179,   9,  60]], // magenta/600 #b3093c
  [0.889, [137,  13,  55]], // magenta/700 #890d37
  [1.000, [104,   5,  43]], // magenta/800 #68052b
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

interface FollowersTooltipPayload {
  payload?: BubblePoint & { t: number };
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
    <ModuleTooltipCard title={`${dayLabel} · ${formatHourLong(p.hour)}`}>
      <ModuleTooltipRow
        dot={colorRamp(p.t)}
        value={p.value.toLocaleString()}
      />
    </ModuleTooltipCard>
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
  } | null>(null);

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
              ticks={HOUR_TICKS}
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
                hovered ? { x: hovered.cx + 12, y: hovered.cy - 12 } : undefined
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
              onMouseEnter={(item) => {
                // Recharts' Scatter passes a `ScatterPointItem`
                // whose `.payload` is the raw data row we fed in
                // (the `decorated` entry) and whose `.cx` / `.cy`
                // are the bubble's pixel coordinates inside the
                // chart.  We pull both: payload drives the
                // crosshair (`day` + `hour`), coordinates drive
                // the tooltip's anchored position.
                const p = item.payload as { day?: number; hour?: number } | undefined;
                if (
                  p &&
                  typeof p.day === 'number' &&
                  typeof p.hour === 'number' &&
                  typeof item.cx === 'number' &&
                  typeof item.cy === 'number'
                ) {
                  setHovered({ day: p.day, hour: p.hour, cx: item.cx, cy: item.cy });
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
