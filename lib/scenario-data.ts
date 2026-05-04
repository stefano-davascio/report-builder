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
 * "many" — 25 reports synthesised by cycling through the 3 production
 * seeds with renamed copies. Stable IDs (`scenario-many-N`) so list
 * keys don't collide with real reports the user creates while the
 * scenario is active. Names rotated through a small bank of plausible
 * report titles so the rows visually read as a real account, not 25
 * copies of the same row.
 */
const MANY_REPORT_NAMES = [
  'January monthly report',
  'February monthly report',
  'March monthly report',
  'April monthly report',
  'May monthly report',
  'June monthly report',
  'Q1 2026 review',
  'Q2 2026 review',
  'Holiday campaign — Black Friday',
  'Holiday campaign — Cyber Monday',
  'Spring product launch',
  'Summer product launch',
  'Fall content push',
  'Winter content push',
  'Brand awareness — global',
  'Brand awareness — US',
  'Engagement deep-dive — Instagram',
  'Engagement deep-dive — TikTok',
  'Engagement deep-dive — LinkedIn',
  'Audience growth — cross-platform',
  'Audience growth — TikTok only',
  'Audience growth — Instagram only',
  'Top-posts roundup — weekly',
  'Top-posts roundup — monthly',
  'Influencer partnership snapshot',
];

const MANY_REPORTS: MockReport[] = MANY_REPORT_NAMES.map((name, i) => {
  // Rotate through the 3 production seeds so each row has plausible
  // module + network + profile data without us having to hand-author 25
  // configurations.
  const seed = INITIAL_REPORTS[i % INITIAL_REPORTS.length];
  return {
    ...seed,
    id: `scenario-many-${i + 1}`,
    name,
    // Stagger modifiedAt so the table's "X hours/days ago" column
    // doesn't read as 25 identical timestamps.
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
