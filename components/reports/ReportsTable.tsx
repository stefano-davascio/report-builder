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

import { useEffect, useMemo, useState } from 'react';
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

const PAGE_SIZE = 10;

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
    ? Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    : 1;
  // Guard against the user being on a page that no longer has rows
  // (e.g. they were on page 3, applied a filter that left only 1
  // page).  Clamp the displayed page without touching the state — a
  // useEffect below brings the state back in line for the next render.
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = paginationEnabled
    ? sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
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
      {/* Optional search input — only mounts when `searchEnabled` is
          true (Scenario Switcher's "many" / "filtered" presets) AND
          the source list is non-empty.  Searching an empty list is a
          no-op surface and the design hides it on the empty state. */}
      {searchEnabled && !isSourceEmpty && (
        <div className="mb-[16px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports by name..."
            aria-label="Search reports"
            className={cn(
              'w-full max-w-[360px] h-[36px] px-[12px] rounded-[6px]',
              'border border-[#E8E8E9] bg-white',
              'text-[14px] leading-[21px] text-[#201E24] placeholder:text-[#9C9B9D]',
              'focus:outline-none focus:border-[#4D36FF]',
            )}
          />
        </div>
      )}

      {/* Header strip — "Reports" title + filter trigger sit INLINE
          (Figma Frame 1295:124153 uses `flex gap-16 items-start`, not
          a justify-between split). Selected chips spill to the right of
          the filter button so the title + add-filter cluster stays
          anchored at the leading edge. mb-24 = Frame 152's gap-24 to
          the column-header strip. Title is Sans-Medium/16 (16/24). */}
      <div className="flex items-start gap-[16px] mb-[24px] flex-wrap gap-y-[8px]">
        <h2 className="text-[16px] leading-[24px] font-medium text-[#201E24]">
          Reports
        </h2>

        {/* Filter trigger — outlined "secondary" button per Figma node
            1295:124155: h-32, px-13, 4-px radius, 1-px #201E24 @ 20 %
            border, gap-7 between icon and label, `plus_circle` glyph
            at 18 px (catalog `IconPlusCircle`, not `IconPlus`), 12/21
            Medium #201E24 label.
            Hidden when the source list is empty (Figma 1452:457037 —
            empty state collapses all list-level chrome). */}
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
                <IconPlusCircle size={18} color="#201E24" />
                <span>Filter{count > 0 ? ` · ${count}` : ''}</span>
              </span>
            )}
          />
        )}

        {/* Filter chips — render to the right of the trigger. Active
            selections still live in the same eye-line as the button
            that produced them. (Source-empty already hides everything
            via the early return above; chips can never be present when
            there are no rows because there's no filter button to set
            them — but we still gate to be safe.) */}
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
          no columns to label). */}
      {!isSourceEmpty && (
        <div className="flex items-center h-[48px] border-b border-[#F3F3F4]">
          <ColumnHeader
            className={REPORT_ROW_COLUMNS.name}
            label="Name"
            sortKey="name"
            state={sort}
            onSort={(k) => setSort((s) => nextSortState(s, k))}
          />
          {/* "Modified" — was "Date modified", but the cell renders a
              relative-time label (seconds / minutes / hours / days ago),
              never an absolute date, so the shorter "Modified" describes
              the column more accurately and matches the spec. */}
          <ColumnHeader
            className={REPORT_ROW_COLUMNS.date}
            label="Modified"
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

      {/* Pagination footer — only mounts when `paginationEnabled` AND
          there's actually more than one page worth of results. A
          single-page result set hides the footer entirely so the UI
          doesn't surface controls that wouldn't move anywhere. */}
      {paginationEnabled && totalPages > 1 && (
        <PaginationFooter
          page={safePage}
          totalPages={totalPages}
          totalItems={sorted.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
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

interface PaginationFooterProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (next: number) => void;
}

/**
 * Pagination footer — minimal controls scoped to the demo tool's "many"
 * preset. Renders the visible-row range ("11–20 of 25"), prev/next
 * buttons, and a numbered page strip with current-page highlight.
 * Visually quieter than the row body so it reads as scaffolding rather
 * than competing with the rows themselves.
 */
function PaginationFooter({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationFooterProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <div
      className="flex items-center justify-between mt-[16px] pt-[16px] border-t border-[#F3F3F4] text-[13px] text-[#4C4B4F]"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      <span>
        {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-[4px]">
        <PageButton
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          ariaLabel="Previous page"
        >
          ‹
        </PageButton>
        {pages.map((p) => (
          <PageButton
            key={p}
            active={p === page}
            onClick={() => onPageChange(p)}
            ariaLabel={`Page ${p}`}
          >
            {p}
          </PageButton>
        ))}
        <PageButton
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          ariaLabel="Next page"
        >
          ›
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  active,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      className={cn(
        'min-w-[28px] h-[28px] px-[8px] rounded-[4px] flex items-center justify-center',
        'text-[13px] leading-[16px] transition-colors',
        active
          ? 'bg-[#EDEAFF] text-[#4D36FF]'
          : 'text-[#4C4B4F] hover:bg-[#F3F3F4]',
        disabled && 'opacity-40 cursor-default hover:bg-transparent',
      )}
    >
      {children}
    </button>
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
