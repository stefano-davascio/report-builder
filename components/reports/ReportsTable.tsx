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
}

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
}: ReportsTableProps) {
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
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
  const filtered = useMemo(() => {
    if (selectedFilters.size === 0) return reports;
    const selectedNetworks = new Set<string>();
    for (const id of selectedFilters) {
      const opt = FILTER_OPTIONS.find((o) => o.id === id);
      if (!opt || opt.category !== 'Network') continue;
      selectedNetworks.add(opt.label.toLowerCase());
    }
    if (selectedNetworks.size === 0) return reports;
    return reports.filter((r) => r.networks.some((n) => selectedNetworks.has(n)));
  }, [reports, selectedFilters]);

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
            Medium #201E24 label. */}
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

        {/* Filter chips — render to the right of the trigger. Active
            selections still live in the same eye-line as the button
            that produced them. */}
        {chips.length > 0 && (
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
          the trailing Actions cell off the right edge. */}
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

      {/* Body */}
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
