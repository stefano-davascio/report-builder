'use client';

/**
 * Publishing Behaviour — Day × Value bubble grid (Figma 2238:52609).
 *
 * Different from `BubbleChartModule` in three meaningful ways:
 *
 *   • Axis orientation: days on X (Sun → Sat, left → right per the
 *     redesign — the original 1302:170169 comp went Mon-first; the
 *     2238 redesign moves Sunday to the left edge to match the way
 *     reports list weekdays elsewhere).  Y is a numeric VALUE scale
 *     (0 → 1k, ticks every 100) — was hour-of-day in the original
 *     comp, swapped to a flat numeric scale in the redesign so each
 *     bubble's vertical position encodes a magnitude (e.g. views,
 *     engagement count) instead of a posting hour.
 *   • Bubble COLOR encodes value bands — High / Mid / Low — using
 *     the TikTok-blue 3-shade ramp (#005BBA / #0067D1 / #1A88FF,
 *     per the Figma INFO tokens).
 *   • Bubble SIZE scales CONTINUOUSLY with the value via Recharts'
 *     ZAxis range, so bubble radius tracks magnitude alongside the
 *     band color — bigger AND darker for higher-value posts.
 *
 * The `BubblePoint.hour` field is reinterpreted by this module as
 * the generic numeric y-value (0-1000).  Sister module
 * `FollowersOnlineModule` still uses `hour` as 0-23 hour-of-day,
 * so the type stays shared but each consumer ascribes its own
 * semantic to the field.
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
import {
  LEGEND_RESERVE,
  LEGEND_TOP_GAP,
  COMPACT_NETWORKS_THRESHOLD_PX,
} from './AudienceGrowthModule';

// X-axis labels — Sunday-first per the Figma 2238 redesign.  Raw
// weekday (0=Sun…6=Sat in `BubblePoint`) maps directly to the
// column index so `dayToColumn` is the identity.
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function dayToColumn(day: number): number {
  return day;
}

// Y-axis tick ladder — every 100 from 0 up through 1000.  Matches
// Figma 2238:52640..52664 exactly.
const VALUE_TICKS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
/** Logical top of the value scale — drives both the YAxis domain
 *  ceiling and the High/Mid/Low band thresholds. */
const VALUE_MAX = 1000;

function formatValue(v: number): string {
  // Figma uses "1k" for the top tick and bare integers for the
  // others (no thousands separator at this scale).
  if (v >= 1000) return '1k';
  return String(v);
}

// ── Color bands ────────────────────────────────────────────────────────────
// Three discrete fills mapped to the Figma 2238 INFO blue ramp.
// Darkest = High (top third of the value range), lightest = Low
// (bottom third).  Colors come from Figma variables:
//   • INFO/info--shade_20 = #005BBA (High)
//   • INFO/info--shade_10 = #0067D1 (Mid / "Medium")
//   • INFO/info_dark-theme = #1A88FF (Low)
const HIGH_COLOR = '#005BBA';
const MID_COLOR  = '#0067D1';
const LOW_COLOR  = '#1A88FF';

type Band = 'high' | 'mid' | 'low';

// Bands split the [0, VALUE_MAX] domain into equal thirds rather
// than the data's own min/max — keeps the legend's color mapping
// stable across data shapes (a deck with no high-value posts won't
// promote its tallest mid bubble to "High").
function bandFor(value: number): Band {
  if (value >= (2 / 3) * VALUE_MAX) return 'high';
  if (value >= (1 / 3) * VALUE_MAX) return 'mid';
  return 'low';
}

function colorFor(band: Band): string {
  if (band === 'high') return HIGH_COLOR;
  if (band === 'mid')  return MID_COLOR;
  return LOW_COLOR;
}

