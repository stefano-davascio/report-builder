'use client';

/**
 * Area-chart renderings that share the visual language of
 * `AudienceGrowthModule` (3-series area), `LineChartModule` (line),
 * and `BarChartModule` (bar). Same axis chrome, same tick-density
 * helpers, same tooltip, same `ModuleNetworks` legend row — the ONLY
 * visual change vs. the line variant is that the series renders as a
 * filled translucent band beneath a 1.5 px stroke instead of a bare
 * line.
 *
 * One export:
 *
 *   • `TimeSeriesAreaModule` — single-series area over a date axis
 *     (`{ date, value }[]`). The area analogue of `TimeSeriesBarModule`
 *     and `TimeSeriesLineModule`, used as the default "area" rendering
 *     for any module whose `supportedChartTypes` includes 'area' but
 *     isn't Audience Growth.
 *
 * The 3-series Audience Growth area is its own component
 * (`AudienceGrowthModule`) since it carries multi-series legend +
 * per-series fill tokens; this module is the simpler single-color
 * fallback for everything else (e.g. `tiktok-video-views-by-day`).
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { MockDataPoint } from '@/types';
import {
  formatYAxis,
  pickYTickCount,
  pickXTickCount,
  computeXTicks,
  LEGEND_RESERVE,
} from './AudienceGrowthModule';
import {
  renderTimeSeriesXTick,
  TimeSeriesLegend,
  singleSeriesTooltipContent,
} from './timeSeriesChrome';
import { useChartCurveStyle } from '@/lib/chart-style-context';

// Y-axis gutter matches the area chart (32 px so "1k" at 12 px fits).
const Y_AXIS_W = 32;

// Translucent-fill opacity matches Audience Growth's 3-series area
// (Figma 1302:170369). Single-series modules using a primary token as
// stroke + the same token at this opacity as fill produce a band that
// reads as a flat tint rather than a saturated wash.
const FILL_OPACITY = 0.18;

interface TimeSeriesAreaModuleProps {
  data: MockDataPoint[];
  /**
   * Single-series stroke + fill color. Pass a design-system token
   * (e.g. `#0075DB` for "platform blue"). The fill uses the same
   * token at `FILL_OPACITY` opacity.
   */
  color: string;
  /** Series label — shown in the legend swatch and the tooltip. */
  label: string;
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

/**
 * Single-series area over the module's date window. Visually a
 * one-series analogue of `AudienceGrowthModule` — same tick density
 * helpers, same tooltip, same legend row (swatch-left, networks-right).
 */
export function TimeSeriesAreaModule({
  data,
  color,
  label,
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: TimeSeriesAreaModuleProps) {
  const curveType = useChartCurveStyle();
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
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
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
            <Area
              type={curveType}
              dataKey="value"
              name={label}
              stroke={color}
              strokeWidth={1.5}
              fill={color}
              fillOpacity={FILL_OPACITY}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: color }}
              isAnimationActive={false}
            />
          </AreaChart>
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
