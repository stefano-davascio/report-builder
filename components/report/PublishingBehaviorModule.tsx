'use client';

/**
 * Publishing Behaviour — Day × Hour bubble grid (Figma 1302:170169).
 *
 * Different from `BubbleChartModule` in three meaningful ways:
 *
 *   • Axis orientation is flipped — days on X (Mon → Sun, left → right),
 *     hours on Y (1 AM at bottom → 1 AM "next day" at top). The Figma
 *     y-axis labels read 1 AM, 3 AM, 5 AM … 11 PM, 1 AM going up.
 *   • Bubble color encodes intensity via three bands — High / Mid / Low —
 *     instead of the single-color radius-only encoding used elsewhere.
 *     Thresholds split the value domain into equal thirds against the
 *     module's max value, so a single ramp shows up no matter how the
 *     data scales.
 *   • Legend swaps the empty-left / networks-right rhythm for a
 *     three-pill row (High / Mid / Low) on the left, networks on the
 *     right — matching the Figma comp.
 *
 * Everything else (axis chrome, grid color, tooltip card, network
 * indicator) shares the same primitives as `BubbleChartModule`,
 * `AudienceGrowthModule`, etc., so visual changes still propagate
 * through the shared modules.
 */

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, Cell, XAxis, YAxis, ZAxis,
  CartesianGrid, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BubblePoint } from '@/types';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltipCard, ModuleTooltipRow } from './ModuleTooltip';
import {
  LEGEND_RESERVE,
  LEGEND_TOP_GAP,
  COMPACT_NETWORKS_THRESHOLD_PX,
} from './AudienceGrowthModule';

// X-axis labels — Monday-first to match the Figma comp. (The rest of the
// app uses Sunday-first lists in places like the Best-Performing-Day
// table; the bubble grid follows the design here so the visual reads
// like a calendar week.)
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Map raw weekday (0=Sun…6=Sat in `BubblePoint`) to the Mon-first column
// index used for plotting.  Sunday wraps to the right edge.
function dayToColumn(day: number): number {
  return (day + 6) % 7;
}

// Y-axis tick ladder — every odd hour from 1 AM up through 11 PM, with
// an extra "1 AM" tick at the very top representing the wrap into the
// next day. Matches the Figma exactly.
const HOUR_TICKS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25];

