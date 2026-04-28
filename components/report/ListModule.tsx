'use client';

/**
 * List module — ranked top-posts list. Visual language matches the
 * refined chart modules:
 *
 *   • Typography     — IBM Plex Sans throughout.
 *       title:    14 / 20, #201E24 (BRAND/dark), `font-medium`.
 *       subtitle: 12 / 16, #79787B (DARK/dark--tint_25), 0.3 px tracking.
 *       metric label: 12 / 16, #79787B (Label-Helper).
 *       metric value: 12 / 16, #201E24, `font-medium`, `tabular-nums`.
 *   • Thumbnail      — 48 × 64 with 6 px corner radius. Solid
 *       #F3F3F4 (DARK/dark--tint_95) surface, BRAND/dark glyph at
 *       50% opacity so the thumbnail reads as an empty-state token,
 *       not a decorative gradient. Random violet/pink/blue Tailwind
 *       gradients have been removed — they didn't belong to the
 *       design system, and asset size shouldn't drive layout.
 *   • Row divider    — 1 px #E8E8E9 between rows; last row drops the
 *       border so the module's own bottom padding owns the close.
 *   • Hover surface  — #F3F3F4 with a 4 px corner radius. Same hover
 *       surface as ModuleActions, dropdowns, and TableModule.
 *
 * The thumbnail glyph is the SendiIcons `IconLineChart` placeholder
 * (a generic media-tile mark) so the catalog stays free of
 * `lucide-react` imports. If a future post object carries a real
 * `thumbnailUrl`, swap it in here without changing the row geometry.
 */

import { ListItem } from '@/types';
import { cn } from '@/lib/utils';

// Subtle play-glyph rendered as a centered SVG triangle inside the
// thumbnail tile. Using a hand-tuned path (not lucide) keeps icon
// origin under design-system control.
function ThumbnailGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3.5 2.5L11 7L3.5 11.5V2.5Z"
        fill="#201E24"
        fillOpacity="0.5"
      />
    </svg>
  );
}

interface ListModuleProps {
  items: ListItem[];
}

export function ListModule({ items }: ListModuleProps) {
  return (
    <div
      className="flex flex-col h-full overflow-auto"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div
            key={item.id}
            className={cn(
              'flex gap-[12px] py-[12px] transition-colors',
              !isLast && 'border-b border-[#E8E8E9]',
              'hover:bg-[#F3F3F4] hover:rounded-[4px]',
              // Negative inset so the hover surface bleeds into the
              // module's content padding by 4 px on each side, giving
              // the rounded hover bg some air without shifting the
              // text alignment vs. the underlying row baseline.
              '-mx-[4px] px-[4px]',
            )}
          >
            {/* Thumbnail — neutral surface tile, no gradient. 48×64
                matches the Figma top-posts thumbnail spec; play glyph
                is centered so the row geometry doesn't change if the
                glyph is later swapped for a real thumbnail image. */}
            <div className="w-[48px] h-[64px] rounded-[6px] bg-[#F3F3F4] flex items-center justify-center flex-shrink-0">
              <ThumbnailGlyph />
            </div>

            {/* Content — title, subtitle, metric strip. `min-w-0` is
                load-bearing on the flex child so long titles can
                truncate inside `line-clamp-2` instead of forcing the
                row to overflow. */}
            <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
              <p className="text-[14px] leading-[20px] font-medium text-[#201E24] line-clamp-2">
                {item.title}
              </p>
              {item.subtitle && (
                <p
                  className="text-[12px] leading-[16px] text-[#79787B]"
                  style={{ letterSpacing: '0.3px' }}
                >
                  {item.subtitle}
                </p>
              )}
              <div className="flex flex-wrap items-baseline gap-x-[12px] gap-y-[2px] mt-[2px]">
                {item.metrics.map((metric, mi) => (
                  <div key={mi} className="flex items-baseline gap-[4px]">
                    <span
                      className="text-[12px] leading-[16px] text-[#79787B]"
                      style={{ letterSpacing: '0.3px' }}
                    >
                      {metric.label}
                    </span>
                    <span className="text-[12px] leading-[16px] font-medium text-[#201E24] tabular-nums">
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
