'use client';

/**
 * Tabular module rendering — the visual analogue of `ListModule` for
 * grid-shaped data. Typography + tokens match the rest of the refined
 * report-builder modules:
 *
 *   • Header row    — IBM Plex Sans 12 / 16, tracking 0.3 px,
 *                     #626165 (DARK/dark--tint_30), `font-medium`.
 *                     Mirrors the Label-Helper used in chart legends.
 *   • Body cell     — IBM Plex Sans 12 / 18, #201E24 (BRAND/dark).
 *                     Date column uses #4C4B4F (DARK/dark--tint_20)
 *                     so the leading temporal anchor reads as a
 *                     "rail" without competing with the metric values.
 *   • Numeric cells — `tabular-nums` so digits align column-to-column
 *                     when row heights vary by content.
 *   • Row divider   — 1 px #E8E8E9 (DARK/dark--tint_90), bottom-border
 *                     only. The last row drops its border so the
 *                     module's own bottom padding owns the close.
 *   • Hover         — `#F3F3F4` (DARK/dark--tint_95). Same hover
 *                     surface used by ModuleActions buttons and
 *                     dropdowns; keeps every interactive surface in
 *                     the same family.
 *   • Sticky header — `position: sticky; top: 0` on `<th>` so the
 *                     header stays anchored as the body scrolls inside
 *                     the module's overflow container.
 *
 * No accent colors — the previous indigo-600 highlight on `engRate`
 * was a Tailwind default, not part of the design system. If a column
 * needs emphasis, pass it through the column metadata.
 */

import { TableRow } from '@/types';
import { cn } from '@/lib/utils';

interface TableModuleProps {
  columns: { key: string; label: string }[];
  rows: TableRow[];
}

function formatValue(value: string | number): string {
  if (typeof value === 'number') return value.toLocaleString();
  return value;
}

// Right-align numeric columns so digits stack cleanly. We treat every
// non-`date` column as numeric for the catalog's current shapes; widen
// this if a future definition introduces text columns past the first.
function isNumericKey(key: string): boolean {
  return key !== 'date';
}

export function TableModule({ columns, rows }: TableModuleProps) {
  return (
    <div className="overflow-auto h-full -mx-[4px]">
      <table
        className="w-full border-separate"
        style={{ borderSpacing: 0, fontFamily: 'IBM Plex Sans, sans-serif' }}
      >
        <thead>
          <tr>
            {columns.map((col, i) => {
              const numeric = isNumericKey(col.key);
              return (
                <th
                  key={col.key}
                  className={cn(
                    'sticky top-0 bg-white z-10 px-[4px] pb-[10px] whitespace-nowrap',
                    'text-[12px] leading-[16px] font-medium text-[#626165] tracking-[0.3px]',
                    'border-b border-[#E8E8E9]',
                    numeric ? 'text-right' : 'text-left',
                    i === 0 && 'pl-[8px]',
                    i === columns.length - 1 && 'pr-[8px]',
                  )}
                >
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const isLast = rowIndex === rows.length - 1;
            return (
              <tr
                key={rowIndex}
                className="group/row hover:bg-[#F3F3F4] transition-colors"
              >
                {columns.map((col, i) => {
                  const numeric = isNumericKey(col.key);
                  const isDate = col.key === 'date';
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        'px-[4px] py-[10px] whitespace-nowrap',
                        'text-[12px] leading-[18px]',
                        numeric ? 'text-right tabular-nums' : 'text-left',
                        // Date column reads as a quieter rail so metric
                        // values pop. Other body cells use BRAND/dark.
                        isDate ? 'text-[#4C4B4F]' : 'text-[#201E24]',
                        !isLast && 'border-b border-[#E8E8E9]',
                        i === 0 && 'pl-[8px]',
                        i === columns.length - 1 && 'pr-[8px]',
                      )}
                    >
                      {formatValue(row[col.key])}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
