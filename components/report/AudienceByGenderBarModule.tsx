'use client';

/**
 * Audience by gender — bar variant.  Bespoke counterpart to the
 * `AudienceByGenderModule` donut (Figma 2467:42088 with the chart
 * type toggled).  Shares the same network-aware palette resolver
 * (`getGenderColors`) and the same `GENDER_BREAKDOWN` data so both
 * variants always tell the same story — flipping the module's
 * chart-type toggle swaps the visual without changing any numbers.
 *
 * Why a bespoke module instead of routing through the generic
 * `CategoricalBarModule`?
 *
 *   • The Figma's bar variant carries the same `Name - 54%` legend
 *     row as the donut variant beneath the chart.  Bolting that
 *     legend onto the generic categorical bar would either bloat
 *     its prop surface or duplicate the categories with the
 *     already-on-axis x-axis labels for other modules.  Keeping
 *     this slice-specific behavior in its own file means the
 *     generic categorical bar stays terse.
 *   • Network-aware palette is a same-file concern with the donut,
 *     so the two live next door rather than the bar reaching into
 *     the donut for tokens.
 */

import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip } from './ModuleTooltip';
import { getGenderColors, GENDER_BREAKDOWN } from './AudienceByGenderModule';
import {
  formatYAxis,
  LEGEND_RESERVE,
  LEGEND_TOP_GAP,
  COMPACT_NETWORKS_THRESHOLD_PX,
} from './AudienceGrowthModule';

// Same gutters / shapes the generic `CategoricalBarModule` uses, so
// the audience-by-gender bar visually lines up with sister
// modules' bar variants (instagram-audience, tiktok-audience).
const Y_AXIS_W = 32;
const BAR_RADIUS = 6;

interface AudienceByGenderBarModuleProps {
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
  /** Network binding from the parent `ReportModule.network`.
   *  See `getGenderColors` for the palette swap rules. */
  network?: string | null;
}

export function AudienceByGenderBarModule({
  contentHeight,
  contentWidth = 0,
  profiles = [],
  network,
}: AudienceByGenderBarModuleProps) {
  const colors = getGenderColors(network);
  const data = GENDER_BREAKDOWN.map((row) => ({
    ...row,
    fill: colors[row.key],
  }));

  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 120);

  return (
    <div className="flex flex-col h-full w-full">
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            // 3 categories — bars can breathe.
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
              // Percentages — pin to [0, 100] so the bars are
              // comparable to other percentage bars elsewhere in
              // the builder and the topmost label sits on the
              // axis ceiling.
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              allowDecimals={false}
            />
            <Tooltip
              content={
                <ModuleTooltip
                  // Per-row colors live on the data — surface them
                  // (Recharts' default `e.color` is the Bar-level
                  // fill, which we never set).
                  title={false}
                  getDot={(e) => e.payload?.fill ?? '#201E24'}
                  getName={(e) => e.payload?.name ?? null}
                  formatValue={(v) => `${v}%`}
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
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer — `Name - 54%` legend on the left, networks
          indicator on the right.  Same legend shape as the donut
          variant (Figma 2467:42121) so flipping the chart-type
          toggle swaps the visual without disturbing the slice
          labels. */}
      <div
        className="flex flex-wrap items-center justify-between w-full flex-shrink-0"
        style={{ paddingTop: LEGEND_TOP_GAP, rowGap: 16 }}
      >
        <div className="flex items-center flex-wrap" style={{ columnGap: 24, rowGap: 8 }}>
          {data.map((entry) => (
            <div key={entry.key} className="flex items-center gap-[4px]">
              <span
                className="block h-[12px] w-[12px] rounded-full flex-shrink-0"
                style={{ background: entry.fill }}
              />
              <span
                className="text-[#4C4B4F]"
                style={{
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: 12,
                  lineHeight: '16px',
                  letterSpacing: '0.3px',
                }}
              >
                {entry.name} - {entry.value}%
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
