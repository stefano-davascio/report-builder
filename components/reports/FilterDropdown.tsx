'use client';

/**
 * Filter dropdown for the Reports table — Figma 797:42255 + 1670:42280 +
 * 1674:43486 / 44025 / 42816 / 44394 / 44910 + 1678:75322 + 1678:76115.
 *
 * Visual contract (re-verified against the latest Figma frames):
 *
 *   ┌──────────────────┐                        ┌──────────────────┐
 *   │ [icon] Search…   │  TOP-LEVEL  →          │ [icon] Network   │  SUBMENU
 *   ├──────────────────┤  click Network/User    ├──────────────────┤  Network/User
 *   │ Network        › │   row drills RIGHT     │ ☑ [icon] Facebook│  search +
 *   │ User           › │  into a 200-px sub-    │ ☐ [icon] TikTok  │  checkbox list
 *   └──────────────────┘  selector that sits    │     …            │  + Select all
 *                         next to the parent.   │     Select all   │  link at
 *                                               └──────────────────┘  bottom-right
 *
 * Submenu placement: the parent panel STAYS VISIBLE while the user
 * drills in.  The submenu opens to the RIGHT of the parent
 * (`left: 100% + 4px`), aligned to the parent's top edge.  The Network /
 * User row in the parent gets an "active" tint while its submenu is
 * open so the user can see which category they're inside.
 *
 * Typing in the parent's search input flips the body into a
 * suggestions list (structured matches + a trailing
 * "Name contains: '<query>'" fallback) — that's the 1670:42280 state.
 *
 * The Name-contains editor (1674:44910) renders STANDALONE — no parent
 * panel — when `view = 'name-edit'`.  This matches the chip-click
 * editor flow.
 *
 * IMPORTANT: this component does NOT own filter state.  It's a
 * controlled view of `selectedNetworks`, `selectedUsers`, and
 * `nameContains`.  All persistence lives upstream so closing the
 * dropdown doesn't lose work-in-progress filters.
 */

import {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { Platform } from '@/types';
import { PlatformIcon } from '@/components/report/PlatformIcon';
import { IconChevronRight, IconSearch } from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────

export interface FilterUser {
  id: string;
  label: string;
  /** Two-letter glyph for the trailing avatar tile (used in chips —
   *  per Figma 1678:76115 the User submenu list does NOT show avatars,
   *  only the checkbox + label). */
  initials: string;
}

/** Initial view the dropdown opens in. Driven by the parent so chip
 *  clicks can short-circuit straight to the relevant editor. */
export type FilterDropdownView = 'top' | 'networks' | 'users' | 'name-edit';

export interface FilterDropdownProps {
  /** Networks the user can pick from in the Network sub-selector.
   *  Filtered by template scope upstream — Beta passes ['facebook',
   *  'tiktok'] only. */
  availableNetworks: Platform[];
  /** User options for the User sub-selector. */
  availableUsers: FilterUser[];

  /** Currently-selected networks. */
  selectedNetworks: ReadonlySet<Platform>;
  onNetworksChange: (next: Set<Platform>) => void;

  /** Currently-selected users. */
  selectedUsers: ReadonlySet<string>;
  onUsersChange: (next: Set<string>) => void;

  /** Active "Name contains" filter. `null` means no filter. */
  nameContains: string | null;
  onNameContainsChange: (next: string | null) => void;

  /** When `null`, the dropdown is closed.  Otherwise indicates which
   *  view is open.  Parent flips this back to null on outside click,
   *  Escape, or after the user picks a terminal option. */
  view: FilterDropdownView | null;
  onViewChange: (next: FilterDropdownView | null) => void;

  /** Anchored content — the trigger button.  Receives `(open)` so the
   *  parent can switch styling when the dropdown is open. */
  renderTrigger?: (open: boolean) => ReactNode;

  /** External anchor element.  When set, the popover is positioned
   *  underneath this element instead of underneath the internal Filter
   *  trigger.  Used by the chip-click flow so the Network / User /
   *  Name-contains editors open directly under the chip the user
   *  clicked (Figma 1674:44910).  Pass `null` (or omit) to fall back
   *  to anchoring under the Filter trigger button. */
  popoverAnchorEl?: HTMLElement | null;
}

// ── Network labels (display strings) ─────────────────────────────────────
//
// Figma uses the marketing-cap network names (Facebook, Instagram, …)
// while the `Platform` keys are kebab-case. We map each direction.

const NETWORK_LABEL: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  'google-analytics': 'Google Analytics',
  x: 'X',
  threads: 'Threads',
  bluesky: 'Bluesky',
};

