'use client';

/**
 * Row-level 3-dot action menu — Figma 701:34671 + 836:45225.
 *
 * Trigger:
 *   • 32 × 32 button, rounded-6, IconMoreVertical 20 #363439 (vertical
 *     kebab — NOT the horizontal more glyph used in the report-builder
 *     module headers).
 *   • Hover bg rgba(32,30,36,0.05).
 *   • ALWAYS visible (Figma row 830:44421 shows the kebab on every row,
 *     not only the hovered one).
 *
 * Surface — Figma 836:45225 ("Dropdown / Image"):
 *   • 168-px wide (up from 152 to comfortably seat the new px-16 item
 *     inset + px-8 outer gutter), rounded-4, bg #FFF, py-8.
 *   • NO border element — the 1-px outline is baked into the shadow as
 *     `0 0 0 1px rgba(32,30,36,0.1)` so we don't double-stack ring +
 *     border. Plus the canonical Floating shadow:
 *       0 12 8 -4 rgba(32,30,36,0.15) +
 *       0 4 4 -2 rgba(32,30,36,0.2).
 *
 * Items — `Dropdown / Components` (836:45228 etc):
 *   • Each item lives inside an `px-[8px]` group so the hover chip is
 *     INSET 8 px from the surface edges (NOT full-width).
 *   • h-40, px-16, gap-16 between leading icon and label, rounded-4.
 *   • Hover bg = `rgba(81,61,217,0.1)` (the PRIMARY purple alpha-tint),
 *     NOT a neutral gray.
 *   • Icons render at 20 px (Figma's spec for this menu — bigger than
 *     the 16-tile we used elsewhere).
 *   • Open       → IconArrowUpRight (the diagonal launch glyph)
 *     Share      → IconExternalLink (boxed frame + escaping arrow —
 *                  the canonical "opens elsewhere" glyph from Figma's
 *                  Navigation icon set, NOT the social share-fan)
 *     Rename     → IconPencil
 *     Duplicate  → IconCopy
 *     Delete     → IconTrash, label color BLACK #201E24 (NOT a red
 *                  destructive tint), with the divider above.
 *
 * Divider:
 *   • 1-px `#D2D2D3` line, FLUSH to the surface edges (no horizontal
 *     gutter — sits under both `px-8` groups, edge-to-edge), with
 *     `py-[8px]` rhythm above and below.
 */

import { useEffect, useRef, useState } from 'react';
import {
  IconMoreVertical,
  IconArrowUpRight,
  IconPencil,
  IconCopy,
  IconTrash,
  IconExternalLink,
} from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

export type ReportAction = 'open' | 'share' | 'rename' | 'duplicate' | 'delete';

interface ActionMenuProps {
  onAction: (action: ReportAction) => void;
}

interface ItemDef {
  action: ReportAction;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  /** Render a 1-px divider ABOVE this item — used to separate Delete. */
  dividerAbove?: boolean;
}

const ITEMS: ItemDef[] = [
  { action: 'open',      label: 'Open',      Icon: IconArrowUpRight },
  // `Share` sits directly below `Open` — both are read-only "send the
  // user somewhere else with this report" affordances, so they group
  // visually before the mutating actions (Rename / Duplicate / Delete).
  // Glyph is `external_link` (boxed frame + escaping arrow) rather than
  // the social share-fan: the row-menu Share routes the user OUT to a
  // share surface, so the "opens elsewhere" metaphor reads better.
  { action: 'share',     label: 'Share',     Icon: IconExternalLink },
  { action: 'rename',    label: 'Rename',    Icon: IconPencil },
  { action: 'duplicate', label: 'Duplicate', Icon: IconCopy },
  { action: 'delete',    label: 'Delete',    Icon: IconTrash, dividerAbove: true },
];

export function ActionMenu({ onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Report actions"
        className={cn(
          'w-[32px] h-[32px] rounded-[6px] flex items-center justify-center transition-colors',
          'hover:bg-[rgba(32,30,36,0.05)]',
          open && 'bg-[rgba(32,30,36,0.05)]',
        )}
      >
        <IconMoreVertical size={20} color="#363439" />
      </button>

      {open && (
        <div
          className="absolute z-30 right-0 top-[36px] w-[168px] rounded-[4px] bg-white py-[8px] overflow-hidden"
          style={{
            // Combined ring + Floating shadow — the first layer is the
            // 1-px outline (replaces the old `border` rule), the next
            // two are Figma's Floating-elevation drop shadows.
            boxShadow:
              '0 0 0 1px rgba(32,30,36,0.1), 0 12px 8px -4px rgba(32,30,36,0.15), 0 4px 4px -2px rgba(32,30,36,0.2)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {ITEMS.map((it) => {
            const Icon = it.Icon;
            return (
              <div key={it.action}>
                {/* Divider — flush to the surface edges (NO horizontal
                    gutter), 8 px breathing above and below. */}
                {it.dividerAbove && (
                  <div className="py-[8px]">
                    <div className="h-px bg-[#D2D2D3]" />
                  </div>
                )}
                {/* `px-[8px]` wrapper insets the hover chip from the
                    surface edges so the rounded-4 wash floats INSIDE
                    the menu rather than touching the outline. */}
                <div className="px-[8px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onAction(it.action);
                    }}
                    className={cn(
                      'w-full h-[40px] px-[16px] flex items-center gap-[16px] rounded-[4px]',
                      'text-[14px] leading-[21px] tracking-[0.07px] text-[#201E24] text-left',
                      // PRIMARY purple alpha-tint, not neutral gray.
                      'hover:bg-[rgba(81,61,217,0.1)] transition-colors',
                      'cursor-pointer',
                    )}
                  >
                    <Icon size={20} color="#201E24" />
                    <span>{it.label}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
