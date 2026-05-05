'use client';

/**
 * Reports list — Figma 795:41116 + 1290:101688.
 *
 * Layout corrections vs. an earlier pass:
 *   • NO white card wrapper. The table sits directly on the page's
 *     white background; only the column-header strip provides any
 *     surface treatment.
 *   • Header strip carries the literal title "Reports" on the left and
 *     a `+ Filter` trigger on the right (no separate sort menu — sort
 *     is driven by clicking the column headers themselves).
 *   • Selected filter chips render INLINE next to the Filter button,
 *     not on a separate chip rail below the toolbar.
 *   • Column header text + icon shift color when actively sorted:
 *     #626165 when inactive, #363439 when active. The glyph itself
 *     stays as `IconSortUpDown` in every state (per Figma node
 *     1295:124161 "select"); color is the only active cue.
 *   • Row borders are #F3F3F4 (NOT #E8E8E9) — the lighter tint reads
 *     as quieter against the white page.
 *
 * Sort cycle (column header click):
 *     not-sorted → desc → asc → not-sorted (third click clears)
 */

import { useMemo, useState } from 'react';
import { MockReport } from '@/lib/reports-data';
import type { ScenarioFeatures } from '@/lib/scenario';
import type { Platform } from '@/types';
import {
  FilterDropdown,
  type FilterDropdownView,
  type FilterUser,
} from './FilterDropdown';
import { PlatformIcon } from '@/components/report/PlatformIcon';
import { ReportRow, REPORT_ROW_COLUMNS } from './ReportRow';
import { EmptyState } from './EmptyState';
import { ReportAction } from './ActionMenu';
import { DeleteReportModal } from './DeleteReportModal';
import {
  IconClose,
  IconSortUpDown,
  IconSortUp,
  IconSortDown,
  IconPlusCircle,
} from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

// Default user options for the User filter — Figma 1678:76115 lists
// six fictional teammates by full name (no avatars in the row, just
// checkbox + label).  Demo-only: no actual user-filter wiring against
// reports data exists today.
const DEFAULT_AVAILABLE_USERS: FilterUser[] = [
  { id: 'usr-cs', label: 'Connie Searson',    initials: 'CS' },
  { id: 'usr-nw', label: 'Nico Watson',       initials: 'NW' },
  { id: 'usr-eo', label: 'Emmanuel Oshowobi', initials: 'EO' },
  { id: 'usr-hm', label: 'Heather Martoglio', initials: 'HM' },
  { id: 'usr-ab', label: 'Ann Borbolla',      initials: 'AB' },
  { id: 'usr-an', label: 'Anthony Benavides', initials: 'AB' },
];

// Default visible network set for the filter when no scope override
// is supplied. Order mirrors Figma's network sub-selector list (the
// 6 mainstream networks from 1674:44025).
const DEFAULT_AVAILABLE_NETWORKS: Platform[] = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'x',
  'youtube',
];

/** Pre-applied filter shape — used by the Scenario Switcher's
 *  "filtered" preset to mount the table with a chip already active.
 *  Each field optional so a scenario can pre-select just one
 *  dimension without having to author empty values for the others. */
export interface InitialFilters {
  networks?: Platform[];
  users?: string[];
  nameContains?: string;
}

interface ReportsTableProps {
  reports: MockReport[];
  onOpen: (report: MockReport) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Show the Filter trigger above the column header strip.  Driven
   *  by the Scenario Switcher's "many" / "filtered" presets — designs
   *  hide the trigger when the list is small enough that filtering
   *  doesn't earn its pixels (3 rows fit on one screen, so the user
   *  scans rather than narrows). */
  filterEnabled?: boolean;
  /** Pre-applied filter state.  Used by the Scenario Switcher's
   *  "filtered" preset so the table mounts with a chip already
   *  active, without forcing the parent to reach into the table's
   *  internal state. */
  initialFilters?: InitialFilters;
  /** Networks that the Filter dropdown's Network sub-selector can
   *  pick from.  Beta scope passes ['facebook', 'tiktok'] only;
   *  Full scope passes the full mainstream network set. */
  availableNetworks?: Platform[];
  /** Capability flags for in-development surfaces. Defaults to all
   *  OFF — production scope hides Rename and Sorting. */
  features?: ScenarioFeatures;
}

