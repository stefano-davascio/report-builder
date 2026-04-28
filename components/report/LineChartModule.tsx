'use client';

/**
 * Line-chart renderings that share the visual language of
 * `AudienceGrowthModule` (area), `AudienceGrowthBarModule` (stacked
 * bar), `BarChartModule` (single-series bar), and `AreaChartModule`
 * (single-series area). Same axis chrome, same tick-density helpers,
 * same tooltip, same `ModuleNetworks` legend row — the ONLY visual
 * change vs. the area variant is that series render as 1.5 px lines
 * instead of filled translucent regions.
 *
 * Two exports, one per data shape the catalog needs:
 *
 *   • `AudienceGrowthLineModule` — 3 overlapping lines for the
 *     Audience Growth module's "line" chart-type. Mirrors
 *     `AudienceGrowthBarModule`'s structure: imports SERIES + DATA
 *     from `AudienceGrowthModule`, so a palette / label / data-window
 *     change only needs to land in one place.
 *
 *   • `TimeSeriesLineModule` — single-series line over a date axis
 *     (`{ date, value }[]`). The line analogue of `TimeSeriesBarModule`
 *     and `TimeSeriesAreaModule`, used as the default "line" rendering
 *     for any module whose `supportedChartTypes` includes 'line' but
 *     isn't Audience Growth.
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { MockDataPoint } from '@/types';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip } from './ModuleTooltip';
import {
  SERIES,
  DATA,
  formatYAxis,
  pickYTickCount,
  pickXTickCount,
  computeXTicks,
  LEGEND_RESERVE,
  LEGEND_TOP_GAP,
  pickSeriesGap,
  COMPACT_NETWORKS_THRESHOLD_PX,
} from './AudienceGrowthModule';
import {
  renderTimeSeriesXTick,
  TimeSeriesLegend,
  singleSeriesTooltipContent,
} from './timeSeriesChrome';

// Y-axis gutter matches the area chart (32 px so "1k" at 12 px fits).
const Y_AXIS_W = 32;

// ── 3-series Audience Growth line ─────────────────────────────────────────

interface AudienceGrowthLineModuleProps {
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

/**
 * Audience Growth — 3 overlapping lines. Identical axis / tooltip /
 * legend chrome as the area + stacked-bar variants; the only visual
 * difference is that each series is now a 1.5 px stroked line with no
 * fill (no gradient defs needed).
 */
export function AudienceGrowthLineModule({
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: AudienceGrowthLineModuleProps) {
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);
  const yTickCount = pickYTickCount(chartH);
  const plotW = contentWidth > 0 ? contentWidth - Y_AXIS_W : 0;
  const xTickCount = pickXTickCount(plotW);
  const xTicks = computeXTicks(DATA, xTickCount);

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={DATA} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
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
              // Match the area + bar variants' domain so toggling
              // chart type doesn't change the y-axis figures.
              domain={[0, 1200]}
              tickCount={yTickCount}
            />
            {/* Multi-series Audience Growth keeps the default tooltip
                shape (date title + one row per series). The `[dot]
                date value` collapse only fits single-series charts. */}
            <Tooltip content={<ModuleTooltip />} cursor={{ stroke: '#C4C3C6', strokeDasharray: '3 3' }} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
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

      {/* Legend row — multi-series version (3 swatches), kept inline
          since the shared `<TimeSeriesLegend />` is single-series only.
          Identical structure to the area + stacked-bar renderings so
          flip-flopping chart types doesn't jitter the footer. */}
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
    </div>
  );
}

// ── Single-series time-series line ────────────────────────────────────────

interface TimeSeriesLineModuleProps {
  data: MockDataPoint[];
  /** Single-series line color. Pass a design-system token. */
  color: string;
  /** Series label — shown in the legend swatch and the tooltip. */
  label: string;
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

/**
 * Single-series line over the module's date window. The line analogue
 * of `TimeSeriesBarModule` and `TimeSeriesAreaModule` — same tick
 * density helpers, same tooltip, same legend row.
 */
export function TimeSeriesLineModule({
  data,
  color,
  label,
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: TimeSeriesLineModuleProps) {
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);
  const yTickCount = pickYTickCount(chartH);
  const plotW = contentWidth > 0 ? contentWidth - Y_AXIS_W : 0;
  const xTickCount = pickXTickCount(plotW);
  // `computeXTicks` is typed for the Audience-Growth row shape — we
  // only read `.date`, so adapt minimally.
  const xTicks = computeXTicks(
    data.map((d) => ({ date: d.date, netFollowers: 0, followers: 0, profileViews: 0 })),
    xTickCount,
  );

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
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
              cursor={{ stroke: '#C4C3C6', strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={label}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: color }}
              isAnimationActive={false}
            />
          </LineChart>
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
