'use client';

/**
 * Filter dropdown for the Reports table — Figma 797:42255 + 1670:42280 +
 * 1674:43486 / 44025 / 42816 / 44394 / 44910.
 *
 * Replaces the old drill-in category menu with a typeahead-driven filter
 * builder.  Visible surfaces and their entry points:
 *
 *   • TRIGGER (+ Filter)        → `view = 'top'`
 *       Shows a 200-px panel with a search input ("Search report…")
 *       and two category rows ("Network ›", "User ›").  Typing in
 *       the search input flips the panel into `view = 'suggestions'`
 *       which surfaces (a) any structured matches for that text +
 *       (b) a "Name contains: '<query>'" fallback row.
 *
 *   • Network row click          → `view = 'networks'`
 *       Promotes a 320-px sub-selector with a header "Network" search
 *       row + a checkbox list of available networks.  Picking a
 *       network checkbox is multi-select (each click toggles).
 *
 *   • User row click             → `view = 'users'`
 *       Same shape as Network selector but iterates `availableUsers`.
 *
 *   • Network chip click         → opens directly in `view = 'networks'`
 *   • User chip click            → opens directly in `view = 'users'`
 *   • Name-contains chip click   → opens directly in `view = 'name-edit'`
 *
 * State surfaces upward via the `*Change` callbacks; the parent
 * (`ReportsTable`) stitches them into chip rendering and report
 * filtering.
 *
 * IMPORTANT: this component does NOT own filter state.  It's a
 * controlled view of `selectedNetworks`, `selectedUsers`, and
 * `nameContains`.  All persistence lives upstream so closing the
 * dropdown doesn't lose work-in-progress filters.
 */

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Platform } from '@/types';
import { PlatformIcon } from '@/components/report/PlatformIcon';
import { IconChevronRight, IconSearch } from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────

