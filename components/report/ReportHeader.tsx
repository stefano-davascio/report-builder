'use client';

import { useState, useRef, useEffect } from 'react';
import {
  IconClose,
  IconPencil,
  IconEdit,
  IconMoreVertical,
  IconExternalLink,
} from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

/**
 * Top header for the report-detail page. Two strict variants, sourced
 * from Figma:
 *
 *   • View mode  → 1371:347757
 *     ─ White background.
 *     ─ LEFT: Close X + ReportTitleInput (title text + pencil edit icon).
 *     ─ RIGHT: primary "Edit report" button (pencil leading icon) →
 *              secondary "Share" button (external_link leading icon) →
 *              1×24 divider → 40×40 kebab (more_vertical).
 *
 *   • Edit mode  → 1373:370662
 *     ─ Background swaps to PRIMARY/primary--tint_90 (#EDEAFF) — this is
 *       the SOLE chrome cue that the canvas below is mutable; subtle,
 *       brand-aligned, and zero text overhead.
 *     ─ LEFT: ReportTitleInput ONLY. The close X is *removed* — exiting
 *       edit mode is now an explicit Cancel/Save decision, not a soft
 *       "back to reports" gesture.
 *     ─ RIGHT: "You're currently editing" status copy in BRAND/primary
 *              (NOT neutral gray) → "Cancel" pill → "Save" pill. NO
 *              divider, NO kebab — both are view-mode-only chrome.
 *
 * Why hide the divider + kebab in edit mode: they only host overflow
 * actions on a published report (rename, duplicate, delete, share by
 * link, etc.), all of which are nonsensical mid-edit. Pulling them out
 * keeps the rail focused on Cancel/Save.
 */
interface ReportHeaderProps {
  title: string;
  isEditMode: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTitleChange: (title: string) => void;
  /** Close-icon click — wires the builder back to the reports landing
   *  page. Optional so the component still works in isolation. Only
   *  rendered in view mode (see Figma 1371:347757 vs 1373:370662). */
  onClose?: () => void;
  /** Share affordance on the view-mode header. Optional — when omitted
   *  the button still renders for visual parity with the design but is
   *  a no-op. Wire this once the share surface lands. */
  onShare?: () => void;
}

