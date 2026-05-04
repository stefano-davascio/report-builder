'use client';

/**
 * Networks-column rendering for the reports table — Figma 1597:463854
 * ("Second report social icons" — 3 visible icons + flush-left at
 * `left-[91px]` inside the 274-px cell).
 *
 * Shows up to THREE network glyphs (20 px each, 4 px gap), then
 * collapses the rest into a "+N" overflow indicator. The overflow is
 * plain text (NOT a pill / chip) — 16/24 #626165 — sitting at the
 * same baseline as the icons.
 *
 * Hover popover (Figma 1364:324535) — when the user hovers the icon
 * stack we float a tooltip directly above it that lists EVERY network
 * the report uses (visible + overflowed). This is the only way to see
 * which networks are hidden behind a "+N" chip without opening the
 * report. Visual contract from Figma:
 *   • bg #FFFFFF, 1-px solid #E8E8E9, rounded-6
 *   • px-8 py-6, gap-4 between icons
 *   • Is-Floating shadow (0 4 8 + 0 8 16 of #201E241A)
 *   • Icons render full-color at the same 20-px tile size as the trigger.
 *
 * Bluesky and X are first-class platforms in the Figma comp, so we
 * forward them straight to `PlatformIcon` (which now handles both).
 */

import { useState } from 'react';
import { Platform } from '@/types';
import { PlatformIcon } from '@/components/report/PlatformIcon';

const VISIBLE = 3;

// All platforms `PlatformIcon` knows how to render. Anything outside
// this list quietly drops out of the row — important so the column
// never silently renders a blank tile.
const SUPPORTED: Platform[] = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'threads',
  'google-analytics',
  'bluesky',
  'x',
];

function isSupported(p: Platform): boolean {
  return SUPPORTED.includes(p);
}

interface ModuleIconStackProps {
  networks: Platform[];
}

export function ModuleIconStack({ networks }: ModuleIconStackProps) {
  const [hovered, setHovered] = useState(false);
  const safe = networks.filter(isSupported);
  const visible = safe.slice(0, VISIBLE);
  const overflow = safe.length - visible.length;

  return (
    <div
      className="relative flex items-center gap-[4px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {visible.map((p) => (
        <span
          key={p}
          className="w-[20px] h-[20px] flex items-center justify-center"
        >
          <PlatformIcon platform={p} size={20} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="text-[16px] leading-[24px] text-[#626165]"
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          +{overflow}
        </span>
      )}

      {/* Hover popover — floats directly above the stack, listing every
          network in the report. `bottom-full` anchors it to the top edge
          of the stack and `mb-[8px]` floats it 8 px clear so it doesn't
          touch the icons. Aligned to the LEADING edge (`left-0`) so the
          tooltip grows rightward from the first glyph rather than
          drifting off the row's trailing edge for reports with many
          networks. `pointer-events-none` keeps the popover from
          intercepting clicks meant for the row. */}
      {hovered && safe.length > 0 && (
        <div
          role="tooltip"
          className="absolute z-30 left-0 bottom-full mb-[8px] flex items-center gap-[4px] bg-white rounded-[6px] px-[8px] py-[6px] pointer-events-none"
          style={{
            border: '1px solid #E8E8E9',
            boxShadow:
              '0 4px 8px rgba(32,30,36,0.1), 0 8px 16px rgba(32,30,36,0.1)',
            whiteSpace: 'nowrap',
          }}
        >
          {safe.map((p) => (
            <span
              key={p}
              className="w-[20px] h-[20px] flex items-center justify-center flex-shrink-0"
            >
              <PlatformIcon platform={p} size={20} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
