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
  const out: string[] = [];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const years = ['2024', '2025', '2026'];

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

  // Hand-curated mix — 51 plausible analytics / campaign titles to
  // bring the total to 99.  Stable order so the same list always
  // renders the same way across renders / refreshes.
  const others = [
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
  out.push(...others);

  return out;
}

const MANY_REPORT_NAMES = generateManyReportNames();

const MANY_REPORTS: MockReport[] = MANY_REPORT_NAMES.map((name, i) => {
  // Rotate through the 3 production seeds so each row has plausible
  // module + network + profile data without us having to hand-author
  // 99 configurations.
  const seed = INITIAL_REPORTS[i % INITIAL_REPORTS.length];
  return {
    ...seed,
    id: `scenario-many-${i + 1}`,
    name,
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
 * Filter ids that come pre-selected in the "filtered" scenario.  Maps
 * to the ids in `FILTER_OPTIONS` (lib/reports-data.ts) — Instagram is
 * a network with a healthy chunk of `MANY_REPORTS` matches, so the
 * filtered view paints with a plausible non-zero result count.
 */
export const FILTERED_INITIAL_FILTER_IDS: ReadonlySet<string> = new Set([
  'instagram',
]);

/**
 * The single source of truth that maps a `reportListState` onto the
 * data + chrome the landing page should render. Returning a struct
 * (not just an array) keeps the chrome flags adjacent to the data
 * they describe — easy to extend with future scenarios without
 * touching every consumer.
 */
export interface ReportsScenarioRender {
  /** Rows the table should render. */
  reports: MockReport[];
  /** Show the search input above the table. */
  searchEnabled: boolean;
  /** Show the pagination footer below the table. */
  paginationEnabled: boolean;
  /** Filter chip ids to pre-select when the table mounts. */
  initialFilters?: ReadonlySet<string>;
}

export function reportsForScenario(state: ReportListState): ReportsScenarioRender {
  switch (state) {
    case 'empty':
      return { reports: [], searchEnabled: false, paginationEnabled: false };
    case 'few':
      return { reports: FEW_REPORTS, searchEnabled: false, paginationEnabled: false };
    case 'many':
      return { reports: MANY_REPORTS, searchEnabled: true, paginationEnabled: true };
    case 'filtered':
      return {
        reports: FILTERED_REPORTS,
        searchEnabled: true,
        paginationEnabled: true,
        initialFilters: FILTERED_INITIAL_FILTER_IDS,
      };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function shiftIsoDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
