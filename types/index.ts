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
}

export interface ReportModule {
  id: string;
  definitionId: string;
  chartType: ChartType;
  layout: LayoutItem;
  title?: string;
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
   */
  elementKind?: 'text' | 'emoji';
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
