'use client';

/**
 * ModuleNetworks — the platform-logo cluster shown in each module's
 * legend/footer row. Signals **which social networks** this module
 * aggregates data from (NOT which individual profiles).
 *
 * Rules (per Figma 1174:214425):
 *   • 0 networks  → render nothing
 *   • 1 network   → single 20×20 badge
 *   • 2 networks  → two overlapping badges
 *   • 3 networks  → three overlapping badges
 *   • 4+ networks → first 3 badges + " +N" text label (N = total − 3)
 *
 * Each badge is a 20×20 white circle with 1 px of padding wrapping the
 * 16×16 platform logo (PlatformIcon). Adjacent badges overlap by 3 px
 * (`mr-[-3px]`), and the white ring reads as a 1 px separator against
 * the logo tile beneath.
 *
 * The component accepts a list of profiles for convenience — it dedups
 * to unique platforms internally, preserving the order in which each
 * platform first appears. Callers don't need to pre-uniq.
 */

import { MockProfile, ProfilePlatform } from '@/lib/profile-data';
import { PlatformIcon } from './PlatformIcon';

// Platform badge outer diameter / inner logo size / overlap, per Figma.
const BADGE_PX = 20;
const ICON_PX = 16;
const OVERLAP_PX = 3;

// Default logo cap — callers can override via `maxVisible` to collapse
// the cluster on narrow cards (see `MetricCardModule` stack layout).
const DEFAULT_MAX_VISIBLE = 3;

interface ModuleNetworksProps {
  profiles: MockProfile[];
  /**
   * Maximum number of platform badges to render before collapsing into
   * the `+N` overflow label. Narrow metric cards pass `1` so the cluster
   * reads as a single icon + `+2` instead of forcing three 20 px badges
   * into a cramped row. Defaults to 3 to match Figma 1174:214425 on
   * standard module widths.
   */
  maxVisible?: number;
}

function PlatformBadge({ platform, zIndex, overlap }: {
  platform: ProfilePlatform;
  zIndex: number;
  overlap: boolean;
}) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full bg-white flex-shrink-0"
      style={{
        width: BADGE_PX,
        height: BADGE_PX,
        // White ring: 1 px of padding around the 16×16 logo plus ~1 px
        // air so the circle shows through.
        padding: (BADGE_PX - ICON_PX) / 2,
        marginLeft: overlap ? -OVERLAP_PX : 0,
        zIndex,
      }}
    >
      <PlatformIcon platform={platform} size={ICON_PX} />
    </div>
  );
}

export function ModuleNetworks({
  profiles,
  maxVisible = DEFAULT_MAX_VISIBLE,
}: ModuleNetworksProps) {
  // Dedup to unique platforms, preserving first-seen order. This is the
  // canonical "networks this module covers" list — independent of how
  // many individual profiles the user has picked per platform.
  const platforms: ProfilePlatform[] = [];
  const seen = new Set<ProfilePlatform>();
  for (const p of profiles) {
    if (!seen.has(p.platform)) {
      seen.add(p.platform);
      platforms.push(p.platform);
    }
  }

  if (platforms.length === 0) return null;

  const cap = Math.max(1, maxVisible);
  const visible = platforms.slice(0, cap);
  const overflow = platforms.length - visible.length;

  return (
    <div className="flex items-center flex-shrink-0" aria-hidden="true">
      {visible.map((platform, idx) => (
        <PlatformBadge
          key={platform}
          platform={platform}
          overlap={idx > 0}
          // Left-most badge paints on top so the overlap reads as a
          // "fan" cascading to the right (matches Figma 1174:214425).
          zIndex={visible.length - idx}
        />
      ))}

      {overflow > 0 && (
        <span
          className="ml-[1px] text-[#4C4B4F]"
          style={{
            fontSize: 12,
            lineHeight: '18px',
            letterSpacing: '0.3px',
            fontFamily: 'IBM Plex Sans, sans-serif',
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
