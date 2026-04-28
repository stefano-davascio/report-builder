'use client';

/**
 * Shared tooltip primitives for every chart module. One look, one set of
 * tokens, one source of truth — so switching chart types or hovering
 * different modules feels continuous instead of patchwork.
 *
 * Visual contract (single source of truth — do not redefine elsewhere):
 *   • Card     : white bg, 1 px #E8E8E9 border, 6 px radius, soft shadow
 *                (`0 4px 12px rgba(32,30,36,0.08)`), 12 / 8 px padding.
 *   • Title    : 11 px IBM Plex Sans, #79787B (dark--tint_30).
 *   • Row text : 12 px IBM Plex Sans, #201E24 (dark/text default).
 *   • Dot      : 8 × 8 CIRCLE — never a square. Color = the data series'
 *                own color (resolved from entry.color / payload.fill /
 *                payload.color, in that order).
 *   • Value    : right-aligned, font-medium, tabular numbers.
 *
 * Three exports, in increasing levels of customization:
 *
 *   1. `ModuleTooltip` — drop-in for `<Tooltip content={<ModuleTooltip />}>`.
 *      Handles 90 % of charts. Knobs: `title`, `formatValue`,
 *      `getName`, `getDot`. Recharts passes active/payload/label.
 *
 *   2. `ModuleTooltipCard` — just the card chrome (border, shadow,
 *      title slot). Use when you need full control of row composition.
 *
 *   3. `ModuleTooltipRow` — one styled row (dot + name + value). Use
 *      inside a `ModuleTooltipCard` when defaults don't fit (e.g.
 *      bubble chart's "day · hour" title with a value-only row).
 */

import type { ReactNode } from 'react';

// Tokens — keep in sync with the rest of the report-builder design
// system. These are duplicated here intentionally (instead of pulled
// from a Tailwind theme) because every chart module already inlines
// hex literals, so co-locating them in this file makes the tooltip
// styling auditable from one place.
const CARD_BORDER = '#E8E8E9';
const CARD_SHADOW = '0 4px 12px rgba(32,30,36,0.08)';
const TITLE_COLOR = '#79787B';
const TEXT_COLOR = '#201E24';
const FONT = 'IBM Plex Sans, sans-serif';

interface ModuleTooltipCardProps {
  /** Optional small caption above the rows (e.g. date, category). */
  title?: ReactNode;
  children: ReactNode;
}

export function ModuleTooltipCard({ title, children }: ModuleTooltipCardProps) {
  return (
    <div
      className="bg-white rounded-[6px] px-3 py-2"
      style={{
        border: `1px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        fontFamily: FONT,
      }}
    >
      {title != null && title !== '' && (
        <p className="text-[11px] mb-1" style={{ color: TITLE_COLOR }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

interface ModuleTooltipRowProps {
  /** Dot color — usually the data series' own hex. */
  dot: string;
  /** Series / category name. Hidden when omitted (single-value rows). */
  name?: ReactNode;
  /** Pre-formatted value (number, percentage, etc.). */
  value: ReactNode;
}

export function ModuleTooltipRow({ dot, name, value }: ModuleTooltipRowProps) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: dot }}
        aria-hidden="true"
      />
      {name != null && name !== '' && (
        <span style={{ color: TEXT_COLOR }}>{name}</span>
      )}
      <span
        className="ml-auto font-medium tabular-nums"
        style={{ color: TEXT_COLOR }}
      >
        {value}
      </span>
    </div>
  );
}

// Recharts' tooltip payload entries are loosely typed — they vary by
// chart type. We narrow to the fields we actually read.
export interface TooltipPayloadEntry {
  name?: string;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  payload?: {
    name?: string;
    color?: string;
    fill?: string;
    [k: string]: unknown;
  };
}

interface ModuleTooltipProps {
  // Recharts injects these.
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;

  /** Override / replace the title row. `false` hides it entirely. */
  title?: ReactNode | false | ((label: string | number | undefined, payload: TooltipPayloadEntry[]) => ReactNode);
  /** Customize the value rendering. Default: `value.toLocaleString()`. */
  formatValue?: (value: number, entry: TooltipPayloadEntry) => ReactNode;
  /** Customize the row label. Default: `entry.name ?? entry.payload.name`. */
  getName?: (entry: TooltipPayloadEntry) => ReactNode;
  /** Customize the dot color. Default chain: entry.color → payload.color → payload.fill → text default. */
  getDot?: (entry: TooltipPayloadEntry) => string;
}

function defaultDot(entry: TooltipPayloadEntry): string {
  return (
    entry.color ?? entry.payload?.color ?? entry.payload?.fill ?? TEXT_COLOR
  );
}

function defaultName(entry: TooltipPayloadEntry): ReactNode {
  return entry.name ?? entry.payload?.name ?? null;
}

function defaultValue(value: number): string {
  return value.toLocaleString();
}

/**
 * Drop-in tooltip — pass to `<Tooltip content={<ModuleTooltip ... />}>`.
 * Renders one row per payload entry using the design-system chrome.
 */
export function ModuleTooltip({
  active,
  payload,
  label,
  title,
  formatValue,
  getName,
  getDot,
}: ModuleTooltipProps) {
  if (!active || !payload?.length) return null;

  const titleNode =
    title === false
      ? null
      : typeof title === 'function'
        ? title(label, payload)
        : (title ?? label);

  return (
    <ModuleTooltipCard title={titleNode}>
      {payload.map((entry, i) => {
        const dot = (getDot ?? defaultDot)(entry);
        const name = (getName ?? defaultName)(entry);
        const numeric = Number(entry.value);
        const value = formatValue
          ? formatValue(numeric, entry)
          : defaultValue(numeric);
        // Key on dataKey if present so Recharts re-renders don't reorder
        // rows; fall back to index for synthetic payloads (e.g. bubble).
        const key = entry.dataKey != null ? String(entry.dataKey) : i;
        return (
          <ModuleTooltipRow key={key} dot={dot} name={name} value={value} />
        );
      })}
    </ModuleTooltipCard>
  );
}
