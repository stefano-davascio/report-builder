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

import { useEffect, useMemo, useRef, useState } from 'react';
import { MockReport, FILTER_OPTIONS } from '@/lib/reports-data';
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
  IconSearch,
  IconChevronDown,
  IconChevronRight,
} from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

interface ReportsTableProps {
  reports: MockReport[];
  onOpen: (report: MockReport) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Show the search input above the column header strip.  Driven by
   *  the Scenario Switcher's "many" / "filtered" presets — designs
   *  spec it as hidden when the list is small enough that scanning is
   *  faster than typing. */
  searchEnabled?: boolean;
  /** Show the pagination footer below the row body when there's more
   *  than one page worth of results.  Same Scenario-Switcher gating —
   *  small lists don't need pagination chrome. */
  paginationEnabled?: boolean;
  /** Filter chip ids to start with selected.  Used by the
   *  Scenario Switcher's "filtered" preset so the table mounts with a
   *  pre-applied filter chip + reduced result set, without forcing the
   *  parent to reach into the table's internal state. */
  initialFilters?: ReadonlySet<string>;
}

/**
 * Allowed values for the "N per page" pagination selector — Figma spec
 * defaults to 10. Hoisted out of state so the dropdown options and the
 * default value share a single source of truth.
 */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 10;

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
  searchEnabled = false,
  paginationEnabled = false,
  initialFilters,
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
  // Free-text search query — only meaningful when `searchEnabled` is
  // true; the input itself is conditionally rendered, so for small
  // lists this state stays at "" and adds no overhead.
  const [searchQuery, setSearchQuery] = useState('');
  // Current page (1-indexed). Reset to 1 whenever filters or search
  // change so the user never lands on an empty page after narrowing
  // results.
  const [page, setPage] = useState(1);
  // Page-size state — drives both the row slice math and the
  // pagination footer's "N per page" selector. Defaults to 10 (Figma
  // spec) and the user can pick from PAGE_SIZE_OPTIONS via the
  // dropdown trigger at the right edge of the pagination footer.
  // Changing the size resets the page to 1 so we don't end up on a
  // page index that no longer exists at the new size.
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const handlePageSizeChange = (next: PageSize) => {
    setPageSize(next);
    setPage(1);
  };
  // Initial sort intentionally has NO active key — every column should
  // render with the neutral `IconSortUpDown` glyph until the user
  // clicks one. The mock data is already in modifiedAt-desc order at
  // the source so the default render matches the prior implicit sort
  // visually; only the directional indicator on the Modified header is
  // suppressed.
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
  // Search runs ON TOP of filters: chips first, then case-insensitive
  // substring match against the report name.
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
    if (searchEnabled && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return rows;
  }, [reports, selectedFilters, searchEnabled, searchQuery]);

  // ── Sorting ──────────────────────────────────────────────────────────────
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

  // ── Pagination ───────────────────────────────────────────────────────────
  // Page math runs after sort so the page slice respects the active
  // ordering.  When pagination is OFF we render every row (no slice);
  // the math still runs but `pageRows === sorted`.
  const totalPages = paginationEnabled
    ? Math.max(1, Math.ceil(sorted.length / pageSize))
    : 1;
  // Guard against the user being on a page that no longer has rows
  // (e.g. they were on page 3, applied a filter that left only 1
  // page).  Clamp the displayed page without touching the state — a
  // useEffect below brings the state back in line for the next render.
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = paginationEnabled
    ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    : sorted;

  // Reset to page 1 whenever the result count changes — keeps the user
  // on something visible after they apply a filter or type a query.
  // Tracked via a ref-style memo so we don't fight React's render cycle.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

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
                Hidden when the source list is empty. */}
            {!isSourceEmpty && (
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

            {/* Filter chips — same row as the trigger. */}
            {!isSourceEmpty && chips.length > 0 && (
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

          {/* Search bar — Figma 1583:461039 / 1597:462252:
              bg DARK/dark--tint_95 (#F3F3F4), max-w 244, min-w 200,
              padding 10/8, radius 6, gap-8 between leading 16-px
              search icon + 12/24 Regular placeholder in #78767C. The
              input itself is unstyled (bg transparent, no border, no
              outline) so it inherits the wrapper's visual treatment.
              Mounted only when `searchEnabled` and the source list
              has rows — searching an empty list is a no-op surface. */}
          {searchEnabled && !isSourceEmpty && (
            <div
              className={cn(
                'flex items-center gap-[8px] bg-[#F3F3F4] rounded-[6px]',
                'px-[10px] py-[8px] min-w-[200px] max-w-[244px] w-full',
              )}
            >
              <IconSearch size={16} color="#78767C" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                aria-label="Search reports"
                className={cn(
                  'flex-1 min-w-0 bg-transparent border-0 outline-none',
                  'text-[12px] leading-[24px] text-[#201E24] placeholder:text-[#78767C]',
                )}
              />
            </div>
          )}
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
              onSort={(k) => setSort((s) => nextSortState(s, k))}
            />
            <ColumnHeader
              className={REPORT_ROW_COLUMNS.modules}
              label="Modules"
              sortKey="modules"
              state={sort}
              onSort={(k) => setSort((s) => nextSortState(s, k))}
            />
            {/* Networks: header frame is intentionally empty in Figma. */}
            <div className={REPORT_ROW_COLUMNS.networks} aria-hidden="true" />
            <div className={REPORT_ROW_COLUMNS.actions} aria-hidden="true" />
          </div>
        )}
      </div>{/* /sticky chrome wrapper */}

      {/* Body — `pageRows` instead of `sorted` so pagination's slice
          actually narrows the rendered set when enabled. When
          pagination is OFF, `pageRows === sorted`, so the empty / row
          paths behave the same as before. The empty-state copy keys
          off `reports.length === 0` (the SOURCE list) rather than
          `pageRows.length === 0`, so a search/filter that reduces the
          result count correctly shows the "No matches" copy instead
          of the first-run "No reports yet" copy. */}
      {pageRows.length === 0 ? (
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
          {pageRows.map((r, i) => (
            <ReportRow
              key={r.id}
              report={r}
              isLast={i === pageRows.length - 1}
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

      {/* Pagination footer — mounts whenever the table has rows and
          the scenario asks for pagination chrome.  We deliberately do
          NOT gate on `totalPages > 1` here: the per-page selector
          inside the footer needs to stay reachable even on a single
          page result so the user can bump the size DOWN (e.g. 25 → 10)
          and re-engage paging.  The Previous / Next / page-number
          pills hide internally when `totalPages <= 1` — see
          `PaginationFooter` below. */}
      {paginationEnabled && sorted.length > 0 && (
        <PaginationFooter
          page={safePage}
          totalPages={totalPages}
          totalItems={sorted.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
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

// ── Pagination ─────────────────────────────────────────────────────────────
//
// Figma 1597:463997 ("Pagination Container") — horizontally-stacked
// row sitting centered below the table:
//
//   ┌───────────┬───────────────────┬────────────┬──────────────┐
//   │ Previous  │ 1   2   3   4 … │   Next →   │ 10 per page▼ │
//   └───────────┴───────────────────┴────────────┴──────────────┘
//
// Pieces, left → right:
//   • Previous pill  — chevron_left + "Previous", h-32 px-12 rounded-4,
//     bg white, label color #908F92 when at page 1 (visually disabled
//     even though the button itself is just inert), 12/21 IBM Plex Sans
//     Medium.
//   • Page numbers   — h-32 min-w-32 px-2 rounded-4. Active page gets
//     bg #EDEAFF and label #4D36FF; inactive bg white, label #201E24.
//   • Next pill      — "Next" + chevron_right, h-32 px-12 rounded-4,
//     bg white, label #201E24 (or #908F92 when at last page).
//   • Per-page menu  — bordered (1 px #E8E8E9) pill, h-32 px-13, label
//     "{N} per page" + chevron_down, bg white, label #201E24. Click
//     opens a small upward menu with the values from
//     PAGE_SIZE_OPTIONS — the dropdown opens UPWARD because it lives
//     at the page bottom and a downward menu would clip below the
//     viewport edge.

interface PaginationFooterProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: PageSize;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: PageSize) => void;
}

function PaginationFooter({
  page,
  totalPages,
  totalItems: _totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationFooterProps) {
  // Show the page navigation cluster (Previous + numbers + Next) only
  // when there's somewhere to navigate to.  On a single-page result
  // we still render the per-page selector so the user can shrink the
  // size and re-engage paging (e.g. switch from 25 → 10 on a 25-row
  // dataset and watch pagination kick back in).
  const showPageNav = totalPages > 1;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <div
      // Centered horizontally below the body — Figma's
      // "Pagination Container" sits at justify-center / mt-24 inside
      // the 1114-px content column.
      className="flex items-center justify-center gap-[6px] mt-[24px] mb-[40px]"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {showPageNav && (
        <>
          <NavPill
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            ariaLabel="Previous page"
            leadingChevronDirection="left"
            label="Previous"
          />
          <div className="flex items-center gap-[6px]">
            {pages.map((p) => (
              <PageNumber
                key={p}
                active={p === page}
                onClick={() => onPageChange(p)}
                label={p}
              />
            ))}
          </div>
          <NavPill
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            ariaLabel="Next page"
            trailingChevronDirection="right"
            label="Next"
          />
        </>
      )}
      <PerPageSelector pageSize={pageSize} onChange={onPageSizeChange} />
    </div>
  );
}

// "Previous" / "Next" pills — share geometry; only the chevron side
// and the disabled-when-at-edge label color differ.
function NavPill({
  label,
  onClick,
  disabled,
  ariaLabel,
  leadingChevronDirection,
  trailingChevronDirection,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  leadingChevronDirection?: 'left' | 'right';
  trailingChevronDirection?: 'left' | 'right';
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'h-[32px] min-w-[32px] px-[12px] rounded-[4px] bg-white',
        'inline-flex items-center justify-center gap-[8px]',
        'text-[12px] leading-[21px] font-medium transition-colors',
        disabled ? 'text-[#908F92] cursor-default' : 'text-[#201E24] hover:bg-[#F3F3F4]',
      )}
    >
      {leadingChevronDirection && (
        <Chevron direction={leadingChevronDirection} disabled={disabled} />
      )}
      <span>{label}</span>
      {trailingChevronDirection && (
        <Chevron direction={trailingChevronDirection} disabled={disabled} />
      )}
    </button>
  );
}

function PageNumber({
  label,
  active,
  onClick,
}: {
  label: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={`Page ${label}`}
      className={cn(
        'h-[32px] min-w-[32px] px-[2px] rounded-[4px]',
        'inline-flex items-center justify-center transition-colors',
        'text-[12px] leading-[21px] font-medium',
        active
          ? 'bg-[#EDEAFF] text-[#4D36FF]'
          : 'bg-white text-[#201E24] hover:bg-[#F3F3F4]',
      )}
    >
      {label}
    </button>
  );
}

function PerPageSelector({
  pageSize,
  onChange,
}: {
  pageSize: PageSize;
  onChange: (next: PageSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click — the menu lives in the same DOM subtree as
  // the trigger (no portal), so a single ancestor check resolves
  // "inside the menu" vs "elsewhere on the page".
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      const menu = document.querySelector('[data-per-page-menu]');
      if (menu && menu.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Escape closes the menu — keeps keyboard users from being trapped.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Items per page"
        className={cn(
          'h-[32px] min-w-[32px] px-[13px] rounded-[4px] bg-white',
          'inline-flex items-center justify-center gap-[8px]',
          'border border-[#E8E8E9]',
          'text-[12px] leading-[21px] font-medium text-[#201E24]',
          'hover:bg-[#F3F3F4] transition-colors',
        )}
      >
        <span>{pageSize} per page</span>
        <IconChevronDown size={16} color="#201E24" />
      </button>

      {open && (
        // Menu opens UPWARD: the pagination footer sits at the bottom
        // of the page, so a downward-opening menu would clip below the
        // viewport.  `bottom: calc(100% + 4 px)` anchors the menu's
        // bottom edge 4 px above the trigger's top edge — same 4 px
        // gap that toolbar / link popovers elsewhere use.
        <ul
          data-per-page-menu
          role="listbox"
          aria-label="Items per page"
          className={cn(
            'absolute right-0 z-30 min-w-[120px]',
            'bg-white border border-[#E8E8E9] rounded-[6px] py-1',
          )}
          style={{
            bottom: 'calc(100% + 4px)',
            boxShadow:
              '0px 1px 8px 0px rgba(27,27,32,0.12), 0px 3px 4px 0px rgba(27,27,32,0.14)',
            fontFamily: 'IBM Plex Sans, sans-serif',
          }}
        >
          {PAGE_SIZE_OPTIONS.map((opt) => {
            const active = opt === pageSize;
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full h-[32px] px-[12px] flex items-center justify-between gap-[8px]',
                    'text-[12px] leading-[21px] font-medium transition-colors',
                    active
                      ? 'bg-[#EDEAFF] text-[#4D36FF]'
                      : 'text-[#201E24] hover:bg-[#F3F3F4]',
                  )}
                >
                  <span>{opt} per page</span>
                  {active && (
                    // Subtle confirmation dot for the currently-selected
                    // option — keeps the row reading as "this is the
                    // active value" without needing a separate check
                    // glyph in the icon catalog.
                    <span className="w-[6px] h-[6px] rounded-full bg-[#4D36FF]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chevron({
  direction,
  disabled,
}: {
  direction: 'left' | 'right';
  disabled?: boolean;
}) {
  // Use the IconChevronRight glyph for both directions, rotated 180°
  // when we need a left-facing chevron — keeps a single source of
  // truth for the chevron path.
  return (
    <span
      style={{
        display: 'inline-flex',
        transform: direction === 'left' ? 'rotate(180deg)' : undefined,
      }}
    >
      <IconChevronRight size={16} color={disabled ? '#908F92' : '#201E24'} />
    </span>
  );
}

// ── Column header ──────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  className: string;
  label: string;
  sortKey: SortKey;
  state: SortState;
  onSort: (key: SortKey) => void;
}

function ColumnHeader({ className, label, sortKey, state, onSort }: ColumnHeaderProps) {
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
