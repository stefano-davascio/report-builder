'use client';

/**
 * Bubble-chart module — weekday × hour grid used by Publishing Behaviour
 * and Followers Online. Y axis is the seven weekdays (Sunday at the top
 * matches calendar convention used elsewhere in the app); X axis is 0–23.
 * Bubble radius scales with the cell's `value` via Recharts' `ZAxis`.
 *
 * First-pass styling: same axis chrome as `AudienceGrowthModule`
 * (12 / 18 IBM Plex Sans, DARK/dark--tint_30 #626165, 1 px #E8E8E9 grid),
 * shadcn-flavored tooltip card. Pixel-perfect Figma values land in a
 * follow-up pass once the design is provided.
 */

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

// Sunday-first labels match the rest of the app (Audience Growth's
// implicit week ordering, the Best-Performing-Day list, etc.).
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// Hour ticks every 3 hours — keeps the X axis legible at any reasonable
// card width without the 24-tick crush of a full ladder.
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21];

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

interface BubbleChartTooltipPayload {
  payload?: BubblePoint;
}

/**
 * Custom title format ("Mon · 3pm") doesn't fit `ModuleTooltip`'s
 * label-driven default, so we compose the shared chrome
 * (`ModuleTooltipCard` + `ModuleTooltipRow`) directly. Visual contract
 * matches every other chart's tooltip exactly.
 */
function BubbleTooltip({ active, payload, color }: {
  active?: boolean;
  payload?: BubbleChartTooltipPayload[];
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <ModuleTooltipCard title={`${DAY_LABELS[p.day]} · ${formatHour(p.hour)}`}>
      <ModuleTooltipRow dot={color} value={p.value.toLocaleString()} />
    </ModuleTooltipCard>
  );
}

interface BubbleChartModuleProps {
  data: BubblePoint[];
  /**
   * Bubble fill color. Defaults to the same blue used by the rest of
   * the time-series chart family for visual continuity.
   */
  color?: string;
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function BubbleChartModule({
  data,
  color = '#0570DE',
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: BubbleChartModuleProps) {
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 160);

  // ZAxis range is in **area** units (not radius). Recharts maps the
  // [domainMin, domainMax] to [rangeMin, rangeMax] and renders bubbles
  // at the resulting area. 60 → ~r=4.4; 800 → ~r=16. The data ranges
  // [8, 100] roughly so this gives a satisfying ~3× radius spread.
  const maxValue = useMemo(
    () => data.reduce((m, p) => Math.max(m, p.value), 0) || 1,
    [data],
  );

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#E8E8E9" strokeWidth={1} />
            <XAxis
              type="number"
              dataKey="hour"
              domain={[-0.5, 23.5]}
              ticks={HOUR_TICKS}
              tickFormatter={formatHour}
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
              dataKey="day"
              domain={[-0.5, 6.5]}
              ticks={[0, 1, 2, 3, 4, 5, 6]}
              tickFormatter={(v: number) => DAY_LABELS[v] ?? ''}
              tickLine={false}
              axisLine={false}
              width={36}
              reversed
              tick={{
                fontSize: 12,
                fill: '#626165',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
              interval={0}
            />
            <ZAxis type="number" dataKey="value" domain={[0, maxValue]} range={[60, 800]} />
            <Tooltip
              cursor={{ stroke: '#C4C3C6', strokeDasharray: '3 3' }}
              content={<BubbleTooltip color={color} />}
            />
            <Scatter
              data={data}
              fill={color}
              fillOpacity={0.7}
              stroke={color}
              strokeWidth={1}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row — mirrors AudienceGrowthModule. No series swatches
          (single-series chart), so the row is just the right-aligned
          ModuleNetworks cluster against an empty left side. */}
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
