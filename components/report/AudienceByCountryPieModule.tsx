'use client';

/**
 * Audience by country — pie/donut variant. Figma 1314:191721, donut
 * shape with an empty center hole.
 *
 *   • Slice colors come from the Figma 1310:191707 ramp (#003262 →
 *     #DDFFFE) so visual weight tracks rank.
 *   • innerRadius / outerRadius give a thick wedge with a generous
 *     center hole; the donut max size is capped at 330 px so it
 *     renders at the same diameter as `AudienceByGenderModule`
 *     regardless of card height.
 *
 * Visualization rules (apply to all pie / distribution charts):
 *   1. No gaps between segments — `stroke="none"` so wedges read as a
 *      single continuous ring.
 *   2. Small values stay visible — `minAngle={6}` ensures slices like
 *      Australia (0.1 %) still render as a perceivable wedge instead
 *      of disappearing into a hairline.
 *   3. Labels keep true values — tooltip and legend always show the
 *      actual percentage; only the visual angle is nudged.
 *   4. Readability over mathematical purity — the floor sacrifices a
 *      tiny amount of proportional accuracy for clarity.
 *
 * Tooltip is the shared `ModuleTooltip` (circle dots, design-system
 * chrome) — same component used by every other chart module.
 */

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { MOCK_PIE_DATA } from '@/lib/mock-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip } from './ModuleTooltip';

interface AudienceByCountryPieModuleProps {
  profiles?: MockProfile[];
}

export function AudienceByCountryPieModule({ profiles = [] }: AudienceByCountryPieModuleProps) {
  const data = MOCK_PIE_DATA['audience-by-country'];

  return (
    <div className="flex h-full w-full flex-col gap-[16px]">
      {/* Donut — capped at 330 px so it matches `AudienceByGenderModule`'s
          diameter regardless of card height or legend footprint. */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="aspect-square h-full max-h-[330px] max-w-[330px] mx-auto w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                cursor={false}
                content={
                  <ModuleTooltip
                    title={false}
                    formatValue={(v) => `${v < 1 ? v.toFixed(1) : v}%`}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="95%"
                // Rule 1: no gaps between segments. Stroke disabled so
                // adjacent wedges read as a single continuous ring.
                stroke="none"
                // Rule 2: small values stay visible. 6° is enough to
                // perceive a 0.1 % wedge without meaningfully distorting
                // the larger slices.
                minAngle={6}
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend row — Figma 1314:191825. flex-wrap so the country chips
          fold to a second line on narrow cards. Wrapping is safe here
          because the donut above is capped at a fixed max diameter,
          so a taller legend no longer squeezes it. The networks
          indicator stays pinned to the right edge of the row. */}
      <div className="flex items-end justify-between gap-[24px] flex-shrink-0">
        <div className="flex flex-wrap items-center" style={{ columnGap: 12, rowGap: 8 }}>
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-[4px]">
              <span
                className="block h-[12px] w-[12px] rounded-full flex-shrink-0"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
              <span
                className="text-[#4C4B4F] whitespace-nowrap"
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
