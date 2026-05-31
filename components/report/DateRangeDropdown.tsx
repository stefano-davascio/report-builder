'use client';

// ─── DateRangeDropdown ──────────────────────────────────────────────────
//
// Date-range picker that opens from the profile-bar's date-range
// trigger.  Figma 2173:48164 (preset view) and the matching
// calendar-month view shown on the same surface.
//
// Two views share the same anchored card:
//
//   1. Presets — four mutually-exclusive radios:
//        • Last 7 days
//        • Last 30 days
//        • Last 60 days
//        • <calendar icon>  <current custom range>
//   2. Calendar — a 7×6 month grid with month navigation, used to
//      pick a custom start + end date.  Clicking the custom row in
//      the preset view swaps the panel content to this calendar
//      without remounting the surface (so position + open-state
//      survive the switch).  The second date click commits the
//      range, flips the active preset to `'custom'`, and closes
//      the panel.
//
// All date math is local-time `Date` — the picker operates on
// calendar days, never on instants, so the host can serialize the
// range however it wants without worrying about timezone drift.

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCalendar } from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

/** The four mutually-exclusive range presets the picker exposes. */
export type DateRangePreset = '7d' | '30d' | '60d' | 'custom';

/** Inclusive start + end days for a custom range. */
export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangeDropdownProps {
  /** Trigger ref — drives the portaled card's position so it sits
   *  right-aligned under the button regardless of where the
   *  profile bar's chips push the trigger horizontally. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Currently selected preset.  Drives which radio reads as
   *  filled in the open card. */
  value: DateRangePreset;
  /** Current custom range — used as the calendar's starting
   *  selection + month, and surfaced as the formatted label in
   *  the custom row.  Caller-owned so the range survives
   *  open/close. */
  customRange: DateRange;
  /** Fires when the user changes the preset, including when the
   *  calendar commits a fresh custom range (which flips the
   *  preset to `'custom'`). */
  onChange: (next: DateRangePreset) => void;
  /** Fires when the calendar commits a fresh start + end pair.
   *  Caller stores it so the next open of the picker keeps the
   *  same selection painted. */
  onCustomRangeChange: (range: DateRange) => void;
  /** Close handler — called on outside-mousedown / Escape, and
   *  also after a successful preset / calendar commit. */
  onClose: () => void;
}

/** The list of preset rows.  `custom` is rendered last with the
 *  calendar glyph beside its dynamic label. */
const PRESETS: { id: Exclude<DateRangePreset, 'custom'>; label: string }[] = [
  { id: '7d',  label: 'Last 7 days'  },
  { id: '30d', label: 'Last 30 days' },
  { id: '60d', label: 'Last 60 days' },
];

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTH = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Format a date as e.g. `"Apr 1, 2026"`.  Used in the trigger
 * button label + the custom-range row in the preset view.
 */
