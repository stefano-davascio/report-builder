'use client';

/**
 * Filter dropdown for the Reports table — Figma 836:45375 + 797:42255.
 *
 * Drill-in pattern (NOT a flat checkbox list):
 *   1. Trigger opens a 224-px menu listing the four categories
 *      ("Network", "User", "Profile", "Profile lists"). Each category
 *      row shows a chevron-right disclosure on the trailing edge —
 *      tapping a row drills INTO that category.
 *   2. Inside a category, the menu replaces its content with a "Back"
 *      header (chevron-left + category name) plus a search input and
 *      the option list as toggleable checkboxes. Tapping "Back"
 *      returns to the top-level category list.
 *
 * Selected filters surface upward as chips; this component owns only
 * the dropdown UI and reports `selectedIds` / `onToggle` outward.
 *
 * The trigger render is delegated via `renderTrigger` so the parent
 * (ReportsTable) can reuse the same dropdown surface with a different
 * trigger glyph (e.g. plus-icon "+ Filter" vs. a chevron-led pill).
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import { FilterOption } from '@/lib/reports-data';
import {
  IconChevronDown,
  IconChevronRight,
  IconSearch,
} from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

interface FilterDropdownProps {
  options: FilterOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  /** Optional trigger renderer — receives `(open, selectedCount)`. */
  renderTrigger?: (open: boolean, count: number) => ReactNode;
}

// Profile + Profile lists are hidden from the top-level drill list
// for now — see the matching commented-out rows in
// `FILTER_OPTIONS` (lib/reports-data.ts).  Re-enable in tandem when
// the underlying selection wiring is built.
const CATEGORY_ORDER: FilterOption['category'][] = [
  'Network',
  'User',
];

type Drill = { kind: 'top' } | { kind: 'category'; cat: FilterOption['category'] };

