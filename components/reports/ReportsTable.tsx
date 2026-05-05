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
import { MockReport, FILTER_OPTIONS } from '@/lib/reports-data';
import type { ScenarioFeatures } from '@/lib/scenario';
import { FilterDropdown } from './FilterDropdown';
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
  /** Filter chip ids to start with selected.  Used by the
   *  Scenario Switcher's "filtered" preset so the table mounts with a
   *  pre-applied filter chip + reduced result set, without forcing the
   *  parent to reach into the table's internal state. */
  initialFilters?: ReadonlySet<string>;
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
  features = FEATURES_DEFAULT,
}: ReportsTableProps) {
  // Selected-filter state seeds from `initialFilters` so the
  // Scenario Switcher's "filtered" preset can mount with chips already
  // applied.  We deliberately don't sync to subsequent `initialFilters`
  // changes — once the user has picked their own chips the seed shouldn't
  // overwrite them. The `key={reportListState}` on this component upstream
  // takes care of remounting with a fresh seed when the scenario changes.
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(
    () => new Set(initialFilters ?? []),
  );
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
  // Only the Network category has data wiring today; the other category
  // selections render as chips but no-op against the data — preserves the
  // affordance end-to-end so the Figma drill-in pattern reads the same.
  const filtered = useMemo(() => {
    let rows = reports;
    if (selectedFilters.size > 0) {
      const selectedNetworks = new Set<string>();
      for (const id of selectedFilters) {
        const opt = FILTER_OPTIONS.find((o) => o.id === id);
        if (!opt || opt.category !== 'Network') continue;
        selectedNetworks.add(opt.label.toLowerCase());
      }
      if (selectedNetworks.size > 0) {
        rows = rows.filter((r) =>
          r.networks.some((n) => selectedNetworks.has(n)),
        );
      }
    }
    return rows;
  }, [reports, selectedFilters]);

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

  // ── Selected filter chips ────────────────────────────────────────────────
  const chips = [...selectedFilters]
    .map((id) => FILTER_OPTIONS.find((o) => o.id === id))
    .filter((o): o is (typeof FILTER_OPTIONS)[number] => Boolean(o));

  const toggleFilter = (id: string) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

            {/* Filter trigger — Figma 1597:463766: h-32, px-13,
                rounded-4, 1-px border #201E24 @ 20%, gap-7 between
                icon and label, IconPlusCircle 16 px (Figma uses 16-tile
                "Add filter icon"), 12/21 Medium #201E24 label.
                Visible only when `filterEnabled` — set true for the
                many / filtered scenarios where the list is long enough
                to need narrowing. Hidden in `few` (3 rows fit on one
                screen) and `empty` (nothing to filter). */}
            {filterEnabled && (
              <FilterDropdown
                options={FILTER_OPTIONS}
                selectedIds={selectedFilters}
                onToggle={toggleFilter}
                renderTrigger={(open, count) => (
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
                    <span>Filter{count > 0 ? ` · ${count}` : ''}</span>
                  </span>
                )}
              />
            )}

            {/* Filter chips — same row as the trigger.  Gated on the
                same `filterEnabled` flag as the trigger above so the
                chips can never outlive the trigger they're spawned
                from (e.g. switching scenario from filtered → few). */}
            {filterEnabled && chips.length > 0 && (
              <div className="flex items-center gap-[8px] flex-wrap">
                {chips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleFilter(c.id)}
                    className={cn(
                      'h-[28px] pl-[10px] pr-[6px] rounded-full bg-[#EDEAFF]',
                      'flex items-center gap-[6px] text-[13px] leading-[18px] font-medium text-[#4D36FF]',
                      'cursor-pointer hover:bg-[#DDD5FF] transition-colors',
                    )}
                  >
                    <span>{c.label}</span>
                    <span className="w-[16px] h-[16px] rounded-full hover:bg-[rgba(77,54,255,0.15)] flex items-center justify-center">
                      <IconClose size={12} color="#4D36FF" />
                    </span>
                  </button>
                ))}
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
