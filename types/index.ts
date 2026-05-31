// Platform — canonical keys for every network the app can target. Kept in
// kebab-case so they're usable both as object keys and as CSS-class-safe
// identifiers. Matches `ProfilePlatform` in `lib/profile-data.ts`, plus
// the two Figma-only filter tiles (x, bluesky) that don't yet have real
// profile data. Upstream catalog names like `FacebookPage` /
// `InstagramBusiness` / `TikTok` collapse onto these keys when the
// module catalog is imported.
export type Platform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'google-analytics'
  | 'x'
  | 'threads'
  | 'bluesky';

// Chart type — the visualization options a module can render in. No
// `donut` here: per the product spec donut is folded into `pie` (the
// Figma visual-type filter row in 1026:40316 shows 7 types, not 8).
// `bubble` is the weekday × hour heatmap-style scatter used by
// Publishing Behaviour and Followers Online.
//
// `text` is the carve-out for non-data canvas elements (Figma
// 1391:376822 et al.) — they share the layout machinery of a regular
// module so the grid can drag/drop/resize them, but they render via
// `TextElement` instead of `ModuleCard`. The canvas branches on
// `ReportModule.elementKind` to pick the renderer.
export type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'metric' | 'table' | 'list' | 'bubble' | 'text';

// Text-element style — drives both the visual presentation (font size,
// weight, list semantics) and the wrapping HTML element used to render
// the content. Mirrors the Figma 1391:383049 style-dropdown picker.
export type TextStyle = 'text' | 'heading-1' | 'heading-2' | 'bullet-list' | 'numbered-list';

export type LayoutCategory = '1-col' | '2-col' | '3-col' | '4-col';

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  supportedChartTypes: ChartType[];
  defaultChartType: ChartType;
  category: string;
  icon: string;
  defaultW: number;
  defaultH: number;
  /**
   * When `true`, the module's height is locked at `defaultH` — drops
   * and resizes set `minH === maxH === defaultH * CHART_H_FACTOR` so
   * the corner-grip drag only changes width, never height.  Used by
   * fixed-pixel-content modules like the video carousels where each
   * card is a constant 240 × 479 px and vertical resize would just
   * stretch invisible padding around the same content.
   */
  fixedHeight?: boolean;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  /**
   * Per-item override of which resize-handle edges/corners react-
   * grid-layout draws.  Defaults to `['se']` (bottom-right corner)
   * across the rest of the canvas; the three video carousels set
   * `['e']` so the user can only drag the right edge — the modules
   * have a fixed height, so a corner grip + visible ghost-cell
   * grid that LOOKS vertical-resizable is misleading.
   */
  resizeHandles?: ('s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne')[];
}

export interface ReportModule {
  id: string;
  definitionId: string;
  chartType: ChartType;
  layout: LayoutItem;
  title?: string;
  /**
   * Network binding for the module.
   *   • A specific `Platform` key (`'tiktok'`, `'facebook'`, …) means the
   *     module was dragged from that network's tab in the Add-module
   *     panel — it renders data for the matching profile(s) only, and
   *     shows the "Select a matching profile to see data" empty state
   *     when no selected profile lives on that network.
   *   • `'cross-network'` means the module was dragged from the "All" tab
   *     and aggregates across every profile whose platform is supported
   *     by the underlying `ModuleDefinition`.
   *
   * Omitted = legacy module (treat as cross-network for back-compat).
   */
  network?: Platform | 'cross-network';
  // ─── Element extensions ─────────────────────────────────────────────
  // When `elementKind` is set, this entry is a non-data canvas element
  // (text/heading/etc.) rather than a data-bound module. The canvas
  // branches at render time. `definitionId` is still set (to a synthetic
  // value like `'element:text'`) so the grid keeps a single map keyed
  // by id, but it isn't looked up in `MODULE_DEFINITIONS`.
  /**
   * Element discriminator.
   *   • `'text'`  — Text / Heading 1 / Heading 2 / Bullet list / Numbered
   *                 list, all rendered by `TextElement`, switched via
   *                 `textStyle` below.
   *   • `'emoji'` — standalone single-emoji decoration block, rendered by
   *                 `EmojiElement`. The picked character is stored on
   *                 `emoji` below; an empty string means "newly dropped,
   *                 picker should auto-open".
   *   • `'divider'` — horizontal-rule layout block, rendered by
   *                 `DividerElement`.  No data, no editable content;
   *                 just a hairline that paints across the cell.
   */
  elementKind?: 'text' | 'emoji' | 'divider';
  /**
   * HTML content for text-based elements. Stored as HTML so inline
   * formatting (B / I / U / links) round-trips through the contenteditable
   * surface without a separate AST.
   */
  html?: string;
  /**
   * Text style for the element — drives both the wrapping HTML element
   * (p / h1 / h2 / ul / ol) and the typographic preset. Defaults to
   * `'text'` when omitted.
   */
  textStyle?: TextStyle;
  /**
   * Native Unicode character for an `elementKind: 'emoji'` element.
   * Empty string when freshly created — the canvas opens the picker on
   * mount in that case so the user can choose one.
   */
  emoji?: string;
}

