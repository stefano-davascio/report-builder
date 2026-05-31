'use client';

/**
 * Generic summary card — flat label/value rows + a networks footer.
 *
 * Used by single-period summary modules whose payload is a small set
 * of pre-formatted facts about ONE thing (a "best day", a totals
 * snapshot, etc.) rather than a ranked list:
 *
 *   • `tiktok-best-engaging-day`  (Figma 1291:123415)
 *   • `tiktok-best-performing-day` (Figma 1339:217275)
 *
 * Both Figma frames are visually identical except for the row labels
 * and values, so they share this component and pass their own `rows`
 * payload from `lib/mock-data.ts`.
 *
 * Different shape from `ListModule`:
 *
 *   • `ListModule` is a ranked list of posts/days with thumbnails,
 *     titles, subtitles, and a metric strip per row.
 *   • `SummaryCardModule` is a flat label/value table — no thumbnails,
 *     no rankings, one fact per row. Rows distribute the available
 *     content height via `flex-1` so the design scales cleanly when
 *     the user resizes the card.
 *
 * Visual chrome (typography, divider color, network indicator) shares
 * the same primitives as the list & metric modules, so changes there
 * propagate here too.
 */

import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { COMPACT_NETWORKS_THRESHOLD_PX } from './AudienceGrowthModule';
import { IconTrendUp, IconTrendDown } from '@/components/icons/SendiIcons';

export interface SummaryRow {
  label: string;
  value: string;
  /**
   * When set, the row's value renders with a trend chip:
   *   • `'up'`   — green-filled circle + up-right arrow,
   *                value text in `#006B43`.
   *   • `'down'` — red-filled circle + down-left arrow,
   *                value text in `#CE091C`.
   * Used by the Growth row in best-performing / best-engaging day
   * summaries (Figma 2208:52384, 2219:39350) so the direction reads
   * at a glance instead of relying on parsing the leading sign of
   * the value string.
   */
  trend?: 'up' | 'down';
}

interface SummaryCardModuleProps {
  rows: SummaryRow[];
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function SummaryCardModule({
  rows,
  contentWidth = 0,
  profiles = [],
}: SummaryCardModuleProps) {
  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {/* Row stack — outer `flex-1` so the stack takes the available
          height; each row is also `flex-1` so the four rows distribute
          that space evenly (matches Figma's `flex-[1_0_0]` rows).
          Per Figma each row carries a 1 px **top** border (so the
          first row gets a divider against the header gap, and the
          last row's bottom edge is owned by the card's own padding). */}
      <div className="flex-1 flex flex-col min-h-0">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex-1 flex items-center justify-between gap-4 border-t border-[#E8E8E9]"
          >
            <span
              className="text-[#363439]"
              style={{ fontSize: 12, lineHeight: '18px' }}
            >
              {row.label}
            </span>
            {row.trend ? (
              // Growth chip — Figma 2208:52384 / 2219:39350.  Icon
              // is the same colored-circle glyph the MetricCard's
              // comparison row uses (`IconTrendUp` / `IconTrendDown`)
              // so all "value direction" indicators in the builder
              // share one visual.  Value text color mirrors the
              // chip's semantic tone.
              <span
                className={`flex items-center gap-[6px] tabular-nums whitespace-nowrap text-right ${
                  row.trend === 'up' ? 'text-[#006B43]' : 'text-[#CE091C]'
                }`}
                style={{ fontSize: 12, lineHeight: '18px' }}
              >
                {row.trend === 'up' ? <IconTrendUp size={16} /> : <IconTrendDown size={16} />}
                {row.value}
              </span>
            ) : (
              <span
                className="text-[#626165] tabular-nums text-right"
                style={{ fontSize: 12, lineHeight: '18px' }}
              >
                {row.value}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer — networks indicator only, right-aligned. No legend
          swatches (no series here), so the row collapses to a single
          right-pinned cluster. */}
      <div className="flex justify-end w-full flex-shrink-0 pt-[12px]">
        <ModuleNetworks
          profiles={profiles}
          maxVisible={contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX ? 1 : 3}
        />
      </div>
    </div>
  );
}
