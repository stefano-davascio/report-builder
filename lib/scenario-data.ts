/**
 * Scenario datasets — feeds the Scenario Switcher (internal demo tool).
 *
 * Every scenario maps to a `(templates, reports, listChrome)` triple that
 * the landing page renders unmodified. The page tree itself doesn't know
 * which scenario it's painting; it just receives the derived data and
 * draws.
 *
 * Datasets live here (not in `lib/reports-data.ts`) so the production
 * surface — `INITIAL_REPORTS`, `REPORT_TEMPLATES` — stays a clean
 * representation of "what a real customer would see by default" and
 * doesn't get cluttered with demo-only fixtures.
 */

import type { Platform } from '@/types';
import type { ReportListState, TemplateScope } from './scenario';
import {
  INITIAL_REPORTS,
  REPORT_TEMPLATES,
  type MockReport,
  type ReportTemplate,
} from './reports-data';

// ── Templates ────────────────────────────────────────────────────────────

/**
 * Beta launch scope per Figma 1452:457037: only Start-from-scratch +
 * TikTok performance + Facebook performance. Anything not in this set
 * is dropped from the carousel when `templateScope === 'beta'`.
 */
const BETA_TEMPLATE_IDS = new Set(['tpl-tt', 'tpl-fb']);

export function templatesForScope(scope: TemplateScope): ReportTemplate[] {
  if (scope === 'full') return REPORT_TEMPLATES;
  return REPORT_TEMPLATES.filter((t) => {
    // Always keep the "Start from scratch" card — it's the primary CTA
    // regardless of which template subset ships in beta.
    if (t.kind === 'scratch') return true;
    return BETA_TEMPLATE_IDS.has(t.id);
  });
}

// ── Reports list ─────────────────────────────────────────────────────────

/** "few" reuses the production seed — it's already 3 rows. */
const FEW_REPORTS: MockReport[] = INITIAL_REPORTS;

/**
 * "many" — 99 reports synthesised by cycling through the 3 production
 * seeds with renamed copies.  The exact count is chosen so the
 * pagination footer's per-page selector exercises every option:
 *
 *   • 10 per page  → 10 pages
 *   • 25 per page  →  4 pages
 *   • 50 per page  →  2 pages
 *   • 100 per page →  1 page  (the only size that collapses to a
 *                              single-page view — confirmation that
 *                              the size selector still surfaces on a
 *                              single-page result so the user can
 *                              shrink back down without losing chrome)
 *
 * Stable IDs (`scenario-many-N`) so list keys don't collide with real
 * reports the user creates while the scenario is active.  Names are
 * generated from a few simple patterns (monthly-by-year, quarterly-
 * by-year, plus a hand-curated list of plausible campaign / analytics
 * titles) so the rows read as a real account rather than 99 copies of
 * the same row, without us having to hand-author every entry.
 */
function generateManyReportNames(): string[] {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const years = ['2024', '2025', '2026'];

  // Hand-curated mix listed FIRST so platform-named reports
  // ('Engagement deep-dive — Facebook', 'Audience growth — Instagram
  // only', etc.) live within the first MANY_VISIBLE_LIMIT (50) rows.
  // Otherwise the name-contains filter ("facebook", "instagram", …)
  // would return zero matches in the many / filtered scenarios — the
  // reports exist but the slice cuts them off.
  const curated = [
    'Holiday campaign — Black Friday',
    'Holiday campaign — Cyber Monday',
    'Spring product launch',
    'Summer product launch',
    'Fall content push',
    'Winter content push',
    'Brand awareness — global',
    'Brand awareness — US',
    'Brand awareness — UK',
    'Engagement deep-dive — Instagram',
    'Engagement deep-dive — TikTok',
    'Engagement deep-dive — LinkedIn',
    'Engagement deep-dive — Facebook',
    'Engagement deep-dive — YouTube',
    'Audience growth — cross-platform',
    'Audience growth — TikTok only',
    'Audience growth — Instagram only',
    'Audience growth — Facebook only',
    'Audience growth — LinkedIn only',
    'Top-posts roundup — weekly',
    'Top-posts roundup — monthly',
    'Influencer partnership snapshot',
    'Competitor analysis — Q1',
    'Competitor analysis — Q2',
    'Competitor analysis — Q3',
    'Competitor analysis — Q4',
    'Content performance — videos',
    'Content performance — carousels',
    'Content performance — stories',
    'Content performance — reels',
    'Customer engagement — email',
    'Customer engagement — social',
    'Crisis response — March',
    'Crisis response — September',
    'Year-end summary',
    'Mid-year review',
    'Onboarding metrics',
    'Retention analysis',
    'Conversion funnel',
    'Hashtag performance',
    'Geographic insights',
    'Demographic breakdown',
    'Sentiment analysis',
    'Influencer ROI',
    'Paid vs organic comparison',
    'Cross-channel comparison',
    'Mobile vs desktop',
    'Time-of-day analysis',
    'Day-of-week analysis',
    'Posting frequency study',
    'Engagement rate by post type',
  ];

  const out: string[] = [...curated];

  // Monthly reports — 12 × 3 = 36
  for (const year of years) {
    for (const month of months) {
      out.push(`${month} ${year} monthly report`);
    }
  }

  // Quarterly reviews — 4 × 3 = 12
  for (const year of years) {
    for (let q = 1; q <= 4; q++) {
      out.push(`Q${q} ${year} review`);
    }
  }

  return out;
}

