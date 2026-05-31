'use client';

/**
 * Interactions by day — three chart variants sharing one palette and
 * one tooltip family.
 *
 *   • `InteractionsByDayModule`     — stacked bar (Figma 1290:101559),
 *     7 weekday buckets with in-bar value labels.
 *   • `InteractionsByDayLineModule` — 3 overlapping lines across the
 *     report's 28-day window.
 *   • `InteractionsByDayAreaModule` — 3 overlapping translucent areas
 *     across the same window.
 *
 * Bar mode is the catalog default (it's the design Figma showed). The
 * line / area variants reuse the bar's series colors so flipping the
 * chart type doesn't change the legend swatches or the tooltip dot
 * colors. Time-series data (`TIME_SERIES_DATA`) is shared between line
 * and area; the bar variant has its own weekday-bucket payload
 * (`MOCK_INTERACTIONS_BY_DAY` in `lib/mock-data.ts`).
 */

import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip, ModuleTooltipCard, ModuleTooltipRow } from './ModuleTooltip';
import {
  formatYAxis,
  pickYTickCount,
  pickXTickCount,
  computeXTicks,
  LEGEND_RESERVE,
  LEGEND_TOP_GAP,
  pickSeriesGap,
  COMPACT_NETWORKS_THRESHOLD_PX,
} from './AudienceGrowthModule';
import { renderTimeSeriesXTick } from './timeSeriesChrome';
import { useChartCurveStyle } from '@/lib/chart-style-context';

