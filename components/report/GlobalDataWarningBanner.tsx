'use client';

// ─── GlobalDataWarningBanner ────────────────────────────────────────────
//
// Canvas-level Case-2 alert.  Mounts at the top of the canvas card,
// above the modules grid.  Renders only when at least one visible
// module is affected by a Case-2 issue (a profile that needs the user
// to reconnect or grant additional permissions before any data can
// flow through).
//
// Pairs with per-module `ModuleWarningIcon`s.  The two-tier
// architecture is explicit:
//
//   • Case-2 issues bubble to a SINGLE global banner instead of N
//     in-card banners — that keeps the canvas readable when many
//     modules are affected, and trains users that "fix it once, fix
//     it everywhere" lives at the top of the page.
//   • Case-1 (informational, no-action) issues stay per-module via the
//     icon; they never raise this banner.
//
// Figma 1914:36680 — `bg-[#FCE7E9]` (DANGER/tint_90) +
// `rounded-[4px]`, 8 / 12 px padding, 14 px warning glyph, 12 / 18
// IBM Plex text in `#CE091C` (DANGER/shade_10).  The fix CTA is
// rendered as a clickable underline span; clicking calls
// `onOpenSelectProfiles` so the picker opens at the same surface where
// the per-profile status pills live.
//
// Dismissal is session-only — `onDismiss` callers should hold the
// state in component state, not localStorage, per the product spec.

import { IconWarning } from '@/components/icons/FigmaIcons';
import { IconClose } from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

interface GlobalDataWarningBannerProps {
  /** Distinct count of profiles needing reconnection / permissions.
   *  Drives the singular/plural noun + the leading number. */
  affectedCount: number;
  /** Opens the Select-profiles picker so the user can act on the
   *  per-profile pills.  Wired in `ReportBuilderPage` to bump a
   *  numeric `openTrigger` that `ProfileSelectionBar` listens for. */
  onOpenSelectProfiles: () => void;
  /** Session-only dismiss — banner re-appears on next page load even
   *  if dismissed earlier in the same session. */
  onDismiss: () => void;
}

export function GlobalDataWarningBanner({
  affectedCount,
  onOpenSelectProfiles,
  onDismiss,
}: GlobalDataWarningBannerProps) {
  // Singular when exactly one profile is affected — "1 profile needs
  // reconnection" reads more naturally than "1 profiles".  No
  // i18n yet so the construction is hand-rolled.
  const noun = affectedCount === 1 ? 'profile needs' : 'profiles need';

  return (
    <div
      // Outer chrome: danger-tint background, 12-px vertical / 8-px
      // horizontal padding (Figma 1980:56769).  `flex` + justify-
      // between pins the close affordance to the far right.  No
      // rounded corners — per the new placement the banner spans
      // the full viewport width directly under the profile bar, so
      // sharp edges read as a horizontal strip rather than a card.
      // No outer margin / shadow — the parent owns layout.
      className="flex items-center justify-between gap-[8px] bg-[#FCE7E9] px-[8px] py-[12px]"
      role="alert"
      data-figma-node-id="1914:36680"
    >
      <div className="flex items-center gap-[8px] min-w-0">
        {/* 14-px IconWarning, danger foreground.  Stroke override
            mirrors the per-module pill / per-profile StatusBadge so
            all three danger surfaces render the glyph at the same
            weight. */}
        <span
          aria-hidden
          className="flex items-center justify-center flex-shrink-0"
        >
          <IconWarning size={14} color="#CE091C" />
        </span>
        {/* Three text runs in one paragraph (Figma 1914:36680 copy):
              • Bold "Action required:" prefix
              • Body text inline after a space
              • "Open Select profiles to fix this." rendered as an
                inline underlined Medium-weight link.  Inline (not a
                block-level button) so the whole sentence wraps as
                one paragraph when the canvas is narrow.  */}
        <p
          className="text-[12px] leading-[18px] text-[#CE091C]"
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          <span className="font-medium">Action required:</span>{' '}
          <span>
            {affectedCount} {noun} reconnection or additional permissions to show complete data.
          </span>{' '}
          <button
            type="button"
            onClick={onOpenSelectProfiles}
            className={cn(
              // Underlined Medium-weight link in danger-shade red.
              // Hover affordance: keep the underline (don't remove
              // it — that subtracts signal) and darken the text to
              // a deeper danger shade so the link visibly responds.
              // No background pill: the underline + color shift is
              // enough on a tinted banner surface.
              'underline underline-offset-2 cursor-pointer transition-colors',
              'text-[#CE091C] font-medium',
              'hover:text-[#A60818]',
              'rounded-[2px] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#CE091C]',
            )}
          >
            Open Select profiles to fix this.
          </button>
        </p>
      </div>
      {/* Close × — 14-px glyph in DARK/dark--tint_10 (#363439) per
          Figma 1914:36687, NOT the danger red used for the warning
          glyph + text.  The product cue is "this is a neutral
          dismiss, not part of the danger color story" so the close
          affordance reads as separate from the alert content.
          Click-area expands via `p-[2px]` so the tap target reaches
          18 × 18 without changing the visible glyph size. */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss warning"
        className={cn(
          'flex items-center justify-center flex-shrink-0 p-[2px] rounded-[2px]',
          'hover:bg-[rgba(32,30,36,0.06)] transition-colors',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#363439]',
        )}
      >
        <IconClose size={14} color="#363439" />
      </button>
    </div>
  );
}
