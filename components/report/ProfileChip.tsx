'use client';

/**
 * ProfileChip — state-driven, mode-aware, pixel-perfect per Figma
 * 1209:308263 (the multi-state reference board).
 *
 * Three concerns, kept independent:
 *
 * 1. **Status**: drives background + border + the optional status icon.
 *    Healthy     → neutral `#F3F3F4` bg / same-tone border / no icon.
 *    Reconnect   → danger tint (`rgba(229,10,31,0.05)` bg, `#FACED2` border) + octagon.
 *    Permission  → same danger tint + warning triangle.
 *    Syncing     → warning tint (`rgba(255,193,7,0.1)` bg, `#FFF3CD` border) + hourglass.
 *
 * 2. **Mode** (`isEditing`): drives whether the trailing × button mounts.
 *    The status icon is independent of mode — it always renders when the
 *    status is non-healthy, in BOTH view and edit modes (per spec §5 + §7).
 *
 * 3. **Asymmetric padding** (per spec §6 — do NOT assume symmetric):
 *    Left padding is always `6 px` (avatar side). Right padding shrinks
 *    as interactive trailing elements are added, to visually balance
 *    their 24×24 touch targets:
 *      • healthy + view     → pr-[6px]  (nothing trailing)
 *      • non-healthy + view → pr-[4px]  (status button trailing)
 *      • any state + edit   → pr-[2px]  (× button trailing, optionally after status)
 *    These are the exact values from Figma nodes 1209:308265 / 308317 /
 *    308264 / 308296 / 309301 / 308338 — they are NOT approximations.
 */

import { MockProfile, ProfileStatus } from '@/lib/profile-data';
import { IconClose } from '@/components/icons/SendiIcons';
import { ProfileAvatarSquare } from './ProfileAvatarSquare';

// Status-icon assets from the Figma MCP export. Kept module-local because
// these specific asset IDs are unique to the chip node — the general
// StatusBadge (used in the picker dropdown) uses a different set.
const IMG_DANGER    = 'http://localhost:3845/assets/72cbcce5fb7e3a9388f3d5578b3fce8bcde03f13.svg';
const IMG_WARNING   = 'http://localhost:3845/assets/d29bfd5e5194fc2e67c503851047c68afe530eee.svg';
const IMG_HOURGLASS = 'http://localhost:3845/assets/4e0d6ac659f9a732ef17e70250b2d25bc0cd2915.svg';

// Status → visual tokens. Nulls map to the healthy baseline. Kept as a
// lookup (not a switch) so the chip body stays flat and the resting
// (healthy) path is just an index into this table with a null key.
const STATUS_STYLES: Record<
  NonNullable<ProfileStatus>,
  { bg: string; border: string; icon: string; label: string }
> = {
  reconnect:  {
    bg:     'rgba(229,10,31,0.05)',
    border: '#FACED2',
    icon:   IMG_DANGER,
    label:  'Profile reconnection needed',
  },
  permission: {
    bg:     'rgba(229,10,31,0.05)',
    border: '#FACED2',
    icon:   IMG_WARNING,
    label:  'Permission needed',
  },
  syncing:    {
    bg:     'rgba(255,193,7,0.1)',
    border: '#FFF3CD',
    icon:   IMG_HOURGLASS,
    label:  'Syncing data',
  },
};

const HEALTHY_BG = '#F3F3F4';
const HEALTHY_BORDER = '#F3F3F4';

interface ProfileChipProps {
  profile: MockProfile;
  isEditing: boolean;
  /**
   * Optional remove handler — when omitted (even in edit mode) the × is
   * not rendered. The parent controls this so view-mode chips can't
   * accidentally receive a callback. In practice edit mode always
   * supplies one, but the two-layer gate (`isEditing` AND `onRemove`)
   * keeps a dev from leaking a remove path into view mode.
   */
  onRemove?: () => void;
}

export function ProfileChip({ profile, isEditing, onRemove }: ProfileChipProps) {
  const status = profile.status;
  const styles = status ? STATUS_STYLES[status] : null;
  const showRemove = isEditing && Boolean(onRemove);

  // Asymmetric right-padding. `pl` is constant; `pr` is the only axis
  // that moves across the matrix below. Explicit px values (no template
  // math) so Tailwind's JIT can statically extract each class.
  const rightPadClass =
    showRemove   ? 'pr-[2px]'   // trailing × button (6→2)
    : status     ? 'pr-[4px]'   // trailing status icon (6→4)
                 : 'pr-[6px]';  // nothing trailing — symmetric with pl

  return (
    <div
      className={`flex items-center h-[32px] pl-[6px] ${rightPadClass} py-[4px] rounded-[4px] border flex-shrink-0`}
      style={{
        backgroundColor: styles?.bg ?? HEALTHY_BG,
        borderColor: styles?.border ?? HEALTHY_BORDER,
      }}
    >
      {/* Avatar + name — 8 px gap per Figma 489:12784.  The new
          24×24 square avatar (ProfileAvatarSquare) has its platform
          badge contained inside a 24-px box (the badge `box-shadow`
          ring extends visually past the box but doesn't affect layout
          flow), so we no longer need the `-ml-[7px]` compensation
          that used to pull the legacy 31-px rectangular avatar's
          badge-overflow out of the gap calculation. */}
      <div className="flex items-center gap-[8px] flex-shrink-0">
        <ProfileAvatarSquare profile={profile} />
        <span
          className="text-[12px] text-[#363439] whitespace-nowrap max-w-[120px] truncate"
          style={{ lineHeight: '22px', fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          {profile.name}
        </span>
      </div>

      {/* Status icon — 24×24 pill wrapper, 14×14 inner icon (Figma).
          Rendered in BOTH view and edit modes when status != healthy
          (spec §7: "Status icon appears ONLY when status ≠ healthy").
          The wrapper has no background of its own; the chip's tinted
          background carries the semantic color. */}
      {styles && (
        <div
          className="flex items-center justify-center w-[24px] h-[24px] rounded-[60px] flex-shrink-0"
          aria-label={styles.label}
          role="img"
        >
          <img src={styles.icon} alt="" className="w-[14px] h-[14px] block" />
        </div>
      )}

      {/* Remove × — edit mode ONLY (spec §7 + §9). 24×24 `rounded-[4px]`
          hover target with a 16-px close glyph. Color `#79787B`
          (DARK/dark--tint_40) to read as a muted action, not destructive
          red — the status color is enough signal on its own. */}
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center w-[24px] h-[24px] rounded-[4px] hover:bg-[#E8E8E9] transition-colors flex-shrink-0"
          aria-label={`Remove ${profile.name}`}
        >
          <IconClose size={16} color="#79787B" />
        </button>
      )}
    </div>
  );
}
