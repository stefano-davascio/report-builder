'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChartType } from '@/types';
import { cn } from '@/lib/utils';
import {
  IconBarChart,
  IconLineChart,
  IconAreaChart,
  IconPieChart,
  IconBubbleChart,
  IconMetric,
  IconTable,
  IconList,
  IconCopy,
  IconTrash,
  IconMoreVertical,
  IconChevronDown,
  IconCheck,
} from '@/components/icons/SendiIcons';

// Action-row icons render at 16×16 inside the 32×32 button tile
// (p-[8px] on each side). Dropdown rows still use the 20×20 variant;
// callers pass `20` explicitly for those.
function chartIcon(type: ChartType, size = 16): ReactNode {
  switch (type) {
    case 'line':   return <IconLineChart size={size} />;
    case 'area':   return <IconAreaChart size={size} />;
    case 'bar':    return <IconBarChart size={size} />;
    case 'pie':    return <IconPieChart size={size} />;
    case 'bubble': return <IconBubbleChart size={size} />;
    case 'metric': return <IconMetric size={size} />;
    case 'table':  return <IconTable size={size} />;
    case 'list':   return <IconList size={size} />;
  }
}

// Labels match the Figma dropdown text (1232:311162, 1232:311167,
// 1232:311172) — "Line chart", "Area chart", "Bar chart". Non-chart
// visual types keep their short form (Metric / Table / List).
const CHART_TYPE_LABELS: Record<ChartType, string> = {
  line:   'Line chart',
  area:   'Area chart',
  bar:    'Bar chart',
  pie:    'Pie chart',
  bubble: 'Bubble chart',
  metric: 'Metric',
  table:  'Table',
  list:   'List',
  // 'text' is a non-data canvas element and never appears in a module's
  // `supportedChartTypes` list, so this label is only here to satisfy the
  // exhaustive-record constraint on ChartType.
  text:   'Text',
};

interface ModuleActionsProps {
  supportedChartTypes: ChartType[];
  currentChartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /**
   * Observed width (px) of the module card. Drives the normal → compact
   * switch at the module level so each card decides its own layout —
   * NOT a viewport media query.
   */
  cardWidth: number;
  /**
   * Fires `true` whenever any dropdown inside the actions row opens
   * (chart-type picker or overflow menu) and `false` when they all
   * close. The parent ModuleCard keeps its hover-chrome mounted while
   * this is true so moving the cursor from the card into the portaled
   * dropdown surface doesn't unmount the dropdown mid-click.
   */
  onMenuOpenChange?: (open: boolean) => void;
}

// Below this card width, the full segmented control + duplicate/delete
// group will no longer fit next to the title; we switch to the compact
// variant (chart trigger + overflow). Figma shows the compact variant
// in frames 1232:311201 + 1232:311204, paired with a "Smaller screens"
// annotation (1232:311210) — the breakpoint is card-local, not
// viewport-based.
const COMPACT_THRESHOLD_PX = 360;

// Figma 1232:311153 — dropdown surface shadow tokens (3 stacked shadows).
const DROPDOWN_SHADOW =
  '0px 0px 0px 1px rgba(32,30,36,0.1), 0px 12px 8px -4px rgba(32,30,36,0.15), 0px 4px 4px -2px rgba(32,30,36,0.2)';

/**
 * Dumb renderer — visibility is controlled by the parent ModuleCard
 * (hover-gated). Switches between NORMAL and COMPACT based on the
 * observed card width passed in from the parent.
 */
export function ModuleActions(props: ModuleActionsProps) {
  // During the first paint `cardWidth` may be 0 (ResizeObserver hasn't
  // fired yet). Fall back to NORMAL so the full-size layout shows
  // first; the compact switch only kicks in once we actually measure a
  // sub-threshold width.
  const compact = props.cardWidth > 0 && props.cardWidth < COMPACT_THRESHOLD_PX;
  return compact ? <CompactActions {...props} /> : <NormalActions {...props} />;
}

