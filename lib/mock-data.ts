import { ModuleDefinition, MockDataPoint, MetricData, TableRow, ListItem, BubblePoint, VideoCardData } from '@/types';

// ─── Module catalog ───────────────────────────────────────────────────────────
//
// Authoritative atomic module definitions, sourced from the product spec.
// Each entry is a **data concept** (what is being measured) paired with
// the visualizations it supports. A single concept can appear in multiple
// browsing paths (Cross-network, Facebook, Instagram, TikTok, Metric card,
// Line chart, etc.) — that's just filtering over this same list.
//
// Mapping from the spec's upstream platform/chart keys onto our local
// canonical keys:
//   TikTok              → 'tiktok'
//   FacebookPage        → 'facebook'
//   InstagramBusiness   → 'instagram'
//   Line | Area | Bar   → 'line' | 'area' | 'bar'
//   Pie                 → 'pie'       (donut is folded into pie)
//   Table | List        → 'table' | 'list'
//   MetricCard          → 'metric'
//
// `tracks: 'Common'` becomes `category: 'Cross-network'` so the section
// header in the Add-modules panel can use the category directly. Single-
// platform modules get `category` set to the platform's display name —
// the same string the panel's section header renders.
//
// `defaultW` / `defaultH` are in OLD-units, where `6h = 1 Figma cell`,
// so `h: 6` = a 1-cell-tall metric card, `h: 18` = 3 cells tall
// (charts), `h: 24` = 4 cells (tables / lists). ReportCanvas runs the
// grid in NEW-units (1 cell = 78 rows) and multiplies these values by
// `CHART_H_FACTOR` (= 13) at every consumption site so the catalog
// stays human-readable.
//
// A generic 👤 icon is used as a placeholder on rows that don't have a
// specific glyph — the panel renders the platform cluster on the right
// regardless, and the icon column on the left shows the drag handle.
export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // ── Cross-network (multi-platform) ──────────────────────────────────────
  {
    id: 'audience-growth',
    name: 'Audience Growth',
    description: 'Tracks net follower change over time across supported platforms.',
    platforms: ['tiktok', 'facebook', 'instagram'],
    supportedChartTypes: ['line', 'area', 'bar'],
    defaultChartType: 'area',
    category: 'Cross-network',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'audience-by-gender',
    name: 'Audience by gender',
    description: 'Breaks down your audience by self-reported gender.',
    platforms: ['tiktok', 'facebook', 'instagram'],
    supportedChartTypes: ['pie', 'bar'],
    defaultChartType: 'pie',
    category: 'Cross-network',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'audience-by-country',
    name: 'Audience by country',
    description: 'Ranks your top audience countries by share of lifetime views.',
    platforms: ['tiktok', 'facebook', 'instagram'],
    supportedChartTypes: ['list', 'pie', 'bar'],
    defaultChartType: 'list',
    category: 'Cross-network',
    icon: '👥',
    defaultW: 2,
    defaultH: 24,
  },
  {
    id: 'top-posts',
    name: 'Top Posts',
    description: 'Ranks your posts by engagement across supported platforms.',
    platforms: ['tiktok', 'facebook', 'instagram'],
    supportedChartTypes: ['table', 'list'],
    defaultChartType: 'list',
    category: 'Cross-network',
    icon: '👥',
    defaultW: 2,
    defaultH: 24,
  },
  {
    id: 'followers',
    name: 'Followers',
    description: 'Displays followers as a single headline metric across supported platforms.',
    platforms: ['tiktok', 'facebook', 'instagram'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Cross-network',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'reach',
    name: 'Reach',
    description: 'Displays reach as a single headline metric across supported platforms.',
    platforms: ['tiktok', 'facebook', 'instagram'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Cross-network',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'impressions',
    name: 'Impressions',
    description: 'Displays impressions as a single headline metric across supported platforms.',
    platforms: ['tiktok', 'facebook', 'instagram'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Cross-network',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'engagement-rate',
    name: 'Engagement Rate',
    description: 'Displays engagement rate as a single headline metric across supported platforms.',
    platforms: ['tiktok', 'facebook', 'instagram'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Cross-network',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },

  // ── Facebook track ──────────────────────────────────────────────────────
  {
    id: 'facebook-page-insights',
    name: 'Facebook Page Insights',
    description: 'Overview of reach, impressions, and engagement for your Facebook Page.',
    platforms: ['facebook'],
    supportedChartTypes: ['line', 'area', 'bar'],
    defaultChartType: 'line',
    category: 'Facebook',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'facebook-top-posts',
    name: 'Facebook Top Posts',
    description: 'Ranks your Facebook posts by reach and engagement.',
    platforms: ['facebook'],
    supportedChartTypes: ['table', 'list'],
    defaultChartType: 'table',
    category: 'Facebook',
    icon: '👥',
    defaultW: 2,
    defaultH: 24,
  },
  {
    id: 'facebook-page-likes',
    name: 'Facebook Page Likes',
    description: 'Displays total Facebook Page likes as a single headline metric.',
    platforms: ['facebook'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Facebook',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'facebook-reach',
    name: 'Facebook Reach',
    description: 'Displays Facebook reach as a single headline metric.',
    platforms: ['facebook'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Facebook',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'facebook-impressions',
    name: 'Facebook Impressions',
    description: 'Displays Facebook impressions as a single headline metric.',
    platforms: ['facebook'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Facebook',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'facebook-engagement',
    name: 'Facebook Engagement',
    description: 'Displays Facebook engagement as a single headline metric.',
    platforms: ['facebook'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Facebook',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },

  // ── Instagram track ─────────────────────────────────────────────────────
  {
    id: 'instagram-audience',
    name: 'Instagram Audience',
    description: 'Deep-dives into your Instagram audience by age, gender, and location.',
    platforms: ['instagram'],
    supportedChartTypes: ['pie', 'bar'],
    defaultChartType: 'pie',
    category: 'Instagram',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'instagram-top-posts',
    name: 'Instagram Top Posts',
    description: 'Ranks your Instagram posts and reels by reach, likes, and saves.',
    platforms: ['instagram'],
    supportedChartTypes: ['table', 'list'],
    defaultChartType: 'table',
    category: 'Instagram',
    icon: '👥',
    defaultW: 2,
    defaultH: 24,
  },
  {
    id: 'instagram-followers',
    name: 'Instagram Followers',
    description: 'Displays Instagram followers as a single headline metric.',
    platforms: ['instagram'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Instagram',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'instagram-reach',
    name: 'Instagram Reach',
    description: 'Displays Instagram reach as a single headline metric.',
    platforms: ['instagram'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Instagram',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'instagram-impressions',
    name: 'Instagram Impressions',
    description: 'Displays Instagram impressions as a single headline metric.',
    platforms: ['instagram'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Instagram',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'instagram-profile-visits',
    name: 'Instagram Profile Visits',
    description: 'Displays Instagram profile visits as a single headline metric.',
    platforms: ['instagram'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'Instagram',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },

  // ── TikTok track ────────────────────────────────────────────────────────
  // IDs keep the `tiktok-` prefix so they remain unique against any
  // future cross-network keys (`comments`, `likes`, `video-views`, …),
  // but display names drop the prefix per the product spec — the panel
  // already groups these under a "TikTok" section header so repeating
  // it on every row was redundant. The cross-network `followers` module
  // covers TikTok as well, so the duplicate `tiktok-followers` was
  // removed.
  {
    id: 'tiktok-audience',
    name: 'Audience',
    description: 'Deep-dives into your TikTok audience profile including interests and device usage.',
    platforms: ['tiktok'],
    supportedChartTypes: ['pie', 'bar'],
    defaultChartType: 'pie',
    category: 'TikTok',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  // NOTE: `tiktok-top-videos` removed pending a fresh Figma spec — the
  // table layout we shipped didn't match the rest of the report-builder
  // visuals, so the module is hidden from the catalog AND from the
  // TikTok preset until the design lands. Re-add here, in
  // `MOCK_LIST_DATA`, and in `presetTikTokOnly` together when reviving.
  {
    id: 'tiktok-video-views',
    name: 'Video Views',
    description: 'Displays TikTok video views as a single headline metric.',
    platforms: ['tiktok'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'TikTok',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'tiktok-profile-views',
    name: 'Profile Views',
    description: 'Displays TikTok profile views as a single headline metric.',
    platforms: ['tiktok'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'TikTok',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'tiktok-likes',
    name: 'Likes',
    description: 'Displays TikTok likes as a single headline metric.',
    platforms: ['tiktok'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'TikTok',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'tiktok-comments',
    name: 'Comments',
    description: 'Displays TikTok comments as a single headline metric.',
    platforms: ['tiktok'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'TikTok',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  // ── Five-metric KPI strip per the new TikTok report design
  // (Figma 2117:67139).  Profile Views + Video Views already exist
  // above; these three round out the strip and supersede the older
  // standalone Likes / Comments cards in the canonical preset
  // (the legacy cards are retained so existing saved reports keep
  // rendering, but the TikTok-only template no longer seeds them).
  {
    id: 'tiktok-followers',
    name: 'Followers',
    description: 'Total TikTok followers for the connected profile, as a single headline metric.',
    platforms: ['tiktok'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'TikTok',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'tiktok-interactions',
    name: 'Interactions',
    description: 'Combined TikTok likes, comments, and shares as a single headline interactions metric.',
    platforms: ['tiktok'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'TikTok',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  {
    id: 'tiktok-net-followers',
    name: 'Net followers',
    description: 'Net follower delta over the selected period (gained minus lost) on TikTok.',
    platforms: ['tiktok'],
    supportedChartTypes: ['metric'],
    defaultChartType: 'metric',
    category: 'TikTok',
    icon: '👥',
    defaultW: 1,
    defaultH: 6,
  },
  // ── TikTok — new modules ────────────────────────────────────────────────
  // Time-series + ranked-day + bubble-grid concepts. Scoped to TikTok
  // for now; promotion to cross-network is just an edit to `platforms`
  // once equivalent FB/IG metrics are wired in.
  {
    id: 'tiktok-video-views-by-day',
    name: 'Video views by day',
    description: 'Daily video-view totals plotted over the report period.',
    platforms: ['tiktok'],
    supportedChartTypes: ['line', 'area', 'bar'],
    defaultChartType: 'area',
    category: 'TikTok',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'tiktok-interactions-by-day',
    name: 'Interactions by day',
    description: 'Daily likes, comments, and shares plotted over the report period.',
    platforms: ['tiktok'],
    // All three variants are bespoke and live in
    // `InteractionsByDayModule.tsx`:
    //   • bar  → stacked weekday breakdown (Figma 1290:101559)
    //   • line → 3 lines over the 28-day window
    //   • area → 3 translucent overlapping bands over the same window
    // Default stays on `bar` so the catalog presents the Figma design
    // first; the line + area variants share `TIME_SERIES_DATA` defined
    // alongside the components.
    supportedChartTypes: ['line', 'area', 'bar'],
    defaultChartType: 'bar',
    category: 'TikTok',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'tiktok-best-performing-day',
    name: 'Best performing day',
    description: 'Single-period summary of the highest-reaching day.',
    platforms: ['tiktok'],
    supportedChartTypes: ['list'],
    defaultChartType: 'list',
    category: 'TikTok',
    icon: '👥',
    defaultW: 2,
    // Figma 1339:217275 measures 583 × 305 px — same shape as
    // best-engaging-day (1291:123415): a 4-row summary card, NOT the
    // ranked-weekday list. h=12 (= 296 px grid-snapped) fits four rows
    // + the networks footer flush with no trailing empty space.
    defaultH: 12,
  },
  {
    id: 'tiktok-best-engaging-day',
    name: 'Best engaging day',
    description: 'Ranks the days of the week by average engagement rate.',
    platforms: ['tiktok'],
    supportedChartTypes: ['list'],
    defaultChartType: 'list',
    category: 'TikTok',
    icon: '👥',
    defaultW: 2,
    // Figma 1291:123415 measures 583 × 305 px — a single 4-row summary
    // card, much shorter than the standard list/chart modules. h=12
    // (= 12 × 10 + 11 × 16 = 296 px) is the closest grid-snapped height
    // and lands a flush fit with the row stack + networks footer. Using
    // h=24 (the default for ranked-list modules) leaves ~300 px of empty
    // space below the last row.
    defaultH: 12,
  },
  {
    id: 'tiktok-publishing-behaviour',
    name: 'Publishing behaviour',
    description: 'When you post, plotted as a weekday × hour bubble grid.',
    platforms: ['tiktok'],
    supportedChartTypes: ['bubble'],
    defaultChartType: 'bubble',
    category: 'TikTok',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'tiktok-followers-online',
    name: 'Followers online',
    description: 'When your followers are most active, by weekday and hour.',
    platforms: ['tiktok'],
    supportedChartTypes: ['bubble'],
    defaultChartType: 'bubble',
    category: 'TikTok',
    icon: '👥',
    defaultW: 2,
    defaultH: 18,
  },
  // Stubs for the new TikTok modules from the canonical layout list.
  // Each one ships with a minimal list payload (see MOCK_LIST_DATA
  // below) so the canvas slot renders something visible until the
  // per-module design lands.  Refining each one happens module-by-
  // module in subsequent passes.
  {
    id: 'tiktok-best-performing-day-summary',
    name: 'Best performing day summary',
    description: 'Top-N performing days within the selected window, ranked by total views.',
    platforms: ['tiktok'],
    supportedChartTypes: ['list'],
    defaultChartType: 'list',
    category: 'TikTok',
    icon: '🏆',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'tiktok-followers-online-summary',
    name: 'Followers online summary',
    description: 'Hours / days where the most followers are active, summarized as a ranked list.',
    platforms: ['tiktok'],
    supportedChartTypes: ['list'],
    defaultChartType: 'list',
    category: 'TikTok',
    icon: '🕒',
    defaultW: 2,
    defaultH: 18,
  },
  {
    id: 'tiktok-video-engagement',
    name: 'Video engagement',
    description: 'Top videos ranked by total engagement (likes + comments + shares).',
    platforms: ['tiktok'],
    supportedChartTypes: ['list'],
    defaultChartType: 'list',
    category: 'TikTok',
    icon: '💬',
    defaultW: 4,
    // h:24 → 24 × 13 (CHART_H_FACTOR) = 312 NEW rows × 2 px
    // (ROW_HEIGHT) = 624 raw, minus the 78 px module chrome (20 px
    // padding top+bottom, 14 px title row, 24 px header gap)
    // = 546 px usable.  The card is a fixed 479 px tall and the
    // footer + 16 px gap eats ~52 px, leaving ~15 px of breathing
    // room at the bottom.
    defaultH: 24,
  },
  {
    id: 'tiktok-video-watch-metrics',
    name: 'Video watch metrics',
    description: 'Top videos ranked by watch metrics (total watch time, average view duration, completion rate).',
    platforms: ['tiktok'],
    supportedChartTypes: ['list'],
    defaultChartType: 'list',
    category: 'TikTok',
    icon: '⏱️',
    defaultW: 4,
    defaultH: 24,
  },
  {
    id: 'tiktok-video-sources',
    name: 'Video sources',
    description: 'Where your video views came from (For You, Following, Profile, etc.), ranked.',
    platforms: ['tiktok'],
    supportedChartTypes: ['list'],
    defaultChartType: 'list',
    category: 'TikTok',
    icon: '🔀',
    defaultW: 4,
    defaultH: 24,
  },
];

// Generate time series data
function generateTimeSeries(days: number, base: number, variance: number): MockDataPoint[] {
  const data: MockDataPoint[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const trend = (days - i) / days;
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.round(base + trend * base * 0.3 + (Math.random() - 0.5) * variance),
      value2: Math.round((base * 0.4) + trend * base * 0.1 + (Math.random() - 0.5) * variance * 0.5),
    });
  }
  return data;
}

// Chart time-series data. Keyed by module id for modules that can render
// as line/area/bar. Missing keys fall through to `audience-growth` in
// `ModuleCard.getModuleContent`.
export const MOCK_CHART_DATA: Record<string, MockDataPoint[]> = {
  'audience-growth': generateTimeSeries(28, 45200, 800),
  'facebook-page-insights': generateTimeSeries(28, 89000, 12000),
  // Hand-picked anchor sequence per Figma 2205:52108 (TikTok comp).
  // Real day-to-day variance is the point — `generateTimeSeries`
  // produced smooth random noise that linear vs monotone couldn't
  // visually distinguish, so the comp's sharp Mar 12 / Mar 14 peaks
  // and the Mar 19–21 dip are encoded literally below.  29 values
  // cover Mar 4 – Apr 1; the calendar dates are stamped relative to
  // a fixed start so the x-axis labels match the design exactly.
  'tiktok-video-views-by-day': (() => {
    const VIEWS_ANCHORS = [
       60,  50,  55,  90, 120,  70, 120,  30,
      460, 110, 490, 420, 400, 395, 380, 270,
      245, 260, 365, 420, 420, 480, 570, 480,
      480, 605, 545, 545, 705,
    ];
    const start = new Date(2026, 2, 4); // Mar 4, 2026
    return VIEWS_ANCHORS.map((value, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value,
      };
    });
  })(),
  // Note: `tiktok-interactions-by-day` is intentionally absent — all
  // three of its variants (bar / line / area) are bespoke and live in
  // `InteractionsByDayModule.tsx`. The bar variant reads
  // `MOCK_INTERACTIONS_BY_DAY` (weekday breakdown); line + area share
  // their own 28-day `TIME_SERIES_DATA` inside that file.
};

// Daily engagement breakdown for `tiktok-interactions-by-day`.
// Numbers + dates match Figma 2219:39079: 11 columns on the visible
// tick positions (Mar 4 / 8 / 12 / 16 / 20 / 22 / 24 / 26 / 28 / 30
// / Apr 1).  Stack order bottom → top is Shares → Comments → Likes
// (matches the SERIES array in InteractionsByDayModule.tsx).  Totals
// per column read straight off the comp: 600, 1100, 215, 655, 890,
// 780, 570, 820, 720, 970, 930.
export const MOCK_INTERACTIONS_BY_DAY = [
  { date: 'Mar 4',  shares: 420, comments: 100, likes:  80 },
  { date: 'Mar 8',  shares: 320, comments: 400, likes: 380 },
  { date: 'Mar 12', shares: 150, comments:  50, likes:  15 },
  { date: 'Mar 16', shares: 340, comments: 120, likes: 195 },
  { date: 'Mar 20', shares: 620, comments: 160, likes: 110 },
  { date: 'Mar 22', shares: 490, comments: 190, likes: 100 },
  { date: 'Mar 24', shares: 400, comments: 100, likes:  70 },
  { date: 'Mar 26', shares: 580, comments: 140, likes: 100 },
  { date: 'Mar 28', shares: 510, comments: 120, likes:  90 },
  { date: 'Mar 30', shares: 680, comments: 170, likes: 120 },
  { date: 'Apr 1',  shares: 655, comments: 160, likes: 115 },
];

// Single-day summary rows for the SummaryCardModule consumers
// (best-engaging-day → 1291:123415, best-performing-day → 1339:217275).
// Pre-formatted as strings since the renderer is a flat label/value
// table — keeping the formatting in the data layer makes localization
// a future drop-in instead of a render-time refactor.
//
// Both modules ship the same `Date / … / Previous period / Growth`
// triplet; only the middle row's label/value differ:
//   • best-engaging-day  → "Total engagement" / 800
//   • best-performing-day → "Total views"     / 134
// Values per Figma 2208:52384 (best-performing) and 2219:39350
// (best-engaging).  The Growth row carries a `trend` flag so the
// SummaryCardModule renders the colored circle + arrow chip on that
// row only.  Cast to `const` so the `'up' | 'down'` literal types
// survive into `SummaryRow[]` consumers without widening to `string`.
export const MOCK_BEST_ENGAGING_DAY_ROWS = [
  { label: 'Date',             value: 'Monday 25 May 2026' },
  // Math-consistent: 20 − 180 = −160; −160 / 180 = −88.89%.  Preserves
  // the Figma headline (Total = 20, change = −88.89%) by adjusting the
  // Previous-period anchor up from 18 → 180 so the row arithmetic
  // actually computes.
  { label: 'Total engagement', value: '20' },
  { label: 'Previous period',  value: '180' },
  { label: 'Growth',           value: '-160 (-88.89%)', trend: 'down' as const },
];

export const MOCK_BEST_PERFORMING_DAY_ROWS = [
  { label: 'Date',            value: 'Monday 25 May 2026' },
  { label: 'Total engagement', value: '731' },
  { label: 'Previous period', value: '221' },
  { label: 'Growth',          value: '+510 (+230%)', trend: 'up' as const },
];

// Metric-card headline data. Each entry is an array of headline metrics —
// the MetricCard component renders one row per entry. Single-metric
// modules (the vast majority) have a one-element array; a module like
// "Audience Summary" (legacy) had four rows.
export const MOCK_METRICS: Record<string, MetricData[]> = {
  // ── Cross-network metric modules ──
  'followers':        [{ label: 'Followers',             value: '45.2K', change: 5.4,   changeAbsolute: '+2.3K',  changeLabel: 'vs last period' }],
  'reach':            [{ label: 'Reach',                 value: '89K',   change: 3.8,   changeAbsolute: '+3.3K',  changeLabel: 'vs last period' }],
  'impressions':      [{ label: 'Impressions',           value: '210K',  change: 7.2,   changeAbsolute: '+14K',   changeLabel: 'vs last period' }],
  'engagement-rate':  [{ label: 'Engagement Rate',       value: '8.4%',  change: -1.2,  changeAbsolute: '-0.1%',  changeLabel: 'vs last period' }],
  // ── Facebook ──
  'facebook-page-likes':   [{ label: 'Page Likes',           value: '12.4K', change: 2.1,  changeAbsolute: '+256',  changeLabel: 'vs last period' }],
  'facebook-reach':        [{ label: 'Facebook Reach',       value: '31K',   change: 4.7,  changeAbsolute: '+1.4K', changeLabel: 'vs last period' }],
  'facebook-impressions':  [{ label: 'Facebook Impressions', value: '72K',   change: 6.3,  changeAbsolute: '+4.3K', changeLabel: 'vs last period' }],
  'facebook-engagement':   [{ label: 'Facebook Engagement',  value: '9.1%',  change: 0.8,  changeAbsolute: '+0.1%', changeLabel: 'vs last period' }],
  // ── Instagram ──
  'instagram-followers':        [{ label: 'Instagram Followers',   value: '28.6K', change: 8.2,  changeAbsolute: '+2.2K', changeLabel: 'vs last period' }],
  'instagram-reach':            [{ label: 'Instagram Reach',       value: '54K',   change: 5.1,  changeAbsolute: '+2.6K', changeLabel: 'vs last period' }],
  'instagram-impressions':      [{ label: 'Instagram Impressions', value: '121K',  change: 9.4,  changeAbsolute: '+10K',  changeLabel: 'vs last period' }],
  'instagram-profile-visits':   [{ label: 'Profile Visits',        value: '3.4K',  change: 11.2, changeAbsolute: '+342',  changeLabel: 'vs last period' }],
  // ── TikTok ──
  // The cross-network `followers` metric covers TikTok as well; no
  // standalone `tiktok-followers` is needed.
  'tiktok-video-views':    [{ label: 'Video Views',   value: '732',  change: 19.22, changeAbsolute: '+118',  changeLabel: 'vs last period' }],
  'tiktok-profile-views':  [{ label: 'Profile Views', value: '12',   change: -2,    changeAbsolute: '-80',   changeLabel: 'vs last period' }],
  'tiktok-likes':          [{ label: 'Likes',         value: '98.4K',change: 12.3,  changeAbsolute: '+9.8K', changeLabel: 'vs last period' }],
  'tiktok-comments':       [{ label: 'Comments',      value: '3.2K', change: 4.5,   changeAbsolute: '+138',  changeLabel: 'vs last period' }],
  // Three new TikTok-strip metrics (Figma 2117:67230 / 2117:67203 /
  // 2201:51505).  Values mirror the design comps; the +1600 % deltas
  // on followers / interactions stress-test the comparison-row
  // formatter against four-digit percent changes (which the existing
  // metric data didn't exercise).
  'tiktok-followers':      [{ label: 'Followers',     value: '1.1k', change: 1600,  changeAbsolute: '+32',   changeLabel: 'vs last period' }],
  'tiktok-interactions':   [{ label: 'Interactions',  value: '34',   change: 1600,  changeAbsolute: '+32',   changeLabel: 'vs last period' }],
  'tiktok-net-followers':  [{ label: 'Net followers', value: '1090', change: 19.22, changeAbsolute: '+118',  changeLabel: 'vs last period' }],
};

export const MOCK_TABLE_DATA: TableRow[] = [
  { date: 'Apr 1', views: 125430, likes: 8923, comments: 1204, shares: 892, engRate: '7.8%' },
  { date: 'Apr 2', views: 98200, likes: 6741, comments: 934, shares: 621, engRate: '8.2%' },
  { date: 'Apr 3', views: 187600, likes: 14320, comments: 2103, shares: 1542, engRate: '9.5%' },
  { date: 'Apr 4', views: 143200, likes: 10102, comments: 1456, shares: 1023, engRate: '8.8%' },
  { date: 'Apr 5', views: 210400, likes: 18923, comments: 2891, shares: 2103, engRate: '10.7%' },
  { date: 'Apr 6', views: 76300, likes: 5201, comments: 723, shares: 412, engRate: '6.9%' },
  { date: 'Apr 7', views: 165800, likes: 12430, comments: 1782, shares: 1231, engRate: '9.1%' },
];

export const MOCK_TABLE_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'engRate', label: 'Eng. Rate' },
];

// Default list payload — used by `top-posts` and as the fallback for
// any list-type module whose definitionId isn't in `MOCK_LIST_DATA`.
export const MOCK_LIST_ITEMS: ListItem[] = [
  {
    id: '1',
    title: 'Get ready with me morning routine ☀️',
    subtitle: 'Apr 12, 2026 · 0:45',
    metrics: [
      { label: 'Views', value: '842K' },
      { label: 'Likes', value: '98.2K' },
      { label: 'Comments', value: '3.4K' },
      { label: 'Shares', value: '12.1K' },
    ],
  },
  {
    id: '2',
    title: 'Trying viral TikTok recipes 🍳',
    subtitle: 'Apr 9, 2026 · 1:02',
    metrics: [
      { label: 'Views', value: '621K' },
      { label: 'Likes', value: '72.4K' },
      { label: 'Comments', value: '2.1K' },
      { label: 'Shares', value: '8.9K' },
    ],
  },
  {
    id: '3',
    title: 'Day in my life as a content creator',
    subtitle: 'Apr 7, 2026 · 2:15',
    metrics: [
      { label: 'Views', value: '513K' },
      { label: 'Likes', value: '58.1K' },
      { label: 'Comments', value: '1.8K' },
      { label: 'Shares', value: '6.3K' },
    ],
  },
  {
    id: '4',
    title: 'Outfit ideas for spring 🌸',
    subtitle: 'Apr 5, 2026 · 0:30',
    metrics: [
      { label: 'Views', value: '398K' },
      { label: 'Likes', value: '45.2K' },
      { label: 'Comments', value: '1.2K' },
      { label: 'Shares', value: '5.1K' },
    ],
  },
  {
    id: '5',
    title: 'Productivity tips that actually work 💪',
    subtitle: 'Apr 3, 2026 · 1:30',
    metrics: [
      { label: 'Views', value: '287K' },
      { label: 'Likes', value: '31.4K' },
      { label: 'Comments', value: '987' },
      { label: 'Shares', value: '4.2K' },
    ],
  },
];

// Keyed lookup so different list-type modules can render their own
// payload. Falls back to MOCK_LIST_ITEMS (top-posts) for unknown ids.
// `tiktok-best-engaging-day` and `tiktok-best-performing-day` are
// intentionally NOT in this map — both render the bespoke
// `SummaryCardModule` (4 label/value rows, Figma 1291:123415 +
// 1339:217275) instead of the ranked list shape, and consume their
// own `MOCK_*_ROWS` arrays wired in directly from ModuleCard.
// Stub list payloads for the new TikTok modules.  Each one is a
// minimal `{title, subtitle, metrics}` ranked list so the canvas
// slot renders something legible until the per-module design lands.
// All five share the same `top-videos` posts list as a base since
// they all rank videos by some metric; only the `metrics` column
// set differs per module to demonstrate what each surface
// emphasises.
const STUB_VIDEO_RANK_BASE = MOCK_LIST_ITEMS;

export const MOCK_LIST_DATA: Record<string, ListItem[]> = {
  'top-posts': MOCK_LIST_ITEMS,
  // `tiktok-top-videos` row intentionally absent — see the catalog note
  // alongside the (also-removed) module definition above.

  // ── New TikTok modules ───────────────────────────────────────
  'tiktok-best-performing-day-summary': [
    { id: 'bpds-1', title: 'Monday 25 May 2026',  metrics: [{ label: 'Total views', value: '731' }, { label: 'Growth', value: '+510 (+230%)' }] },
    { id: 'bpds-2', title: 'Friday 22 May 2026',  metrics: [{ label: 'Total views', value: '604' }, { label: 'Growth', value: '+78 (+15%)' }] },
    { id: 'bpds-3', title: 'Sunday 17 May 2026',  metrics: [{ label: 'Total views', value: '512' }, { label: 'Growth', value: '+24 (+5%)' }] },
    { id: 'bpds-4', title: 'Wednesday 13 May 2026', metrics: [{ label: 'Total views', value: '488' }, { label: 'Growth', value: '+12 (+2.5%)' }] },
    { id: 'bpds-5', title: 'Tuesday 5 May 2026',  metrics: [{ label: 'Total views', value: '410' }, { label: 'Growth', value: '−18 (−4.2%)' }] },
  ],
  'tiktok-followers-online-summary': [
    { id: 'fos-1', title: 'Wednesday · 12 PM – 2 PM',  metrics: [{ label: 'Followers online', value: '16.2k' }] },
    { id: 'fos-2', title: 'Friday · 1 PM – 3 PM',      metrics: [{ label: 'Followers online', value: '14.8k' }] },
    { id: 'fos-3', title: 'Monday · 12 PM – 2 PM',     metrics: [{ label: 'Followers online', value: '13.5k' }] },
    { id: 'fos-4', title: 'Tuesday · 1 PM – 3 PM',     metrics: [{ label: 'Followers online', value: '12.9k' }] },
    { id: 'fos-5', title: 'Thursday · 12 PM – 2 PM',   metrics: [{ label: 'Followers online', value: '12.4k' }] },
  ],
  'tiktok-video-engagement':    STUB_VIDEO_RANK_BASE,
  'tiktok-video-watch-metrics': STUB_VIDEO_RANK_BASE.map((it) => ({
    ...it,
    metrics: [
      { label: 'Watch time', value: it.metrics[0]?.value ?? '' },
      { label: 'Avg duration', value: '0:38' },
      { label: 'Completion', value: '64%' },
    ],
  })),
  'tiktok-video-sources': STUB_VIDEO_RANK_BASE.map((it) => ({
    ...it,
    metrics: [
      { label: 'For You', value: '78%' },
      { label: 'Following', value: '12%' },
      { label: 'Profile', value: '10%' },
    ],
  })),
};

// ─── Video-card carousels ──────────────────────────────────────────────────
//
// Hand-authored data for the `tiktok-video-engagement` carousel
// (Figma 2222:40922).  Each card is a self-contained post snapshot
// (profile chip, caption, thumbnail, 4-row metric table).  Cards are
// authored with **distinct gradient thumbnails** so the strip reads
// visually as different videos without us shipping an image-per-card
// binary into the repo.
//
// Profile data here is decoupled from the user's connected-profile
// catalogue (`PROFILE_GROUPS` in `lib/profile-data.ts`) — these are
// per-post handles, not selected profiles, and the post may come from
// any TikTok handle in the user's network.  Sibling carousels
// (`tiktok-video-watch-metrics`, `tiktok-video-sources`) will ship
// their own payloads with module-specific metric columns.
// Picsum.photos delivers stable random JPEGs given a seed — same
// seed always resolves to the same image, so the deck doesn't
// reshuffle on reload.  The seeds below are hand-picked words that
// happen to retrieve photos that read plausibly as "creator content"
// (fashion / lifestyle / portrait crops) at the 140 × 249 portrait
// inset we render them into.  Bumped to 2× (280 × 498) for retina.
const VIDEO_PREVIEW_IMAGE = (seed: string) =>
  `https://picsum.photos/seed/${seed}/280/498`;

export const MOCK_VIDEO_ENGAGEMENT_CARDS: VideoCardData[] = [
  {
    id: 've-1',
    date: '23 Sep 2024 - 10.34 AM',
    profile: { name: 'Tenceclothier', handle: '@tenceclothier_ng', monogram: 'T' },
    caption: '🌍✨ Navigating the Wild World of Social Media! ✨📱 From viral trends to influencer hacks, join me as I explore how social media shapes our lives! 🎉📈',
    thumbnail: 'linear-gradient(135deg, #FFC4D8 0%, #B8C4F9 55%, #9F8DF0 100%)',
    image: VIDEO_PREVIEW_IMAGE('tence-rw-01'),
    metrics: [
      { label: 'Views',    value: '204' },
      { label: 'Likes',    value: '134' },
      { label: 'Comments', value: '126' },
      { label: 'Shares',   value: '28' },
    ],
  },
  {
    id: 've-2',
    date: '21 Sep 2024 - 4.12 PM',
    profile: { name: 'Tenceclothier', handle: '@tenceclothier_gh', monogram: 'T' },
    caption: 'Behind the scenes of our newest spring drop 🌸 Watch how the campaign came together from sketch to storefront.',
    thumbnail: 'linear-gradient(135deg, #FEE5B6 0%, #FFB48A 55%, #F77B6E 100%)',
    image: VIDEO_PREVIEW_IMAGE('tence-gh-02'),
    metrics: [
      { label: 'Views',    value: '192' },
      { label: 'Likes',    value: '128' },
      { label: 'Comments', value: '118' },
      { label: 'Shares',   value: '24' },
    ],
  },
  {
    id: 've-3',
    date: '18 Sep 2024 - 9.45 AM',
    profile: { name: 'Tenceclothier', handle: '@tenceclothier_ke', monogram: 'T' },
    caption: 'A quick GRWM with our signature linen tee 🌿 Comfy, breathable, and slept-in soft from day one.',
    thumbnail: 'linear-gradient(135deg, #C7F0E1 0%, #95CAEA 55%, #5C8FE0 100%)',
    image: VIDEO_PREVIEW_IMAGE('tence-ke-03'),
    metrics: [
      { label: 'Views',    value: '186' },
      { label: 'Likes',    value: '121' },
      { label: 'Comments', value: '109' },
      { label: 'Shares',   value: '22' },
    ],
  },
  {
    id: 've-4',
    date: '15 Sep 2024 - 6.50 PM',
    profile: { name: 'Tenceclothier', handle: '@tenceclothier_rw', monogram: 'T' },
    caption: 'How three friends styled the same jacket three different ways 🧥 Comment which look you’d wear out tonight!',
    thumbnail: 'linear-gradient(135deg, #E0CDF8 0%, #B5A8F0 55%, #8E78EA 100%)',
    image: VIDEO_PREVIEW_IMAGE('tence-rw-04'),
    metrics: [
      { label: 'Views',    value: '178' },
      { label: 'Likes',    value: '114' },
      { label: 'Comments', value: '101' },
      { label: 'Shares',   value: '19' },
    ],
  },
  {
    id: 've-5',
    date: '12 Sep 2024 - 11.05 AM',
    profile: { name: 'Tenceclothier', handle: '@tenceclothier_tz', monogram: 'T' },
    caption: 'Studio tour with @tenceclothier_tz — patternmaking, dyeing, and the cutting table that started it all ✂️',
    thumbnail: 'linear-gradient(135deg, #F5E8D2 0%, #E0B57A 55%, #B07E3D 100%)',
    image: VIDEO_PREVIEW_IMAGE('tence-tz-05'),
    metrics: [
      { label: 'Views',    value: '165' },
      { label: 'Likes',    value: '108' },
      { label: 'Comments', value: '94'  },
      { label: 'Shares',   value: '17' },
    ],
  },
  {
    id: 've-6',
    date: '09 Sep 2024 - 7.30 AM',
    profile: { name: 'Tenceclothier', handle: '@tenceclothier_ug', monogram: 'T' },
    caption: 'Trying every customer-tagged outfit from this week — which one is the winner? Watch til the end 👀',
    thumbnail: 'linear-gradient(135deg, #D2F0E2 0%, #92D3A5 55%, #4FA877 100%)',
    image: VIDEO_PREVIEW_IMAGE('tence-ug-06'),
    metrics: [
      { label: 'Views',    value: '152' },
      { label: 'Likes',    value: '97'  },
      { label: 'Comments', value: '86'  },
      { label: 'Shares',   value: '14' },
    ],
  },
  {
    id: 've-7',
    date: '06 Sep 2024 - 2.18 PM',
    profile: { name: 'Tenceclothier', handle: '@tenceclothier_ng', monogram: 'T' },
    caption: 'Capsule wardrobe challenge — five pieces, seven days, zero repeats. Day-by-day breakdown 👇',
    thumbnail: 'linear-gradient(135deg, #FFD5E0 0%, #FF98B6 55%, #E15E8C 100%)',
    image: VIDEO_PREVIEW_IMAGE('tence-ng-07'),
    metrics: [
      { label: 'Views',    value: '141' },
      { label: 'Likes',    value: '89'  },
      { label: 'Comments', value: '78'  },
      { label: 'Shares',   value: '12' },
    ],
  },
  {
    id: 've-8',
    date: '03 Sep 2024 - 8.42 AM',
    profile: { name: 'Tenceclothier', handle: '@tenceclothier_gh', monogram: 'T' },
    caption: 'Backstage at the Accra pop-up — first 50 customers, sold-out racks, and one happy team 🛍️',
    thumbnail: 'linear-gradient(135deg, #C7E2F8 0%, #7AB1E6 55%, #3D7FCC 100%)',
    image: VIDEO_PREVIEW_IMAGE('tence-gh-08'),
    metrics: [
      { label: 'Views',    value: '128' },
      { label: 'Likes',    value: '78'  },
      { label: 'Comments', value: '67'  },
      { label: 'Shares',   value: '10' },
    ],
  },
];

// Pie / donut data. Platform-specific audience modules
// (instagram-audience, tiktok-audience) render an age-bucket breakdown;
// cross-network audience-by-gender has its own 3-wedge key.
// `audience-demographics` is retained as the fallback bucket for legacy
// references / unknown definitionIds.
export const MOCK_PIE_DATA = {
  'audience-demographics': [
    { name: '13-17', value: 8, color: '#818CF8' },
    { name: '18-24', value: 34, color: '#6366F1' },
    { name: '25-34', value: 28, color: '#4F46E5' },
    { name: '35-44', value: 18, color: '#4338CA' },
    { name: '45-54', value: 8, color: '#3730A3' },
    { name: '55+', value: 4, color: '#312E81' },
  ],
  // Green / blue / orange palette shared with Audience Growth
  // (`SERIES` in `AudienceGrowthModule.tsx`) and the donut variant
  // (`AudienceByGenderModule.tsx`). Keeping the bar / pie data sources
  // in sync means flipping chart types doesn't change the slice→color
  // mapping a viewer sees.
  'audience-by-gender': [
    { name: 'Female',      value: 54, color: '#3FA40D' }, // green
    { name: 'Male',        value: 45, color: '#0570DE' }, // blue
    { name: 'Unspecified', value: 1,  color: '#ED6704' }, // orange
  ],
  'instagram-audience': [
    { name: '13-17', value: 5, color: '#818CF8' },
    { name: '18-24', value: 38, color: '#6366F1' },
    { name: '25-34', value: 31, color: '#4F46E5' },
    { name: '35-44', value: 16, color: '#4338CA' },
    { name: '45-54', value: 7, color: '#3730A3' },
    { name: '55+', value: 3, color: '#312E81' },
  ],
  'tiktok-audience': [
    { name: '13-17', value: 12, color: '#818CF8' },
    { name: '18-24', value: 42, color: '#6366F1' },
    { name: '25-34', value: 26, color: '#4F46E5' },
    { name: '35-44', value: 12, color: '#4338CA' },
    { name: '45-54', value: 5, color: '#3730A3' },
    { name: '55+', value: 3, color: '#312E81' },
  ],
  // Top-10 countries — used by Audience by country when the user
  // switches the module to pie or bar. Mirrors the country/percentage
  // pairs the list rendering uses in `AudienceByCountryModule`, so all
  // three chart types tell the same story; only the visualization
  // changes. Colors come from Figma 1310:191707 — a 10-step blue ramp
  // running from deepest navy (rank 1) to palest mint (rank 10), so the
  // visual weight always matches the rank ordering.
  'audience-by-country': [
    { name: 'United States',  value: 25,  color: '#003262' },
    { name: 'United Kingdom', value: 20,  color: '#04438C' },
    { name: 'India',          value: 15,  color: '#0055BC' },
    { name: 'Brazil',         value: 10,  color: '#0570DE' },
    { name: 'Germany',        value: 8,   color: '#0096EB' },
    { name: 'Italy',          value: 7,   color: '#06B9EF' },
    { name: 'France',         value: 5,   color: '#75D5E8' },
    { name: 'Canada',         value: 4,   color: '#A2E5EF' },
    { name: 'Japan',          value: 2.9, color: '#CFF5F6' },
    { name: 'Australia',      value: 0.1, color: '#DDFFFE' },
  ],
};

// ─── Bubble-chart payloads ─────────────────────────────────────────────────
//
// Weekday × hour grids. `day` is 0 (Sunday) … 6 (Saturday); `hour` is
// 0–23. Only "active" cells are emitted — empty cells aren't rendered.
// `value` drives bubble radius via Recharts' ZAxis range.
//
// `publishing-behaviour` mirrors when the creator posts; `followers-online`
// mirrors when the audience is active. The two grids have visibly
// different shapes on purpose:
//
//   • Publishing Behaviour — discrete posting **events**. A creator
//     posts a finite number of times per week, so we sample those
//     events from a distribution centered on the supplied peak day /
//     peak hour and aggregate counts per (day, hour) cell. This gives
//     the sparse, scattered look the Figma comp shows (1302:170169) —
//     a handful of bubbles per day, clustered around the user's
//     posting habits, instead of a continuous strip from morning to
//     evening.
//
//   • Followers Online — continuous audience presence. Every hour has
//     *some* number of followers online, so we keep the original
//     decay-from-peak model that emits a value for nearly every cell.
//
// Two generators, two data shapes — same `BubblePoint` output type so
// the renderer doesn't care which it's plotting.

// xorshift32 PRNG — deterministic pseudo-random so the mock data is
// stable across reloads. Fine for visual mocks.
function makeRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000) / 1000; };
}

// Cell-based generator for Followers Online. Emits all 7×24 cells so
// the heatmap renders a full continuous surface — every (day, hour)
// gets a value, no visibility floor.
//
// `HOUR_INTENSITY` is hand-tuned to match the Figma comp's per-hour
// bubble shape (1326:217061): a sharp daytime peak at 1 PM, a smaller
// late-night bump at 1 AM, and a tiny baseline ~0.025 across the rest
// of the day so faint dots still render in the off-hours. The base
// peak value is 16k, calibrated against the legend's 0 → 16k axis.
const FOLLOWERS_PEAK_VALUE = 16000;
const FOLLOWERS_HOUR_INTENSITY: Record<number, number> = {
  0:  0.10,  // 12 AM — small visible dot (rolling into the wrap spike)
  1:  0.30,  // 1 AM  — late-night spike, biggest of the off-peak hours
  2:  0.10,  // 2 AM  — tail of wrap spike
  3:  0.04,  // 3 AM
  4:  0.025, // 4 AM
  5:  0.025,
  6:  0.025,
  7:  0.025,
  8:  0.025,
  9:  0.025,
  10: 0.10,  // 10 AM — onset of daytime peak
  11: 0.30,  // 11 AM — medium pink
  12: 0.62,  // 12 PM — large pink
  13: 1.00,  // 1 PM  — peak (deepest wine)
  14: 0.62,  // 2 PM
  15: 0.30,  // 3 PM
  16: 0.06,  // 4 PM  — peak shoulder
  17: 0.025, // 5 PM
  18: 0.025,
  19: 0.025,
  20: 0.025,
  21: 0.025,
  22: 0.025,
  23: 0.025,
};

function genFollowersOnline(
  seed: number,
  dayBoosts: number[],
): BubblePoint[] {
  const rand = makeRand(seed);
  const out: BubblePoint[] = [];
  for (let d = 0; d < 7; d++) {
    const dayBoost = dayBoosts[d] ?? 1;
    for (let h = 0; h < 24; h++) {
      let intensity = FOLLOWERS_HOUR_INTENSITY[h] ?? 0.025;
      // Monday damps the late-night spike — people sleep earlier on
      // Sunday night than Saturday night, so Mon's 12 AM / 1 AM / 2 AM
      // bubbles read smaller in the comp.
      if (d === 1 && h <= 2) {
        intensity *= 0.4;
      }
      // Small per-cell jitter so the grid doesn't look mechanically
      // identical row-to-row at the same hour.
      const noise = 0.95 + rand() * 0.10;
      const v = Math.round(FOLLOWERS_PEAK_VALUE * intensity * dayBoost * noise);
      out.push({ day: d, hour: h, value: Math.max(v, 0) });
    }
  }
  return out;
}

export const MOCK_BUBBLE_DATA: Record<string, BubblePoint[]> = {
  // Hand-curated to match the Figma comp (1302:170169) position-for-
  // position. The renderer's `bandFor()` splits the value range into
  // equal thirds against the module's max value, so picking literal
  // band sentinels (low=2, mid=5, high=10 with max=10) lands every
  // bubble in its intended band: 2/10 = 0.20 → low, 5/10 = 0.50 → mid,
  // 10/10 = 1.00 → high. Read each row as a single day's vertical
  // strip — `[hour, band]` pairs ordered bottom-up so the file mirrors
  // how the chart reads visually (1 AM at the bottom of the column).
  'tiktok-publishing-behaviour': (() => {
    const HIGH = 10, MID = 5, LOW = 2;
    type Pt = { day: number; hour: number; value: number };
    const pts: Pt[] = [];
    const add = (day: number, hour: number, v: number) =>
      pts.push({ day, hour, value: v });

    // Mon (day=1) — sparse anchor day per user spec: 3 AM low,
    // 8 AM high, 10 PM high.
    add(1, 3,  LOW);
    add(1, 8,  HIGH);
    add(1, 22, HIGH);

    // Tue (day=2) — heaviest mid-day cluster in the comp; biggest
    // bubble of the whole grid sits at noon.
    add(2, 6,  LOW);
    add(2, 8,  HIGH);
    add(2, 12, HIGH);
    add(2, 15, MID);
    add(2, 17, MID);
    add(2, 21, MID);

    // Wed (day=3) — early-morning High cluster + scattered mids.
    add(3, 4,  HIGH);
    add(3, 5,  HIGH);
    add(3, 7,  MID);
    add(3, 9,  MID);
    add(3, 12, HIGH);
    add(3, 14, LOW);
    add(3, 16, MID);
    add(3, 17, HIGH);

    // Thu (day=4) — almost all High, mid-morning through evening.
    add(4, 7,  LOW);
    add(4, 9,  HIGH);
    add(4, 10, HIGH);
    add(4, 15, HIGH);
    add(4, 21, HIGH);

    // Fri (day=5) — late-night peak (high at midnight wrap), morning
    // High, light afternoon.
    add(5, 5,  LOW);
    add(5, 6,  MID);
    add(5, 9,  HIGH);
    add(5, 18, LOW);
    add(5, 19, MID);
    add(5, 23, HIGH);

    // Sat (day=6) — busy lunch + late-night Mid, mostly mid-band.
    add(6, 3,  LOW);
    add(6, 5,  MID);
    add(6, 7,  HIGH);
    add(6, 8,  MID);
    add(6, 11, MID);
    add(6, 12, MID);
    add(6, 13, HIGH);
    add(6, 23, MID);

    // Sun (day=0) — early-morning Highs, light evening.
    add(0, 1,  HIGH);
    add(0, 3,  HIGH);
    add(0, 7,  MID);
    add(0, 9,  HIGH);
    add(0, 19, MID);
    add(0, 23, LOW);

    return pts;
  })(),
  // Heatmap calibrated to Figma 1326:217061. Peak value (16k) lands at
  // 1 PM and aligns with the legend's gradient top. `dayBoosts` scale
  // each day's whole row — Thu/Fri are the hottest days in the comp,
  // Sun the lightest, Mon slightly damped (also see the dampening for
  // its early-morning hours inside `genFollowersOnline`).
  'tiktok-followers-online': genFollowersOnline(
    0xBADF00D,
    // Sun,  Mon,  Tue,  Wed,  Thu,  Fri,  Sat
    [0.85, 0.92, 0.97, 0.97, 1.04, 1.02, 0.93],
  ),
};

export const CHART_COLORS = {
  primary: '#4D36FF',
  secondary: '#EC4899',
  tertiary: '#14B8A6',
  quaternary: '#F59E0B',
  muted: '#94A3B8',
  grid: '#F1F5F9',
  text: '#79787B',
};