const MANY_REPORT_NAMES = generateManyReportNames();

/**
 * Rotation of plausible network combinations for the "many" rows.
 *
 * The original implementation cycled the production INITIAL_REPORTS
 * seeds, which collapsed every row to one of just three identical
 * network arrays — every "many" report ended up looking either
 * facebook-only, instagram-only, or the same 4-way cross-platform
 * combo. The Networks column is one of the most visually scannable
 * pieces of the table, so a real account would have considerably more
 * variety: single-network reports, two-way pairs, three-way combos,
 * and the occasional 4 / 5-way combo to exercise the "+N" overflow
 * indicator.
 *
 * Order is intentionally varied — single → pair → triple → wide →
 * single — so the table reads as natural diversity rather than a
 * predictable pattern.  Index i % NETWORK_VARIANTS.length picks the
 * combo for each row.
 */
const NETWORK_VARIANTS: Platform[][] = [
  ['facebook'],
  ['tiktok'],
  ['instagram'],
  ['linkedin'],
  ['youtube'],
  ['facebook', 'instagram'],
  ['linkedin', 'facebook'],
  ['instagram', 'tiktok'],
  ['youtube', 'instagram'],
  ['facebook', 'tiktok'],
  ['linkedin', 'youtube'],
  ['facebook', 'instagram', 'tiktok'],
  ['linkedin', 'facebook', 'instagram'],
  ['tiktok', 'youtube', 'instagram'],
  ['facebook', 'instagram', 'tiktok', 'linkedin'],
  ['facebook', 'instagram', 'tiktok', 'youtube'],
  ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube'],
];

const MANY_REPORTS: MockReport[] = MANY_REPORT_NAMES.map((name, i) => {
  // Rotate through the 3 production seeds for module + profile data
  // (so each row has a plausible module count) but OVERRIDE the
  // networks array with a varied combo so the Networks column
  // reads as a real, mixed account.
  const seed = INITIAL_REPORTS[i % INITIAL_REPORTS.length];
  const networks = NETWORK_VARIANTS[i % NETWORK_VARIANTS.length];
  return {
    ...seed,
    id: `scenario-many-${i + 1}`,
    name,
    networks,
    // Stagger modifiedAt so the table's "X hours/days ago" column
    // doesn't read as 99 identical timestamps.
    modifiedAt: shiftIsoDays(seed.modifiedAt, i),
  };
});

/**
 * "filtered" — same `MANY_REPORTS` source but the table is opened with
 * one filter chip pre-selected so the user lands on a screen that shows
 * "filter applied + smaller result count + active chip" out of the
 * gate.  The actual filtering still runs through the table's normal
 * filter machinery — no special path.
 */
const FILTERED_REPORTS: MockReport[] = MANY_REPORTS;

/**
 * Initial filter state for the "filtered" scenario — the table mounts
 * with one Network chip pre-applied so reviewers see the
 * "filter applied + smaller result count + active chip" look out of
 * the gate.  Facebook is the chosen seed because it (a) has many
 * matches in MANY_REPORTS, and (b) is in scope under BOTH Full and
 * Beta templates (Beta only allows facebook + tiktok), so the chip
 * survives every scope without producing zero results.
 */
export interface ScenarioInitialFilters {
  networks?: Platform[];
  users?: string[];
  nameContains?: string;
}

export const FILTERED_INITIAL_FILTERS: ScenarioInitialFilters = {
  networks: ['facebook'],
};

/**
 * Hard cap on the number of rows the "many" / "filtered" scenarios
 * surface.  We generate 99 rows up front (more = better synthetic
 * variety, since the names + network rotation patterns repeat every
 * few dozen entries) but slice to this number when handing off to the
 * UI so the visible scenario reads as a believable real-world account.
 */
const MANY_VISIBLE_LIMIT = 50;

/**
 * Networks permitted under each template scope.  When the scope is
 * 'full' we don't restrict — the report list paints with whatever
 * network glyphs each row was authored with.  When the scope is
 * 'beta' the only platforms in scope are Facebook + TikTok (matches
 * the Build-a-new-report carousel's beta filter — see
 * `BETA_TEMPLATE_IDS` above).  Returning `null` for the unrestricted
 * case lets callers short-circuit the per-row filter loop.
 */
const BETA_NETWORKS: ReadonlySet<Platform> = new Set(['facebook', 'tiktok']);

