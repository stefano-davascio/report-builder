'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChartType } from '@/types';
import { cn } from '@/lib/utils';
import {
  IconActivity,
  IconBarChart,
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
//
// `line` uses `IconActivity` (heartbeat / pulse zigzag, Figma
// 2042:42209 — the bare wavy-line glyph) rather than `IconLineChart`
// (ChartLineUp — wavy line nested inside an L-axis frame, used by
// module headers and the visual-type chip row).  The hover toolbar
// wants the SIMPLER glyph so all three chart-type segments
// (line / area / bar) read at the same visual weight; the axis
// frame on `IconLineChart` makes it heavier than its siblings at
// this 16-px tile size.
function chartIcon(type: ChartType, size = 16): ReactNode {
  switch (type) {
    case 'line':   return <IconActivity size={size} />;
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

// Figma 2042:42209 — Elevation 1 (surface/shadow/elevation-12 / 14 / 20)
// applied to BOTH hover-toolbar pills (chart-type group + actions
// group).  The pills used to render flat; the updated design lifts
// them off the card with a subtle 3-stack shadow so the toolbar
// reads as floating chrome rather than a baked-in header.
const TOOLBAR_PILL_SHADOW =
  '0px 1px 3px 0px rgba(27,27,32,0.12), 0px 1px 1px 0px rgba(27,27,32,0.14), 0px 2px 1px -1px rgba(27,27,32,0.2)';

// Figma 2042:42209 — pill chrome shared by both the chart-type
// group and the duplicate/delete group.  Centralizing it here keeps
// the two groups (and the compact-mode single pills below) visually
// in lockstep when this spec evolves.
//
//   • `p-[2px]` — 2 px inset around the inner buttons.  Previously
//     buttons sat flush against the pill border (with the outer
//     `overflow-hidden` clipping the corners); the design now
//     insets them so each button reads as its own tap target.
//   • `gap-[2px]` — 2 px breathing room between sibling buttons,
//     replacing the old 1 px vertical divider in the duplicate/
//     delete group.  Inset + gap together is the new way the
//     design separates the buttons.
//   • `shadow` — Elevation 1 (see above).
const PILL_CLASSES =
  'flex items-center gap-[2px] p-[2px] bg-white border border-[#E8E8E9] rounded-[6px]';

// Inner button chrome — used by every icon button inside a pill.
// 28×28 footprint stays the same as before (16-px icon + 6-px
// halo from p-[6px]).  What's new:
//   • `rounded-[4px]` — each button now rounds itself instead of
//     relying on the outer pill's `overflow-hidden`.  The pill no
//     longer clips, so the active-state background fully shows its
//     own 4-px corners (4 px inner radius nested inside the pill's
//     6 px outer radius — a clean 2-px ring of pill-bg around it).
//   • Hover bg: `rgba(32,30,36,0.05)` (DARK/dark--alpha_05) — the
//     Figma updated the hover token from the page-grey `#F3F3F4`
//     used elsewhere to this near-black-at-5 % wash so the hover
//     reads as subtle ink on the white pill instead of swapping
//     the bg to the grey of the canvas behind it.
const TOOLBAR_BTN_BASE =
  'flex items-center justify-center w-7 h-7 p-[6px] rounded-[4px] transition-colors [&_path]:[stroke-width:1.25]';
const TOOLBAR_BTN_HOVER = 'hover:bg-[rgba(32,30,36,0.05)]';

/**
 * Dumb renderer — visibility is controlled by the parent ModuleCard
 * (hover-gated). Switches between NORMAL and COMPACT based on the
 * observed card width passed in from the parent.
 */
export function ModuleActions(props: ModuleActionsProps) {
  // The COMPACT layout exists because the chart-type pill + the
  // duplicate/delete pill together don't fit alongside the title on
  // narrow cards.  When the chart-type pill isn't rendered to begin
  // with (single supported chart type — e.g. metric cards), there's
  // no horizontal pressure: the duplicate/delete pill alone always
  // fits even on the narrowest cards, so we skip compact mode and
  // surface duplicate/delete inline.  Without this carve-out, metric
  // cards would hide both actions behind a kebab — a worse default
  // because the user has to click the kebab to discover what's
  // actually a 2-button toolbar.
  //
  // During the first paint `cardWidth` may be 0 (ResizeObserver
  // hasn't fired yet).  Fall back to NORMAL so the full-size layout
  // shows first; the compact switch only kicks in once we actually
  // measure a sub-threshold width AND the card has multiple chart
  // types to pick from.
  const canSwitch = props.supportedChartTypes.length > 1;
  const compact =
    canSwitch && props.cardWidth > 0 && props.cardWidth < COMPACT_THRESHOLD_PX;
  return compact ? <CompactActions {...props} /> : <NormalActions {...props} />;
}

// ── NORMAL layout ──────────────────────────────────────────────────────────
// Figma 2042:42209 — two rounded-6 bordered pill groups, each with
// `p-[2px]` inset and `gap-[2px]` between inner buttons, separated
// by an 8 px gap.  Both pills carry Elevation 1 so they read as
// floating chrome above the card.  Chart group: N × 28×28 segments
// (16-px icon + 6-px halo).  Duplicate/Delete group: 28×28 +
// 2-px-gap + 28×28 — the 1 px divider used to sit between them; the
// new design replaces it with the pill's own inset+gap.
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
        <div className={PILL_CLASSES} style={{ boxShadow: TOOLBAR_PILL_SHADOW }}>
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
                  TOOLBAR_BTN_BASE,
                  // Active wash is `PRIMARY/primary--tint_90`
                  // (#EDEAFF, Figma 2010:42707).  Icon adopts
                  // BRAND/primary (#4D36FF) so the active segment
                  // reads as a purple tint even when the glyph is
                  // small.  Non-active segments take the dark text
                  // token and pick up the hover wash on pointerover.
                  active
                    ? 'bg-[#EDEAFF] text-[#4D36FF]'
                    : cn('bg-white text-[#363439]', TOOLBAR_BTN_HOVER),
                )}
              >
                {chartIcon(type, 16)}
              </button>
            );
          })}
        </div>
      )}
      <div className={PILL_CLASSES} style={{ boxShadow: TOOLBAR_PILL_SHADOW }}>
        <button
          type="button"
          onClick={onDuplicate}
          onMouseDown={(e) => e.stopPropagation()}
          title="Duplicate module"
          className={cn(TOOLBAR_BTN_BASE, 'bg-white text-[#363439]', TOOLBAR_BTN_HOVER)}
        >
          <IconCopy size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          onMouseDown={(e) => e.stopPropagation()}
          title="Delete module"
          className={cn(TOOLBAR_BTN_BASE, 'bg-white text-[#363439]', TOOLBAR_BTN_HOVER)}
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
            // Compact-mode pills carry the same Elevation 1 shadow
            // and DARK/dark--alpha_05 hover wash as the
            // normal-mode pills (Figma 2042:42209) so the toolbar
            // chrome reads consistently across the breakpoint.
            // Open-state bg also moves to the alpha-05 wash —
            // matches the wider-card "pressed pill" treatment.
            className={cn(
              'flex items-center gap-2 p-[6px] h-7 border border-[#E8E8E9] rounded-[6px] transition-colors',
              chartOpen
                ? 'bg-[rgba(32,30,36,0.05)]'
                : 'bg-white hover:bg-[rgba(32,30,36,0.05)]',
            )}
            style={{ boxShadow: TOOLBAR_PILL_SHADOW }}
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
          // Matches the chart-trigger pill above — same elevation,
          // same alpha-05 hover / open wash.
          className={cn(
            'flex items-center justify-center w-7 h-7 p-[6px] border border-[#E8E8E9] rounded-[6px] transition-colors',
            overflowOpen
              ? 'bg-[rgba(32,30,36,0.05)]'
              : 'bg-white hover:bg-[rgba(32,30,36,0.05)]',
          )}
          style={{ boxShadow: TOOLBAR_PILL_SHADOW }}
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
export function DropdownSurface({
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

export function DropdownItem({
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
        className="flex items-center gap-4 h-10 px-4 py-2 rounded-[4px] hover:bg-[rgba(32,30,36,0.05)] transition-colors w-full"
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

/**
 * `DropdownSeparator` — a 1-px hairline between two clusters of
 * dropdown items.  Renders as an `<li role="separator">` so screen
 * readers announce the break.  `mx-[-8px]` so the line spans the
 * full surface width (countering the parent `<ul>`'s `px-2`).
 */
export function DropdownSeparator() {
  return (
    <li role="separator" aria-hidden="true" className="my-[6px] h-px bg-[#E8E8E9] mx-[-8px]" />
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