function formatHour(h: number): string {
  // 25 = wrap to "next day" 1 AM; 24 = midnight (not a tick, but kept
  // here for completeness if the formatter is asked).
  if (h === 25) return '1 AM';
  if (h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

// `BubblePoint.hour` is 0-23; we plot in a 1-25 frame so the tick ladder
// and the bubble positions line up. Hour 0 (midnight) renders at y=24,
// just below the top "1 AM" wrap tick.
function hourToPlot(hour: number): number {
  return hour === 0 ? 24 : hour;
}

// ── Color bands ────────────────────────────────────────────────────────────
// Three discrete fills — top-third = High, middle-third = Mid,
// bottom-third = Low. The ramp goes dark → light so visual weight tracks
// posting intensity even at a glance.
const HIGH_COLOR = '#0075DB';   // platform blue (matches other charts)
const MID_COLOR  = '#5DCAE0';   // medium teal
const LOW_COLOR  = '#BFE5EE';   // pale cyan

type Band = 'high' | 'mid' | 'low';

function bandFor(value: number, max: number): Band {
  if (max <= 0) return 'low';
  const t = value / max;
  if (t >= 2 / 3) return 'high';
  if (t >= 1 / 3) return 'mid';
  return 'low';
}

function colorFor(band: Band): string {
  if (band === 'high') return HIGH_COLOR;
  if (band === 'mid')  return MID_COLOR;
  return LOW_COLOR;
}

// Bubble area (not radius) per band. Three discrete sizes — every
// "High" bubble is the same circle, every "Mid" the same, every "Low"
// the same — matching the Figma where size encodes band, not raw
// value. Areas chosen so radii roughly track 14 px / 10 px / 6 px,
// preserving the ~3× spread of the previous continuous ramp.
const BAND_SIZE: Record<Band, number> = {
  high: 600,
  mid:  300,
  low:  110,
};

const BAND_LABEL: Record<Band, string> = {
  high: 'High',
  mid:  'Mid',
  low:  'Low',
};

// ── Tooltip ────────────────────────────────────────────────────────────────
// Custom title format ("Mon · 3pm") doesn't fit `ModuleTooltip`'s
// label-driven default, so we compose the shared chrome directly. Dot
// color tracks the bubble's band so the tooltip reads as a continuation
// of the hovered bubble rather than a generic chip.

interface PublishingTooltipPayload {
  payload?: BubblePoint & { band: Band };
}

function PublishingTooltip({ active, payload }: {
  active?: boolean;
  payload?: PublishingTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const dayLabel = DAY_LABELS[dayToColumn(p.day)];
  return (
    <ModuleTooltipCard title={`${dayLabel} · ${formatHour(hourToPlot(p.hour))}`}>
      <ModuleTooltipRow
        dot={colorFor(p.band)}
        name={BAND_LABEL[p.band]}
        value={p.value.toLocaleString()}
      />
    </ModuleTooltipCard>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface PublishingBehaviorModuleProps {
  data: BubblePoint[];
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function PublishingBehaviorModule({
  data,
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: PublishingBehaviorModuleProps) {
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 200);

  // Decorate every point with its plot coordinates + band classification
  // up front so the render path stays a flat map. `maxValue` falls back
  // to 1 to keep the band threshold math safe on an empty payload.
  // `size` is the fixed bubble area for the point's band — Recharts'
  // ZAxis reads this dataKey directly so bubbles within a band render
  // at exactly the same radius.
  const decorated = useMemo(() => {
    const max = data.reduce((m, p) => Math.max(m, p.value), 0) || 1;
    return data.map((p) => {
      const band = bandFor(p.value, max);
      return {
        ...p,
        column: dayToColumn(p.day),
        yPlot:  hourToPlot(p.hour),
        band,
        size:   BAND_SIZE[band],
      };
    });
  }, [data]);

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {/* Grid is drawn entirely via `ReferenceLine` so we can
                pick exactly which lines render. The Figma comp shows:
                  • horizontals at every odd hour, **including** the
                    1 AM wrap ticks at top and bottom — full ladder.
                  • verticals through every day column (x = 0…6,
                    Mon → Sun). The plot's X domain is [-0.5, 6.5], so
                    these lines sit *inside* the plot area, not at the
                    frame; the Mon/Sun lines are still inset from the
                    axis edges by half a column.
                CartesianGrid stays off entirely; otherwise it would
                draw extra lines at the actual axis edges and close
                the box. */}
            <CartesianGrid stroke="#E8E8E9" strokeWidth={1} horizontal={false} vertical={false} />
            {HOUR_TICKS.map((h) => (
              <ReferenceLine
                key={`h-${h}`}
                y={h}
                stroke="#E8E8E9"
                strokeWidth={1}
                ifOverflow="visible"
              />
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map((x) => (
              <ReferenceLine
                key={`v-${x}`}
                x={x}
                stroke="#E8E8E9"
                strokeWidth={1}
                ifOverflow="visible"
              />
            ))}
            <XAxis
              type="number"
              dataKey="column"
              domain={[-0.5, 6.5]}
              ticks={[0, 1, 2, 3, 4, 5, 6]}
              tickFormatter={(v: number) => DAY_LABELS[v] ?? ''}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{
                fontSize: 12,
                fill: '#626165',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
              interval={0}
            />
            <YAxis
              type="number"
              dataKey="yPlot"
              // 0.5 / 25.5 keep the bottom (1 AM) and top (1 AM next
              // day) ticks fully inside the plot area instead of being
              // clipped against the axis edge.
              domain={[0.5, 25.5]}
              ticks={HOUR_TICKS}
              tickFormatter={formatHour}
              tickLine={false}
              axisLine={false}
              // 48 px wide so "11 AM" / "11 PM" don't push against the
              // grid — wider than the time-series modules (32 px) since
              // the labels here are two characters + a space + meridian.
              width={48}
              tick={{
                fontSize: 12,
                fill: '#626165',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
              interval={0}
            />
            {/* ZAxis reads the precomputed `size` field (one of three
                fixed band areas) and passes it through identity:
                domain == range, so a `size` of 600 renders as area
                600 (r ≈ 13.8 px), 300 → r ≈ 9.8 px, 110 → r ≈ 5.9 px.
                That gives discrete High / Mid / Low circle sizes
                instead of a continuous value-driven ramp. */}
            <ZAxis type="number" dataKey="size" domain={[110, 600]} range={[110, 600]} />
            <Tooltip
              cursor={{ stroke: '#C4C3C6', strokeDasharray: '3 3' }}
              content={<PublishingTooltip />}
            />
            <Scatter data={decorated} isAnimationActive={false}>
              {decorated.map((p, i) => {
                const c = colorFor(p.band);
                return <Cell key={i} fill={c} stroke={c} fillOpacity={0.95} />;
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row — High / Mid / Low pills (left), networks (right).
          Same `paddingTop` / wrap rhythm as every other chart module so
          the footer stays aligned across the canvas. */}
      <div
        className="flex flex-wrap items-center justify-between w-full flex-shrink-0"
        style={{ paddingTop: LEGEND_TOP_GAP, rowGap: 16 }}
      >
        <div
          className="flex flex-wrap items-center"
          style={{ columnGap: 24, rowGap: 8 }}
        >
          <BandPill color={HIGH_COLOR} label="High" />
          <BandPill color={MID_COLOR}  label="Mid" />
          <BandPill color={LOW_COLOR}  label="Low" />
        </div>
        <ModuleNetworks
          profiles={profiles}
          maxVisible={contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX ? 1 : 3}
        />
      </div>
    </div>
  );
}

// Single legend entry — colored dot + label. Same typography stack as
// the swatches in `AudienceGrowthBarModule` / `LineChartModule` so the
// three-pill row reads as part of the existing legend family.
function BandPill({ color, label }: { color: string; label: string }) {
  return (
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
  );
}