export function ReportHeader({
  title,
  isEditMode,
  onEdit,
  onSave,
  onCancel,
  onTitleChange,
  onClose,
  onShare,
}: ReportHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitleDraft(title); }, [title]);

  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTitle]);

  const handleTitleSubmit = () => {
    const newTitle = titleDraft.trim() || title;
    onTitleChange(newTitle);
    setTitleDraft(newTitle);
    setEditingTitle(false);
  };

  return (
    <header
      className={cn(
        'border-b border-[#E8E8E9] h-14 px-6 flex items-center justify-between flex-shrink-0 transition-colors',
        // PRIMARY/primary--tint_90 cue for edit mode (Figma 1373:371102),
        // white for the standard view-mode chrome (Figma 1371:348190).
        isEditMode ? 'bg-[#EDEAFF]' : 'bg-white',
      )}
    >
      {/* ─── Left rail ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Close / back icon — view-mode only. Figma 1371:348202.
            Edit mode (1373:371112) renders ONLY the title input on the
            left; the close X disappears so the user has to commit via
            Cancel/Save. */}
        {!isEditMode && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to reports"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F3F3F4] transition-colors text-[#4C4B4F]"
          >
            <IconClose size={20} color="#201E24" />
          </button>
        )}

        {/* ReportTitleInput — same component in both modes (Figma 288:2825).
            px-16 py-8, rounded-4. Gap between title and pencil is 8 px
            (NOT the 16 px shown on the design's container token) — the
            tighter spacing in the actual Figma render reads visibly
            below the canonical `--spacings/16`, so we follow the render
            over the token. */}
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-[4px] transition-colors cursor-pointer group',
            // Hover wash adapts to the surface color — neutral gray on
            // white, white-on-purple on the edit-mode tint so the chip
            // stays legible against the #EDEAFF background.
            isEditMode ? 'hover:bg-white' : 'hover:bg-[#F3F3F4]',
          )}
          onClick={() => { if (!editingTitle) { setTitleDraft(title); setEditingTitle(true); } }}
        >
          {editingTitle ? (
            <input
              ref={inputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') { setTitleDraft(title); setEditingTitle(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-[16px] font-medium text-[#201E24] border-none outline-none bg-transparent min-w-[120px] max-w-[288px] leading-[22px]"
            />
          ) : (
            // Title color is BRAND/dark `#201E24` for entered values
            // (the Figma file shows `#4C4B4F` because the master
            // component renders the "Untitled report" placeholder
            // state — see `ReportTitleInput.property1=default`. For an
            // actual title the heading color tier applies).
            <span className="text-[16px] font-medium text-[#201E24] leading-[22px] max-w-[288px] truncate">
              {title}
            </span>
          )}
          {/* Pencil rename affordance — Figma 283:2740 wrapper, 14-px
              `rename` glyph (IconPencil). Stroke override
              `[&_path]:[stroke-width:1.33]` — Figma renders this
              glyph at ~1.33 px stroke at 14-tile.  Since the icon
              library now uses `vector-effect: non-scaling-stroke`,
              the value is interpreted in CSS pixels directly (no
              viewBox scaling), so we set 1.33 literally instead of
              the previous 2.25 viewBox-units that pre-compensated
              for a 14/24 scale-down.  The lib default of 1.5 would
              also be acceptable here but a touch heavier than spec. */}
          <button
            onClick={(e) => { e.stopPropagation(); setTitleDraft(title); setEditingTitle(true); }}
            className="w-6 h-6 flex items-center justify-center flex-shrink-0 cursor-pointer"
            aria-label="Rename report"
          >
            <IconPencil
              size={14}
              color="#201E24"
              className="[&_path]:[stroke-width:1.33]"
            />
          </button>
        </div>
      </div>

      {/* ─── Right rail ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        {isEditMode ? (
          <>
            {/* "You're currently editing" — Figma 1373:371106. BRAND/primary
                #4D36FF, 14 Regular leading 21. NOT a neutral gray status
                line: this color is what reinforces the purple-tinted
                surface and signals "everything you do here is staged". */}
            <span
              className="text-[14px] text-[#4D36FF] leading-[21px]"
              style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              You&rsquo;re currently editing
            </span>
            <div className="flex items-center gap-4">
              {/* Cancel — Figma 1373:371108. h-32 px-12 py-8, rounded-40,
                  translucent white fill + hairline dark border. Hover
                  uses DARK/dark--alpha_05 (`rgba(32,30,36,0.05)`) so the
                  pill darkens slightly against the purple-tint surface
                  rather than going pure white (which would compete with
                  the Save CTA's value contrast). */}
              <button
                onClick={onCancel}
                className="h-8 px-3 text-[14px] font-medium text-[#363439] bg-[rgba(255,255,255,0.1)] border border-[rgba(32,30,36,0.05)] rounded-[40px] hover:bg-[rgba(32,30,36,0.05)] transition-colors"
              >
                Cancel
              </button>
              {/* Save — Figma 1373:371109. h-32 px-24 py-8 (wider than
                  Cancel because it's the primary CTA), BRAND/primary
                  fill, white label. */}
              <button
                onClick={onSave}
                className="h-8 px-6 text-[14px] font-medium text-white bg-[#4D36FF] rounded-[40px] hover:bg-[#3D28E8] transition-colors"
              >
                Save
              </button>
            </div>
            {/* NB: NO divider + NO kebab in edit mode. Figma 1373:371102
                drops both — they're view-mode-only chrome. */}
          </>
        ) : (
          <>
            {/* Edit report — Figma 1371:348198. h-32 px-12 py-8 rounded-40
                with a 16×16 `edit` leading icon (IconEdit — pencil ON a
                rectangle, Figma 1133:104422) + label. NOT IconPencil
                (the freestanding pencil is the rename glyph used by the
                title chip). Narrower than Save (px-12 vs px-24) — do NOT
                inherit Save's padding. */}
            <button
              onClick={onEdit}
              className="flex items-center gap-[6px] h-8 px-3 text-[14px] font-medium text-white bg-[#4D36FF] rounded-[40px] hover:bg-[#3D28E8] transition-colors"
            >
              <IconEdit size={16} color="white" />
              Edit report
            </button>
            {/* Share — Figma 1371:348316. Secondary pill paired with the
                primary Edit report. Same h-32 / rounded-40 / leading-icon
                shape, but uses the muted bg `rgba(255,255,255,0.1)` and
                the hairline `rgba(32,30,36,0.05)` border so it reads as
                a quiet companion rather than a competing CTA. The glyph
                is `external_link` (boxed frame + escaping arrow), not
                the social share-fan — same icon used in the row action
                menu's Share item. */}
            <button
              onClick={onShare}
              className="flex items-center gap-[6px] h-8 px-3 text-[14px] font-medium text-[#363439] bg-[rgba(255,255,255,0.1)] border border-[rgba(32,30,36,0.05)] rounded-[40px] hover:bg-[#F3F3F4] transition-colors"
            >
              <IconExternalLink size={16} color="#363439" />
              Share
            </button>
            {/* Trailing affordances — Figma 1371:348199 (divider) +
                1371:348200 (kebab). Both are view-mode-only; edit mode
                drops them entirely. */}
            <span className="w-px h-6 bg-[#E8E8E9]" aria-hidden="true" />
            <button
              aria-label="More report actions"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F3F3F4] transition-colors text-[#4C4B4F]"
            >
              <IconMoreVertical size={20} color="#201E24" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