const BAND_LABEL: Record<Band, string> = {
  high: 'High',
  mid:  'Medium',
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
    <ModuleTooltipCard title={dayLabel}>
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

  // Hovered bubble's pixel coordinates + the chart's width at the
  // time of hover — used to anchor the Tooltip directly to the
  // bubble (instead of letting Recharts default to the chart's
  // top-left).  The chart width drives a right-edge flip so the
  // tooltip doesn't extend past the module card's right edge,
  // where the card's `overflow: hidden` would clip it (see the
  // matching pattern in `FollowersOnlineModule`).
  const [hovered, setHovered] = useState<{
    cx: number;
    cy: number;
    chartW: number;
  } | null>(null);
  // Rough max width of the tooltip card.  Used to predict if a
  // right-of-bubble anchor would overflow the chart area.  Set a
  // bit wider than the longest content ("Sat" + "Medium" + 4-digit
  // value = ~110 px) so the flip kicks in before truncation.
  const TOOLTIP_EST_WIDTH = 120;

  // Decorate every point with its plot coordinates + band classification
  // up front so the render path stays a flat map.  Both color band and
  // y-axis position derive from `value` directly — see the file header
  // comment for the BubblePoint field semantics for Publishing Behaviour.
  const decorated = useMemo(() => {
    return data.map((p) => {
      const band = bandFor(p.value);
      return {
        ...p,
        column: dayToColumn(p.day),
        yPlot:  p.value,
        band,
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
            {VALUE_TICKS.map((v) => (
              <ReferenceLine
                key={`h-${v}`}
                y={v}
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
              // Slight padding outside [0, 1000] so the 0 and 1k tick
              // labels sit fully inside the plot area instead of
              // clipping against the axis edges.
              domain={[-25, VALUE_MAX + 25]}
              ticks={VALUE_TICKS}
              tickFormatter={formatValue}
              tickLine={false}
              axisLine={false}
              // 32 px is plenty for "1k" / "900" / "100" labels.
              width={32}
              tick={{
                fontSize: 12,
                fill: '#626165',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
              interval={0}
            />
            {/* ZAxis maps each bubble's `value` (its dataKey) linearly
                to a bubble AREA in the 50 → 800 range — so a value=50
                point renders as area ≈ 50 (r ≈ 4 px) and a value=1000
                point as area ≈ 800 (r ≈ 16 px).  Recharts' default
                scaling is by area (visual perception of size), not
                radius, so the radius grows ~sqrt(value). */}
            <ZAxis
              type="number"
              dataKey="value"
              domain={[0, VALUE_MAX]}
              range={[50, 800]}
            />
            <Tooltip
              // No dashed crosshair — at scatter density, the
              // cross cursor competes visually with the bubbles.
              // Tooltip anchors to the hovered bubble's pixel
              // coordinates via `position`; `wrapperStyle` keeps
              // the tooltip hidden until `onMouseEnter` on a
              // bubble sets `hovered`, otherwise Recharts shows
              // a single-frame flash at (0, 0) on first hover
              // before our state update lands.  The x-position
              // flips LEFT of the bubble when a right-of-bubble
              // anchor would push the tooltip past the chart's
              // right edge — otherwise the module card's
              // `overflow: hidden` clips the rightmost columns'
              // tooltips.
              cursor={false}
              content={<PublishingTooltip />}
              position={
                hovered
                  ? {
                      x:
                        hovered.cx + 12 + TOOLTIP_EST_WIDTH > hovered.chartW
                          ? Math.max(0, hovered.cx - 12 - TOOLTIP_EST_WIDTH)
                          : hovered.cx + 12,
                      y: hovered.cy - 12,
                    }
                  : { x: -9999, y: -9999 }
              }
              wrapperStyle={hovered ? undefined : { visibility: 'hidden' }}
            />
            <Scatter
              data={decorated}
              isAnimationActive={false}
              onMouseEnter={(item, _i, e) => {
                if (typeof item.cx !== 'number' || typeof item.cy !== 'number') return;
                // Walk up from the bubble to the chart's outer
                // SVG to get its width; we use that to decide
                // whether to flip the tooltip's x anchor.
                const target = e?.target as SVGElement | null;
                const svg = target?.ownerSVGElement ?? target?.closest?.('svg');
                const chartW = svg
                  ? (svg as SVGSVGElement).getBoundingClientRect().width
                  : 0;
                setHovered({ cx: item.cx, cy: item.cy, chartW });
              }}
              onMouseLeave={() => setHovered(null)}
            >
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
          <BandPill color={MID_COLOR}  label="Medium" />
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
