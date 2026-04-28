'use client';

/**
 * Empty-state card for the report canvas — Figma 1393:411077.
 *
 * Surfaces in the builder whenever a fresh scratch report has no
 * modules yet.  Centered inside the white canvas, it shows a small
 * preview block (lavender plate + inner outlined frame + plus glyph),
 * a heading + subtitle, and a primary "Add first module" button that
 * opens the Add-modules panel.
 *
 * The component is purely presentational — the parent owns the panel-
 * open state and passes a callback in.  No hover/drag affordances on
 * the preview itself; it's a static visual cue, not a drop target.
 */

interface EmptyBoardCardProps {
  /** Click on "Add first module" — typically toggles the AddModulePanel. */
  onAddFirstModule: () => void;
}

export function EmptyBoardCard({ onAddFirstModule }: EmptyBoardCardProps) {
  return (
    <div
      // Outer card — Figma 1393:411077.
      //   • White bg, 1 px #E8E8E9 border, 8 px radius.
      //   • Dual drop-shadow (elevation-12 + elevation-14) lifts it off
      //     the empty canvas.
      //   • Padding: top 12, sides 12, bottom 20 — Figma spec.
      //   • Width: 376 px natural (= 352 inner column + 12 + 12 outer
      //     padding) but capped at the parent's available width via
      //     `max-w-full`.  Without the cap, opening the AddModulePanel
      //     can shrink the canvas content area below 376 px, which
      //     overflows the canvas-card; CSS makes overflow-x compute to
      //     `auto` whenever overflow-y is `auto`, so the overflowing
      //     card gets clipped and visually "disappears" into the
      //     scrollbar gutter.  Capping the width keeps the card inside
      //     the visible canvas at every panel/viewport combination.
      className="bg-white border border-[#E8E8E9] rounded-[8px] pt-[12px] px-[12px] pb-[20px] w-[376px] max-w-full"
      style={{
        boxShadow:
          '0px 1px 8px 0px rgba(27,27,32,0.12), 0px 3px 4px 0px rgba(27,27,32,0.14)',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
    >
      {/* Inner column fills whatever width the (capped) outer card got
          so the heading / button / preview block all reflow together
          rather than the column staying at 352 px and overflowing the
          card on narrow viewports. */}
      <div className="flex flex-col gap-[16px] items-start w-full">
        {/* Preview block — lavender plate behind a slightly inset
            outlined rectangle, with a centered plus glyph.  This is a
            visual hint, not interactive — the click target is the
            button below. */}
        <div className="relative h-[167px] w-full">
          <div className="absolute inset-0 bg-[#EDEAFF] rounded-[4px]" />
          <div
            // Inner frame — 304 × 119, centered inside the lavender
            // plate.  Border in #DBD6FF (the primary tint_80 token);
            // matches Figma 1393:411080.
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[304px] h-[119px] border border-[#DBD6FF] rounded-[4px]"
          />
          {/* Plus glyph — 32 × 32 stroke icon centered over the inner
              frame.  Stroke uses primary/tint_50 (#A69AFF) for a soft
              "ghost" feel rather than the full-strength brand purple. */}
          <svg
            width={32}
            height={32}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="#A69AFF"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Text block — title + subtitle, 2 px gap, 38 px overall
            (Figma 1393:411098). */}
        <div className="flex flex-col gap-[2px] w-full">
          <p className="text-[16px] leading-[22px] font-medium text-[#201E24]">
            Add to board
          </p>
          <p
            className="text-[12px] leading-[16px] text-[#4C4B4F]"
            style={{ letterSpacing: '0.3px' }}
          >
            Get started with a report, text, or media module.
          </p>
        </div>

        {/* Primary button — full-width, brand purple, pill shape, 32 px
            tall.  Matches the Figma button token (1393:411091). */}
        <button
          type="button"
          onClick={onAddFirstModule}
          className="w-full h-[32px] flex items-center justify-center bg-[#4D36FF] hover:bg-[#3D2BCC] active:bg-[#2D1FA8] rounded-[40px] transition-colors"
        >
          <span className="text-[14px] leading-[14px] font-medium text-white">
            Add first module
          </span>
        </button>
      </div>
    </div>
  );
}
