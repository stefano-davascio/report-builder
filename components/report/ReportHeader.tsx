'use client';

import { useState, useRef, useEffect } from 'react';
import {
  IconClose,
  IconCloseCircle,
  IconPencil,
  IconEdit,
  IconMoreVertical,
  IconExternalLink,
  IconPrinter,
} from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';
import { DropdownSurface, DropdownItem, DropdownSeparator } from './ModuleActions';

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
  /** Share action — now lives inside the more-actions dropdown
   *  (Figma decision: free the header rail of standalone Share so the
   *  kebab carries the canonical surface).  Optional; no-op when
   *  omitted. */
  onShare?: () => void;
  /** Print action — also lives inside the more-actions dropdown.
   *  Optional; falls back to `window.print()` when omitted so the
   *  affordance still produces a useful result without parent wiring. */
  onPrint?: () => void;
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
  onPrint,
}: ReportHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  // More-actions dropdown state.  `moreBtnRef` anchors the portaled
  // DropdownSurface; the outside-click handler closes the menu when
  // the user mousedowns anywhere that isn't the button or the
  // surface itself (the surface carries `data-module-dropdown` /
  // `data-text-overflow-menu` attrs that DropdownSurface uses as
  // its "inside" markers).
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (moreBtnRef.current && moreBtnRef.current.contains(target)) return;
      if (target.closest('[data-module-dropdown="true"]')) return;
      setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreMenuOpen]);

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

        {/* ReportTitleInput — Figma 489:11557 covers all four states:
              • Default  (489:11559) — no bg / no border, px-16 py-8.
              • Hover    (489:11560) — bg-[#F3F3F4] added.
              • Clicked  (489:11561) — bg-[#F3F3F4] + 1-px brand-purple
                                       border, py bumps to 9 to absorb
                                       the border thickness; pencil
                                       hidden; selected text on
                                       #C9C2FF wash.
              • Typing   (489:11562) — same chrome as Clicked; caret in
                                       #4D36FF, pencil still hidden.
            Switching `editingTitle` flips between the {Default+Hover}
            cluster and the {Clicked+Typing} cluster — the per-cluster
            differences (hover wash, caret showing) are pure browser
            behaviour. */}
        <div
          className={cn(
            'flex items-center gap-2 px-4 rounded-[4px] transition-colors max-w-[288px]',
            editingTitle
              // Clicked / Typing.  py-[9px] (vs default's py-2/8) so
              // the outer height grows by ~4 px when active — the
              // design intentionally enlarges the click target to
              // signal mutability; box-sizing keeps the border inside
              // the padding box so the text doesn't visibly shift.
              ? 'py-[9px] bg-[#F3F3F4] border border-[#4D36FF]'
              : cn(
                  // Default + Hover.  Hover wash adapts to the
                  // surface color — neutral grey on white,
                  // white-on-purple against the edit-mode tint.
                  'py-2 cursor-pointer group',
                  isEditMode ? 'hover:bg-white' : 'hover:bg-[#F3F3F4]',
                ),
          )}
          onClick={() => { if (!editingTitle) { setTitleDraft(title); setEditingTitle(true); } }}
        >
          {editingTitle ? (
            // Caret + selection mirror Figma 489:11561 / 489:11562:
            //   • caret: BRAND/primary `#4D36FF` (Typing state).
            //   • selection: PRIMARY/primary--tint_70 `#C9C2FF`
            //     wash + dark text (Clicked state).
            // The pencil button is intentionally NOT rendered in the
            // editing branch — Figma drops it from the Clicked /
            // Typing variants so the active title reads as a clean
            // text field rather than a chip with an extra glyph.
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
              // `field-sizing: content` makes the input shrink-to-fit
              // the typed value (Figma 489:11562 Typing state shows
              // the chip narrowing to `w-[16px]` for just "E|") while
              // still respecting `max-w-[288px]` for runaway titles.
              // `size={1}` is the HTML fallback minimum so the input
              // doesn't collapse to zero when empty in browsers
              // without `field-sizing` support (Safari < 17.4).
              size={1}
              className={cn(
                'text-[16px] font-medium text-[#201E24] border-none outline-none bg-transparent',
                'text-left max-w-[288px] leading-[22px]',
                '[field-sizing:content]',
                'caret-[#4D36FF] selection:bg-[#C9C2FF] selection:text-[#201E24]',
              )}
            />
          ) : (
            <>
              {/* Title color is BRAND/dark `#201E24` for entered
                  values (the Figma file shows `#4C4B4F` because the
                  master component renders the "Untitled report"
                  placeholder state — see
                  `ReportTitleInput.property1=default`. For an actual
                  title the heading color tier applies). */}
              <span className="text-[16px] font-medium text-[#201E24] leading-[22px] max-w-[288px] truncate">
                {title}
              </span>
              {/* Pencil rename affordance — Figma 283:2740 wrapper,
                  14-px `rename` glyph (IconPencil).  Renders at
                  library default stroke-width (1.5).  Was 1.33 to
                  match Figma's exact spec, but sub-1.5 strokes
                  with `non-scaling-stroke` render faded on DPR=1
                  displays. */}
              <button
                onClick={(e) => { e.stopPropagation(); setTitleDraft(title); setEditingTitle(true); }}
                className="w-6 h-6 flex items-center justify-center flex-shrink-0 cursor-pointer"
                aria-label="Rename report"
              >
                <IconPencil
                  size={14}
                  color="#201E24"
                />
              </button>
            </>
          )}
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
            {/* More-actions kebab — Figma 1371:348200.  The standalone
                Share button + adjacent divider were folded into this
                dropdown so the header rail stays focused on
                "Edit report" as the single visible CTA in view mode.
                Share + Print live inside the menu; future overflow
                actions (Duplicate, Delete, Rename, etc.) join here. */}
            <button
              ref={moreBtnRef}
              aria-label="More report actions"
              aria-expanded={moreMenuOpen}
              aria-haspopup="menu"
              onClick={() => setMoreMenuOpen((v) => !v)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F3F3F4] transition-colors text-[#4C4B4F]"
            >
              <IconMoreVertical size={20} color="#201E24" />
            </button>
            {moreMenuOpen && (
              <DropdownSurface anchorRef={moreBtnRef}>
                <DropdownItem
                  icon={<IconExternalLink size={20} />}
                  label="Share"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onShare?.();
                  }}
                />
                <DropdownItem
                  icon={<IconPrinter size={20} />}
                  label="Print"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    // Fall back to a native print dialog when the
                    // parent hasn't wired a custom handler — this
                    // keeps the surface useful without forcing every
                    // call site to pass an `onPrint`.
                    if (onPrint) onPrint();
                    else if (typeof window !== 'undefined') window.print();
                  }}
                />
                {/* Hairline separates Share + Print (in-report
                    affordances) from Close (a destructive-ish exit
                    action), matching Figma 1975:55513. */}
                <DropdownSeparator />
                {/* Close — third menu item, mirrors the close-X icon
                    at the far-left of the header so users have two
                    entry points (icon + overflow menu) to leave the
                    report.  No-op when no `onClose` is wired (the
                    icon-X stays inactive in that case too). */}
                <DropdownItem
                  icon={<IconCloseCircle size={20} />}
                  label="Close"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onClose?.();
                  }}
                />
              </DropdownSurface>
            )}
          </>
        )}
      </div>
    </header>
  );
}