// ── Component ────────────────────────────────────────────────────────────

export function FilterDropdown({
  availableNetworks,
  availableUsers,
  selectedNetworks,
  onNetworksChange,
  selectedUsers,
  onUsersChange,
  nameContains,
  onNameContainsChange,
  view,
  onViewChange,
  renderTrigger,
  popoverAnchorEl = null,
}: FilterDropdownProps) {
  const open = view !== null;

  // Search query inside the TOP-LEVEL dropdown — flips the panel into
  // suggestion mode when the user starts typing. Reset whenever the
  // dropdown closes so re-opening lands fresh.
  const [topQuery, setTopQuery] = useState('');

  // Search query inside Network / User sub-selectors — narrows the
  // checkbox list. Independent from `topQuery`.
  const [subQuery, setSubQuery] = useState('');

  // Working draft for the Name-contains editor.  Seeded from the
  // current `nameContains` whenever the editor opens so editing an
  // existing chip starts with its value pre-loaded.
  const [nameDraft, setNameDraft] = useState('');

  // Whether the user reached the current sub-view (networks / users)
  // by drilling in from the top panel.  When true, the parent panel
  // stays visible alongside the submenu (1678:75322 / 1678:76115).
  // When false, the view was opened externally — e.g. by clicking a
  // chip — and only the submenu is shown.
  const drilledFromTopRef = useRef(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const topInputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Popover positioning ─────────────────────────────────────────────────
  // The popover renders via createPortal and `position: fixed` so it
  // can anchor either to the internal Filter trigger button OR to an
  // external chip element (`popoverAnchorEl`).  Portaling escapes the
  // sticky `<section>` wrapper so the popover doesn't get clipped, and
  // fixed positioning lets us use viewport coordinates directly from
  // `getBoundingClientRect()`.  Position recomputes on scroll + resize
  // so the popover follows the chip as the user scrolls past the
  // sticky activation point.
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPopoverPos(null);
      return;
    }
    const anchor = popoverAnchorEl ?? triggerRef.current;
    if (!anchor) return;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    };
    update();
    // Capture-phase scroll listener catches scroll events from any
    // ancestor scroll container, not just `window` — needed because
    // the table sits inside a sticky chrome wrapper that may scroll
    // independently.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, popoverAnchorEl]);

  // ── Hover-intent close ──────────────────────────────────────────────────
  // The Network / User row's highlight and its submenu are a single
  // atomic state — both visible while the cursor is inside the row OR
  // its submenu, both gone the instant the cursor leaves both regions.
  //
  // Implementation: when the cursor exits a row OR a submenu, we
  // schedule a close on a short timer. Re-entering either region (or
  // the 4-px gap traversal between them) cancels the timer. Hovering
  // a sibling row (Network → User) cancels then re-opens to that row.
  // Hovering the search input lets the timer expire so the drill
  // collapses back to `'top'`.
  //
  // 80 ms is long enough to bridge the flex `gap-[4px]` between the
  // top panel and submenu — measured at typical cursor speeds the
  // mouseenter on the submenu fires within ~10 ms — and short enough
  // that an intentional "move away" feels immediate.
  const closeTimeoutRef = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      // Only collapse the drill — outside click / Escape still own
      // fully closing the dropdown. Guarded on `drilledFromTopRef`
      // so chip-click standalone submenus don't auto-dismiss.
      if (drilledFromTopRef.current) {
        onViewChange('top');
      }
    }, 80);
  };
  // Cleanup on unmount so a pending timer can't fire after teardown.
  useEffect(() => {
    return () => cancelClose();
  }, []);

  // Close the dropdown on outside click + Escape.  Listeners only
  // attach while the dropdown is open so we don't burn cycles on
  // every page click when the surface is closed.
  //
  // "Inside" means any of:
  //   • rootRef          (the trigger wrapper)
  //   • popoverRef       (the portaled popover panel)
  //   • popoverAnchorEl  (the external chip, when chip-anchored)
  // Without the popover/anchor checks the portal'd popover would self-
  // close on every interaction since it lives outside `rootRef`.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      if (popoverAnchorEl?.contains(target)) return;
      onViewChange(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onViewChange(null);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onViewChange, popoverAnchorEl]);

  // Reset query state + seed the name draft whenever the dropdown
  // opens or the view changes.  Also clears the drill ref on close.
  useEffect(() => {
    if (!open) {
      setTopQuery('');
      setSubQuery('');
      drilledFromTopRef.current = false;
      return;
    }
    if (view === 'top') {
      requestAnimationFrame(() => topInputRef.current?.focus());
    } else if (view === 'networks' || view === 'users') {
      requestAnimationFrame(() => subInputRef.current?.focus());
      setSubQuery('');
    } else if (view === 'name-edit') {
      setNameDraft(nameContains ?? '');
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      });
    }
  }, [open, view, nameContains]);

  const commitNetworkToggle = (p: Platform) => {
    const next = new Set(selectedNetworks);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onNetworksChange(next);
  };

  const commitUserToggle = (id: string) => {
    const next = new Set(selectedUsers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onUsersChange(next);
  };

  const commitNameContains = () => {
    const next = nameDraft.trim();
    onNameContainsChange(next.length === 0 ? null : next);
    onViewChange(null);
  };

  const handleSelectAllNetworks = () => {
    onNetworksChange(new Set(availableNetworks));
  };
  const handleUnselectAllNetworks = () => {
    onNetworksChange(new Set());
  };
  const handleSelectAllUsers = () => {
    onUsersChange(new Set(availableUsers.map((u) => u.id)));
  };
  const handleUnselectAllUsers = () => {
    onUsersChange(new Set());
  };

  // ── Top-level suggestions ────────────────────────────────────────────
  // Structured matches: any network whose label includes the query
  // (case-insensitive). Plus a single trailing "Name contains: '<q>'"
  // fallback so the user always has an escape hatch into a freeform
  // text filter.
  const trimmedTop = topQuery.trim();
  const networkSuggestions = useMemo(() => {
    if (!trimmedTop) return [];
    const q = trimmedTop.toLowerCase();
    return availableNetworks.filter((p) =>
      NETWORK_LABEL[p].toLowerCase().includes(q),
    );
  }, [trimmedTop, availableNetworks]);

  const userSuggestions = useMemo(() => {
    if (!trimmedTop) return [];
    const q = trimmedTop.toLowerCase();
    return availableUsers.filter((u) => u.label.toLowerCase().includes(q));
  }, [trimmedTop, availableUsers]);

  const showSuggestions = trimmedTop.length > 0;

  // The TOP panel is visible whenever `view === 'top'` OR when the
  // user drilled into a sub-selector from the top (per Figma the
  // parent stays visible to the LEFT of the submenu).
  const showTopPanel =
    view === 'top' ||
    ((view === 'networks' || view === 'users') && drilledFromTopRef.current);

  // The submenu (Network / User selector) is positioned RIGHT of the
  // parent when drilled from top, otherwise it's a standalone popover
  // anchored to the trigger.
  const showSubmenuRightOfTop =
    (view === 'networks' || view === 'users') && drilledFromTopRef.current;

  // The popover JSX — extracted so we can render it via portal when
  // the dropdown is open. Same DOM regardless of whether anchored to
  // the internal trigger or to an external chip.
  const popoverNode = open && popoverPos ? (
    <div
      ref={popoverRef}
      className="z-30 flex items-start gap-[4px]"
      style={{
        position: 'fixed',
        top: popoverPos.top,
        left: popoverPos.left,
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
    >
      {showTopPanel && (
        <TopPanel
          query={topQuery}
          onQueryChange={setTopQuery}
          showSuggestions={showSuggestions}
          networkSuggestions={networkSuggestions}
          userSuggestions={userSuggestions}
          activeRow={
            view === 'networks'
              ? 'network'
              : view === 'users'
                ? 'user'
                : null
          }
          inputRef={topInputRef}
          onPickNetwork={(p) => {
            commitNetworkToggle(p);
            onViewChange(null);
          }}
          onPickUser={(id) => {
            commitUserToggle(id);
            onViewChange(null);
          }}
          onPickNameContains={() => {
            onNameContainsChange(trimmedTop);
            onViewChange(null);
          }}
          onOpenNetworks={() => {
            cancelClose();
            drilledFromTopRef.current = true;
            onViewChange('networks');
          }}
          onOpenUsers={() => {
            cancelClose();
            drilledFromTopRef.current = true;
            onViewChange('users');
          }}
          onLeaveCategory={scheduleClose}
          onHoverNonCategory={scheduleClose}
        />
      )}

      {/* Sub-selectors:
          • In drill mode (`showSubmenuRightOfTop`) they sit to the
            right of the parent, gap-4 between.
          • Otherwise (chip-click entry) they stand alone in the
            same anchor slot. */}
      {view === 'networks' && (
        <div
          // Re-entering the submenu cancels a pending close, leaving
          // it cancels the cancel and schedules one. Together with
          // the row's enter/leave handlers, this keeps the row
          // highlight + submenu treated as one atomic hover region.
          // Only matters when drilled from the top panel — chip-
          // click flows have `drilledFromTopRef === false` so the
          // scheduled close is a no-op for them.
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <NetworkSelector
            query={subQuery}
            onQueryChange={setSubQuery}
            inputRef={subInputRef}
            available={availableNetworks}
            selected={selectedNetworks}
            onToggle={commitNetworkToggle}
            onSelectAll={handleSelectAllNetworks}
            onUnselectAll={handleUnselectAllNetworks}
          />
        </div>
      )}

      {view === 'users' && (
        <div onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <UserSelector
            query={subQuery}
            onQueryChange={setSubQuery}
            inputRef={subInputRef}
            available={availableUsers}
            selected={selectedUsers}
            onToggle={commitUserToggle}
            onSelectAll={handleSelectAllUsers}
            onUnselectAll={handleUnselectAllUsers}
          />
        </div>
      )}

      {view === 'name-edit' && !showSubmenuRightOfTop && (
        <NameContainsEditor
          draft={nameDraft}
          onDraftChange={setNameDraft}
          inputRef={nameInputRef}
          onCommit={commitNameContains}
        />
      )}
    </div>
  ) : null;

  return (
    <>
      <div
        ref={rootRef}
        className="relative inline-flex"
        style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            drilledFromTopRef.current = false;
            onViewChange(open ? null : 'top');
          }}
          className="inline-flex items-center"
        >
          {renderTrigger?.(open)}
        </button>
      </div>
      {/* Portal the popover to document.body so the sticky / overflow
          ancestors don't clip it, and so its position is anchored
          purely off `popoverPos` (computed from the trigger button or
          an external chip via `popoverAnchorEl`). */}
      {typeof document !== 'undefined' && popoverNode
        ? createPortal(popoverNode, document.body)
        : null}
    </>
  );
}

