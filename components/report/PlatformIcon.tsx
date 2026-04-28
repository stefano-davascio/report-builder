'use client';

/**
 * Platform logo badge — a thin wrapper that forwards to the canonical
 * icon components in `@/components/icons/NetworkIcons`. Those are the
 * Figma-exported network logos (multi-layer SVGs with exact fills /
 * gradients / insets) and must NOT be reimplemented inline. This
 * component exists only to map a `ProfilePlatform` string onto the
 * corresponding `IconNetwork*` component so callers don't have to
 * switch over platform keys themselves.
 *
 * Used by:
 *   • ProfileSelectionBar — dropdown group headers (16×16 tile)
 *   • ModuleNetworks       — module legend's networks cluster
 *                            (16×16 logo inside a 20×20 white ring)
 */

import { ProfilePlatform } from '@/lib/profile-data';
import { Platform } from '@/types';
import {
  IconNetworkFacebook,
  IconNetworkInstagram,
  IconNetworkTikTok,
  IconNetworkYouTube,
  IconNetworkLinkedIn,
  IconNetworkGA,
  IconNetworkThreads,
  IconNetworkBluesky,
  IconNetworkX,
} from '@/components/icons/NetworkIcons';

interface PlatformIconProps {
  /** Accepts both `ProfilePlatform` (catalog of profiles we own data for)
   *  and the wider `Platform` union — the reports list and Figma comp
   *  show Bluesky / X in the Networks column even when there's no profile
   *  data behind them. */
  platform: ProfilePlatform | Platform;
  size?: number;
}

export function PlatformIcon({ platform, size = 16 }: PlatformIconProps) {
  switch (platform) {
    case 'facebook':         return <IconNetworkFacebook size={size} />;
    case 'instagram':        return <IconNetworkInstagram size={size} />;
    case 'tiktok':           return <IconNetworkTikTok size={size} />;
    case 'youtube':          return <IconNetworkYouTube size={size} />;
    case 'linkedin':         return <IconNetworkLinkedIn size={size} />;
    case 'google-analytics': return <IconNetworkGA size={size} />;
    case 'threads':          return <IconNetworkThreads size={size} />;
    case 'bluesky':          return <IconNetworkBluesky size={size} />;
    case 'x':                return <IconNetworkX size={size} />;
    default:                 return null;
  }
}
