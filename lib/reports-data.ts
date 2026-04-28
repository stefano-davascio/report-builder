import { Platform, ReportModule } from '@/types';
import { DEFAULT_MODULES, scaleChartLayout } from './default-layout';
import { ALL_PROFILES } from './profile-data';
import { uid } from './utils';

// ─── Reports landing page mock data ──────────────────────────────────────────
//
// Source-of-truth shape for a saved report as it appears in the landing
// page list. The `modules` field is a snapshot of the report-builder
// canvas — it gets passed straight back to `ReportBuilderPage` when the
// user opens a report. `networks` drives the Networks-column icon stack
// in the table; `selectedProfileIds` carries the profile selection
// forward so the builder doesn't reset to the default every time.
//
// `modifiedAt` stays as a literal ISO date so the table can sort it
// without timezone gymnastics. The cell formatter renders a relative
// label ("just now", "2 hours ago", "1 day ago") computed against
// today's date — matches the Figma comp 1290:101688 which uses relative
// dates rather than absolute. The current calendar date is read from
// `Date.now()` at format time, so the labels age naturally.

export interface MockReport {
  id: string;
  name: string;
  modifiedAt: string; // ISO date — `YYYY-MM-DD`
  modules: ReportModule[];
  networks: Platform[];
  selectedProfileIds: string[];
  /** "Premium" tag in Figma node 701:34671 — drives the small chip on the row. */
  premium?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Build a fresh ReportModule[] cloned from DEFAULT_MODULES so each mock
// report owns its own ids — important once the user mutates the builder
// canvas after opening a report.
function cloneDefault(): ReportModule[] {
  return DEFAULT_MODULES.map((m) => {
    const newId = `mod-${m.definitionId}-${uid()}`;
    return {
      ...m,
      id: newId,
      layout: { ...m.layout, i: newId },
    };
  });
}

// ── Module-set presets ─────────────────────────────────────────────────────
//
// Each preset returns an independent ReportModule[] (no shared object
// references). Filtered subsets of DEFAULT_MODULES so each row's icon
// stack and saved layout actually correspond to the report name.

function presetCrossPlatform(): ReportModule[] {
  return cloneDefault();
}

function presetFacebookOnly(): ReportModule[] {
  return cloneDefault().filter((m) =>
    ['followers', 'reach', 'impressions', 'engagement-rate', 'audience-growth'].includes(
      m.definitionId,
    ),
  );
}

function presetInstagramOnly(): ReportModule[] {
  return cloneDefault().filter((m) =>
    ['followers', 'reach', 'engagement-rate', 'audience-growth', 'audience-by-country', 'top-posts'].includes(
      m.definitionId,
    ),
  );
}

// TikTok preset — every TikTok-scoped module in the catalog, hand-laid
// out so related modules sit next to each other on the canvas. The
// pairings the preset is built around (read top-to-bottom on the left
// column, then the right):
//
//   Row 0   metric strip:   video views | profile views | likes | comments
//   Row 1   audience strip: followers (Audience headline metric, w=1)
//   Row 2   demographics:   audience-by-gender pie  ┃  audience-by-country list
//   Row 3   day-by-day:     video views by day      ┃  interactions by day
//   Row 4   summary cards:  best performing day     ┃  best engaging day
//   Row 5   activity grids: publishing behaviour    ┃  followers online
//
// NOTE: a Row 6 "top videos" table previously closed the preset; it's
// been removed pending a fresh Figma spec. Re-add by restoring the
// `tiktok-top-videos` definition in `lib/mock-data.ts` AND its preset
// entry below.
//
// "Audience" is the cross-network `followers` module rendered as a
// metric card — the headline number is what the user actually wants
// when scanning the report. The age-bucket donut (`tiktok-audience`)
// stays available in the picker for users who want it back, but it's
// not part of the default TikTok preset since the gender + country
// breakdowns below it cover the demographic story more usefully.
//
// The "best performing day" card sits directly beneath "video views by
// day" (same x, next y band) so the two read as a topic pair; same for
// "best engaging day" beneath "interactions by day". This matches the
// product framing: each summary card is the headline number that the
// chart above it visualizes day-by-day.
//
// Heights are all multiples of 6 (Figma cell boundaries); widths are
// 1 / 2 / 4 columns. Coordinates are picked so no two modules ever
// overlap even when adjacent rows have different `h` values.
//
// Definitions (`MODULE_DEFINITIONS` in `lib/mock-data.ts`) own each
// module's `defaultChartType` — we re-state it here so the preset is
// self-contained: a future catalog tweak shouldn't silently change
// what a saved TikTok report renders as.
function presetTikTokOnly(): ReportModule[] {
  const modules: ReportModule[] = [
    // Row 0 (y=0, h=6) — TikTok-specific KPI strip across the top.
    { id: 'mod-tt-video-views',    definitionId: 'tiktok-video-views',    chartType: 'metric',
      layout: { i: 'mod-tt-video-views',    x: 0, y: 0, w: 1, h: 6, minW: 1, minH: 6 } },
    { id: 'mod-tt-profile-views',  definitionId: 'tiktok-profile-views',  chartType: 'metric',
      layout: { i: 'mod-tt-profile-views',  x: 1, y: 0, w: 1, h: 6, minW: 1, minH: 6 } },
    { id: 'mod-tt-likes',          definitionId: 'tiktok-likes',          chartType: 'metric',
      layout: { i: 'mod-tt-likes',          x: 2, y: 0, w: 1, h: 6, minW: 1, minH: 6 } },
    { id: 'mod-tt-comments',       definitionId: 'tiktok-comments',       chartType: 'metric',
      layout: { i: 'mod-tt-comments',       x: 3, y: 0, w: 1, h: 6, minW: 1, minH: 6 } },

    // Row 1 (y=6, h=6) — Audience headline metric. `followers` is the
    // cross-network module that renders a single headline number; on
    // TikTok it's the audience-size KPI. Sits at x=0 as the lead-in
    // for the demographic breakdowns immediately below it.
    { id: 'mod-tt-followers',      definitionId: 'followers',             chartType: 'metric',
      layout: { i: 'mod-tt-followers',      x: 0, y: 6, w: 1, h: 6, minW: 1, minH: 6 } },

    // Row 2 (y=12, h=18) — audience demographics: gender pie next to
    // country list. Country defaultH is 24 in the catalog; we trim to
    // 18 here so the row reads as an even pair.
    { id: 'mod-tt-aud-gender',     definitionId: 'audience-by-gender',    chartType: 'pie',
      layout: { i: 'mod-tt-aud-gender',     x: 0, y: 12, w: 2, h: 18, minW: 1, minH: 12 } },
    { id: 'mod-tt-aud-country',    definitionId: 'audience-by-country',   chartType: 'list',
      layout: { i: 'mod-tt-aud-country',    x: 2, y: 12, w: 2, h: 18, minW: 1, minH: 12 } },

    // Row 3 (y=30, h=18) — daily-trend chart pair.
    { id: 'mod-tt-views-by-day',   definitionId: 'tiktok-video-views-by-day',    chartType: 'area',
      layout: { i: 'mod-tt-views-by-day',   x: 0, y: 30, w: 2, h: 18, minW: 1, minH: 12 } },
    { id: 'mod-tt-inter-by-day',   definitionId: 'tiktok-interactions-by-day',   chartType: 'bar',
      layout: { i: 'mod-tt-inter-by-day',   x: 2, y: 30, w: 2, h: 18, minW: 1, minH: 12 } },

    // Row 4 (y=48, h=12) — summary cards directly under each daily trend.
    // Best performing day pairs with views-by-day (same x=0); best
    // engaging day pairs with interactions-by-day (same x=2).
    { id: 'mod-tt-best-perf',      definitionId: 'tiktok-best-performing-day',   chartType: 'list',
      layout: { i: 'mod-tt-best-perf',      x: 0, y: 48, w: 2, h: 12, minW: 1, minH: 12 } },
    { id: 'mod-tt-best-eng',       definitionId: 'tiktok-best-engaging-day',     chartType: 'list',
      layout: { i: 'mod-tt-best-eng',       x: 2, y: 48, w: 2, h: 12, minW: 1, minH: 12 } },

    // Row 5 (y=60, h=18) — publishing-behaviour bubble grid next to
    // followers-online heatmap. Both are activity-pattern charts.
    { id: 'mod-tt-publishing',       definitionId: 'tiktok-publishing-behaviour', chartType: 'bubble',
      layout: { i: 'mod-tt-publishing',       x: 0, y: 60, w: 2, h: 18, minW: 1, minH: 12 } },
    { id: 'mod-tt-followers-online', definitionId: 'tiktok-followers-online',     chartType: 'bubble',
      layout: { i: 'mod-tt-followers-online', x: 2, y: 60, w: 2, h: 18, minW: 1, minH: 12 } },
    // Row 6 (top-videos table) intentionally absent — pending a fresh
    // Figma spec. See the rationale comment above the function.
  ];
  // `app/page.tsx` calls `reissueModuleIds(template.modules())` on
  // template click so each spawned report gets fresh ids — the literal
  // ids above are just stable design-time anchors. No need to clone or
  // randomize here.
  // Layout literals above are written in OLD-units (1 Figma cell = 6
  // rows) for readability; canvas runs in NEW-units (1 cell = 78 rows)
  // — see `scaleChartLayout` in default-layout.ts for the transform.
  return scaleChartLayout(modules);
}

// ── Initial reports list ───────────────────────────────────────────────────
//
// Figma comp 1290:101688 shows three rows:
//   • Facebook performance       — just now
//   • Instagram performance      — 2 hours ago
//   • Cross-platform summary     — 1 day ago, Facebook+Instagram+Bluesky+1
//
// The dates below are spaced relative to "today" (the page assumes
// 2026-04-25 at write-time but the formatter recomputes against
// `Date.now()` so the labels stay accurate as the calendar advances).

const NOW = new Date(); // resolved at module-load

function isoDaysAgo(days: number, hoursOffset = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hoursOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}:00`;
}

export const INITIAL_REPORTS: MockReport[] = [
  {
    id: 'report-1',
    name: 'Facebook performance',
    // "just now" — within the last minute
    modifiedAt: isoDaysAgo(0, 0),
    modules: presetFacebookOnly(),
    networks: ['facebook'],
    selectedProfileIds: ['fb-1', 'fb-2', 'fb-3'],
  },
  {
    id: 'report-2',
    name: 'Instagram performance',
    // "2 hours ago"
    modifiedAt: isoDaysAgo(0, 2),
    modules: presetInstagramOnly(),
    networks: ['instagram'],
    selectedProfileIds: ['ig-1', 'ig-2'],
  },
  {
    id: 'report-3',
    name: 'Cross-platform summary',
    // "1 day ago" — five modules, multi-network with overflow chip
    modifiedAt: isoDaysAgo(1, 0),
    modules: presetCrossPlatform().slice(0, 5),
    networks: ['facebook', 'instagram', 'bluesky', 'linkedin'],
    selectedProfileIds: ['fb-1', 'ig-1', 'li-1'],
  },
];

// ── Templates (top "Build a new report" section) ───────────────────────────
//
// `kind: 'scratch'` is the dashed-border primary card. The other three
// are concrete templates that seed the builder with a preset module set
// and an initial profile selection. The template's `name` lands on the
// Builder header as the new report's title.

export type ReportTemplate =
  | { kind: 'scratch'; title: string; description: string }
  | {
      kind: 'template';
      id: string;
      title: string;
      description: string;
      /**
       * Networks this template targets. Drives both the Networks-column
       * icon stack on the landing-page row AND the default profile
       * selection seeded into the builder when the template is clicked
       * (see `templateSelectedProfileIds` below):
       *   • single-network template → all profiles for that network
       *   • multi-network template  → every connected profile
       *     (the "cross-platform summary" semantics)
       *
       * No more hardcoded `selectedProfileIds` on the template — the
       * profile catalog (`ALL_PROFILES`) is the source of truth, so
       * adding a profile to a network automatically opts it into the
       * matching quick report on its next click.
       */
      networks: Platform[];
      modules: () => ReportModule[];
    };

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    kind: 'scratch',
    title: 'Start from scratch',
    description: 'Create a fully custom report',
  },
  {
    kind: 'template',
    id: 'tpl-cross',
    title: 'Cross-platform summary',
    description: 'Compare performance across connected channels',
    // Cross-platform = "every connected profile" (see
    // `templateSelectedProfileIds`). The list below stays as a hint for
    // the row's Networks column; the multi-entry length is what flips
    // the seeding logic into "select all".
    networks: ['facebook', 'instagram', 'tiktok'],
    modules: presetCrossPlatform,
  },
  // Figma 1295:124074 places Instagram before Facebook in the strip —
  // we match that order so the visible 4-card window reads exactly as
  // designed (Start, Cross, Instagram, Facebook).
  {
    kind: 'template',
    id: 'tpl-ig',
    title: 'Instagram performance',
    description: 'Pre-built metrics for Instagram profiles',
    networks: ['instagram'],
    modules: presetInstagramOnly,
  },
  {
    kind: 'template',
    id: 'tpl-fb',
    title: 'Facebook performance',
    description: 'Understand the impact your posts have on your overall metrics.',
    networks: ['facebook'],
    modules: presetFacebookOnly,
  },
  // ── Second-row templates (Figma 1297:145621). The Figma comp uses the
  // same one-line "Pre-built metrics for Instagram profiles" placeholder
  // for all four — we localize it per network so each card tells its
  // own story while keeping the typography exactly as designed.
  {
    kind: 'template',
    id: 'tpl-tt',
    title: 'TikTok performance',
    description: 'Understand your TikTok audience, their behaviour and engagement.',
    networks: ['tiktok'],
    // Hand-laid TikTok preset (see `presetTikTokOnly` for the row-by-row
    // rationale) — pairs each daily-trend chart with the matching
    // summary card directly below it (views-by-day → best-performing-day,
    // interactions-by-day → best-engaging-day) so the canvas reads as
    // topic groups rather than a flat module list.
    modules: presetTikTokOnly,
  },
  {
    kind: 'template',
    id: 'tpl-ga',
    title: 'Google Analytics performance',
    description: 'Analyse the impact social media has on traffic to your website.',
    networks: ['google-analytics'],
    modules: cloneDefault,
  },
  {
    kind: 'template',
    id: 'tpl-li',
    title: 'LinkedIn performance',
    description: 'Track your company’s presence on LinkedIn with insightful data.',
    networks: ['linkedin'],
    modules: cloneDefault,
  },
  {
    kind: 'template',
    id: 'tpl-yt',
    title: 'Youtube performance',
    description: 'Track your audience growth & video engagement.',
    networks: ['youtube'],
    modules: cloneDefault,
  },
];

/**
 * Default profile selection for a quick-report template click.
 *
 *   • Single-network template (e.g. "Instagram performance")
 *       → every profile in `ALL_PROFILES` whose `platform` matches.
 *   • Multi-network template (e.g. "Cross-platform summary")
 *       → every connected profile.
 *
 * Order follows `ALL_PROFILES` (i.e. the order profiles render in the
 * picker dropdown) so the chip strip reads in the same sequence the
 * user sees when they open the picker.
 */
export function templateSelectedProfileIds(
  template: Extract<ReportTemplate, { kind: 'template' }>,
): string[] {
  if (template.networks.length > 1) {
    return ALL_PROFILES.map((p) => p.id);
  }
  const [net] = template.networks;
  return ALL_PROFILES.filter((p) => p.platform === net).map((p) => p.id);
}

// ── Filter catalog ─────────────────────────────────────────────────────────
//
// Static catalog of filter options. The dropdown uses a drill-in pattern:
// the landing screen lists the four categories with chevrons; tapping a
// row drills into the sub-list of that category (Network / User / Profile
// / Profile lists). Selecting an option turns it into a chip rendered
// inline next to the Filter button.

export interface FilterOption {
  id: string;
  label: string;
  category: 'Network' | 'User' | 'Profile' | 'Profile lists';
}

export const FILTER_OPTIONS: FilterOption[] = [
  { id: 'net-fb',   label: 'Facebook',  category: 'Network' },
  { id: 'net-ig',   label: 'Instagram', category: 'Network' },
  { id: 'net-tt',   label: 'TikTok',    category: 'Network' },
  { id: 'net-yt',   label: 'YouTube',   category: 'Network' },
  { id: 'net-li',   label: 'LinkedIn',  category: 'Network' },
  { id: 'net-bs',   label: 'Bluesky',   category: 'Network' },
  { id: 'usr-me',   label: 'Me',                category: 'User' },
  { id: 'usr-team', label: 'Team members',      category: 'User' },
  { id: 'pl-tence', label: 'Tenceclothier',     category: 'Profile' },
  { id: 'pll-core', label: 'Core profiles',     category: 'Profile lists' },
  { id: 'pll-emea', label: 'EMEA profiles',     category: 'Profile lists' },
];

// ── Date formatting ────────────────────────────────────────────────────────
//
// Render an ISO date (or full ISO datetime) as a relative phrase per
// Figma 1290:101688: "just now", "X minutes ago", "X hours ago", "X days
// ago", "X weeks ago", "X months ago", "X years ago". Anchored to
// `Date.now()` so the label updates as the calendar advances.

export function formatModifiedAt(iso: string): string {
  // Accept either `YYYY-MM-DD` (date only) or a full ISO datetime. For
  // date-only we anchor to noon so a same-day stamp doesn't read as
  // "yesterday" because the local timezone trimmed off a few hours.
  const isoNorm = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  const t = Date.parse(isoNorm);
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWk  = Math.floor(diffDay / 7);
  const diffMo  = Math.floor(diffDay / 30);
  const diffYr  = Math.floor(diffDay / 365);

  if (diffSec < 60)  return 'just now';
  if (diffMin < 60)  return diffMin === 1 ? '1 minute ago'  : `${diffMin} minutes ago`;
  if (diffHr  < 24)  return diffHr  === 1 ? '1 hour ago'    : `${diffHr} hours ago`;
  if (diffDay < 7)   return diffDay === 1 ? '1 day ago'     : `${diffDay} days ago`;
  if (diffWk  < 5)   return diffWk  === 1 ? '1 week ago'    : `${diffWk} weeks ago`;
  if (diffMo  < 12)  return diffMo  === 1 ? '1 month ago'   : `${diffMo} months ago`;
  return diffYr === 1 ? '1 year ago' : `${diffYr} years ago`;
}
