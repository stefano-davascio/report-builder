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

// Green / blue / orange — shared with Audience Growth (`SERIES`
// in `AudienceGrowthModule.tsx`). Re-stating the literals here rather
// than importing keeps the dependency graph one-directional (chart
// modules don't reach into each other for tokens) and makes the
// palette auditable from this file alone.
const GENDER_COLORS = {
  female: '#3FA40D',      // green — biggest slice
  male: '#0570DE',        // blue  — Male stays blue
  unspecified: '#ED6704', // orange — warm accent for the residual slice
} as const;

const GENDER_DATA = [
  { key: 'female', name: 'Female', value: 54, fill: GENDER_COLORS.female },
  { key: 'male', name: 'Male', value: 45, fill: GENDER_COLORS.male },
  { key: 'unspecified', name: 'Unspecified', value: 1, fill: GENDER_COLORS.unspecified },
];

interface AudienceByGenderModuleProps {
  profiles?: MockProfile[];
}

export function AudienceByGenderModule({ profiles = [] }: AudienceByGenderModuleProps) {
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
