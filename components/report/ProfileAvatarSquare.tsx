'use client';

/**
 * 24×24 square profile avatar — Figma 1781:36801 / 308:5307.
 *
 * Used in BOTH the SelectProfilesDropdown rows AND in profile chips on
 * the ProfileSelectionBar.  Matches the new design pattern where the
 * avatar is a 24-px square with the profile's first initial centered
 * inside, plus a 16-px platform badge overlapping the bottom-right
 * corner with a 2-px white ring.
 *
 * Hard specs from Figma:
 *   • Outer 24×24 square, `bg-[#63A3F2]`, `border-[0.75px] solid
 *     #5688C9`, `rounded-[6px]`.
 *   • Initial — first letter of the profile name, rendered as
 *     SF Pro Display Heavy 15 / 13.2, color `#0D4EA3`.  Positioned via
 *     `top-[calc(50%-6.75px)]` (vertical optical center) and
 *     `left-[calc(50%-0.25px)] -translate-x-1/2` (sub-pixel x correction
 *     baked into the design).
 *   • Platform badge at bottom-right — a 16×16 white circle
 *     (`rounded-[8px]`) at `(13.63, 13.63)` so it overlaps the
 *     avatar's right + bottom edges by ~5.6 px each, with a 2-px white
 *     `box-shadow` ring.  Inner platform glyph at 14-px via
 *     `PlatformIcon`.
 *
 * The legacy rectangular `ProfileAvatar` (31×26 with hand-drawn paths
 * per platform) is still used internally elsewhere if needed; this
 * component is the new visual contract for chips + dropdown rows.
 */

import type { MockProfile } from '@/lib/profile-data';
import { PlatformIcon } from './PlatformIcon';
import { cn } from '@/lib/utils';

interface ProfileAvatarSquareProps {
  profile: MockProfile;
  /** Optional className applied to the outer 24-px square — used by
   *  callers that need to add `flex-shrink-0`, margin, etc. */
  className?: string;
}

export function ProfileAvatarSquare({ profile, className }: ProfileAvatarSquareProps) {
  const initial = (profile.name.charAt(0) || 'T').toUpperCase();
  return (
    <div
      aria-hidden
      className={cn(
        'relative flex-shrink-0 size-[24px] rounded-[6px]',
        'bg-[#63A3F2] border-[0.75px] border-solid border-[#5688C9]',
        className,
      )}
    >
      <span
        className="absolute -translate-x-1/2 not-italic text-center whitespace-nowrap"
        style={{
          left: 'calc(50% - 0.25px)',
          top: 'calc(50% - 6.75px)',
          fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          fontWeight: 900,
          fontSize: 15,
          lineHeight: '13.2px',
          color: '#0D4EA3',
        }}
      >
        {initial}
      </span>
      <div
        className="absolute bg-white rounded-[8px] flex items-center justify-center overflow-clip"
        style={{
          left: 13.63,
          top: 13.63,
          width: 16,
          height: 16,
          padding: '0 1px',
          boxShadow: '0 0 0 2px white',
        }}
      >
        <PlatformIcon platform={profile.platform} size={14} />
      </div>
    </div>
  );
}
