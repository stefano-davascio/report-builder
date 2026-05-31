'use client';

/**
 * Audience Growth — grouped bar rendering. Shown when the user switches
 * the Audience Growth module's chart type to "bar". Shares every piece
 * of visual chrome (grid, axis ticks, tooltip, legend row, density
 * helpers) with the default area rendering by importing from
 * `AudienceGrowthModule`, so styling changes stay in one place.
 *
 * Why grouped, not stacked: the three SERIES (Net followers, Followers,
 * Profile views) are parallel metrics, not components of a single
 * total — stacking them would imply additivity that doesn't exist and
 * would also balloon the y-axis (~2.7k stacked vs. ~1.1k peak per
 * series), causing the y-axis figures to jump when the user toggles
 * between area / line / bar variants. Grouped bars keep every variant
 * pinned to the same `[0, 1200]` domain.
 *
 * Every bar gets a rounded top (`[BAR_RADIUS, BAR_RADIUS, 0, 0]`) and
 * a flat bottom so the bars sit cleanly on the x-axis.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip } from './ModuleTooltip';
import {
  getSeries,
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

interface AudienceGrowthBarModuleProps {
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
  /** Module network binding — drives the series palette (see
   *  `AudienceGrowthModule` for the cross-network vs TikTok split). */
  network?: string | null;
}

// Corner radius for the top of each bar. Bottom corners stay square
// so the bar sits flat on the x-axis.
const BAR_RADIUS = 2;

export function AudienceGrowthBarModule({
  contentHeight,
  contentWidth = 0,
  profiles = [],
  network,
}: AudienceGrowthBarModuleProps) {
  const series = getSeries(network);
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);
  const yTickCount = pickYTickCount(chartH);
  const plotW = contentWidth > 0 ? contentWidth - 32 : 0;
  const xTickCount = pickXTickCount(plotW);
  const xTicks = computeXTicks(DATA, xTickCount);

  // Grouped bars — every series gets the same rounded-top treatment
  // since none of them is "on top of" another.
  const radius: [number, number, number, number] = [BAR_RADIUS, BAR_RADIUS, 0, 0];

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={DATA}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            // Cap bar width so 31 data points don't render as thick
            // slabs on wide cards — we want a visual density close to
            // the area chart's plotted line weight.
            maxBarSize={14}
            // Small categorical gap keeps adjacent bars visually
            // separated without opening a big river of whitespace.
            barCategoryGap={2}
          >
            <CartesianGrid
              stroke="#E8E8E9"
              strokeWidth={1}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              ticks={xTicks}
              interval={0}
              tickMargin={12}
              tick={(props) => {
                const { x, y, payload, index } = props;
                const isFirst = index === 0;
                const isLast  = index === xTicks.length - 1;
                const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
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
                    {payload.value}
                  </text>
                );
              }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#626165', fontFamily: 'IBM Plex Sans, sans-serif' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              width={32}
              // Pin to the same domain as the area + line variants so
              // the y-axis ladder doesn't change when the user toggles
              // chart type. Peak per-series value on mock data is
              // ~1.1k, so 1.2k gives a tiny ceiling buffer without
              // wasting vertical space.
              domain={[0, 1200]}
              tickCount={yTickCount}
              allowDecimals={false}
            />
            <Tooltip content={<ModuleTooltip />} cursor={{ fill: 'rgba(196,195,198,0.18)' }} />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={radius}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row — identical structure to the area-chart rendering,
          driven by the same `pickSeriesGap` / `COMPACT_NETWORKS_*`
          thresholds so switching chart type doesn't jitter the
          footer. */}
      <div
        className="flex flex-wrap items-center justify-between w-full flex-shrink-0"
        style={{ paddingTop: LEGEND_TOP_GAP, rowGap: 16 }}
      >
        <div
          className="flex flex-wrap items-center"
          style={{ columnGap: pickSeriesGap(contentWidth), rowGap: 8 }}
        >
          {series.map((s) => (
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
