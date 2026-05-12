/**
 * Elements catalog — non-data content blocks surfaced by the "Elements" tab
 * in AddModulePanel (Figma frame 1026:40473).
 *
 * Elements are distinct from modules in two important ways:
 *   1. They carry no data bindings — no `platforms`, no `supportedChartTypes`,
 *      no mock-data lookup. An Element is just a canvas-level content block
 *      (a heading, a divider, an uploaded image, etc.).
 *   2. They render via dedicated components, NOT via `getModuleContent` in
 *      ModuleCard. The canvas distinguishes the two by kind at render time.
 *
 * The catalog is split into two categories per Figma:
 *   • Basic blocks: Text, Heading 1, Heading 2, Divider, Emoji
 *   • Media:        Image, File, Link
 *
 * Grid sizing defaults follow ReportCanvas's NEW-units geometry:
 *   ROW_HEIGHT = 2 px, with a 16 px transparent padding-bottom per grid
 *   item, so a grid item's painted area is `h × 2 − 16` px tall. One
 *   Figma cell (140 px visible) is `h = 78` rows. For TEXT-shaped
 *   elements (Text / Heading 1 / Heading 2) we pick `defaultH` so
 *   `defaultH × 2 − 16` exactly matches the empty wrapper's intrinsic
 *   pixel height — TextElement's ResizeObserver re-asserts this on
 *   mount via `pxToRows()`, so the value here just seeds the first
 *   render without the cell jumping a row immediately after.
 *   For media elements we pick `defaultH` so `defaultH × 2 − 16` lands
 *   on a cell-band boundary (140 / 280 / 420 / … px visible).
 */

export type ElementCategory = 'Basic blocks' | 'Media';

export type ElementKind =
  | 'text'
  | 'heading-1'
  | 'heading-2'
  | 'divider'
  | 'emoji'
  | 'image'
  | 'file'
  | 'link';

export interface ElementDefinition {
  id: ElementKind;
  name: string;
  category: ElementCategory;
  /** Default width in grid columns (1..4). */
  defaultW: number;
  /** Default height in grid rows (multiple of 6 to align to Figma cells). */
  defaultH: number;
  /** Minimum width to keep the content legible after a resize. */
  minW: number;
  /** Minimum height to keep the content legible after a resize. */
  minH: number;
}

export const ELEMENT_DEFINITIONS: ElementDefinition[] = [
  // ── Basic blocks ────────────────────────────────────────────────────────
  // Text / Heading 1 / Heading 2 — full-width by default. `defaultH` seeds
  // the first render with the empty single-line wrapper height; the
  // ResizeObserver in TextElement immediately re-asserts the right value
  // via pxToRows() once the DOM measures, so a one-row mismatch here
  // would show up as a tiny one-frame jump but nothing worse.
  // Empty wrappers (16 px font, 12 px top + 12 px bottom padding):
  //   • Text:      ~44 px → h = (44 + 16) / 2 = 30
  //   • Heading 1: ~50 px → h = (50 + 16) / 2 = 33
  //   • Heading 2: ~44 px → h = (44 + 16) / 2 = 30
  // (Heading 1 uses a 20 px font with 26 px line-height, so its empty
  // chrome is ~6 px taller than Text/H2.)
  {
    id: 'text',
    name: 'Text',
    category: 'Basic blocks',
    defaultW: 4,
    defaultH: 30,
    minW: 1,
    minH: 30,
  },
  {
    id: 'heading-1',
    name: 'Heading 1',
    category: 'Basic blocks',
    defaultW: 4,
    defaultH: 33,
    minW: 1,
    minH: 33,
  },
  {
    id: 'heading-2',
    name: 'Heading 2',
    category: 'Basic blocks',
    defaultW: 4,
    defaultH: 30,
    minW: 1,
    minH: 30,
  },
  // Divider — visual chrome is JUST a 1-px hairline inside 12 px py
  // padding, so the painted area is `12 + 1 + 12 = 25 px`.  Pick the
  // smallest `defaultH` that yields at least 25 px visible after the
  // 16-px BOTTOM_GAP_PX is subtracted: `21 × 2 − 16 = 26 px` (1 px of
  // headroom).  Anything taller leaves dead space below the rule.
  {
    id: 'divider',
    name: 'Divider',
    category: 'Basic blocks',
    defaultW: 4,
    defaultH: 21,
    minW: 1,
    minH: 21,
  },
  {
    id: 'emoji',
    name: 'Emoji',
    category: 'Basic blocks',
    defaultW: 1,
    defaultH: 30,
    minW: 1,
    minH: 30,
  },
  // ── Media ───────────────────────────────────────────────────────────────
  // Heights here land on Figma cell boundaries: 78 rows = 1 cell (140 px
  // visible), 156 rows = 2 cells (296 px = 140 + 16 gap + 140 visible),
  // … — same correspondence as chart modules.
  {
    id: 'image',
    name: 'Image',
    category: 'Media',
    defaultW: 2,
    defaultH: 156, // 2 cells visible
    minW: 1,
    minH: 78,
  },
  {
    id: 'file',
    name: 'File',
    category: 'Media',
    defaultW: 2,
    defaultH: 78, // 1 cell visible
    minW: 1,
    minH: 30,
  },
  {
    id: 'link',
    name: 'Link',
    category: 'Media',
    defaultW: 2,
    defaultH: 30,
    minW: 1,
    minH: 30,
  },
];

/**
 * Order-preserving group by category so the Elements tab can render "Basic
 * blocks" before "Media" (matches Figma 1026:40473's vertical stack).
 */
export function groupElementsByCategory(): Record<ElementCategory, ElementDefinition[]> {
  const groups: Record<ElementCategory, ElementDefinition[]> = {
    'Basic blocks': [],
    'Media': [],
  };
  for (const el of ELEMENT_DEFINITIONS) {
    groups[el.category].push(el);
  }
  return groups;
}
