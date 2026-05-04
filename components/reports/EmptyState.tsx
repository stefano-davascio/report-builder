'use client';

/**
 * Empty-state for the reports table — Figma 1452:457148 ("Empty state
 * container") inside the Beta Launch + empty state frame (1452:457037).
 *
 * Spec, top → bottom:
 *   • Outer container: 324 px wide, `flex-col`, gap-24 between icon
 *     wrapper and text cluster, items-center.
 *   • Icon wrapper (1452:457149): 56 × 56, fully rounded (radius 28),
 *     bg DARK/dark--tint_95 (#F3F3F4), 16 px padding so the inner
 *     24 × 24 IconDanger sits centered.
 *   • Icon (1452:457149 → "danger"): IconDanger glyph at 24 px,
 *     stroke #201E24 (BRAND/dark) — the same octagonal stop-sign
 *     glyph used elsewhere in the design system.
 *   • Text cluster (1452:457151): gap-12 between title and description,
 *     items-center, text-center.
 *   • Title: "You haven't created any reports yet" — IBM Plex Sans
 *     Medium, 16 / 22, color #201E24.
 *   • Description: "Choose a template above or start from scratch to
 *     create your first report." — IBM Plex Sans Regular, 14 / 21,
 *     color #626165, max-width 298 px.
 *
 * Defaults match the Figma copy for the source-empty case (no reports
 * authored yet). The "filtered to zero" path passes overrides via
 * `title` / `description` props so the same component renders both
 * empty-state variations without duplication.
 */

import { IconDanger } from '@/components/icons/SendiIcons';

interface EmptyStateProps {
  /** Headline copy. Defaults to the Figma source-empty title. */
  title?: string;
  /** Sub-copy. Defaults to the Figma source-empty description. */
  description?: string;
}

export function EmptyState({
  title = "You haven't created any reports yet",
  description = 'Choose a template above or start from scratch to create your first report.',
}: EmptyStateProps) {
  return (
    <div
      // 324-px-wide container centered horizontally inside the
      // section. `mx-auto` is the centering vehicle (the section uses
      // a vanilla flex-col so we can't rely on a parent `items-center`
      // there — that would shrink the populated-state header off
      // full-width too).
      className="mx-auto flex flex-col items-center gap-[24px]"
      style={{ width: 324, fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {/* Icon wrapper — 56 × 56, fully rounded, light-grey fill,
          16 px padding so the IconDanger glyph occupies the inner
          24 × 24. `flex items-start` per Figma so the icon sits in
          the top-left of the padded box; with symmetric padding the
          24-px glyph still ends up visually centered. */}
      <div
        className="flex items-start bg-[#F3F3F4] rounded-full"
        style={{ width: 56, height: 56, padding: 16 }}
        aria-hidden="true"
      >
        <IconDanger size={24} color="#201E24" />
      </div>

      {/* Text cluster — title + description stacked, gap-12, both
          centered. */}
      <div className="flex flex-col items-center gap-[12px] text-center w-full">
        <p className="text-[16px] leading-[22px] font-medium text-[#201E24]">
          {title}
        </p>
        {/* Description capped at 298 px (Figma 1452:457153) — keeps
            the line breaks where the design intends them. Wider
            viewports won't reflow into a single uncomfortably-long
            line. */}
        <p
          className="text-[14px] leading-[21px] text-[#626165]"
          style={{ maxWidth: 298 }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
