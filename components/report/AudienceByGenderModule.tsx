'use client';

/**
 * Audience by gender — donut. Figma 1232:350200, donut shape with an
 * empty center hole.
 *
 *   • Slice colors share the green / blue / orange palette established
 *     by Audience Growth (Figma 1302:170369), so every chart in the
 *     report reads from the same three primaries:
 *       • Female      → #3FA40D (green)  — biggest slice gets the most
 *                                          "primary" hue
 *       • Male        → #0570DE (blue)   — Male stays blue, matching
 *                                          the convention every other
 *                                          chart's "platform blue" uses
 *       • Unspecified → #ED6704 (orange) — third slice gets the warm
 *                                          accent
 *     The bar variant (rendered via `CategoricalBarModule` from the
 *     `audience-by-gender` entry in `MOCK_CHART_DATA`) reads its colors
 *     from that same data source, so this palette change lands in both
 *     chart types in one place — see `lib/mock-data.ts`.
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

// Cross-network palette — green / blue / orange, shared with the
// `SERIES_CROSS_NETWORK` ramp in `AudienceGrowthModule.tsx`.
const GENDER_COLORS_CROSS_NETWORK = {
  female: '#3FA40D',      // green — biggest slice
  male: '#0570DE',        // blue  — Male stays blue
  unspecified: '#ED6704', // orange — warm accent for the residual slice
} as const;

// TikTok palette (Figma 2467:42088) — three INFO-blue shades from
// the same Figma INFO tokens Audience Growth uses on TikTok.
// Female (the dominant slice) gets the DARKEST shade per the
// design — visual weight tracks data weight:
//   • Female      — INFO/info--shade_20  (#005BBA, darkest)
//   • Male        — INFO/info--shade_10  (#0067D1, medium)
//   • Unspecified — INFO/info_dark-theme (#1A88FF, lightest)
const GENDER_COLORS_TIKTOK = {
  female: '#005BBA',
  male: '#0067D1',
  unspecified: '#1A88FF',
} as const;

/**
 * Resolve the gender-slice palette for a given module network.
 * `'tiktok'` swaps to the all-blue INFO ramp; anything else falls
 * back to the cross-network green / blue / orange tokens.  Mirrors
 * the `getSeries(network)` pattern used by `AudienceGrowthModule`.
 */
function getGenderColors(network?: string | null) {
  return network === 'tiktok' ? GENDER_COLORS_TIKTOK : GENDER_COLORS_CROSS_NETWORK;
}

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
              <span
                className="text-[#4C4B4F]"
                style={{
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: 12,
                  lineHeight: '16px',
                  letterSpacing: '0.3px',
                }}
              >
                {entry.name}
              </span>
            </div>
          ))}
        </div>
        <ModuleNetworks profiles={profiles} />
      </div>
    </div>
  );
}
