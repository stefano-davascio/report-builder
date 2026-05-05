'use client';

/**
 * One report row in the landing-page table — Figma 830:44421.
 *
 * Visual contract (per corrections vs. earlier pass):
 *   • h-56, border-b 1-px #F3F3F4 (lighter than the earlier #E8E8E9
 *     attempt — matches the Figma underline tone). Last row drops
 *     the border.
 *   • Hover bg #FAFAFA (subtle); pencil icon 16 #363439 reveals next
 *     to the name ONLY on hover. The 3-dot kebab is ALWAYS visible
 *     (Figma row 830:44421 shows the kebab on every row, hovered or
 *     not — only the inline-with-name pencil is hover-gated).
 *   • Five columns:
 *       Name      flex-1 min-w-[420px]
 *       Modified  flex-1 min-w-[220px]   ← relative time ("2 hours ago")
 *       Modules   flex-1 min-w-[120px]   ← integer count of modules
 *       Networks  flex-1 min-w-[274px]   ← brand-icon stack (no header)
 *       Actions   w-[80px]               ← right-aligned 3-dot kebab
 *   • Premium chip is YELLOW (#FFF3CD bg / #806104 text) with a
 *     leading IconPremiumDiamond — Figma uses an amber treatment, NOT
 *     the brand purple.
 *   • Renaming state — name cell becomes a bare inline input with a
 *     simple text-decoration:underline (no wash bg). Auto-focus +
 *     select-all; Enter / blur saves; Escape reverts.
 */

import { KeyboardEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { MockReport, formatModifiedAt } from '@/lib/reports-data';
import { IconPencil, IconPremiumDiamond } from '@/components/icons/SendiIcons';
import { ModuleIconStack } from './ModuleIconStack';
import { ActionMenu, ReportAction } from './ActionMenu';
import { cn } from '@/lib/utils';

interface ReportRowProps {
  report: MockReport;
  isLast: boolean;
  /** Capability flag — when false, the hover-revealed pencil button
   *  beside the name is suppressed AND the action menu's `Rename` row
   *  is hidden (gated downstream in ActionMenu via `renameEnabled`).
   *  All rename machinery (state, input, commit/cancel handlers) is
   *  preserved so flipping the flag back on restores the full flow
   *  with no code changes.  Defaults to false (production scope). */
  renameEnabled?: boolean;
  /** Force the row into rename mode (e.g. from the action menu). */
  renaming: boolean;
  onStartRename: () => void;
  onCommitRename: (next: string) => void;
  onCancelRename: () => void;
  onOpen: () => void;
  onAction: (action: ReportAction) => void;
}

// Column class map. Exported so the table header can keep its columns
// in lockstep with the body rows without a second source of truth.
// Column proportions read from Figma 830:44519: Name 420 / Date 220 /
// Modules 120 / Networks 274 / Actions 80 (sum = 1114, the content
// column width). The row container has NO outer padding and NO gap
// between cells — Figma puts those widths edge-to-edge — so the Name
// cell carries its own `pl-[16px]` for the leading-edge breathing
// space (matches Figma 830:44557's `left-[16px]` text inset).
export const REPORT_ROW_COLUMNS = {
  name: 'flex-1 min-w-[420px] pl-[16px]',
  date: 'flex-1 min-w-[220px]',
  modules: 'flex-1 min-w-[120px]',
  // Networks: Figma 830:44565 nests the brand-icon stack at `left-[91px]`
  // inside the 274-px cell — i.e. an explicit 91-px leading inset, NOT
  // a flush-left rendering. Bake that offset into the column class so
  // both the body row AND the (empty) column header stay in lockstep.
  networks: 'flex-1 min-w-[274px] pl-[91px]',
  actions: 'w-[80px] flex-shrink-0',
};

const COL = REPORT_ROW_COLUMNS;

export function ReportRow({
  report,
  isLast,
  renameEnabled = false,
  renaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onOpen,
  onAction,
}: ReportRowProps) {
  const [hovered, setHovered] = useState(false);
  const [draft, setDraft] = useState(report.name);
  // `mounted` flips to true after first client paint so the relative
  // date label can render without diverging from the SSR HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync the draft whenever rename mode flips on — guarantees the
  // input opens with the current name even if the parent's state has
  // shifted between two rename cycles.
  useEffect(() => {
    if (renaming) {
      setDraft(report.name);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [renaming, report.name]);

  const commit = () => {
    const next = draft.trim();
    if (next.length > 0 && next !== report.name) onCommitRename(next);
    else onCancelRename();
  };

  const handleInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelRename();
    }
  };

  const handleRowClick = () => {
    if (renaming) return;
    onOpen();
  };

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={handleRowClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        // Per Figma 830:44555 cells sit FLUSH (no gap, no outer padding);
        // each column is exactly its min-width so the row sums to 1114.
        // The Name cell carries its own `pl-16` for content breathing
        // space — see comment on the Name cell below.
        'flex items-center h-[56px] cursor-pointer transition-colors',
        !isLast && 'border-b border-[#F3F3F4]',
        (hovered || renaming) && 'bg-[#FAFAFA]',
      )}
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {/* Name cell. `COL.name` already provides the leading
          `pl-[16px]` (since the row container is flush — no gap, no
          outer padding — and cells sit edge-to-edge). DO NOT add
          `min-w-0` here: it overrides COL.name's `min-w-[420px]` and
          collapses the cell, shifting every other column LEFT vs. the
          header. Truncation lives on the nested wrapper. */}
      <div className={cn(COL.name, 'flex items-center gap-[8px]')}>
        {renaming ? (
          <div
            className="relative inline-flex items-center min-w-0 max-w-full"
            onClick={stop}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={handleInputKey}
              className={cn(
                'h-[24px] px-0 outline-none border-none bg-transparent',
                'text-[14px] leading-[21px] text-[#201E24]',
                // Override the browser-default blue text-selection wash
                // with the brand-purple tint used in Figma when the
                // rename input opens with all text pre-selected.
                'selection:bg-[rgba(77,54,255,0.10)] selection:text-[#201E24]',
              )}
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                textDecorationColor: '#D2D2D3',
                minWidth: 80,
                width: `${Math.max(draft.length, 6) + 2}ch`,
                maxWidth: '100%',
              }}
            />
          </div>
        ) : (
          <>
            {/* Inner wrapper carries the `min-w-0` truncation context
                so the SPAN can shrink + ellipsis, while the OUTER cell
                still respects `COL.name`'s min-width and stays in
                column lockstep with the header. NO `flex-1` here —
                otherwise the wrapper inflates to fill the 420-px cell
                and pushes the trailing pencil button to the cell's
                right edge, far from the report name. */}
            <div className="flex items-center gap-[8px] min-w-0">
              <span className="text-[14px] leading-[21px] text-[#201E24] truncate">
                {report.name}
              </span>
              {report.premium && (
                <span
                  className={cn(
                    'h-[20px] pl-[6px] pr-[8px] rounded-[4px] flex items-center gap-[4px] flex-shrink-0',
                    'bg-[#FFF3CD] text-[12px] leading-[16px] font-medium text-[#806104]',
                  )}
                  aria-label="Premium report"
                >
                  <IconPremiumDiamond size={12} color="#806104" />
                  <span>Premium</span>
                </span>
              )}
            </div>
            {hovered && renameEnabled && (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onStartRename();
                }}
                aria-label="Rename report"
                // Bare-glyph affordance (no chip background), but it
                // still needs to FEEL clickable — `cursor-pointer` for
                // the pointer change on hover and a subtle ink darken
                // (`hover:[&_path]:stroke-[#201E24]`) so the pencil
                // visibly responds when the user is about to click it.
                className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 cursor-pointer hover:[&_path]:stroke-[#201E24] transition-colors"
              >
                <IconPencil
                  size={16}
                  color="#363439"
                  className="[&_path]:[stroke-width:1.5]"
                />
              </button>
            )}
          </>
        )}
      </div>

      {/* Modified — relative-time label ("just now", "2 hours ago",
          "1 day ago", "3 weeks ago"…) keyed off `report.modifiedAt`.
          Formatting depends on `Date.now()`, which differs between SSR
          and client (the server module loads at build time but the user
          hydrates minutes later). To avoid a hydration mismatch we
          render the formatted label only after mount; SSR emits an
          empty string and `suppressHydrationWarning` tells React the
          brief client-side text swap is intentional. */}
      <div
        suppressHydrationWarning
        className={cn(COL.date, 'text-[14px] leading-[21px] text-[#626165] truncate')}
      >
        {mounted ? formatModifiedAt(report.modifiedAt) : ''}
      </div>

      {/* Modules — integer count of modules in the report (5, 6, 12…),
          NOT a network glyph. The Networks column below renders the
          actual social-network brand icons. */}
      <div className={cn(COL.modules, 'text-[14px] leading-[21px] text-[#201E24] tabular-nums')}>
        {report.modules.length}
      </div>

      {/* Networks — header is intentionally empty per Figma 830:44421;
          the brand-color glyphs in this cell make the column self-evident.
          `ModuleIconStack` renders one 20-px brand icon per platform the
          report uses, with a "+N" overflow chip when there are more than
          fit (matching the Cross-platform row's "facebook | ig | bluesky | +1"). */}
      <div className={cn(COL.networks, 'flex items-center')}>
        <ModuleIconStack networks={report.networks} />
      </div>

      {/* Actions — Figma 836:44713 centers the kebab in the 80-px cell
          (left-[22px] + 36-px footprint + 22-px right gutter), NOT flush
          to the trailing edge. `justify-center` reproduces that with our
          32-px button: (80 − 32) / 2 = 24 px breathing space per side,
          matching Figma's intent within a single px. */}
      <div className={cn(COL.actions, 'flex items-center justify-center')} onClick={stop}>
        <ActionMenu onAction={onAction} renameEnabled={renameEnabled} />
      </div>
    </div>
  );
}