export function formatDateRangeLabel(range: DateRange): string {
  const fmt = (d: Date) =>
    `${SHORT_MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return `${fmt(range.start)} - ${fmt(range.end)}`;
}

export function DateRangeDropdown({
  anchorRef,
  value,
  customRange,
  onChange,
  onCustomRangeChange,
  onClose,
}: DateRangeDropdownProps) {
  // View state — swaps the surface body between presets and the
  // calendar grid.  Resets to 'presets' when the dropdown opens
  // (i.e. on mount) so reopening it always starts at the radio
  // list, even if the user last interacted with the calendar.
  const [view, setView] = useState<'presets' | 'calendar'>('presets');

  // Anchor positioning — measured from the trigger so the card
  // floats right-aligned and drops 4 px below it (matches the
  // hairline gap shown in Figma).  Recomputed on resize / scroll
  // so the card tracks the trigger if the viewport changes
  // mid-open.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

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

  // Outside-click + Escape closes the menu.  Mousedown (not click)
  // so the close fires before the next focused element absorbs the
  // click — same pattern the profile picker uses.
  useLayoutEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (surfaceRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

  if (typeof document === 'undefined' || !pos) return null;

  // Surface widens in calendar mode so the 7-column grid fits
  // without crushing each cell.  Preset view stays at the
  // original 262 px from Figma 2173:48164.
  const surfaceWidth = view === 'calendar' ? 320 : 262;

  return createPortal(
    <div
      ref={surfaceRef}
      data-figma-node-id="2173:48164"
      className="fixed z-[60] bg-white rounded-[4px] py-[8px]"
      style={{
        top: pos.top,
        right: pos.right,
        width: surfaceWidth,
        boxShadow:
          '0 0 0 1px #D2D2D3, 0 12px 8px -4px rgba(32,30,36,0.15), 0 4px 4px -2px rgba(32,30,36,0.2)',
      }}
      role="dialog"
      aria-label="Select date range"
    >
      {view === 'presets' ? (
        // Preset list — Figma 2173:48167.  Container is flush
        // (no gap between rows); each row carries its own
        // `rounded-[4px]` so the hover/active fill paints as a
        // pill inside the surface's 8-px horizontal gutter.
        <ul className="flex flex-col px-[8px]">
          {PRESETS.map((p) => (
            <DateRangeRow
              key={p.id}
              label={p.label}
              checked={value === p.id}
              onSelect={() => {
                onChange(p.id);
                onClose();
              }}
            />
          ))}
          <DateRangeRow
            label={formatDateRangeLabel(customRange)}
            checked={value === 'custom'}
            // Custom row — clicking opens the calendar inside this
            // same surface instead of dispatching `onChange`.  The
            // commit happens later, when the user finishes picking
            // a range in the calendar view.
            onSelect={() => setView('calendar')}
            leadingIcon={<IconCalendar size={16} color="#4C4B4F" />}
          />
        </ul>
      ) : (
        <Calendar
          initialRange={customRange}
          onCommit={(range) => {
            onCustomRangeChange(range);
            onChange('custom');
            onClose();
          }}
        />
      )}
    </div>,
    document.body,
  );
}

interface DateRangeRowProps {
  label: string;
  checked: boolean;
  onSelect: () => void;
  /** Optional 16-px glyph rendered between the radio and the label,
   *  used by the custom-range row to flag it as a calendar entry. */
  leadingIcon?: React.ReactNode;
}

/**
 * Single row in the preset list.  Native `<input type="radio">` so
 * screen readers + arrow-key nav behave correctly; the visible
 * chrome is the design-supplied 28-tile radio SVG.
 *
 * Geometry per Figma 2173:48164 (Label child):
 *   • 40-px row (44 px for the custom-range row to absorb the
 *     leading calendar glyph cleanly).
 *   • `pl-[6px] py-[6px]` + an 8-px gap between radio and label.
 *   • 28-px radio tile.  The visible disc body fills the
 *     `inset-[12.5%]` square in the middle (~21 px footprint).
 *   • 14 / 21 IBM Plex Sans label.
 *   • Hover: row bg → `rgba(32,30,36,0.05)` (DARK/dark--alpha_05)
 *     AND the UNCHECKED radio's stroke swaps from `#D2D2D3` to
 *     `#4D36FF` (brand purple) — the row's group-hover drives the
 *     SVG via `currentColor` so we don't need a JS hover state.
 */
function DateRangeRow({ label, checked, onSelect, leadingIcon }: DateRangeRowProps) {
  return (
    <li>
      <label
        // Click handler on the LABEL (not the input's `onChange`)
        // because clicking an already-checked radio doesn't fire
        // its native change event — so re-clicking the custom row
        // when `custom` was the active preset wouldn't open the
        // calendar.  `onClick` on the label fires every time.
        onClick={(e) => {
          e.preventDefault();
          onSelect();
        }}
        className={cn(
          'group flex items-center gap-[8px] pl-[6px] pr-[8px] py-[6px] rounded-[4px]',
          // Custom row needs slightly more vertical space (44 px
          // total) to absorb the leading 16-px calendar glyph
          // without the row reading taller than its siblings.
          leadingIcon ? 'h-[44px]' : 'h-[40px]',
          // `text-` color flows to the radio SVG's stroke via
          // `currentColor`.  Default `#D2D2D3` flips to `#4D36FF`
          // on hover; the checked state overrides the SVG stroke
          // inline so this color cascade only affects unchecked
          // rows.
          'text-[#D2D2D3] hover:text-[#4D36FF]',
          'cursor-pointer transition-colors hover:bg-[rgba(32,30,36,0.05)]',
        )}
      >
        <span className="relative inline-flex w-[28px] h-[28px] items-center justify-center flex-shrink-0">
          <input
            type="radio"
            name="date-range-preset"
            checked={checked}
            // No-op: the label's `onClick` drives state.  React
            // still requires `onChange` on a controlled radio to
            // suppress its warning.
            onChange={() => {}}
            tabIndex={-1}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Native 28-tile radio SVG provided by design.  Checked
              state: solid `#4D36FF` disc with a 7-px white inner
              dot.  Unchecked: white interior + `currentColor`
              hairline ring (1.17 px) — the parent `<label>`'s
              `text-*` class controls the stroke so hover can
              swap it to brand purple without a JS state. */}
          <svg
            aria-hidden
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 4.08301C19.4768 4.08301 23.917 8.52318 23.917 14C23.917 19.4768 19.4768 23.917 14 23.917C8.52318 23.917 4.08301 19.4768 4.08301 14C4.08301 8.52318 8.52318 4.08301 14 4.08301Z"
              fill={checked ? '#4D36FF' : '#FFFFFF'}
              stroke={checked ? '#4D36FF' : 'currentColor'}
              strokeWidth="1.16667"
            />
            {checked && (
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M14 10.5C12.067 10.5 10.5 12.067 10.5 14C10.5 15.933 12.067 17.5 14 17.5C15.933 17.5 17.5 15.933 17.5 14C17.5 12.067 15.933 10.5 14 10.5Z"
                fill="white"
              />
            )}
          </svg>
        </span>
        {leadingIcon && (
          <span className="flex items-center justify-center flex-shrink-0">
            {leadingIcon}
          </span>
        )}
        <span
          className="text-[14px] leading-[21px] text-[#201E24] truncate"
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          {label}
        </span>
      </label>
    </li>
  );
}