const FEATURES_DEFAULT: ScenarioFeatures = {
  rename: false,
  sorting: false,
};

export type SortKey = 'name' | 'modifiedAt' | 'modules';
export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: SortKey | null;
  dir: SortDir;
}

// Header click cycles sort state through the same machine as Figma
// 836:45051: inactive → desc → asc → cleared.
function nextSortState(curr: SortState, k: SortKey): SortState {
  if (curr.key !== k) return { key: k, dir: 'desc' };
  if (curr.dir === 'desc') return { key: k, dir: 'asc' };
  return { key: null, dir: 'desc' };
}

export function ReportsTable({
  reports,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  filterEnabled = false,
  initialFilters,
  availableNetworks = DEFAULT_AVAILABLE_NETWORKS,
  features = FEATURES_DEFAULT,
}: ReportsTableProps) {
  // Filter state — three independent dimensions per Figma 797:42255.
  // Seeded from `initialFilters` so the Scenario Switcher's "filtered"
  // preset can mount with one or more chips already applied. We
  // deliberately don't sync to subsequent `initialFilters` changes —
  // once the user has picked their own chips the seed shouldn't
  // overwrite them. The `key={reportListState}` on this component
  // upstream takes care of remounting with a fresh seed when the
  // scenario changes.
  const [selectedNetworks, setSelectedNetworks] = useState<Set<Platform>>(
    () => new Set(initialFilters?.networks ?? []),
  );
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(
    () => new Set(initialFilters?.users ?? []),
  );
  const [nameContains, setNameContains] = useState<string | null>(
    () => initialFilters?.nameContains ?? null,
  );

  // Filter dropdown view state. `null` means closed. The Filter
  // trigger and chip clicks all flip this to a specific view value;
  // outside-click + Escape inside FilterDropdown flip it back to null.
  const [filterView, setFilterView] = useState<FilterDropdownView | null>(null);
  // Initial sort intentionally has NO active key — every column should
  // render with the neutral `IconSortUpDown` glyph until the user
  // clicks one. The mock data is already in modifiedAt-desc order at
  // the source so the default render matches the prior implicit sort
  // visually; only the directional indicator on the Modified header is
  // suppressed.  Sort state is preserved even when `features.sorting`
  // is off (the headers just stop emitting `setSort` calls) so toggling
  // the flag back on doesn't drop any in-progress ordering.
  const [sort, setSort] = useState<SortState>({ key: null, dir: 'desc' });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Pending-delete state — when a row's action menu fires "Delete" we
  // hold the target here and surface the confirmation dialog. Only
  // when the user actually confirms do we propagate `onDelete` upward
  // — clicks on Cancel / backdrop / Escape simply clear this.
  const [pendingDelete, setPendingDelete] = useState<MockReport | null>(null);

  // ── Filtering ────────────────────────────────────────────────────────────
  // Three filter dimensions, applied in series:
  //   1. Networks  — row passes if any of its `networks` is selected.
  //   2. Name      — case-insensitive substring match against `name`.
  //   3. Users     — chip-only for now (no wiring against report data
  //                  in the demo, since reports aren't authored against
  //                  a `user` axis). The chip still renders so the UX
  //                  flow reads end-to-end.
  const filtered = useMemo(() => {
    let rows = reports;
    if (selectedNetworks.size > 0) {
      rows = rows.filter((r) => r.networks.some((n) => selectedNetworks.has(n)));
    }
    if (nameContains && nameContains.trim().length > 0) {
      const q = nameContains.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return rows;
  }, [reports, selectedNetworks, nameContains]);

  // ── Sorting ──────────────────────────────────────────────────────────────
  // Sort math runs unconditionally (cheap on hundreds of rows); the
  // feature flag only gates the column-header UI that triggers sort
  // state changes. Off → headers stay static, `sort.key` stays null,
  // `sorted === filtered`.
  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const arr = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const key = sort.key;
    arr.sort((a, b) => {
      const av = key === 'modules' ? a.modules.length : a[key];
      const bv = key === 'modules' ? b.modules.length : b[key];
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * dir;
    });
    return arr;
  }, [filtered, sort]);

  // ── Source-empty rule ────────────────────────────────────────────────────
  // When the source list is empty (no reports authored yet), all
  // list-level chrome — search, filter button, filter chips, column
  // headers — collapses out of the layout: there's nothing to search,
  // filter, or sort.  Only the section heading + the empty-state tile
  // remain. This is a hard rule (per Figma 1452:457037), so we derive
  // it from the data instead of routing through a prop — every
  // scenario gets the right behavior automatically.
  //
  // Note: this is DIFFERENT from "filtered to zero" — when reports has
  // rows but the active filter chip leaves zero matches, we DO keep
  // the filter button + chips visible (so the user can clear the
  // filter back to a non-empty result). The body in that case shows
  // the "No matches" copy, not "No reports yet".
  const isSourceEmpty = reports.length === 0;

  // ── Active-filter helpers ────────────────────────────────────────────────
  const hasAnyFilter =
    selectedNetworks.size > 0 ||
    selectedUsers.size > 0 ||
    (nameContains !== null && nameContains.length > 0);

  const clearAllFilters = () => {
    setSelectedNetworks(new Set());
    setSelectedUsers(new Set());
    setNameContains(null);
    setFilterView(null);
  };

  const handleAction = (report: MockReport, action: ReportAction) => {
    switch (action) {
      case 'open':      onOpen(report); break;
      // `Share` is a stub for now — the share dialog hasn't been
      // designed yet. Once a Figma spec lands, route to a
      // `setPendingShare(report)` modal here, mirroring the delete flow.
      case 'share':     break;
      case 'rename':    setRenamingId(report.id); break;
      case 'duplicate': onDuplicate(report.id); break;
      // Don't delete immediately — stage the report and let the
      // confirmation modal commit the destructive action.
      case 'delete':    setPendingDelete(report); break;
    }
  };

  return (
    <section
      className="flex flex-col"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {/* ── Sticky chrome ────────────────────────────────────────────
          Per Figma 1585:461063 (Many reports — after scroll), the
          Reports section header AND the column-header strip both stick
          to the viewport top (right below the TopAppBar) as the user
          scrolls. We wrap them in a single sticky container so they
          travel together — visually they stay flush.

          Offset: `top-[88px]` matches the TopAppBar's combined height
          (utility row 29 px + main nav row 59 px = 88 px). The layered
          z-indexes (TopAppBar at z-30, this at z-20, body unset) keep
          the rows below painting cleanly behind the chrome.

          `bg-white` is required — without an opaque fill, the rows
          scrolling past would bleed through the sticky surface. */}
      <div className="sticky top-[88px] z-20 bg-white">
        {/* Header row — Figma 1597:463763 spec: 80 px tall, with
            "Reports" title + Filter trigger anchored to the LEFT and
            the search input flush to the RIGHT edge. Implemented as
            `flex justify-between` so the right edge tracks the
            container width regardless of the title cluster's width. */}
        <div className="h-[80px] flex items-center justify-between gap-[16px] flex-wrap gap-y-[8px]">
          {/* Left cluster — title + filter button + chip overflow.
              Wrapped in its own flex so the gap between members stays
              tight while `justify-between` on the parent pushes the
              search to the opposite edge. */}
          <div className="flex items-center gap-[16px] flex-wrap gap-y-[8px]">
            <h2 className="text-[16px] leading-[24px] font-medium text-[#201E24]">
              Reports
            </h2>

            {/* Filter trigger — Figma 1597:463766 / 797:42255: h-32,
                px-13, rounded-4, 1-px border #201E24 @ 20%, gap-7
                between icon and label, IconPlusCircle 16 px, 12/21
                Medium #201E24 label.  Visible only when `filterEnabled`. */}
            {filterEnabled && (
              <FilterDropdown
                availableNetworks={availableNetworks}
                availableUsers={DEFAULT_AVAILABLE_USERS}
                selectedNetworks={selectedNetworks}
                onNetworksChange={setSelectedNetworks}
                selectedUsers={selectedUsers}
                onUsersChange={setSelectedUsers}
                nameContains={nameContains}
                onNameContainsChange={setNameContains}
                view={filterView}
                onViewChange={setFilterView}
                renderTrigger={(open) => (
                  <span
                    className={cn(
                      'h-[32px] min-w-[32px] px-[13px] rounded-[4px]',
                      'inline-flex items-center justify-center gap-[7px]',
                      'border border-[rgba(32,30,36,0.2)]',
                      'text-[12px] leading-[21px] font-medium text-[#201E24]',
                      open ? 'bg-[#F3F3F4]' : 'bg-transparent',
                      'hover:bg-[#F3F3F4] transition-colors',
                    )}
                  >
                    <IconPlusCircle size={16} color="#201E24" />
                    <span>Filter</span>
                  </span>
                )}
              />
            )}

            {/* Filter chips — Figma 1674:43486 / 44394.  Three chip
                shapes:
                  • Network  — single chip aggregating ALL selected
                    networks; clicking it reopens the Network sub-
                    selector so the user can edit the selection.
                  • User     — same, with user initials inside.
                  • Name contains — pill with split label/value styling;
                    clicking it reopens the Name-contains editor.
                Each chip has an × that removes that filter dimension
                wholesale (per the Figma — there's no per-network ×
                inside the Network chip; that affordance lives in the
                sub-selector's checkboxes). */}
            {filterEnabled && hasAnyFilter && (
              <div className="flex items-center gap-[8px] flex-wrap">
                {selectedNetworks.size > 0 && (
                  <NetworkChip
                    networks={[...selectedNetworks]}
                    onClick={() => setFilterView('networks')}
                    onRemove={() => setSelectedNetworks(new Set())}
                  />
                )}
                {selectedUsers.size > 0 && (
                  <UserChip
                    users={[...selectedUsers]
                      .map((id) => DEFAULT_AVAILABLE_USERS.find((u) => u.id === id))
                      .filter((u): u is FilterUser => Boolean(u))}
                    onClick={() => setFilterView('users')}
                    onRemove={() => setSelectedUsers(new Set())}
                  />
                )}
                {nameContains && (
                  <NameContainsChip
                    value={nameContains}
                    onClick={() => setFilterView('name-edit')}
                    onRemove={() => setNameContains(null)}
                  />
                )}
                {/* Clear all — only visible when at least one filter
                    is active AND the dropdown is closed. Re-opening
                    a chip's editor (filterView !== null) hides the
                    link so it doesn't compete with the editor. */}
                {filterView === null && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className={cn(
                      'text-[12px] leading-[21px] font-medium text-[#626165]',
                      'hover:text-[#201E24] transition-colors cursor-pointer',
                    )}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Standalone search input is removed entirely — search now
              lives inside the FilterDropdown's per-category drill view
              (see `query` state in FilterDropdown.tsx).  Above-the-table
              search is gone for the foreseeable future. */}
        </div>

      {/* Column header row — sortable Name / Date / Modules columns +
          an EMPTY Networks frame + an empty Actions slot. Per Figma
          830:44520, the strip is h-48 and the Networks header has no
          label (the row's network glyphs make the column self-evident).
          NO gap / NO outer padding: cells sit flush edge-to-edge and
          the Name cell carries its own `pl-16` for breathing space.
          This matches Figma's column widths exactly (sum = 1114 = the
          content width) — adding gap/padding would overflow and clip
          the trailing Actions cell off the right edge.
          Hidden when the source list is empty — Figma 1452:457037
          shows the empty state without column headers (no rows means
          no columns to label).
          Inside the sticky wrapper above so the strip travels with
          the section header as the user scrolls (Figma 1585:461063). */}
        {!isSourceEmpty && (
          <div className="flex items-center h-[48px] border-b border-[#F3F3F4]">
            <ColumnHeader
              className={REPORT_ROW_COLUMNS.name}
              label="Name"
              sortKey="name"
              state={sort}
              sortable={features.sorting}
              onSort={(k) => setSort((s) => nextSortState(s, k))}
            />
            {/* "Date modified" — Figma 1597:463779.  Earlier code had
                "Modified" for brevity; the design specs the longer
                label so we restore it. */}
            <ColumnHeader
              className={REPORT_ROW_COLUMNS.date}
              label="Date modified"
              sortKey="modifiedAt"
              state={sort}
              sortable={features.sorting}
              onSort={(k) => setSort((s) => nextSortState(s, k))}
            />
            <ColumnHeader
              className={REPORT_ROW_COLUMNS.modules}
              label="Modules"
              sortKey="modules"
              state={sort}
              sortable={features.sorting}
              onSort={(k) => setSort((s) => nextSortState(s, k))}
            />
            {/* Networks: header frame is intentionally empty in Figma. */}
            <div className={REPORT_ROW_COLUMNS.networks} aria-hidden="true" />
            <div className={REPORT_ROW_COLUMNS.actions} aria-hidden="true" />
          </div>
        )}
      </div>{/* /sticky chrome wrapper */}

      {/* Body — pagination removed, so we render the entire `sorted`
          list. The page is its own scroll container (see
          ReportsLandingPage), so a 99-row "many" scenario just scrolls
          naturally. The empty-state copy keys off `reports.length`
          (the SOURCE list) so a filter that reduces results to zero
          shows "No matches", while an authentically empty list shows
          the first-run "No reports yet" copy. */}
      {sorted.length === 0 ? (
        <EmptyState
          title={reports.length === 0 ? 'No reports yet' : 'No matches'}
          description={
            reports.length === 0
              ? 'Build your first report from a template above.'
              : 'Try removing a filter or two to see more reports.'
          }
        />
      ) : (
        <div>
          {sorted.map((r, i) => (
            <ReportRow
              key={r.id}
              report={r}
              isLast={i === sorted.length - 1}
              renameEnabled={features.rename}
              renaming={renamingId === r.id}
              onStartRename={() => setRenamingId(r.id)}
              onCommitRename={(next) => {
                onRename(r.id, next);
                setRenamingId(null);
              }}
              onCancelRename={() => setRenamingId(null)}
              onOpen={() => onOpen(r)}
              onAction={(a) => handleAction(r, a)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog — Figma 1366:346431. Open whenever
          a row has been staged for deletion via the action menu; we
          commit `onDelete` only on confirm so Cancel / backdrop /
          Escape leave the report untouched. */}
      <DeleteReportModal
        open={pendingDelete !== null}
        reportName={pendingDelete?.name ?? ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </section>
  );
}

// ── Filter chips ────────────────────────────────────────────────────────────
//
// Figma 1674:43486 / 44025 / 44394 / 44910 — three chip shapes that
// share a common pill chrome (h-32 px-12 rounded-4 1-px #E8E8E9
// border, white bg). Each chip has a clickable label region (opens
// the relevant editor) + a trailing × button that removes the filter
// without opening the editor.
//
// `onRemove` stops event propagation so the X button doesn't also
// fire the chip's "open editor" behavior.

const CHIP_BASE = cn(
  'h-[32px] px-[12px] rounded-[4px] inline-flex items-center gap-[8px]',
  'border border-[#E8E8E9] bg-white',
  'text-[12px] leading-[21px] font-medium text-[#201E24]',
  'hover:bg-[#F3F3F4] transition-colors cursor-pointer',
);

interface NetworkChipProps {
  networks: Platform[];
  onClick: () => void;
  onRemove: () => void;
}

function NetworkChip({ networks, onClick, onRemove }: NetworkChipProps) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={CHIP_BASE}
      aria-label="Edit Network filter"
    >
      <span>Network</span>
      <span className="flex items-center gap-[4px]">
        {networks.slice(0, 3).map((p) => (
          <span key={p} className="inline-flex items-center justify-center w-[16px] h-[16px]">
            <PlatformIcon platform={p} size={16} />
          </span>
        ))}
        {networks.length > 3 && (
          <span className="text-[12px] leading-[16px] text-[#626165]">
            +{networks.length - 3}
          </span>
        )}
      </span>
      <ChipRemoveButton onRemove={onRemove} />
    </span>
  );
}

interface UserChipProps {
  users: FilterUser[];
  onClick: () => void;
  onRemove: () => void;
}

function UserChip({ users, onClick, onRemove }: UserChipProps) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={CHIP_BASE}
      aria-label="Edit User filter"
    >
      <span>User</span>
      <span className="flex items-center gap-[4px]">
        {users.slice(0, 3).map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-[3px] bg-[#4D36FF] text-white"
            style={{ fontSize: 9, fontWeight: 600, lineHeight: 1 }}
          >
            {u.initials.slice(0, 2).toUpperCase()}
          </span>
        ))}
        {users.length > 3 && (
          <span className="text-[12px] leading-[16px] text-[#626165]">
            +{users.length - 3}
          </span>
        )}
      </span>
      <ChipRemoveButton onRemove={onRemove} />
    </span>
  );
}

interface NameContainsChipProps {
  value: string;
  onClick: () => void;
  onRemove: () => void;
}

function NameContainsChip({ value, onClick, onRemove }: NameContainsChipProps) {
  // Figma 1674:44394 paints the chip with a SUBTLE distinction
  // between the label "Name contains" (in a softer neutral) and the
  // value (in the on-background dark) — gives the user a visual
  // handle on which part is editable.
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={CHIP_BASE}
      aria-label="Edit Name contains filter"
    >
      <span className="text-[#626165]">Name contains</span>
      <span className="text-[#201E24]">{value}</span>
      <ChipRemoveButton onRemove={onRemove} />
    </span>
  );
}

function ChipRemoveButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Stop the click from also reaching the chip-level click
        // handler (which would open the editor). The X always means
        // "remove" with no editor follow-up.
        e.stopPropagation();
        onRemove();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label="Remove filter"
      className={cn(
        'inline-flex items-center justify-center w-[16px] h-[16px] rounded-[2px]',
        'text-[#201E24] hover:bg-[rgba(32,30,36,0.1)] transition-colors cursor-pointer',
      )}
    >
      <IconClose size={12} color="#201E24" />
    </button>
  );
}