export function FilterDropdown({
  options,
  selectedIds,
  onToggle,
  renderTrigger,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [drill, setDrill] = useState<Drill>({ kind: 'top' });
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Reset the drill state whenever the menu closes so re-opening
  // always lands on the category list, not whatever sub-list was last
  // visited.
  useEffect(() => {
    if (!open) {
      setDrill({ kind: 'top' });
      setQuery('');
    }
  }, [open]);

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

  const count = selectedIds.size;

  // Selection counts per category — surfaced as a "· N" suffix on the
  // top-level category rows so the user can see at a glance which
  // categories already have active filters.
  const countsByCategory: Record<FilterOption['category'], number> = {
    Network: 0,
    User: 0,
    Profile: 0,
    'Profile lists': 0,
  };
  for (const id of selectedIds) {
    const opt = options.find((o) => o.id === id);
    if (opt) countsByCategory[opt.category] += 1;
  }

  // Active sub-list (when drilled in). Filtered by query so the search
  // input narrows only the current category, not the global list.
  const subList =
    drill.kind === 'category'
      ? options.filter(
          (o) =>
            o.category === drill.cat &&
            o.label.toLowerCase().includes(query.toLowerCase()),
        )
      : [];

  return (
    <div
      ref={rootRef}
      className="relative"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          // When `renderTrigger` is provided we render only the
          // child — the parent's trigger styling fully replaces ours.
          renderTrigger
            ? 'inline-flex items-center'
            : cn(
                'h-[32px] px-[12px] rounded-[4px] border border-[#E8E8E9] bg-white',
                'flex items-center gap-[8px] text-[14px] leading-[21px] text-[#363439]',
                'hover:bg-[#F3F3F4] transition-colors',
              ),
        )}
      >
        {renderTrigger ? (
          renderTrigger(open, count)
        ) : (
          <>
            <span>Filter{count > 0 ? ` · ${count}` : ''}</span>
            <IconChevronDown size={16} color="#626165" />
          </>
        )}
      </button>

      {open && (
        // Anchor the menu to the LEADING edge of the trigger
        // (`left-0`). The trigger now sits next to the "Reports" title
        // at the start of the row, so right-anchoring would push the
        // 224-px panel off-screen on the left. Top offset = 36 px =
        // 32-px trigger height + 4-px float gap.
        <div
          // Surface matches the action-menu pattern (Figma 836:45225):
          // rounded-4, py-8, no separate border. The 1-px outline is
          // baked into the shadow as a `0 0 0 1px` ring so we don't
          // double-stack ring + border.
          className="absolute z-20 left-0 top-[36px] w-[224px] rounded-[4px] bg-white py-[8px] overflow-hidden"
          style={{
            boxShadow:
              '0 0 0 1px rgba(32,30,36,0.1), 0 12px 8px -4px rgba(32,30,36,0.15), 0 4px 4px -2px rgba(32,30,36,0.2)',
          }}
        >
          {drill.kind === 'top' ? (
            // ── Top-level category list ──────────────────────────────
            // `px-[8px]` wraps the items so the rounded-4 hover chip
            // sits 8 px clear of the surface edges, matching the
            // ActionMenu treatment (Figma 836:45225).
            <div className="px-[8px] flex flex-col">
              {CATEGORY_ORDER.map((cat) => {
                const c = countsByCategory[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDrill({ kind: 'category', cat })}
                    className={cn(
                      'w-full h-[40px] px-[16px] flex items-center justify-between rounded-[4px]',
                      'text-[14px] leading-[21px] text-[#201E24] text-left',
                      // Brand purple alpha-tint, NOT neutral gray.
                      'hover:bg-[rgba(81,61,217,0.1)] transition-colors cursor-pointer',
                    )}
                  >
                    <span className="flex items-center gap-[8px]">
                      <span>{cat}</span>
                      {c > 0 && (
                        <span className="text-[12px] leading-[18px] text-[#626165]">
                          · {c}
                        </span>
                      )}
                    </span>
                    <IconChevronRight size={14} color="#626165" />
                  </button>
                );
              })}
            </div>
          ) : (
            // ── Drilled-in option list ───────────────────────────────
            <div>
              {/* Back row — same inset + rounded-chip treatment as the
                  category items. The `border-b` rule moved out to a
                  full-width divider sibling below so the inset hover
                  chip doesn't carry the underline with it. */}
              <div className="px-[8px]">
                <button
                  type="button"
                  onClick={() => {
                    setDrill({ kind: 'top' });
                    setQuery('');
                  }}
                  className={cn(
                    'w-full h-[40px] px-[12px] flex items-center gap-[8px] rounded-[4px]',
                    'text-[14px] leading-[21px] font-medium text-[#201E24] text-left',
                    'hover:bg-[rgba(81,61,217,0.1)] transition-colors cursor-pointer',
                  )}
                >
                  <span className="rotate-180 inline-flex">
                    <IconChevronRight size={14} color="#363439" />
                  </span>
                  <span>{drill.cat}</span>
                </button>
              </div>
              {/* Full-width divider below the back row — flush to the
                  surface edges (no horizontal gutter), 8 px breathing
                  rhythm above and below. */}
              <div className="pt-[8px] pb-[8px]">
                <div className="h-px bg-[#D2D2D3]" />
              </div>

              <div className="px-[12px] pb-[8px]">
                <label
                  className={cn(
                    'flex items-center gap-[8px] h-[32px] rounded-[4px]',
                    'border border-[#E8E8E9] px-[8px]',
                  )}
                >
                  <IconSearch size={16} color="#626165" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    className="w-full bg-transparent outline-none text-[14px] leading-[21px] text-[#201E24] placeholder:text-[#626165]"
                  />
                </label>
              </div>

              <div className="max-h-[280px] overflow-y-auto pb-[8px] px-[8px]">
                {subList.length === 0 ? (
                  <div className="px-[16px] py-[12px] text-[12px] leading-[18px] text-[#626165]">
                    No matches.
                  </div>
                ) : (
                  subList.map((o) => {
                    const checked = selectedIds.has(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onToggle(o.id)}
                        className={cn(
                          'w-full h-[40px] px-[16px] flex items-center gap-[12px] rounded-[4px]',
                          'text-[14px] leading-[21px] text-[#201E24] text-left',
                          'hover:bg-[rgba(81,61,217,0.1)] transition-colors cursor-pointer',
                        )}
                      >
                        {/* Checkbox — square 16, rounded-2, brand
                            primary when checked. Inline rather than
                            the larger module-catalog Checkbox so it
                            sizes to this menu's 16-px footprint. */}
                        <span
                          className={cn(
                            'w-[16px] h-[16px] rounded-[2px] flex items-center justify-center flex-shrink-0',
                            checked
                              ? 'bg-[#4D36FF] border border-[#4D36FF]'
                              : 'bg-white border border-[#C4C3C6]',
                          )}
                          aria-hidden="true"
                        >
                          {checked && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              fill="none"
                            >
                              <path
                                d="M2 5L4 7L8 3"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{o.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