// ── Sub-views ────────────────────────────────────────────────────────────

// Shared panel chrome — Figma 696:33981.  White bg, rounded-4, 1-px
// translucent outline ring + soft drop shadow.
const PANEL_CHROME = 'bg-white rounded-[4px] overflow-hidden';
const PANEL_SHADOW =
  '0 0 0 1px #D2D2D3, 0 12px 8px -4px rgba(32,30,36,0.15), 0 4px 4px -2px rgba(32,30,36,0.2)';

// Search-input chrome shared across every panel.  Per Figma
// 1670:42280 the focused state is JUST a 1-px brand-purple border
// stroke around the existing tinted box — no fill change, no focus
// ring shadow.  Border always renders (transparent at rest) so
// flipping its color on focus doesn't shift box width by 2 px.
const SEARCH_INPUT_WRAP = cn(
  'flex items-center gap-[8px] h-[32px] px-[8px] rounded-[4px]',
  'bg-[rgba(32,30,36,0.05)]',
  'border border-transparent transition-colors',
  'focus-within:border-[#4D36FF]',
);
const SEARCH_INPUT_FIELD = cn(
  'flex-1 min-w-0 bg-transparent border-0 outline-none',
  'text-[14px] leading-[14px] tracking-[-0.1px]',
  'text-[#201E24] placeholder:text-[#78767C]',
);

