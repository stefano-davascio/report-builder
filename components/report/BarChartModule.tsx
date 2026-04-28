'use client';

/**
 * Generic bar-chart renderings that share the same visual language as
 * `AudienceGrowthModule` (area), `AudienceGrowthBarModule` (stacked
 * bar), `LineChartModule` (line), and `AreaChartModule` (single-series
 * area): horizontal-only grid, no axis/tick lines, 12 px IBM Plex Sans
 * in DARK/dark--tint_30, rounded bar tops, and the same tooltip +
 * `ModuleNetworks` legend-row pattern on the right.
 *
 * Two exports, one per data shape the catalog needs:
 *
 *   • `CategoricalBarModule` — one bar per category (pie-shaped data:
 *     `{ name, value, color }[]`). Used when a pie/bar module is
 *     switched to bar (audience-by-gender, instagram-audience,
 *     tiktok-audience). Colors come from the data entries themselves
 *     via <Cell />, so the bars line up with the pie slice colors the
 *     user saw before switching.
 *
 *   • `TimeSeriesBarModule` — single-series bars over a date axis
 *     (`{ date, value }[]`). Used by facebook-page-insights when
 *     switched to bar. Takes the series color as a prop so callers
 *     pick the token that fits the module.
 */

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { MockDataPoint } from '@/types';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip } from './ModuleTooltip';
import {
  formatYAxis,
  pickYTickCount,
  pickXTickCount,
  computeXTicks,
  LEGEND_RESERVE,
  LEGEND_TOP_GAP,
  COMPACT_NETWORKS_THRESHOLD_PX,
  DATA as AUDIENCE_GROWTH_DATA,
} from './AudienceGrowthModule';
import {
  renderTimeSeriesXTick,
  TimeSeriesLegend,
  singleSeriesTooltipContent,
} from './timeSeriesChrome';

const BAR_RADIUS = 4;

// Y-axis gutter matches the area chart (32 px so "1k" at 12 px fits).
const Y_AXIS_W = 32;

type CategoryRow = { name: string; value: number; color: string };

interface CategoricalBarModuleProps {
  data: CategoryRow[];
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

/**
 * One bar per category. Rounded top-corners, flat bottom. Category
 * label lives on the x-axis — no series swatches in the legend row
 * (the x-axis already names each category; duplicating them below
 * would just clutter). `ModuleNetworks` still anchors to the right
 * for parity with the other cards.
 */
export function CategoricalBarModule({
  data,
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: CategoricalBarModuleProps) {
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);
  const yTickCount = pickYTickCount(chartH);

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            // Wider bars than the time-series variant — we have at most
            // ~6 categories vs. 31 dates, so the bars can breathe.
            maxBarSize={56}
            barCategoryGap="20%"
          >
            <CartesianGrid stroke="#E8E8E9" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval={0}
              tick={{ fontSize: 12, fill: '#626165', fontFamily: 'IBM Plex Sans, sans-serif' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#626165', fontFamily: 'IBM Plex Sans, sans-serif' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              width={Y_AXIS_W}
              domain={[0, 'auto']}
              tickCount={yTickCount}
              allowDecimals={false}
            />
            <Tooltip
              content={
                <ModuleTooltip
                  // Categorical bar — the x-axis label already names
                  // the hovered category, and the row shows the same
                  // name. Hide the title so the tooltip matches the
                  // single-row shape used by the pie modules.
                  title={false}
                  // Per-cell colors live on the data row, not on the
                  // single Bar's `fill` — surface them.
                  getDot={(e) => e.payload?.color ?? e.color ?? '#201E24'}
                  // Single-series bar — reach through to the row's
                  // category name (entry.name is the dataKey "value").
                  getName={(e) => e.payload?.name ?? null}
                />
              }
              cursor={{ fill: 'rgba(196,195,198,0.18)' }}
            />
            <Bar
              dataKey="value"
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row — networks cluster only; the categories are
          already on the x-axis so a separate swatch row would
          duplicate them. Matches the footer rhythm of every other
          chart module (same top gap, same wrap behavior, same
          compact-networks threshold). */}
      <div
        className="flex flex-wrap items-center justify-end w-full flex-shrink-0"
        style={{ paddingTop: LEGEND_TOP_GAP, rowGap: 16 }}
      >
        <ModuleNetworks
          profiles={profiles}
          maxVisible={contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX ? 1 : 3}
        />
      </div>
    </div>
  );
}

interface TimeSeriesBarModuleProps {
  data: MockDataPoint[];
  /**
   * Single-series fill color. Pass a design-system token
   * (e.g. `#0075DB` for "platform blue"), never an ad-hoc hex.
   */
  color: string;
  /**
   * Series label — shown in the legend swatch and in the tooltip.
   */
  label: string;
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

/**
 * Single time-series rendered as bars over the module's date window.
 * Visually a one-series analogue of the stacked variant in
 * `AudienceGrowthBarModule` — same tick density helpers, same tooltip,
 * same legend row (swatch-left, networks-right).
 */
export function TimeSeriesBarModule({
  data,
  color,
  label,
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: TimeSeriesBarModuleProps) {
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);
  const yTickCount = pickYTickCount(chartH);
  const plotW = contentWidth > 0 ? contentWidth - Y_AXIS_W : 0;
  const xTickCount = pickXTickCount(plotW);
  // `computeXTicks` is typed for the Audience-Growth row shape — for
  // tick anchoring we only need the `.date` string, so we pass the
  // generic data through a minimal adapter.
  const xTicks = computeXTicks(
    data.map((d) => ({ date: d.date, netFollowers: 0, followers: 0, profileViews: 0 })),
    xTickCount,
  );

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            maxBarSize={14}
            barCategoryGap={2}
          >
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
              domain={[0, 'auto']}
              tickCount={yTickCount}
              allowDecimals={false}
            />
            <Tooltip
              content={singleSeriesTooltipContent}
              cursor={{ fill: 'rgba(196,195,198,0.18)' }}
            />
            <Bar
              dataKey="value"
              name={label}
              fill={color}
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <TimeSeriesLegend
        color={color}
        label={label}
        contentWidth={contentWidth}
        profiles={profiles}
      />
    </div>
  );
}

// Re-exported so callers can fall back to audience-growth data when a
// time-series module doesn't have its own mock (parity with
// ModuleCard's existing behavior before this change).
export { AUDIENCE_GROWTH_DATA };
