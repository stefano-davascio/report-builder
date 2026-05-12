// ─── Profile-status warning helpers ──────────────────────────────────────
//
// Two-tier classification for `ProfileStatus`, plus the per-module + global
// derivations that drive the new warning surfaces:
//
//   • `GlobalDataWarningBanner` (top-of-canvas) — fires only on Case 2,
//     the actionable "reconnect / grant permissions" tier.
//   • `ModuleWarningIcon` (in each module's title row) — Case 2 takes
//     precedence over Case 1 so we never stack both glyphs.
//
// The product spec is deliberate about NOT conflating the two — Case 1
// (a profile is healthy but the timeframe has no data for it) is a
// no-action FYI; Case 2 (a profile needs the user to act before any
// data can land) is the urgent one.  Conflating them trains users to
// ignore both, so the two helpers exposed below are the canonical
// gates for which surface a status flows into.

import type { MockProfile, ProfileStatus } from '@/lib/profile-data';
import type { ModuleDefinition, Platform, ReportModule } from '@/types';

/** Severity buckets the UI cares about.  `null` ≡ no warning surface
 *  renders for the affected profiles. */
export type WarningSeverity = 'case1' | 'case2' | null;

/**
 * Classify a single `ProfileStatus` into the warning tier.
 *
 *   • `'reconnect' | 'permission'` → `'case2'` (actionable — user must
 *     fix something in the Select profiles panel before data lands).
 *   • `'syncing'`                  → `'case1'` (informational — the
 *     profile is fine, the timeframe just has no data for it).
 *   • `null`                       → `null`   (healthy, no surface).
 *
 * NOTE: `'syncing'` reads as "sync in progress" rather than "no data
 * for timeframe" today, but the product treats both as the same
 * informational tier (nothing the user can fix), so they collapse onto
 * the same bucket.  If the backend later distinguishes them, split
 * here and update `MODULE_TOOLTIP_COPY` below.
 */
export function classifyStatus(status: ProfileStatus): WarningSeverity {
  if (status === 'reconnect' || status === 'permission') return 'case2';
  if (status === 'syncing') return 'case1';
  return null;
}

/**
 * Apply a module's network + definition-platforms filter to the global
 * `selectedProfiles` set — returning only the profiles a given module
 * would actually surface data for.  Mirrors the same logic
 * `ModuleCard.tsx` uses to derive `profilesForModule`; centralized here
 * so the global warning union below sees the exact same set the module
 * sees in its title row.
 */
export function filterProfilesForModule(
  module: ReportModule,
  definition: ModuleDefinition,
  selectedProfiles: MockProfile[],
): MockProfile[] {
  const network = module.network ?? 'cross-network';
  if (network !== 'cross-network') {
    return selectedProfiles.filter((p) => p.platform === network);
  }
  const platformSet = new Set<Platform>(definition.platforms);
  return selectedProfiles.filter((p) => platformSet.has(p.platform as Platform));
}

/**
 * Severity for a module's title-row icon.  Case 2 wins over Case 1 so a
 * module that has BOTH a reconnect-needed profile AND a syncing
 * profile renders only the red warning glyph — surfacing the action
 * the user can take.
 *
 * Returns the severity AND the list of profiles in that tier, since
 * the tooltip copy keys off the affected names + count.
 */
export function deriveModuleWarning(
  profilesForModule: MockProfile[],
): { severity: WarningSeverity; profiles: MockProfile[] } {
  const case2 = profilesForModule.filter((p) => classifyStatus(p.status) === 'case2');
  if (case2.length > 0) return { severity: 'case2', profiles: case2 };
  const case1 = profilesForModule.filter((p) => classifyStatus(p.status) === 'case1');
  if (case1.length > 0) return { severity: 'case1', profiles: case1 };
  return { severity: null, profiles: [] };
}

/**
 * Distinct union of Case-2 profiles affecting any visible module —
 * drives `GlobalDataWarningBanner`.  A profile only counts if it would
 * actually surface in at least one module (i.e. the module's
 * network/definition filter would pick it up).  This avoids the banner
 * raising the alarm about a profile whose platform doesn't appear in
 * any module the user has on the canvas.
 *
 * Returns the unique profiles (de-duped by `id`) and the affected
 * count is callers can use `.length` directly.
 */
export function deriveGlobalCase2Profiles(
  modules: ReportModule[],
  definitionsById: Map<string, ModuleDefinition>,
  selectedProfiles: MockProfile[],
): MockProfile[] {
  const seen = new Map<string, MockProfile>();
  for (const module of modules) {
    // Skip non-data canvas elements (Text / Divider / Emoji) — they
    // don't bind to profiles, so their presence shouldn't pull
    // anything into the union.
    if (module.elementKind) continue;
    const def = definitionsById.get(module.definitionId);
    if (!def) continue;
    const forModule = filterProfilesForModule(module, def, selectedProfiles);
    for (const p of forModule) {
      if (classifyStatus(p.status) === 'case2' && !seen.has(p.id)) {
        seen.set(p.id, p);
      }
    }
  }
  return Array.from(seen.values());
}