// ── Top panel ───────────────────────────────────────────────────────────

interface TopPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  showSuggestions: boolean;
  networkSuggestions: Platform[];
  userSuggestions: FilterUser[];
  activeRow: 'network' | 'user' | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPickNetwork: (p: Platform) => void;
  onPickUser: (id: string) => void;
  onPickNameContains: () => void;
  onOpenNetworks: () => void;
  onOpenUsers: () => void;
  /** Cursor left a category row — schedule a drill close. */
  onLeaveCategory: () => void;
  /** Cursor entered a region of the top panel that is NOT a category
   *  row (e.g. the search input).  Same effect as leaving a row —
   *  schedules the drill to collapse, so the active row's highlight
   *  drops and the submenu folds away. */
  onHoverNonCategory: () => void;
}

function TopPanel({
  query,
  onQueryChange,
  showSuggestions,
  networkSuggestions,
  userSuggestions,
  activeRow,
  inputRef,
  onPickNetwork,
  onPickUser,
  onPickNameContains,
  onOpenNetworks,
  onOpenUsers,
  onLeaveCategory,
  onHoverNonCategory,
}: TopPanelProps) {
  return (
    <div
      className={cn(PANEL_CHROME, 'w-[200px] flex flex-col')}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      {/* Search input — Figma 696:33983. Pressing Enter with text
          typed commits a Name contains filter immediately.
          Hovering the search area is treated as "leaving the category
          rows" — it schedules the drill to collapse so the active
          row's highlight drops in step. */}
      <div className="p-[8px]" onMouseEnter={onHoverNonCategory}>
        <div className={SEARCH_INPUT_WRAP}>
          <IconSearch size={16} color="#201E24" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim().length > 0) {
                e.preventDefault();
                onPickNameContains();
              }
            }}
            placeholder="Search report..."
            aria-label="Search filters"
            className={SEARCH_INPUT_FIELD}
          />
        </div>
      </div>

      {/* Body — either the two category rows OR a suggestions list,
          depending on whether the user is typing.
          NOTE: pt-0 to keep the gap between search and rows tight
          (Figma rhythm: 8 px outer padding, no extra space between
          input and first row). */}
      <div className="flex flex-col p-[8px] pt-0 max-h-[400px] overflow-auto">
        {!showSuggestions ? (
          <>
            <CategoryRow
              label="Network"
              active={activeRow === 'network'}
              onOpen={onOpenNetworks}
              onLeave={onLeaveCategory}
            />
            <CategoryRow
              label="User"
              active={activeRow === 'user'}
              onOpen={onOpenUsers}
              onLeave={onLeaveCategory}
            />
          </>
        ) : (
          <>
            {networkSuggestions.map((p) => (
              <SuggestionRow
                key={`net-${p}`}
                onClick={() => onPickNetwork(p)}
                leading={<PlatformIcon platform={p} size={16} />}
                label={`Network > ${NETWORK_LABEL[p]}`}
              />
            ))}
            {userSuggestions.map((u) => (
              <SuggestionRow
                key={`usr-${u.id}`}
                onClick={() => onPickUser(u.id)}
                label={`User > ${u.label}`}
              />
            ))}
            {/* Always-present fallback — Figma 1670:42280 shows it as
                the last row whenever the user has typed anything.
                Phrasing per spec: 'Name contains: "fa"'. */}
            <SuggestionRow
              onClick={onPickNameContains}
              label={`Name contains: "${query.trim()}"`}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface CategoryRowProps {
  label: string;
  active: boolean;
  /** HOVER opens the submenu (Figma 1678:75322 / 1678:76115).  Click
   *  is also wired so keyboard / touch users can open the same
   *  surface — both call the same handler. */
  onOpen: () => void;
  /** Cursor left this row — parent schedules a drill close so the
   *  highlight + submenu drop together when the user moves away. The
   *  schedule is cancelled if the cursor lands on the submenu, the
   *  sibling category row, or this row again before the timer fires. */
  onLeave: () => void;
}

function CategoryRow({ label, active, onOpen, onLeave }: CategoryRowProps) {
  return (
    <button
      type="button"
      onMouseEnter={onOpen}
      onMouseLeave={onLeave}
      onFocus={onOpen}
      onBlur={onLeave}
      onClick={onOpen}
      className={cn(
        'flex items-center justify-between w-full px-[8px] py-[10px] rounded-[4px]',
        'text-[14px] leading-[17.5px] text-[#201E24]',
        'transition-colors cursor-pointer',
        // Hover + active share the same brand-purple tint
        // (rgba(81,61,217,0.1) — verified in Figma 1678:75513).  The
        // category whose submenu is currently visible always paints
        // in this color so it reads as "selected" from the user's
        // mental model — same as hover, since hovering it would also
        // make it the active row.
        active
          ? 'bg-[rgba(81,61,217,0.1)]'
          : 'hover:bg-[rgba(81,61,217,0.1)]',
      )}
    >
      <span>{label}</span>
      <IconChevronRight size={16} color="#201E24" />
    </button>
  );
}

interface SuggestionRowProps {
  onClick: () => void;
  leading?: ReactNode;
  label: string;
}

function SuggestionRow({ onClick, leading, label }: SuggestionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-[8px] w-full px-[8px] py-[10px] rounded-[4px]',
        'text-[14px] leading-[17.5px] text-[#201E24] text-left',
        'hover:bg-[rgba(81,61,217,0.1)] transition-colors cursor-pointer',
      )}
    >
      {leading && <span className="flex-shrink-0">{leading}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
}

// ── Network sub-selector ─────────────────────────────────────────────────

interface NetworkSelectorProps {
  query: string;
  onQueryChange: (q: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  available: Platform[];
  selected: ReadonlySet<Platform>;
  onToggle: (p: Platform) => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
}

function NetworkSelector({
  query,
  onQueryChange,
  inputRef,
  available,
  selected,
  onToggle,
  onSelectAll,
  onUnselectAll,
}: NetworkSelectorProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((p) => NETWORK_LABEL[p].toLowerCase().includes(q));
  }, [query, available]);

  const allSelected =
    available.length > 0 && available.every((p) => selected.has(p));

  return (
    <div
      className={cn(PANEL_CHROME, 'w-[200px] flex flex-col')}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      <div className="p-[8px]">
        <div className={SEARCH_INPUT_WRAP}>
          <IconSearch size={16} color="#201E24" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Network"
            aria-label="Search networks"
            className={SEARCH_INPUT_FIELD}
          />
        </div>
      </div>

      <ul
        role="listbox"
        aria-label="Networks"
        className="flex flex-col px-[8px] pb-[4px] max-h-[320px] overflow-auto"
      >
        {filtered.map((p) => (
          <li key={p}>
            <CheckboxRow
              checked={selected.has(p)}
              onClick={() => onToggle(p)}
              leading={<PlatformIcon platform={p} size={16} />}
              label={NETWORK_LABEL[p]}
            />
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-[8px] py-[10px] text-[14px] leading-[17.5px] text-[#78767C]">
            No matches
          </li>
        )}
      </ul>

      <SelectAllFooter
        allSelected={allSelected}
        onSelectAll={onSelectAll}
        onUnselectAll={onUnselectAll}
      />
    </div>
  );
}

// ── User sub-selector ────────────────────────────────────────────────────

interface UserSelectorProps {
  query: string;
  onQueryChange: (q: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  available: FilterUser[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
}

function UserSelector({
  query,
  onQueryChange,
  inputRef,
  available,
  selected,
  onToggle,
  onSelectAll,
  onUnselectAll,
}: UserSelectorProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((u) => u.label.toLowerCase().includes(q));
  }, [query, available]);

  const allSelected =
    available.length > 0 && available.every((u) => selected.has(u.id));

  return (
    <div
      className={cn(PANEL_CHROME, 'w-[200px] flex flex-col')}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      <div className="p-[8px]">
        <div className={SEARCH_INPUT_WRAP}>
          <IconSearch size={16} color="#201E24" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="User"
            aria-label="Search users"
            className={SEARCH_INPUT_FIELD}
          />
        </div>
      </div>

      {/* Per Figma 1678:76115, User rows show ONLY the checkbox +
          label (no avatar tile). The same component is used for the
          chip popover — chips already convey the user identity, the
          submenu just confirms / edits the selection. */}
      <ul
        role="listbox"
        aria-label="Users"
        className="flex flex-col px-[8px] pb-[4px] max-h-[320px] overflow-auto"
      >
        {filtered.map((u) => (
          <li key={u.id}>
            <CheckboxRow
              checked={selected.has(u.id)}
              onClick={() => onToggle(u.id)}
              label={u.label}
            />
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-[8px] py-[10px] text-[14px] leading-[17.5px] text-[#78767C]">
            No matches
          </li>
        )}
      </ul>

      <SelectAllFooter
        allSelected={allSelected}
        onSelectAll={onSelectAll}
        onUnselectAll={onUnselectAll}
      />
    </div>
  );
}

// ── Name-contains editor ─────────────────────────────────────────────────

interface NameContainsEditorProps {
  draft: string;
  onDraftChange: (next: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCommit: () => void;
}

function NameContainsEditor({
  draft,
  onDraftChange,
  inputRef,
  onCommit,
}: NameContainsEditorProps) {
  return (
    <div
      className={cn(PANEL_CHROME, 'w-[220px] flex flex-col')}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      <div className="p-[8px]">
        <div className={SEARCH_INPUT_WRAP}>
          <IconSearch size={16} color="#201E24" />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommit();
              }
            }}
            placeholder="Name contains"
            aria-label="Edit name contains filter"
            className={SEARCH_INPUT_FIELD}
          />
        </div>
      </div>

      {draft.trim().length > 0 && (
        <div className="px-[8px] pb-[8px]">
          <SuggestionRow
            onClick={onCommit}
            label={`Name contains: "${draft.trim()}"`}
          />
        </div>
      )}
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

interface CheckboxRowProps {
  checked: boolean;
  onClick: () => void;
  leading?: ReactNode;
  label: string;
}

function CheckboxRow({ checked, onClick, leading, label }: CheckboxRowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onClick}
      className={cn(
        // Slightly tighter padding than the category rows so the list
        // reads as denser than the parent's 2 rows. py-[10px] matches
        // Figma 1678:75528 row spec exactly (each row ≈ 36 px tall
        // including the 15-px checkbox).
        'flex items-center gap-[8px] w-full px-[8px] py-[10px] rounded-[4px]',
        'text-[14px] leading-[17.5px] text-[#201E24] text-left',
        'hover:bg-[rgba(81,61,217,0.1)] transition-colors cursor-pointer',
      )}
    >
      {/* 15-px square checkbox per Figma 1678:75531: white bg +
          inset 1-px ring (rgba(32,30,36,0.2)) at rest; brand-purple
          fill (#4D36FF) at active with the design system's filled
          tick glyph (NOT a stroked line — the Figma SVG asset uses
          a solid filled path so the check has tapered ends and a
          slight thickness variation). */}
      <span
        aria-hidden="true"
        className={cn(
          'flex-shrink-0 w-[15px] h-[15px] rounded-[3px] flex items-center justify-center',
          'transition-colors',
          checked
            ? 'bg-[#4D36FF]'
            : 'bg-white shadow-[inset_0_0_0_1px_rgba(32,30,36,0.2)]',
        )}
      >
        {checked && (
          // Figma checkmark asset (verified directly via the asset
          // URL in node 1678:75973 — `icon / _color / check`). Filled
          // path with rounded vertices, white fill on the brand-purple
          // background.
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7.71694 2.62099L3.5711 6.73891L1.94985 5.26766C1.78485 5.11807 1.53235 5.12432 1.37527 5.28141L1.37235 5.28432C1.20527 5.45141 1.20985 5.72349 1.38277 5.88432L2.98444 7.37224C3.31235 7.67682 3.82194 7.66807 4.13902 7.35266L8.30402 3.21224C8.46777 3.04974 8.46777 2.78516 8.30485 2.62182C8.14277 2.45974 7.87985 2.45932 7.71694 2.62099"
              fill="white"
            />
          </svg>
        )}
      </span>
      {leading && (
        <span className="flex-shrink-0 inline-flex items-center justify-center">
          {leading}
        </span>
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

// Select all / Unselect all footer — bottom-right of Network / User
// submenus.  Toggle behaviour: when every option is currently
// selected, the same button reads "Unselect all" and clears the
// entire selection set; otherwise it reads "Select all" and adds
// every option.  The pill chrome + hover treatment is copied from
// the report builder's profile-selection bar (h-24 rounded-60,
// hover bg `rgba(81,61,217,0.1)`, label #513DD9 12-px Medium) so
// the affordance reads identically across the app.
interface SelectAllFooterProps {
  allSelected: boolean;
  onSelectAll: () => void;
  onUnselectAll: () => void;
}

function SelectAllFooter({
  allSelected,
  onSelectAll,
  onUnselectAll,
}: SelectAllFooterProps) {
  return (
    <div className="flex justify-end px-[8px] pb-[8px] pt-[4px]">
      <button
        type="button"
        onClick={allSelected ? onUnselectAll : onSelectAll}
        className={cn(
          'flex items-center h-[24px] px-[8px] py-[6px] rounded-[60px]',
          'hover:bg-[rgba(81,61,217,0.1)] transition-colors cursor-pointer',
        )}
      >
        <span
          className="text-[12px] font-medium text-[#513DD9]"
          style={{ lineHeight: '12px' }}
        >
          {allSelected ? 'Unselect all' : 'Select all'}
        </span>
      </button>
    </div>
  );
}