export interface FilterUser {
  id: string;
  label: string;
  /** Two-letter glyph for the trailing avatar tile. */
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
}: FilterDropdownProps) {
  const open = view !== null;

  // Search query inside the TOP-LEVEL dropdown — flips the panel into
  // `view = 'top'` "suggestions mode" when the user starts typing.
  // Reset whenever the dropdown closes so re-opening lands fresh.
  const [topQuery, setTopQuery] = useState('');

  // Search query inside Network / User sub-selectors — narrows the
  // checkbox list. Independent from `topQuery`.
  const [subQuery, setSubQuery] = useState('');

  // Working draft for the Name-contains editor.  Seeded from the
  // current `nameContains` whenever the editor opens so editing an
  // existing chip starts with its value pre-loaded.
  const [nameDraft, setNameDraft] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const topInputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Close the dropdown on outside click + Escape.  Listeners only
  // attach while the dropdown is open so we don't burn cycles on
  // every page click when the surface is closed.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onViewChange(null);
      }
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
  }, [open, onViewChange]);

  // Reset query state + seed the name draft whenever the dropdown
  // opens or the view changes.
  useEffect(() => {
    if (!open) {
      setTopQuery('');
      setSubQuery('');
      return;
    }
    if (view === 'top') {
      // Focus the top search input so typing starts the typeahead
      // immediately. requestAnimationFrame so the DOM has mounted.
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

  return (
    <div ref={rootRef} className="relative inline-flex" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
      <button
        type="button"
        onClick={() => onViewChange(open ? null : 'top')}
        className="inline-flex items-center"
      >
        {renderTrigger?.(open)}
      </button>

      {open && (
        <div
          className="absolute z-30 left-0 top-[calc(100%+4px)]"
          // The dropdown panel itself; surfaces are conditionally
          // rendered inside.
        >
          {view === 'top' && (
            <TopPanel
              query={topQuery}
              onQueryChange={setTopQuery}
              showSuggestions={showSuggestions}
              networkSuggestions={networkSuggestions}
              userSuggestions={userSuggestions}
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
              onOpenNetworks={() => onViewChange('networks')}
              onOpenUsers={() => onViewChange('users')}
            />
          )}

          {view === 'networks' && (
            <NetworkSelector
              query={subQuery}
              onQueryChange={setSubQuery}
              inputRef={subInputRef}
              available={availableNetworks}
              selected={selectedNetworks}
              onToggle={commitNetworkToggle}
            />
          )}

          {view === 'users' && (
            <UserSelector
              query={subQuery}
              onQueryChange={setSubQuery}
              inputRef={subInputRef}
              available={availableUsers}
              selected={selectedUsers}
              onToggle={commitUserToggle}
            />
          )}

          {view === 'name-edit' && (
            <NameContainsEditor
              draft={nameDraft}
              onDraftChange={setNameDraft}
              inputRef={nameInputRef}
              onCommit={commitNameContains}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-views ────────────────────────────────────────────────────────────

// Shared 200-px panel chrome (Figma 696:33981) — white bg, rounded-4,
// 1-px outline ring + soft drop shadow.
const PANEL_CHROME = cn(
  'bg-white rounded-[4px] overflow-hidden',
);
const PANEL_SHADOW =
  '0 0 0 1px #D2D2D3, 0 12px 8px -4px rgba(32,30,36,0.15), 0 4px 4px -2px rgba(32,30,36,0.2)';

interface TopPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  showSuggestions: boolean;
  networkSuggestions: Platform[];
  userSuggestions: FilterUser[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPickNetwork: (p: Platform) => void;
  onPickUser: (id: string) => void;
  onPickNameContains: () => void;
  onOpenNetworks: () => void;
  onOpenUsers: () => void;
}

function TopPanel({
  query,
  onQueryChange,
  showSuggestions,
  networkSuggestions,
  userSuggestions,
  inputRef,
  onPickNetwork,
  onPickUser,
  onPickNameContains,
  onOpenNetworks,
  onOpenUsers,
}: TopPanelProps) {
  return (
    <div
      className={cn(PANEL_CHROME, 'w-[260px] flex flex-col')}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      {/* Search input — Figma's icon-leading input pattern, no
          underline, soft gray fill. Pressing Enter with text typed
          commits a Name contains filter (Acceptance criteria #8). */}
      <div className="p-[8px]">
        <div
          className={cn(
            'flex items-center gap-[8px] h-[32px] px-[8px] rounded-[4px]',
            'bg-[rgba(32,30,36,0.05)]',
          )}
        >
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
            className={cn(
              'flex-1 min-w-0 bg-transparent border-0 outline-none',
              'text-[14px] leading-[14px] tracking-[-0.1px]',
              'text-[#201E24] placeholder:text-[#78767C]',
            )}
          />
        </div>
      </div>

      {/* Body — either the two category rows OR a suggestions list,
          depending on whether the user is typing. */}
      <div className="flex flex-col p-[8px] pt-0 max-h-[400px] overflow-auto">
        {!showSuggestions ? (
          <>
            <CategoryRow label="Network" onClick={onOpenNetworks} />
            <CategoryRow label="User" onClick={onOpenUsers} />
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
                leading={<UserAvatar initials={u.initials} size={16} />}
                label={`User > ${u.label}`}
              />
            ))}
            {/* Always-present fallback — Figma 1670:42280 shows it as
                the last row whenever the user has typed anything.
                Phrasing is exactly per the spec: 'Name contains: "fa"'. */}
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
  onClick: () => void;
}

function CategoryRow({ label, onClick }: CategoryRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between w-full px-[8px] py-[10px] rounded-[4px]',
        'text-[14px] leading-[17.5px] text-[#201E24]',
        'hover:bg-[rgba(32,30,36,0.05)] transition-colors cursor-pointer',
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
        'hover:bg-[rgba(32,30,36,0.05)] transition-colors cursor-pointer',
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
}

function NetworkSelector({
  query,
  onQueryChange,
  inputRef,
  available,
  selected,
  onToggle,
}: NetworkSelectorProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((p) => NETWORK_LABEL[p].toLowerCase().includes(q));
  }, [query, available]);

  return (
    <div
      className={cn(PANEL_CHROME, 'w-[200px] flex flex-col')}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      {/* Header search — Figma 696:34004: 56-px frame, search icon
          leading, "Network" placeholder. Smaller than 320-px in the
          design but tightened to 200 to match the trigger width. */}
      <div className="border-b border-[#D2D2D3] p-[8px]">
        <div
          className={cn(
            'flex items-center gap-[8px] h-[32px] px-[8px] rounded-[4px]',
            'bg-[rgba(32,30,36,0.05)]',
          )}
        >
          <IconSearch size={16} color="#201E24" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Network"
            aria-label="Search networks"
            className={cn(
              'flex-1 min-w-0 bg-transparent border-0 outline-none',
              'text-[14px] leading-[14px] tracking-[-0.1px]',
              'text-[#201E24] placeholder:text-[#78767C]',
            )}
          />
        </div>
      </div>

      <ul
        role="listbox"
        aria-label="Networks"
        className="flex flex-col p-[8px] max-h-[360px] overflow-auto"
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
}

function UserSelector({
  query,
  onQueryChange,
  inputRef,
  available,
  selected,
  onToggle,
}: UserSelectorProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((u) => u.label.toLowerCase().includes(q));
  }, [query, available]);

  return (
    <div
      className={cn(PANEL_CHROME, 'w-[200px] flex flex-col')}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      <div className="border-b border-[#D2D2D3] p-[8px]">
        <div
          className={cn(
            'flex items-center gap-[8px] h-[32px] px-[8px] rounded-[4px]',
            'bg-[rgba(32,30,36,0.05)]',
          )}
        >
          <IconSearch size={16} color="#201E24" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="User"
            aria-label="Search users"
            className={cn(
              'flex-1 min-w-0 bg-transparent border-0 outline-none',
              'text-[14px] leading-[14px] tracking-[-0.1px]',
              'text-[#201E24] placeholder:text-[#78767C]',
            )}
          />
        </div>
      </div>

      <ul
        role="listbox"
        aria-label="Users"
        className="flex flex-col p-[8px] max-h-[360px] overflow-auto"
      >
        {filtered.map((u) => (
          <li key={u.id}>
            <CheckboxRow
              checked={selected.has(u.id)}
              onClick={() => onToggle(u.id)}
              leading={<UserAvatar initials={u.initials} size={16} />}
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
        <div
          className={cn(
            'flex items-center gap-[8px] h-[32px] px-[8px] rounded-[4px]',
            'bg-[rgba(32,30,36,0.05)]',
          )}
        >
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
            className={cn(
              'flex-1 min-w-0 bg-transparent border-0 outline-none',
              'text-[14px] leading-[14px] tracking-[-0.1px]',
              'text-[#201E24] placeholder:text-[#78767C]',
            )}
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
        'flex items-center gap-[8px] w-full px-[8px] py-[10px] rounded-[4px]',
        'text-[14px] leading-[17.5px] text-[#201E24] text-left',
        'hover:bg-[rgba(32,30,36,0.05)] transition-colors cursor-pointer',
      )}
    >
      {/* 15-px square checkbox per Figma 696:34014. Manual styling so
          we can mirror the design's translucent inner-shadow border at
          rest and brand-purple fill when checked. */}
      <span
        aria-hidden="true"
        className={cn(
          'flex-shrink-0 w-[15px] h-[15px] rounded-[4px] flex items-center justify-center',
          checked
            ? 'bg-[#4D36FF]'
            : 'bg-white shadow-[inset_0_0_0_1px_rgba(32,30,36,0.2)]',
        )}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M1.5 5.5L4 8L8.5 2"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {leading && <span className="flex-shrink-0">{leading}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
}

// Tiny avatar tile for User rows / suggestions.  Two-letter initials
// over a #4D36FF brand-purple square — we don't have first-class user
// avatars in the demo data so a tinted initial reads well at 16-px
// without needing real assets.
function UserAvatar({ initials, size }: { initials: string; size: number }) {
  return (
    <span
      aria-hidden="true"
      className="rounded-[3px] bg-[#4D36FF] flex items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        lineHeight: 1,
        fontWeight: 600,
      }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}