function allowedNetworksForScope(scope: TemplateScope): ReadonlySet<Platform> | null {
  return scope === 'beta' ? BETA_NETWORKS : null;
}

/**
 * Apply network-scope filtering to a list of reports:
 *   • For each row, intersect its `networks` array with the allowed
 *     set so the icon stack only paints in-scope glyphs.
 *   • Drop rows that have ZERO allowed networks left — a row with an
 *     empty Networks column would read as broken.
 *
 * Callers pass `null` for the unrestricted (full-scope) case; we
 * return the source list untouched so there's no allocation overhead
 * for the production code path.
 */
function applyNetworkScope(
  reports: MockReport[],
  allowed: ReadonlySet<Platform> | null,
): MockReport[] {
  if (allowed === null) return reports;
  const out: MockReport[] = [];
  for (const r of reports) {
    const networks = r.networks.filter((n) => allowed.has(n));
    if (networks.length === 0) continue;
    out.push({ ...r, networks });
  }
  return out;
}

/**
 * Public wrapper: apply the template scope to an arbitrary report
 * list.  Used by `app/page.tsx` to scope the LIVE production reports
 * state in the "few" scenario (where the rendered list is the user's
 * actual `reports` array, not a canned dataset).  Mirrors the same
 * filter `reportsForScenario` runs internally, so the few scenario
 * gets the same Beta-network treatment as many / filtered.
 */
export function scopeFilterReports(
  reports: MockReport[],
  scope: TemplateScope,
): MockReport[] {
  return applyNetworkScope(reports, allowedNetworksForScope(scope));
}

/**
 * The single source of truth that maps a `reportListState` (× the
 * current `TemplateScope`) onto the data + chrome the landing page
 * should render. Returning a struct (not just an array) keeps the
 * chrome flags adjacent to the data they describe — easy to extend
 * with future scenarios without touching every consumer.
 */
export interface ReportsScenarioRender {
  /** Rows the table should render. */
  reports: MockReport[];
  /** Show the Filter trigger above the table.  True only when the
   *  list is long enough that filtering meaningfully narrows it
   *  (many / filtered).  False for empty + few — three rows fit on
   *  one screen and a Filter trigger would just clutter the row. */
  filterEnabled: boolean;
  /** Pre-applied filter chips when the table mounts.  See
   *  `ScenarioInitialFilters` for the shape. */
  initialFilters?: ScenarioInitialFilters;
  /** Networks the FilterDropdown's Network sub-selector can pick from.
   *  Beta scope ships only Facebook + TikTok; Full scope ships the
   *  mainstream network set. */
  availableNetworks: Platform[];
}

// Mainstream network set surfaced in the FilterDropdown's Network
// sub-selector when the scope is 'full'. Order mirrors the Figma
// network list (1674:44025).
const FULL_AVAILABLE_NETWORKS: Platform[] = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'x',
  'youtube',
];

const BETA_AVAILABLE_NETWORKS: Platform[] = ['facebook', 'tiktok'];

/**
 * Networks visible inside the Filter dropdown's Network sub-selector,
 * gated by template scope. Beta = FB+TT only; Full = the mainstream
 * 6-network set.  Used by `ReportsLandingPage` to plumb the option
 * list down to `ReportsTable` → `FilterDropdown`.
 */
export function availableNetworksForScope(scope: TemplateScope): Platform[] {
  return scope === 'beta' ? BETA_AVAILABLE_NETWORKS : FULL_AVAILABLE_NETWORKS;
}

export function reportsForScenario(
  state: ReportListState,
  scope: TemplateScope,
): ReportsScenarioRender {
  // Compute the allowed network set ONCE per render — every case
  // below funnels its dataset through the same filter, and re-running
  // the lookup per case would just be noise.
  const allowed = allowedNetworksForScope(scope);
  const availableNetworks = availableNetworksForScope(scope);
  switch (state) {
    case 'empty':
      return { reports: [], filterEnabled: false, availableNetworks };
    case 'few':
      return {
        reports: applyNetworkScope(FEW_REPORTS, allowed),
        filterEnabled: false,
        availableNetworks,
      };
    case 'many':
      // Apply scope FIRST, then cap.  Doing it the other way around
      // (cap → scope) means a beta-scoped many could end up with far
      // fewer than 50 visible rows when the first 50 of MANY_REPORTS
      // happen to skew toward non-beta networks.
      return {
        reports: applyNetworkScope(MANY_REPORTS, allowed).slice(0, MANY_VISIBLE_LIMIT),
        filterEnabled: true,
        availableNetworks,
      };
    case 'filtered':
      return {
        reports: applyNetworkScope(FILTERED_REPORTS, allowed).slice(0, MANY_VISIBLE_LIMIT),
        filterEnabled: true,
        availableNetworks,
        initialFilters: FILTERED_INITIAL_FILTERS,
      };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function shiftIsoDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
