// ─── Profile catalogue ────────────────────────────────────────────────────────
//
// Source of truth for the user's connected profiles. Lifted out of
// `ProfileSelectionBar` so the selected subset can be threaded into
// modules (e.g. the Module Networks indicator in each chart's legend row)
// through a single owner — `ReportBuilderPage` — without drilling into the
// profile-picker's internals.
//
// This is currently static mock data; once the real product wiring lands,
// the shapes here should match what the API returns.

export type ProfilePlatform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'threads'
  | 'google-analytics';

export type ProfileStatus = 'reconnect' | 'permission' | 'syncing' | null;

export interface MockProfile {
  id: string;
  name: string;
  platform: ProfilePlatform;
  status: ProfileStatus;
}

export interface ProfileGroup {
  platform: ProfilePlatform;
  label: string;
  profiles: MockProfile[];
}

export const PROFILE_GROUPS: ProfileGroup[] = [
  {
    platform: 'facebook',
    label: 'Facebook profiles',
    profiles: [
      { id: 'fb-1', name: 'Tenceclothieruganda',  platform: 'facebook', status: null },
      { id: 'fb-2', name: 'Tenceclothierwanda',   platform: 'facebook', status: null },
      { id: 'fb-3', name: 'Tenceclothierghana',   platform: 'facebook', status: null },
      { id: 'fb-4', name: 'tenceclothierkenya',   platform: 'facebook', status: null },
      { id: 'fb-5', name: 'tenceclothiersenegal', platform: 'facebook', status: null },
      { id: 'fb-6', name: 'tenceclothierk...',    platform: 'facebook', status: 'permission' },
    ],
  },
  {
    platform: 'instagram',
    label: 'Instagram profiles',
    profiles: [
      { id: 'ig-1', name: 'tenceclothier_gh', platform: 'instagram', status: null },
      { id: 'ig-2', name: 'tenceclothier_ke', platform: 'instagram', status: null },
    ],
  },
  {
    platform: 'tiktok',
    label: 'TikTok profiles',
    profiles: [
      { id: 'tt-1', name: 'tenceclothier_rw', platform: 'tiktok', status: 'syncing' },
      { id: 'tt-2', name: 'tenceclothier_gh', platform: 'tiktok', status: null },
    ],
  },
  {
    platform: 'youtube',
    label: 'YouTube profiles',
    profiles: [
      { id: 'yt-1', name: 'Tenceclothier YT', platform: 'youtube', status: null },
    ],
  },
  {
    platform: 'linkedin',
    label: 'LinkedIn profiles',
    profiles: [
      { id: 'li-1', name: 'Tenceclothier',  platform: 'linkedin', status: 'reconnect' },
    ],
  },
];

// Everything except li-1 (which has `reconnect` status) — matches the
// original "5 visible chips + +5 overflow" first-load state.
export const INITIAL_SELECTED_IDS: ReadonlyArray<string> = [
  'fb-1', 'fb-2', 'fb-3', 'fb-4', 'fb-5',
  'ig-1', 'ig-2',
  'tt-1', 'tt-2',
  'yt-1',
];

export const ALL_PROFILES: MockProfile[] = PROFILE_GROUPS.flatMap((g) => g.profiles);

/**
 * Resolve a list of profile IDs to the full profile objects, preserving
 * the order they were selected.
 */
export function profilesByIds(ids: Iterable<string>): MockProfile[] {
  const set = ids instanceof Set ? ids : new Set(ids);
  return ALL_PROFILES.filter((p) => set.has(p.id));
}
