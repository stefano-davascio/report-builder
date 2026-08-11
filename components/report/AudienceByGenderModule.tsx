'use client';

/**
 * Audience by gender — donut. Figma 2486:56994, refresh over the
 * earlier 1232:350200 comp.  Donut shape with an empty center hole.
 *
 *   • Slice colors share the blue / green / yellow palette locked in
 *     by Audience Growth (Figma 2895:68528) — same three primaries
 *     across every chart in the report:
 *       • Female      → #0570DE (blue, colors/palette/blue/500)     — biggest slice, brand-primary hue
 *       • Male        → #00C078 (green, SUCCESS/success--shade_10)  — second
 *       • Unspecified → #E6AE06 (yellow, WARNING/warning--shade_10) — accent for the residual slice
 *     The bar variant (`AudienceByGenderBarModule`) uses the same
 *     `getGenderColors` resolver so this palette change lands in
 *     both chart types in one place.
 *
 * Visualization rules (apply to all pie / distribution charts):
 *   1. No gaps between segments — `stroke="none"` so wedges read as a
 *      single continuous ring.
 *   2. Small values stay visible — `minAngle={6}` so the Unspecified
 *      1 % wedge still renders as a perceivable slice.
 *   3. Labels keep true values — tooltip and legend always show the
 *      actual percentage; only the visual angle is nudged.
 *
 * Tooltip is the shared `ModuleTooltip` (circle dots, design-system
 * chrome) — same component used by every other chart module.
 */

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip } from './ModuleTooltip';

// Cross-network palette — blue / green / yellow, shared with the
// `SERIES_CROSS_NETWORK` ramp in `AudienceGrowthModule.tsx` (Figma
// 2895:68528).  Same three Figma tokens across every distribution
// chart in the report.
const GENDER_COLORS_CROSS_NETWORK = {
  female: '#0570DE',      // blue   — colors/palette/blue/500 (biggest slice)
  male: '#00C078',        // green  — SUCCESS/success--shade_10
  unspecified: '#E6AE06', // yellow — WARNING/warning--shade_10 (residual)
} as const;

// TikTok palette — Figma 2486:56994 unifies TikTok with the
// cross-network palette (the earlier 2467:42088 all-blue INFO ramp
// is retired).  Kept as a distinct constant rather than folding
// into `GENDER_COLORS_CROSS_NETWORK` so `getGenderColors(network)`
// branching survives for any future TikTok-specific palette
// without another refactor — same pattern `getSeries` uses in
// `AudienceGrowthModule.tsx`.
const GENDER_COLORS_TIKTOK = {
  female: '#0570DE',
  male: '#00C078',
  unspecified: '#E6AE06',
} as const;

/**
 * Resolve the gender-slice palette for a given module network.
 * Currently returns the same blue / green / yellow palette
 * regardless of network per Figma 2486:56994 (which supersedes the
 * earlier TikTok-blue variant).  Branch retained so a future
 * TikTok-specific palette can drop in without another refactor.
 *
 * Exported so the sibling `AudienceByGenderBarModule` can use the
 * same palette resolver — both modules share the same legend row
 * shape (`Name - 54%`) and need to agree on slice colors.
 */
export function getGenderColors(network?: string | null) {
  return network === 'tiktok' ? GENDER_COLORS_TIKTOK : GENDER_COLORS_CROSS_NETWORK;
}

/** Fixed gender breakdown shared by both the donut and bar
 *  variants.  Values are percentages summing to 100. */
export const GENDER_BREAKDOWN: Array<{ key: 'female' | 'male' | 'unspecified'; name: string; value: number }> = [
  { key: 'female',      name: 'Female',      value: 54 },
  { key: 'male',        name: 'Male',        value: 45 },
  { key: 'unspecified', name: 'Unspecified', value: 1  },
];

interface AudienceByGenderModuleProps {
  profiles?: MockProfile[];
  /** Network binding from the parent `ReportModule.network`.  When
   *  `'tiktok'` the slices use the INFO-blue ramp matching the rest
   *  of the TikTok report; otherwise the cross-network palette. */
  network?: string | null;
}

export function AudienceByGenderModule({
  profiles = [],
  network,
}: AudienceByGenderModuleProps) {
  const colors = getGenderColors(network);
  const GENDER_DATA = [
    { key: 'female',      name: 'Female',      value: 54, fill: colors.female },
    { key: 'male',        name: 'Male',        value: 45, fill: colors.male },
    { key: 'unspecified', name: 'Unspecified', value: 1,  fill: colors.unspecified },
  ];
  return (
    <div className="flex h-full w-full flex-col gap-[16px]">
      {/* Donut — capped at 330 px so it matches `AudienceByCountryPieModule`'s
          diameter regardless of card height. Both pie modules must use
          the same cap. */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="aspect-square h-full max-h-[330px] max-w-[330px] mx-auto w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                cursor={false}
                content={
                  <ModuleTooltip
                    title={false}
                    formatValue={(v) => `${v}%`}
                  />
                }
              />
              <Pie
                data={GENDER_DATA}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="95%"
                // Rule 1: no gaps between segments.
                stroke="none"
                // Rule 2: small values stay visible (Unspecified 1 %).
                minAngle={6}
                isAnimationActive={false}
              >
                {GENDER_DATA.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row — legend dots on the left, networks indicator on the
          right. Mirrors the Figma 1233:350247 footer layout used by the
          audience-growth chart. */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-[24px]">
          {GENDER_DATA.map((entry) => (
            <div key={entry.key} className="flex items-center gap-[4px]">
              <span
                className="block h-[12px] w-[12px] rounded-full"
                style={{ background: entry.fill }}
              />
              {/* `Name - 54%` per Figma 2486:56994 — name in
                  regular 12/16 with 0.3 tracking, percentage in
                  medium 12/18.  Both spans share `#201E24`
                  (BRAND/dark) so the emphasis comes from weight,
                  not color.  Was a single-weight span before. */}
              <span
                style={{
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  color: '#201E24',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: '16px',
                    letterSpacing: '0.3px',
                  }}
                >
                  {entry.name} -{' '}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: '18px',
                    fontWeight: 500,
                  }}
                >
                  {entry.value}%
                </span>
              </span>
            </div>
          ))}
        </div>
        <ModuleNetworks profiles={profiles} />
      </div>
    </div>
  );
}