// ── Column header ──────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  className: string;
  label: string;
  sortKey: SortKey;
  state: SortState;
  /** When false the header is a static label — no sort glyph, no
   *  click target, no hover affordance. Driven by the `sorting`
   *  feature flag in the Scenario Switcher. */
  sortable: boolean;
  onSort: (key: SortKey) => void;
}

function ColumnHeader({
  className,
  label,
  sortKey,
  state,
  sortable,
  onSort,
}: ColumnHeaderProps) {
  // Static (non-sortable) variant — render as a plain label with no
  // glyph, no cursor, no click handler.  Same column class so the row
  // still aligns with the body.
  if (!sortable) {
    return (
      <div
        className={cn(
          className,
          'flex items-center text-left',
          'text-[14px] leading-[18px] font-medium tracking-[0.07px] text-[#626165]',
        )}
      >
        <span>{label}</span>
      </div>
    );
  }

  const active = state.key === sortKey;
  // Per Figma 830:44403 ("Sorting states") the GLYPH itself swaps with
  // sort state — not just the color:
  //   • inactive → `select` (dual up+down chevron, #626165)
  //   • active desc → `sort_down` (line + down-chevron, #363439)
  //   • active asc  → `sort_up`   (line + up-chevron,   #363439)
  // All three icons share the same 10.26×16.26 footprint inside the
  // 16-tile so the column header doesn't reflow on state change.
  const iconColor = active ? '#363439' : '#626165';
  const SortIcon = !active
    ? IconSortUpDown
    : state.dir === 'desc'
      ? IconSortDown
      : IconSortUp;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        className,
        'flex items-center gap-[4px] text-left cursor-pointer',
        'text-[14px] leading-[18px] font-medium tracking-[0.07px]',
        active ? 'text-[#363439]' : 'text-[#626165]',
        'hover:text-[#363439] transition-colors',
      )}
    >
      <span>{label}</span>
      <SortIcon size={16} color={iconColor} />
    </button>
  );
}