// ── NORMAL layout ──────────────────────────────────────────────────────────
// Figma 1232:311142 — two rounded-6 bordered groups separated by an 8 px
// gap. Chart group: 3 × 32-wide segments with 20 px icons at p-6 inside.
// Duplicate/Delete group: 32 + 1 px divider + 32, same 20 px icon spec.
function NormalActions({
  supportedChartTypes,
  currentChartType,
  onChartTypeChange,
  onDuplicate,
  onDelete,
}: ModuleActionsProps) {
  const canSwitch = supportedChartTypes.length > 1;
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {canSwitch && (
        <div className="flex items-center bg-white border border-[#E8E8E9] rounded-[6px] overflow-hidden">
          {supportedChartTypes.map((type) => {
            const active = type === currentChartType;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onChartTypeChange(type)}
                onMouseDown={(e) => e.stopPropagation()}
                title={CHART_TYPE_LABELS[type]}
                className={cn(
                  // 28×28 segments wrapping a 16-px icon (p-[6px]
                  // gives a 6-px halo around the glyph). Stroke 1.25
                  // + #363439 fill match the native Figma asset (the
                  // library default 1.5 reads too heavy at this size).
                  'flex items-center justify-center w-7 h-7 p-[6px] transition-colors',
                  '[&_path]:[stroke-width:1.25]',
                  active
                    ? 'bg-[#EDEAFF] text-[#4D36FF]'
                    : 'bg-white text-[#363439] hover:bg-[#F3F3F4]',
                )}
              >
                {chartIcon(type, 16)}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center bg-white border border-[#E8E8E9] rounded-[6px] overflow-hidden">
        <button
          type="button"
          onClick={onDuplicate}
          onMouseDown={(e) => e.stopPropagation()}
          title="Duplicate module"
          className={cn(
            'flex items-center justify-center w-7 h-7 p-[6px]',
            'bg-white text-[#363439] hover:bg-[#F3F3F4] transition-colors',
            '[&_path]:[stroke-width:1.25]',
          )}
        >
          <IconCopy size={16} />
        </button>
        <div className="w-px h-7 bg-[#E8E8E9]" aria-hidden="true" />
        <button
          type="button"
          onClick={onDelete}
          onMouseDown={(e) => e.stopPropagation()}
          title="Delete module"
          className={cn(
            'flex items-center justify-center w-7 h-7 p-[6px]',
            'bg-white text-[#363439] hover:bg-[#F3F3F4] transition-colors',
            '[&_path]:[stroke-width:1.25]',
          )}
        >
          <IconTrash size={16} />
        </button>
      </div>
    </div>
  );
}

// ── COMPACT layout ─────────────────────────────────────────────────────────
// Figma 1232:311201 (chart trigger) + 1232:311204 (overflow kebab).
//   • Chart trigger: bordered rounded-6 pill, p-6 with 8 px gap between
//     active chart icon (20 px) and a chevron-down (16 px). Opens the
//     chart-type dropdown (1232:311153).
//   • Overflow: bordered rounded-6 32×32 square with a 20 px kebab icon.
//     Opens a dropdown with Duplicate / Delete.
// Both triggers stay `bg-[#F3F3F4]` while the menu is open (active
// state, Figma 1232:311234 / 1232:311237).
function CompactActions({
  supportedChartTypes,
  currentChartType,
  onChartTypeChange,
  onDuplicate,
  onDelete,
  onMenuOpenChange,
}: ModuleActionsProps) {
  const [chartOpen, setChartOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const chartBtnRef = useRef<HTMLButtonElement>(null);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);
  const canSwitch = supportedChartTypes.length > 1;

  // Notify the parent ModuleCard whenever ANY dropdown is open so it
  // can keep its hover-chrome mounted while the user moves the cursor
  // from the card edge into the portaled dropdown surface — without
  // this signal the chrome unmounts on mouseleave, taking the portal
  // child with it before the user can click Duplicate / Delete.
  useEffect(() => {
    onMenuOpenChange?.(chartOpen || overflowOpen);
  }, [chartOpen, overflowOpen, onMenuOpenChange]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Clicks inside a portaled dropdown aren't descendants of the
      // trigger refs — match them via the `data-module-dropdown`
      // attribute we stamp onto the portal root.
      const insideDropdown =
        target instanceof Element && !!target.closest('[data-module-dropdown]');
      if (insideDropdown) return;
      if (chartOpen && chartRef.current && !chartRef.current.contains(target)) {
        setChartOpen(false);
      }
      if (overflowOpen && overflowRef.current && !overflowRef.current.contains(target)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chartOpen, overflowOpen]);

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {canSwitch && (
        <div ref={chartRef} className="relative">
          <button
            ref={chartBtnRef}
            type="button"
            onClick={() => {
              setChartOpen((p) => !p);
              setOverflowOpen(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={CHART_TYPE_LABELS[currentChartType]}
            className={cn(
              'flex items-center gap-2 p-[6px] h-7 border border-[#E8E8E9] rounded-[6px] transition-colors',
              chartOpen ? 'bg-[#F3F3F4]' : 'bg-white hover:bg-[#F3F3F4]',
            )}
          >
            <span className="flex items-center justify-center text-[#4D36FF]">
              {chartIcon(currentChartType, 16)}
            </span>
            <IconChevronDown size={16} color="#4C4B4F" />
          </button>
          {chartOpen && (
            <ChartDropdown
              anchorRef={chartBtnRef}
              supportedChartTypes={supportedChartTypes}
              currentChartType={currentChartType}
              onSelect={(t) => {
                onChartTypeChange(t);
                setChartOpen(false);
              }}
            />
          )}
        </div>
      )}
      <div ref={overflowRef} className="relative">
        <button
          ref={overflowBtnRef}
          type="button"
          onClick={() => {
            setOverflowOpen((p) => !p);
            setChartOpen(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="More actions"
          className={cn(
            'flex items-center justify-center w-7 h-7 p-[6px] border border-[#E8E8E9] rounded-[6px] transition-colors',
            overflowOpen ? 'bg-[#F3F3F4]' : 'bg-white hover:bg-[#F3F3F4]',
          )}
        >
          <IconMoreVertical size={16} color="#4C4B4F" />
        </button>
        {overflowOpen && (
          <OverflowDropdown
            anchorRef={overflowBtnRef}
            onDuplicate={() => {
              onDuplicate();
              setOverflowOpen(false);
            }}
            onDelete={() => {
              onDelete();
              setOverflowOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Dropdowns ──────────────────────────────────────────────────────────────
// Figma 1232:311153. Surface: rounded-4, py-8, w-210 (min-192 max-240).
// Inner list: flex-col px-8. Row: h-40 px-16 py-8 gap-16 rounded-4,
// default bg-white, hover bg-[#F3F3F4]. Icon 20 × 20, label 14/14,
// active row shows a 16 × 16 check at the end.
//
// Rendered via createPortal so the menu escapes the module card's
// `overflow-hidden` — dropdowns open downward past the card border and
// must also clear any grid siblings below. Position is computed from
// the anchor's bounding box so the menu's RIGHT edge lines up with the
// anchor's right edge (matches Figma where the trigger sits at the far
// right of the header row).
function DropdownSurface({
  anchorRef,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef]);

  if (typeof document === 'undefined' || !pos) return null;

  return createPortal(
    <div
      // Both attrs let click-outside detection in the various callers
      // recognize this surface as "inside" — `data-module-dropdown` is
      // legacy, `data-text-overflow-menu` is what TextElement watches.
      data-module-dropdown="true"
      data-text-overflow-menu="true"
      className="fixed z-[60] bg-white rounded-[4px] py-2 w-[210px] min-w-[192px] max-w-[240px]"
      style={{ top: pos.top, right: pos.right, boxShadow: DROPDOWN_SHADOW }}
    >
      <ul className="flex flex-col px-2 w-full">{children}</ul>
    </div>,
    document.body,
  );
}

function DropdownItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <li className="w-full">
      <button
        type="button"
        onClick={onClick}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center gap-4 h-10 px-4 py-2 rounded-[4px] hover:bg-[#F3F3F4] transition-colors w-full"
      >
        <span className="flex-shrink-0 flex items-center justify-center text-[#4C4B4F]">
          {icon}
        </span>
        <span className="flex-1 min-w-0 text-left text-[14px] leading-[14px] tracking-[0.07px] text-[#201E24] truncate">
          {label}
        </span>
        {active && (
          <span className="flex-shrink-0 flex items-center justify-center text-[#201E24]">
            <IconCheck size={16} />
          </span>
        )}
      </button>
    </li>
  );
}

function ChartDropdown({
  anchorRef,
  supportedChartTypes,
  currentChartType,
  onSelect,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  supportedChartTypes: ChartType[];
  currentChartType: ChartType;
  onSelect: (t: ChartType) => void;
}) {
  return (
    <DropdownSurface anchorRef={anchorRef}>
      {supportedChartTypes.map((t) => (
        <DropdownItem
          key={t}
          icon={chartIcon(t, 20)}
          label={CHART_TYPE_LABELS[t]}
          active={t === currentChartType}
          onClick={() => onSelect(t)}
        />
      ))}
    </DropdownSurface>
  );
}

/**
 * Shared "Duplicate / Delete" overflow menu surface — anchored to the
 * trigger via `anchorRef`, portaled to `document.body`. Exported so
 * `TextElement` can reuse it (text modules show a single more-options
 * kebab matching the data-module compact layout, vs. two side-by-side
 * action buttons).
 */
export function OverflowDropdown({
  anchorRef,
  onDuplicate,
  onDelete,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownSurface anchorRef={anchorRef}>
      <DropdownItem
        icon={<IconCopy size={20} />}
        label="Duplicate"
        onClick={onDuplicate}
      />
      <DropdownItem
        icon={<IconTrash size={20} />}
        label="Delete"
        onClick={onDelete}
      />
    </DropdownSurface>
  );
}