// ─── Calendar ───────────────────────────────────────────────────────────
//
// Month-view calendar with range selection.  Operates on local-time
// `Date` so day boundaries never drift across DST or timezone
// changes.  Always renders six rows × seven columns; leading +
// trailing days from adjacent months render dimmed so the grid
// dimensions stay stable as the user navigates between months.

interface CalendarProps {
  /** Pre-selected range, used to seed the visible month + the
   *  painted range during open. */
  initialRange: DateRange;
  /** Fires once the user has clicked both endpoints (or clicked
   *  the same day twice, producing a zero-length range).  Parent
   *  is expected to close the picker. */
  onCommit: (range: DateRange) => void;
}

/** Strip time from a Date — returns a new Date at 00:00 local. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Days difference between two dates (sign-aware). */
function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Build the 6×7 grid for a given month.  Returns 42 dates spanning
 *  from the Sunday on or before the 1st of the month through the
 *  Saturday on or after the trailing days. */
function buildMonthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}

function Calendar({ initialRange, onCommit }: CalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(initialRange.start.getFullYear(), initialRange.start.getMonth(), 1),
  );
  // Pending selection state.  When `start` is set but `end` is
  // null, the user has just clicked one endpoint and we're
  // waiting for the second click.  Clicking the second commits
  // (and swaps if the user picked an earlier date).
  const [pendingStart, setPendingStart] = useState<Date | null>(initialRange.start);
  const [pendingEnd, setPendingEnd] = useState<Date | null>(initialRange.end);

  const days = buildMonthGrid(visibleMonth);

  // Range bounds for paint purposes — `pendingEnd` may be null
  // mid-selection; in that case the "range" is a single day.
  const rangeStart = pendingStart;
  const rangeEnd = pendingEnd ?? pendingStart;

  const handleDayClick = (d: Date) => {
    if (!pendingStart || pendingEnd) {
      // Either no selection yet OR a committed range — start a
      // fresh pick.  Clear `end` so the next click sets it.
      setPendingStart(d);
      setPendingEnd(null);
      return;
    }
    // Second click — commit the range, swapping if the user
    // picked an earlier date than the start.
    const cmp = daysBetween(pendingStart, d);
    const range: DateRange =
      cmp >= 0 ? { start: pendingStart, end: d } : { start: d, end: pendingStart };
    setPendingEnd(cmp >= 0 ? d : pendingStart);
    setPendingStart(cmp >= 0 ? pendingStart : d);
    onCommit(range);
  };

  const monthLabel = `${MONTH_LABELS[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;

  return (
    <div className="px-[12px] pb-[8px]">
      {/* Month nav — Figma shows a `‹  Month YYYY  ›` row with the
          chevrons pinned to the left/right edges and the label
          centered.  Buttons are 24×24, the chevron glyph 14×14. */}
      <div className="flex items-center justify-between h-[32px] mb-[4px]">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setVisibleMonth(
              new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
            )
          }
          className="w-[24px] h-[24px] flex items-center justify-center rounded-[4px] hover:bg-[#F3F3F4] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 6l-6 6 6 6" stroke="#201E24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p
          className="text-[14px] leading-[21px] font-medium text-[#201E24]"
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          {monthLabel}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setVisibleMonth(
              new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
            )
          }
          className="w-[24px] h-[24px] flex items-center justify-center rounded-[4px] hover:bg-[#F3F3F4] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 6l6 6-6 6" stroke="#201E24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Day-of-week header — Sunday-first.  Single-row grid using
          the same column template as the day grid below so headers
          and cells share x-alignment exactly. */}
      <div className="grid grid-cols-7 mb-[2px]">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="h-[32px] flex items-center justify-center text-[12px] text-[#626165]"
            style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid — 42 cells, 6 rows × 7 columns.  Cells without
          gaps so the lavender in-range background reads as a
          continuous band across the row when consecutive days are
          selected. */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inCurrentMonth = d.getMonth() === visibleMonth.getMonth();
          const isStart = rangeStart && daysBetween(d, rangeStart) === 0;
          const isEnd = rangeEnd && daysBetween(d, rangeEnd) === 0;
          const isEndpoint = isStart || isEnd;
          const inRange =
            rangeStart &&
            rangeEnd &&
            daysBetween(rangeStart, d) >= 0 &&
            daysBetween(d, rangeEnd) >= 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDayClick(d)}
              className={cn(
                'h-[36px] flex items-center justify-center transition-colors',
                'text-[14px] leading-[21px]',
                // In-range band — lavender for any day between the
                // two endpoints (inclusive).  Painted edge-to-edge
                // so adjacent in-range cells visually merge into a
                // strip; endpoints overlay a solid purple square
                // on top of the band.
                inRange && !isEndpoint && 'bg-[#EDEAFF]',
                // Endpoints — solid purple square + white text.
                // `rounded-[6px]` floats the endpoint inside the
                // row so it reads as a chip, not as part of the
                // band.
                isEndpoint && 'bg-[#4D36FF] text-white font-medium rounded-[6px]',
                // Non-current-month days are dimmed to grey so the
                // user knows they belong to a sibling month.
                !isEndpoint && (inCurrentMonth ? 'text-[#201E24]' : 'text-[#D2D2D3]'),
                !isEndpoint && !inRange && 'hover:bg-[#F3F3F4]',
              )}
              style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
