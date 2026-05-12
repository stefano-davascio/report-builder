'use client';

// ─── ModuleWarningIcon ──────────────────────────────────────────────────
//
// Compact warning glyph rendered in a module's title row, right of the
// title text and left of the existing info `(i)` icon.  Pairs with
// `GlobalDataWarningBanner` — together they form the two-tier warning
// surface architecture documented in `lib/profile-status.ts`:
//
//   • `severity: 'case2'` — the actionable tier.  Red warning triangle
//     inside a danger-tinted pill, matching the `Permission needed`
//     `StatusBadge` chrome from `ProfileSelectionBar` so the family of
//     "you need to act on this" surfaces all read as one system.
//
//   • `severity: 'case1'` — the informational tier.  Outline info `(i)`
//     icon in tertiary text color, no fill behind it.  Quiet on
//     purpose: the user can't fix it, so we don't want it competing
//     with the real call to action.
//
// Tooltip copy scales by `profiles.length` (1 / 2–4 / 5+) — see
// `formatTooltip` below.  Case 2 takes precedence over Case 1 at the
// module level (enforced by `deriveModuleWarning` in
// `lib/profile-status.ts`) so this component never has to render both
// glyphs at once.

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { IconWarning } from '@/components/icons/FigmaIcons';
import { IconInfo } from '@/components/icons/SendiIcons';
import { MockProfile } from '@/lib/profile-data';
import { WarningSeverity } from '@/lib/profile-status';
import { cn } from '@/lib/utils';

interface ModuleWarningIconProps {
  /** Severity tier — `null` callers should not render the icon at all
   *  (caller does the gate; we don't render-noop here so the prop
   *  surface stays honest). */
  severity: Exclude<WarningSeverity, null>;
  /** Profiles in this severity tier for the module.  Drives the
   *  tooltip's name list + count.  Must be non-empty; an empty list
   *  means there's no warning, so the caller should have skipped the
   *  render. */
  profiles: MockProfile[];
}

/**
 * Build the tooltip body text.  Three tiers per the product spec:
 *
 *   • 1 profile      — name in the message body.
 *   • 2–4 profiles   — "{a}, {b}, and {c}" Oxford-comma list.
 *   • 5+ profiles    — count only ("3 of your selected profiles" /
 *                      "5 profiles need attention").
 *
 * Each severity has its own template since the surrounding sentence
 * shifts ("No data available …" vs "This data is incomplete …").
 */
function formatTooltip(severity: 'case1' | 'case2', profiles: MockProfile[]): string {
  const n = profiles.length;
  const names = profiles.map((p) => p.name);
  // Oxford-comma list — used only at 2–4.  At 5+ we drop the list
  // entirely because the design spec says naming 5 in a tooltip reads
  // as noise (and overflows the 224 px max-width).
  const list = n === 2
    ? `${names[0]} and ${names[1]}`
    : n === 3
      ? `${names[0]}, ${names[1]}, and ${names[2]}`
      : `${names[0]}, ${names[1]}, ${names[2]}, and ${names[3]}`;

  if (severity === 'case1') {
    if (n === 1) return `No data available for this timeframe for ${names[0]}.`;
    if (n <= 4) return `No data available for this timeframe for ${list}.`;
    return `No data available for this timeframe for ${n} of your selected profiles.`;
  }
  // Case 2 — actionable.  Single-profile tier names the profile and
  // tells the user the remediation in one sentence.  Multi-profile
  // tiers lead with the count for scannability.
  if (n === 1) {
    return `This data is incomplete. ${names[0]} needs attention — grant all permissions to fix this.`;
  }
  if (n <= 4) {
    return `This data is incomplete. ${n} profiles need attention: ${list}. Grant all permissions to fix this.`;
  }
  return `This data is incomplete. ${n} profiles need attention. Open Select profiles to see which ones and reconnect them.`;
}

export function ModuleWarningIcon({ severity, profiles }: ModuleWarningIconProps) {
  const tooltipText = formatTooltip(severity, profiles);

  // Chrome tokens, mirrored from existing surfaces so the new icon
  // doesn't introduce a third color story:
  //   • Case 2 — pill: `bg-[#FCE7E9]` + `text-[#CE091C]`, 20 px tall,
  //     14 px icon, matches `StatusBadge.permission` /
  //     `ModuleBannerTag.danger` and the global banner.
  //   • Case 1 — no pill, just the IconInfo glyph at
  //     `#79787B` (DARK/dark--tint_40), the same tertiary gray we use
  //     for the "Cross-network" section header in AddModulePanel.  No
  //     background fill — the spec calls for "no fill" so it doesn't
  //     compete with the title text.
  const trigger =
    severity === 'case2' ? (
      <span
        aria-label="Action required"
        role="img"
        className={cn(
          'inline-flex items-center justify-center w-[20px] h-[20px] p-[3px] rounded-[4px]',
          'bg-[#FCE7E9] flex-shrink-0',
          // Inherits FigmaIcon's stroke handling — width override
          // matches existing in-card pill icons.
          '[&_path]:[stroke-width:1]',
        )}
      >
        <IconWarning size={14} color="#CE091C" />
      </span>
    ) : (
      <span
        aria-label="Partial data"
        role="img"
        className="inline-flex items-center justify-center w-[16px] h-[16px] flex-shrink-0"
      >
        <IconInfo size={14} color="#79787B" />
      </span>
    );

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={trigger} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="top" sideOffset={6} className="isolate z-50">
          <TooltipPrimitive.Popup
            className={cn(
              // Figma 489:12798 — DARK/dark--alpha_70 surface @ 70%
              // alpha with a 2 px backdrop-filter blur, so any chart
              // content peeking through reads as softly diffused
              // behind the tooltip rather than crisp.  Same chrome
              // ProfileChip's status tooltip uses, so all warning
              // tooltips in the app share one visual family.
              'bg-[rgba(32,30,36,0.7)] backdrop-blur-[2px] rounded-[4px] px-[8px] py-[4px]',
              'max-w-[280px]',
              'text-[12px] leading-[16px] text-white',
              'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0',
              'data-open:animate-in data-open:fade-in-0',
              'data-closed:animate-out data-closed:fade-out-0',
            )}
            style={{
              fontFamily: 'IBM Plex Sans, sans-serif',
              letterSpacing: '0.3px',
            }}
          >
            {tooltipText}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