// ── Series + colors (shared) ──────────────────────────────────────────────
// Order in this array is the **render order**:
//   • Bar mode:  Recharts stacks the first bar at the bottom, so Shares
//                sits on the x-axis baseline and Likes caps the stack.
//   • Area mode: each subsequent series renders on top of the previous,
//                so Shares (the largest) is drawn first as the broadest
//                wash, and the smaller series stack visibly on top.
// `subtle` is the area-fill token paired with each `color` stroke —
// matched to the AudienceGrowth palette so the visual language is
// consistent across the report.
// TikTok all-blue palette per Figma 2219:39079.  Stack order (bottom
// → top) is preserved (Shares → Comments → Likes); the three tones
// step from darkest (Shares, base of the stack) to lightest (Likes,
// cap).  `subtle` is the area-fill paired with the matching stroke
// for the line / area variants.
export const SERIES = [
  { key: 'shares',   label: 'Shares',   color: '#0050B8', subtle: '#9EC6EA' },
  { key: 'comments', label: 'Comments', color: '#0570DE', subtle: '#A8CEEC' },
  { key: 'likes',    label: 'Likes',    color: '#7CB5EB', subtle: '#CFE4F7' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

// ── Bar-variant data shape ────────────────────────────────────────────────
// Renamed `day` → `date` per Figma 2219:39079 (x-axis labels are now
// calendar dates like "Mar 4" / "Apr 1" instead of weekday letters).
export interface InteractionsByDayRow {
  date: string; // e.g. "Mar 4"
  shares: number;
  comments: number;
  likes: number;
}

// ── Time-series data (shared by line + area variants) ─────────────────────
// 28-day window of daily Shares / Comments / Likes counts, smoothly
// synthesized so the three series visibly overlap and never cross zero.
// Means + amplitudes anchored to the bar variant's weekly totals
// (Shares ≈ 130/day, Comments ≈ 45/day, Likes ≈ 22/day) so a viewer
// flipping from bar → line/area sees the same order of magnitude.
export interface InteractionsTimePoint {
  date: string;
  shares: number;
  comments: number;
  likes: number;
}

function generateTimeSeries(): InteractionsTimePoint[] {
  const rows: InteractionsTimePoint[] = [];
  // Same start as AudienceGrowth so x-axis labels read consistently
  // across modules placed on the same canvas.
  const start = new Date(2026, 2, 2); // Mar 2, 2026
  for (let i = 0; i < 28; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const t = i / 27;
    rows.push({
      date: label,
      // Phase-shifted curves — peaks land on different days so the
      // three lines / bands don't move in lockstep.
      shares:   Math.round(130 + Math.sin(t * 5)       * 28 + Math.sin(t * 13)       * 8),
      comments: Math.round(45  + Math.cos(t * 4 + 0.6) * 11 + Math.sin(t * 9 + 1.2)  * 3),
      likes:    Math.round(22  + Math.sin(t * 6 + 1.1) * 5  + Math.cos(t * 11 + 0.4) * 2),
    });
  }
  return rows;
}

export const TIME_SERIES_DATA = generateTimeSeries();

// Domain top — ceiling above the largest expected daily Shares peak
// (~165). Pinning it across line + area means toggling between them
// doesn't shift the y-axis ladder. Bar mode has its own [0, 260]
// domain since stacked totals are larger than any single series.
const TS_DOMAIN: [number, number] = [0, 200];

// Reused tick / margin constants — same values as the AudienceGrowth
// time-series modules so the chrome stays consistent across the canvas.
const Y_AXIS_W = 32;

// ── Bar-variant tooltip ───────────────────────────────────────────────────
// Custom tooltip shows all three series totals in one card so hovering
// any segment reveals the full daily breakdown — matches the legend
// column ordering (top-down: Likes, Comments, Shares).

interface InteractionsBarTooltipPayload {
  payload?: InteractionsByDayRow;
}

function InteractionsBarTooltip({ active, payload }: {
  active?: boolean;
  payload?: InteractionsBarTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  // Render Likes → Comments → Shares so the tooltip reads top-down in
  // the same visual order as the stacked bar (Likes at top of stack).
  const ordered = [...SERIES].reverse();
  return (
    <ModuleTooltipCard title={row.date}>
      {ordered.map((s) => (
        <ModuleTooltipRow
          key={s.key}
          dot={s.color}
          name={s.label}
          value={row[s.key as SeriesKey].toLocaleString()}
        />
      ))}
    </ModuleTooltipCard>
  );
}

// ── Shared legend row ─────────────────────────────────────────────────────
// Series swatches LEFT (in render order so the tile colors match the
// chart from bottom up: Shares · Comments · Likes), networks indicator
// RIGHT. Pulled out so all three variants share one footer.

function InteractionsLegendRow({
  contentWidth,
  profiles,
}: {
  contentWidth: number;
  profiles: MockProfile[];
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between w-full flex-shrink-0"
      style={{ paddingTop: LEGEND_TOP_GAP, rowGap: 16 }}
    >
      <div
        className="flex flex-wrap items-center"
        style={{ columnGap: pickSeriesGap(contentWidth), rowGap: 8 }}
      >
        {SERIES.map((s) => (
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
      <ModuleNetworks
        profiles={profiles}
        maxVisible={contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX ? 1 : 3}
      />
    </div>
  );
}

// ── Stacked-bar variant (Figma 1290:101559) ───────────────────────────────

interface InteractionsByDayModuleProps {
  data: InteractionsByDayRow[];
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

// Y-axis is pinned to a fixed `[0, 1000]` ladder with 100-step ticks
// so the stacked totals match Figma 2219:39079 exactly regardless of
// the data peak.  Generated once at module level since the ticks
// never change.
// Y-axis domain bumped to 1100 (was 1000) because the largest stack
// in `MOCK_INTERACTIONS_BY_DAY` is Mar 8 = 320 + 400 + 380 = 1100,
// which previously poked over the top gridline and left the 11th
// (topmost) gridline unlabelled.  12 ticks at every 100 means every
// horizontal line has a matching label.
const BAR_Y_DOMAIN: [number, number] = [0, 1100];
const BAR_Y_TICKS = Array.from({ length: 12 }, (_, i) => i * 100); // 0…1100

export function InteractionsByDayModule({
  data,
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: InteractionsByDayModuleProps) {
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 200);

  // Rounded top corners for the **top** segment only (Likes — last
  // series in `SERIES`). Middle and bottom segments stay square so
  // adjacent segments butt cleanly together.
  const TOP_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
  const FLAT_RADIUS: [number, number, number, number] = [0, 0, 0, 0];

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            // Bars are thicker than the time-series modules — only 7
            // bars to render, so each one can be visually weighty
            // enough to host an in-bar label without crowding.
            maxBarSize={56}
            barCategoryGap="20%"
          >
            {/* Draw one horizontal gridline per `BAR_Y_TICKS`
                entry — every 100, 0 → 1000 — so the grid aligns
                1:1 with the YAxis labels.  Recharts' default
                tickCount-driven layout draws 6-7 lines across
                [0, 1000], which don't line up with the 11 labels
                and leaves the top cell half-height.
                We linearly interpolate y positions from the
                chart's clip bounds (`offset.top` → bottom = top +
                `offset.height`) since the YAxis is a simple
                [0, 1000] linear scale.  Reaching into the d3
                scale via `yAxis.scale(t)` was unreliable across
                Recharts versions; manual interpolation is stable. */}
            <CartesianGrid
              stroke="#E8E8E9"
              strokeWidth={1}
              vertical={false}
              horizontalCoordinatesGenerator={(ctx: { offset?: { top?: number; height?: number } }) => {
                const top = ctx?.offset?.top ?? 0;
                const innerH = ctx?.offset?.height ?? 0;
                if (innerH <= 0) return [];
                const max = BAR_Y_DOMAIN[1];
                return BAR_Y_TICKS.map((t) => top + innerH * (1 - t / max));
              }}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tick={{
                fontSize: 12,
                fill: '#626165',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
              interval={0}
            />
            <YAxis
              type="number"
              domain={BAR_Y_DOMAIN}
              ticks={BAR_Y_TICKS}
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{
                fontSize: 12,
                fill: '#626165',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(196,195,198,0.18)' }}
              content={<InteractionsBarTooltip />}
            />
            {/* Figma 2219:39079 removed the in-bar value labels —
                each segment now renders as a flat colored block, with
                the value surfaced via the hover tooltip + y-axis
                ladder.  Simpler read, less crowding when bars are
                slim. */}
            {SERIES.map((s, i) => {
              const isTop = i === SERIES.length - 1;
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  stackId="engagement"
                  radius={isTop ? TOP_RADIUS : FLAT_RADIUS}
                  isAnimationActive={false}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <InteractionsLegendRow contentWidth={contentWidth} profiles={profiles} />
    </div>
  );
}

// ── Time-series shared chrome (line + area) ───────────────────────────────
// X-axis tick renderer is shared with the rest of the time-series
// modules via `./timeSeriesChrome` — anchors the first label `start`
// and the last `end` so the outermost dates don't clip against the
// plot edges.

// `computeXTicks` is typed for the AudienceGrowth row shape; map our
// time-series rows into a minimal compatible shape so we can reuse
// the same density helper without redefining it.
function timeSeriesXTicks(count: number): string[] {
  return computeXTicks(
    TIME_SERIES_DATA.map((d) => ({
      date: d.date,
      netFollowers: 0,
      followers: 0,
      profileViews: 0,
    })),
    count,
  );
}

// ── Line variant ──────────────────────────────────────────────────────────

interface InteractionsByDayLineModuleProps {
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function InteractionsByDayLineModule({
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: InteractionsByDayLineModuleProps) {
  const curveType = useChartCurveStyle();
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);
  const yTickCount = pickYTickCount(chartH);
  const plotW = contentWidth > 0 ? contentWidth - Y_AXIS_W : 0;
  const xTickCount = pickXTickCount(plotW);
  const xTicks = timeSeriesXTicks(xTickCount);

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={TIME_SERIES_DATA} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#E8E8E9" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              ticks={xTicks}
              interval={0}
              tickMargin={12}
              tick={renderTimeSeriesXTick(xTicks)}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#626165', fontFamily: 'IBM Plex Sans, sans-serif' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              width={Y_AXIS_W}
              domain={TS_DOMAIN}
              tickCount={yTickCount}
              allowDecimals={false}
            />
            <Tooltip content={<ModuleTooltip />} cursor={{ stroke: '#C4C3C6', strokeDasharray: '3 3' }} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type={curveType}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: s.color }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <InteractionsLegendRow contentWidth={contentWidth} profiles={profiles} />
    </div>
  );
}

// ── Area variant ──────────────────────────────────────────────────────────

interface InteractionsByDayAreaModuleProps {
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function InteractionsByDayAreaModule({
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: InteractionsByDayAreaModuleProps) {
  const curveType = useChartCurveStyle();
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);
  const yTickCount = pickYTickCount(chartH);
  const plotW = contentWidth > 0 ? contentWidth - Y_AXIS_W : 0;
  const xTickCount = pickXTickCount(plotW);
  const xTicks = timeSeriesXTicks(xTickCount);

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={TIME_SERIES_DATA} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#E8E8E9" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              ticks={xTicks}
              interval={0}
              tickMargin={12}
              tick={renderTimeSeriesXTick(xTicks)}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#626165', fontFamily: 'IBM Plex Sans, sans-serif' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              width={Y_AXIS_W}
              domain={TS_DOMAIN}
              tickCount={yTickCount}
              allowDecimals={false}
            />
            <Tooltip content={<ModuleTooltip />} cursor={{ stroke: '#C4C3C6', strokeDasharray: '3 3' }} />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type={curveType}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={1.5}
                fill={s.subtle}
                fillOpacity={0.7}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <InteractionsLegendRow contentWidth={contentWidth} profiles={profiles} />
    </div>
  );
}
