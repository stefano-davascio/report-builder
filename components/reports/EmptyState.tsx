'use client';

/**
 * Empty-state for the reports table when no reports exist (or when the
 * active filter set yields zero rows). Centered tile + headline + sub-
 * copy. The illustration tile is intentionally a flat #F3F3F4 surface
 * with our IconPlusCircle glyph instead of a custom illustration —
 * keeps the empty state on-system without inventing artwork.
 */

import { IconPlusCircle } from '@/components/icons/SendiIcons';

interface EmptyStateProps {
  /** Headline copy. Defaults to the no-reports message. */
  title?: string;
  /** Sub-copy. Defaults to the no-reports message. */
  description?: string;
}

export function EmptyState({
  title = 'No reports yet',
  description = 'Build your first report from a template above.',
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-[64px] gap-[16px]"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      <div className="w-[80px] h-[80px] rounded-[16px] bg-[#F3F3F4] flex items-center justify-center">
        <IconPlusCircle size={32} color="#626165" />
      </div>
      <div className="flex flex-col gap-[4px] max-w-[320px]">
        <p className="text-[16px] leading-[24px] font-medium text-[#201E24]">{title}</p>
        <p className="text-[14px] leading-[21px] text-[#626165]">{description}</p>
      </div>
    </div>
  );
}