export interface MockDataPoint {
  date: string;
  value: number;
  value2?: number;
}

export interface MetricData {
  label: string;
  /** Primary headline value, pre-formatted (e.g. "45.2K", "8.4%"). */
  value: string;
  /** Signed percent change — drives up/down indicator + text sign. */
  change: number;
  /** Short qualifier shown after the comparison (e.g. "vs last period").
   *  Currently NOT rendered per Figma 1197:269145 (the metric card shows
   *  only `±absolute (±percent%)`), but kept on the type so analytics
   *  modules that need a period hint can consume it. */
  changeLabel: string;
  /** Pre-formatted absolute delta (e.g. "+118", "-80"). Rendered first in
   *  the comparison row per Figma 1197:269145 → "+118 (+19.22%)". If
   *  omitted the card renders only the percent. */
  changeAbsolute?: string;
}

export interface TableRow {
  [key: string]: string | number;
}

export interface ListItem {
  id: string;
  thumbnail?: string;
  title: string;
  subtitle?: string;
  metrics: { label: string; value: string }[];
}

// Bubble-chart point — a weekday × hour cell. `day` is 0-indexed
// (0 = Sunday … 6 = Saturday) and `hour` is 0-23. `value` drives the
// bubble radius via Recharts' ZAxis range.
export interface BubblePoint {
  day: number;
  hour: number;
  value: number;
}

// Carousel "video card" payload — Figma 2222:40922 (Video engagement)
// and its sister modules.  Each card is a self-contained snapshot of
// one post: profile chip, caption, thumbnail, and a 4-row metric
// table.  The carousel-level modules
// (`VideoEngagementModule` and its still-stubbed siblings
// `tiktok-video-watch-metrics`, `tiktok-video-sources`) accept
// `VideoCardData[]` and just iterate them — the metric set differs
// per consumer, so the type stays shape-only (label / value pairs)
// rather than naming specific columns.
export interface VideoCardData {
  id: string;
  /** Pre-formatted timestamp e.g. "23 Sep 2024 - 10.34 AM".  Frozen
   *  upstream so we don't drag i18n / Date formatting into the
   *  presentation layer. */
  date: string;
  profile: {
    /** Display name shown above the @handle. */
    name: string;
    /** With the leading @ already included, e.g. "@tenceclothier_ng". */
    handle: string;
    /** Single uppercase letter rendered inside the 32-px avatar
     *  monogram square. */
    monogram: string;
  };
  /** Free-text caption.  Truncated to 2 lines by the card renderer
   *  via `-webkit-line-clamp`. */
  caption: string;
  /** CSS background value used as the thumbnail BACKDROP — visible
   *  behind / around the 9 : 16 inner video preview as a 50 px strip
   *  on each side.  Per-card gradient so the strip's left/right
   *  letterboxing reads visually different card-to-card. */
  thumbnail: string;
  /** URL of the image rendered inside the 9 : 16 inner video preview
   *  to make each card read as "different post / different video"
   *  instead of identical dark frames.  Sourced from
   *  `picsum.photos/seed/<seed>/280/498` (2× the rendered 140 × 249
   *  for retina sharpness) so the seed → image mapping is stable
   *  across reloads. */
  image: string;
  /** 4-row metric table.  Order is preserved as authored.  Sister
   *  carousels (watch metrics, sources) supply their own
   *  module-specific labels here. */
  metrics: { label: string; value: string }[];
}
