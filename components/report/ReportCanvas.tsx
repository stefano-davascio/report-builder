'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ReportModule, ChartType, ModuleDefinition, TextStyle } from '@/types';
import { MODULE_DEFINITIONS } from '@/lib/mock-data';
import { ElementDefinition } from '@/lib/element-definitions';
import { MockProfile } from '@/lib/profile-data';
import { uid } from '@/lib/utils';
import { ModuleCard } from './ModuleCard';
import { TextElement } from './TextElement';
import { EmojiElement } from './EmojiElement';
import { DividerElement } from './DividerElement';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Import types from the new react-grid-layout
import type { LayoutItem, Layout } from 'react-grid-layout';
import { verticalCompactor } from 'react-grid-layout';

const GridLayout = dynamic(
  () => import('react-grid-layout').then((mod) => mod.GridLayout),
  { ssr: false },
);

// ──────────────────────────────────────────────────────────────────────────────
// Grid constants — 4-column, gravity-compacted layout system.
// ──────────────────────────────────────────────────────────────────────────────
//
// The canvas behaves like Notion / Metabase:
//   • Horizontal:   strict 4-column snap; modules are 1–4 cols wide.
//   • Vertical:     fluid flow via `verticalCompactor` — modules always pull
//                   up to fill gaps. No fixed rows; row-height is just the
//                   vertical snap increment.
//   • Guides:       a 4×N ghost-cell grid is shown **only while the user is
//                   interacting** (dragging, resizing, or dragging from the
//                   Add-modules panel). Cells directly under the current drag
//                   flip into an active lavender drop-zone state.
//
// Figma reference: "visual guide" frame (node 1026:44982) inside the canvas
// frame (1026:44981, 1237 px wide with 24 px padding → 1188 px inner).
// The guide is a 4 × N grid of ghost cells. Every cell child (Frame 281..314)
// measures **285 × 140** with x positions 0/301/602/903 and y positions
// 0/156/312/… — confirming a **16 px gutter** on both axes. We encode those
// numbers exactly below.
//
// Grid math proof (all integer, no approximation):
//   • Column width:    285   (cellWidth = (1188 − 3×16) / 4 = 285)
//   • Column gutter:   16
//   • Vertical layout: every grid item carries 16 px of TRANSPARENT
//     padding-bottom (see the `.react-grid-item` CSS rule below), and we
//     run the grid with `rowHeight=2`, `marginY=0`. That gives us:
//       grid-item visible height = h × ROW_HEIGHT − BOTTOM_GAP
//                                = h × 2          − 16
//     so a Figma cell (140 px visible) is `h = 78` grid rows
//     (78 × 2 − 16 = 140 ✓), and the 16 px gap between any two stacked
//     items is provided by the transparent padding rather than RGL's
//     internal row-margin. This is what lets a TEXT element (which
//     hugs intrinsic content height) sit cleanly above a CHART without
//     RGL's row-quantization forcing a 26 px stride.
//   • Band stride:     GHOST_CELL_ROWS × ROW_HEIGHT
//                    = 78 × 2 = 156  ✓ (140 visible + 16 gap)
//
// Why ROW_HEIGHT=2 (not 10)?
//   With marginY=0, the cell-height formula simplifies to `h × 2`. We
//   need `h × 2 − 16 = wrapperPx` to be solvable for arbitrary wrapper
//   heights (ResizeObserver-measured text content). The smallest stride
//   that admits an integer `h` for any even wrapper height is 2 — i.e.
//   ROW_HEIGHT must divide every (wrapperPx + 16). 2 is the largest
//   value that satisfies this for the wrapper heights we observe
//   (44, 50, 62, …), and it keeps grid math compact.
//
// Chart height transform: chart `MODULE_DEFINITIONS` in lib/mock-data.ts
// still declare `defaultH` in OLD-units (multiples of 6 = Figma cells).
// We multiply by 13 at every consumption site (drop / drag-over / add)
// so the source numbers stay readable and a single constant change here
// ripples out without rewriting the catalog. 6 × 13 = 78 (one cell), 12
// × 13 = 156 (two cells), … exact correspondence to old behavior.
// Responsive canvas grid — cols flex with available canvas width so modules
// reflow cleanly on narrower viewports rather than getting squeezed into a
// 4-column layout that can no longer hold them. Breakpoints are measured
// on the *canvas inner width* (the `containerWidth` prop), not the
// viewport, because the Add-modules panel eats real horizontal space when
// it's open:
//
//   • canvas ≥  950 px  →  4 cols  (full desktop + typical laptop)
//   • canvas ≥  860 px  →  3 cols  (narrow laptop w/o panel, or wide
//                                   laptop w/ panel open — still room
//                                   for 3 narrow modules side-by-side)
//   • canvas ≥  540 px  →  2 cols  (mid-size laptop w/ panel open)
//   • canvas <  540 px  →  1 col   (very narrow — single column stack)
//
// 950 keeps the 4-column layout active on typical ~1100–1280 laptop
// viewports (canvas ≈ 999–1237) where the extra column packs the four
// metric cards into a single row and puts audience-growth +
// audience-demographics side-by-side. 860 / 540 kick in as the panel
// opens and eats real canvas width.
const COL_COUNT_DESKTOP = 4;
const CANVAS_BP_4COL_PX = 950;
const CANVAS_BP_3COL_PX = 860;
const CANVAS_BP_2COL_PX = 540;
function getColCount(width: number): number {
  if (width === 0) return COL_COUNT_DESKTOP; // pre-measurement default
  if (width >= CANVAS_BP_4COL_PX) return 4;
  if (width >= CANVAS_BP_3COL_PX) return 3;
  if (width >= CANVAS_BP_2COL_PX) return 2;
  return 1;
}
const ROW_HEIGHT = 2;
// MARGIN[0] = horizontal gutter between columns (still 16 px).
// MARGIN[1] = 0: vertical gap between stacked items is provided by a
// transparent 16 px padding-bottom on each grid item (see the
// `.react-grid-item` CSS rule below). This pulls vertical stacking out
// of RGL's row-quantizer entirely, so a text element of any pixel
// height can sit above a cell-quantized chart with an exact 16 px gap.
const MARGIN: [number, number] = [16, 0];
/** Transparent gap rendered as padding-bottom on each grid item, in px. */
const BOTTOM_GAP_PX = 16;
const CONTAINER_PADDING: [number, number] = [0, 0];

// One ghost cell = 78 grid rows. A "Figma cell" of 140 px visible height
// satisfies `78 × 2 − 16 = 140`. Module charts declare their heights in
// OLD-units (multiples of 6) in lib/mock-data.ts and are transformed via
// `× CHART_H_FACTOR` at consumption sites — see CHART_H_FACTOR below.
const GHOST_CELL_ROWS = 78;
// Trailing landing-zone rows below the last module. 234 row units = 3
// ghost cell bands (3 × 78), so the user always has a 3-deep drop target
// below existing content.
const GHOST_TRAILING_ROWS = 234;
/**
 * Factor by which we scale a chart `ModuleDefinition.defaultH` (declared
 * in OLD-units, where 1 cell = 6 rows) into NEW-units (where 1 cell = 78
 * rows). Lives at the boundary so lib/mock-data.ts stays human-readable
 * (a 1-cell chart is "h: 6", not "h: 78"). 78 / 6 = 13.
 */
const CHART_H_FACTOR = 13;

// ──────────────────────────────────────────────────────────────────────────────
// Module-type-aware resize snap.
// ──────────────────────────────────────────────────────────────────────────────
// Strict modules (charts, data, lists, tables, metrics, donuts, pies) must
// have HEIGHTS that are multiples of GHOST_CELL_ROWS (=1 cell = 140 px
// visible). This keeps chart sizing tight on cell boundaries and prevents
// "in-between" heights.
//
// Text modules (and headings) are the exception: they resize in single-row
// (2 px) increments because their height is content-driven (a
// ResizeObserver in TextElement reports back the wrapper's intrinsic
// pixel height, which we ceil into a row count via pxToRows()).
//
// Y-coordinate is NOT snapped on commit. With ROW_HEIGHT=2 and 16 px of
// transparent padding-bottom per item, charts already sit on natural 16
// px gaps below whatever's above them — the compactor produces the right
// y; rounding it to multiples of 78 would (a) round non-cell-aligned
// y values like 30 (compactor-placed below a small text) DOWN to 0,
// causing collisions, and (b) prevent charts from sitting flush below
// arbitrary-height text blocks. We DO snap y for the ACTIVE-DRAG ghost
// highlight (visual feedback in `snapActiveDrag`) and for the initial
// panel drop position (handleDrop / handlePanelDragOver), since those
// cases benefit from cell-aligned target cells.
//
// The library always emits layouts in 1-row (2 px) granularity during
// drag/resize, which is what we want for smooth tracking. We re-snap
// strict items' HEIGHTS before committing so the settled layout lands on
// cell boundaries.
function isFlexibleHeight(chartType: ChartType): boolean {
  // Cast through `string` because 'text' isn't in ChartType yet — the
  // predicate is forward-compatible: once `'text'` is added to the union
  // this branch activates without further changes.
  return (chartType as string) === 'text';
}

/** Round v to the nearest multiple of GHOST_CELL_ROWS, clamped to >= min. */
function snapToCell(v: number, min = GHOST_CELL_ROWS): number {
  return Math.max(min, Math.round(v / GHOST_CELL_ROWS) * GHOST_CELL_ROWS);
}

interface ReportCanvasProps {
  modules: ReportModule[];
  isEditMode: boolean;
  // React setter — functional-update form lets drag/drop/resize handlers read
  // the freshest module list without closing over `modules` (which would
  // rebind the callback on every commit and make the grid re-register its
  // internal handlers every frame).
  onModulesChange: React.Dispatch<React.SetStateAction<ReportModule[]>>;
  onAddModule: () => void;
  containerWidth: number;
  /**
   * Definition currently being dragged from the Add-modules panel. When set
   * (and `isEditMode`), the grid becomes a drop target and renders a
   * placeholder sized to the definition's default w/h.
   */
  draggingDefinition?: ModuleDefinition | null;
  /**
   * Element-kind being dragged from the Elements tab. Mutually exclusive
   * with `draggingDefinition` in practice — the panel only ever drags one
   * thing at a time. When set, the grid becomes a drop target sized to the
   * element's defaultW/H.
   */
  draggingElement?: ElementDefinition | null;
  /**
   * Called when a panel item is dropped onto the grid at grid cell (x, y).
   */
  onDropModuleAt?: (def: ModuleDefinition, x: number, y: number) => void;
  /** Called when an element is dropped onto the grid at grid cell (x, y). */
  onDropElementAt?: (def: ElementDefinition, x: number, y: number) => void;
  /**
   * The profiles currently selected in the global profile bar. Passed
   * through to each ModuleCard so modules can show a Networks indicator
   * (overlapping-avatar cluster) in their legend row.
   */
  selectedProfiles?: MockProfile[];
}

export function ReportCanvas({
  modules,
  isEditMode,
  onModulesChange,
  onAddModule,
  containerWidth,
  draggingDefinition = null,
  draggingElement = null,
  onDropModuleAt,
  onDropElementAt,
  selectedProfiles = [],
}: ReportCanvasProps) {
  // ── Interaction state ──────────────────────────────────────────────────────
  // The ghost-cell overlay only renders while the user is actively
  // manipulating the layout — per Figma, the grid is hidden by default and
  // only surfaces during drag / resize / panel-drag-over.
  //
  // `activeDrag` tracks the cell rectangle being hovered so we can paint the
  // matching ghost cells in the lavender "active drop zone" state.
  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  // The *id* of the module currently being resized (not just a boolean):
  // ModuleCard uses this to keep its hover chrome (border / shadow /
  // drag handle / actions / resize grip) latched on while the user is
  // dragging the corner grip, even if their cursor slips briefly
  // outside the card as its dimensions change. Boolean `isResizing`
  // (below) is the derived state used by the ghost-cell overlay.
  const [resizingId, setResizingId] = useState<string | null>(null);
  const isResizing = resizingId !== null;

  // Unified read of "what's currently being dragged from the panel" — the
  // Add-modules panel surfaces either a ModuleDefinition (Network / Visual
  // tabs) or an ElementDefinition (Elements tab), never both. Centralizing
  // here lets the drop / drag-over / placeholder code paths treat them
  // uniformly via the `defaultW` / `defaultH` / `defaultChartType?` fields
  // they share at the structural level.
  //
  // Memoized so downstream callbacks/memos don't re-create on every render
  // (the discriminated-union object would otherwise be a fresh reference
  // each pass even when both inputs are stable).
  const dragging = useMemo<
    | { kind: 'module'; def: ModuleDefinition }
    | { kind: 'element'; def: ElementDefinition }
    | null
  >(() => {
    if (draggingDefinition) return { kind: 'module', def: draggingDefinition };
    if (draggingElement) return { kind: 'element', def: draggingElement };
    return null;
  }, [draggingDefinition, draggingElement]);

  // When a panel drag ends without a drop (user releases outside the grid
  // or cancels), the parent clears `draggingDefinition` / `draggingElement`.
  // Mirror that on `activeDrag` so the lavender ghost highlight disappears
  // too — otherwise the last hover cell stays lit until the next internal
  // drag.
  useEffect(() => {
    if (!dragging && activeDrag?.id === '__dropping__') {
      setActiveDrag(null);
    }
  }, [dragging, activeDrag]);

  // ── Layout commit ─────────────────────────────────────────────────────────
  // The grid emits a new `layout` on every tick of drag / resize. We commit
  // only the x/y/w/h of each module, and only when something actually
  // changed, so:
  //
  //   • React state reference is stable when the layout is identical →
  //     `gridLayout` memo stays stable → grid doesn't re-sync → Recharts'
  //     ResponsiveContainer doesn't re-measure every frame (which was the
  //     source of the old max-update-depth loop).
  //
  //   • `verticalCompactor` runs INSIDE the grid library, so by the time
  //     `layout` reaches us it's already gravity-settled. We don't need to
  //     resolve collisions ourselves.
  // Source discriminator for `applyGridLayout`.  `'drag'` covers both
  // RGL's drag/move events and any other path that reorders without
  // changing module width; `'resize'` is the corner-grip path where w
  // is genuinely under the user's control.
  type ApplyLayoutSource = 'drag' | 'resize';

  const applyGridLayout = useCallback(
    (layout: Layout, source: ApplyLayoutSource = 'drag') => {
      onModulesChange((prev) => {
        let changed = false;
        const next = prev.map((mod) => {
          const l = (layout as LayoutItem[]).find((x) => x.i === mod.id);
          if (!l) return mod;
          // Type-aware snap: strict (chart/data) modules must have their
          // HEIGHT snap to cell boundaries (multiples of GHOST_CELL_ROWS).
          // Text modules pass through at the library's 1-row granularity.
          // Y is never re-snapped on commit — see the comment block on
          // GHOST_CELL_ROWS / snapToCell above for the rationale.
          const flexible = isFlexibleHeight(mod.chartType);
          const nextH = flexible
            ? Math.max(l.h, mod.layout.minH ?? 1)
            : snapToCell(l.h, Math.max(mod.layout.minH ?? GHOST_CELL_ROWS, GHOST_CELL_ROWS));
          const nextY = l.y;
          // ── Width persistence rule ────────────────────────────────
          // Only commit a new `w` when the change is from a corner-grip
          // resize.  During drag/move events, the layout RGL hands us
          // has every item's `w` clamped to the current responsive
          // `cols` (computed at line ~611 in the `gridLayout` memo).
          // Persisting that clamp would silently overwrite the user's
          // authored width — e.g. a 4-col-wide module that's been
          // visually clamped to 2 while the AddModulePanel is open
          // would stay 2 after the panel closes, leaving awkward empty
          // columns.  Keeping the source discriminator means moving
          // (drag) preserves authored width, while resizing (corner
          // grip) records the user's new explicit width.
          const nextW = source === 'resize' ? l.w : mod.layout.w;
          if (
            l.x === mod.layout.x &&
            nextY === mod.layout.y &&
            nextW === mod.layout.w &&
            nextH === mod.layout.h
          ) {
            return mod;
          }
          changed = true;
          return {
            ...mod,
            layout: { ...mod.layout, x: l.x, y: nextY, w: nextW, h: nextH },
          };
        });
        return changed ? next : prev;
      });
    },
    [onModulesChange],
  );

  const handleChartTypeChange = useCallback(
    (moduleId: string, type: ChartType) => {
      onModulesChange((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, chartType: type } : m)),
      );
    },
    [onModulesChange],
  );

  const handleDuplicate = useCallback(
    (moduleId: string) => {
      onModulesChange((prev) => {
        const original = prev.find((m) => m.id === moduleId);
        if (!original) return prev;
        const newId = `${moduleId}-copy-${uid()}`;
        const duplicate: ReportModule = {
          ...original,
          id: newId,
          layout: {
            ...original.layout,
            i: newId,
            y: original.layout.y + original.layout.h,
          },
        };
        // Append; `verticalCompactor` will pull it up to fill the nearest
        // available slot on the next grid sync.
        return [...prev, duplicate];
      });
    },
    [onModulesChange],
  );

  const handleDelete = useCallback(
    (moduleId: string) => {
      onModulesChange((prev) => prev.filter((m) => m.id !== moduleId));
    },
    [onModulesChange],
  );

  // Persist text-element edits (HTML / textStyle / intrinsic height) back
  // into the parent's module list. Used by TextElement; merged shallowly
  // so partial patches (only html, only textStyle, only layoutH, or any
  // combination) all work without clobbering unrelated fields.
  //
  // `layoutH` carries the intrinsic content height (in grid rows)
  // measured by TextElement's ResizeObserver. We translate it into the
  // module's `layout.h` so the grid cell hugs the typed content — the
  // text element grows row-by-row as the user adds lines, with no
  // wasted space below until they want it. We early-return if the row
  // count is unchanged so we don't churn React state on every observer
  // tick (the observer fires on sub-pixel deltas too, and most of those
  // round to the same row count).
  const handleTextElementChange = useCallback(
    (moduleId: string, patch: { html?: string; textStyle?: TextStyle; layoutH?: number }) => {
      const { layoutH, ...rest } = patch;
      onModulesChange((prev) =>
        prev.map((m) => {
          if (m.id !== moduleId) return m;
          const next: ReportModule = { ...m, ...rest };
          if (layoutH !== undefined && layoutH !== m.layout.h) {
            next.layout = { ...m.layout, h: layoutH };
          }
          return next;
        }),
      );
    },
    [onModulesChange],
  );

  // Persist a chosen emoji onto the module (the picker fires this when
  // the user selects a character).  No layout side-effects — the emoji
  // element keeps whatever cell size the grid gave it.
  const handleEmojiElementChange = useCallback(
    (moduleId: string, patch: { emoji?: string }) => {
      onModulesChange((prev) =>
        prev.map((m) => (m.id !== moduleId ? m : { ...m, ...patch })),
      );
    },
    [onModulesChange],
  );

  // Current responsive column count — driven by canvas inner width.
  // All grid math (cell stride, drop clamp, ghost iteration, grid config)
  // reads from here so breakpoints update atomically as the canvas resizes.
  const cols = getColCount(containerWidth);

  // ── External drop (from Add-modules panel) ────────────────────────────────
  // Charts declare `defaultH` in OLD-units (multiples of 6 = Figma cells)
  // — see the CHART_H_FACTOR comment up top. Elements declare it in
  // NEW-units directly (text=30, heading-1=33, heading-2=30 …). Branch
  // here so the placeholder reflects the right number of grid rows.
  const droppingItem = useMemo(() => {
    if (!dragging) return undefined;
    const h =
      dragging.kind === 'module'
        ? dragging.def.defaultH * CHART_H_FACTOR
        : dragging.def.defaultH;
    return {
      i: '__dropping__',
      x: 0,
      y: 0,
      w: Math.min(dragging.def.defaultW, cols),
      h,
    };
  }, [dragging, cols]);

  // True if the incoming drag uses flexible (text-style) height snapping —
  // text elements bypass cell-snap so resize / drop Y track the cursor at
  // 1-row granularity. Module definitions look at `defaultChartType`;
  // elements check the kind directly.
  const isDragFlexible = useCallback((d: NonNullable<typeof dragging>): boolean => {
    if (d.kind === 'module') return isFlexibleHeight(d.def.defaultChartType);
    // Text / Heading 1 / Heading 2 all render via TextElement, so they
    // share the flexible-height behavior.
    return d.def.id === 'text' || d.def.id === 'heading-1' || d.def.id === 'heading-2';
  }, []);

  const handleDrop = useCallback(
    (_layout: Layout, item: LayoutItem | undefined) => {
      if (!dragging || !item) return;
      const def = dragging.def;
      const w = Math.min(def.defaultW, cols);
      const x = Math.max(0, Math.min(item.x, cols - w));
      // Cell-snap the drop Y unless the incoming item is flexible (text).
      const flexible = isDragFlexible(dragging);
      const y = flexible ? Math.max(0, item.y) : snapToCell(item.y, 0);
      // Parent owns the state — it will append the new module/element via
      // its respective handler. The next render's `verticalCompactor` pass
      // pulls the new entry up to the top of its column if there's empty
      // space above.
      if (dragging.kind === 'module') {
        onDropModuleAt?.(dragging.def, x, y);
      } else {
        onDropElementAt?.(dragging.def, x, y);
      }
      setActiveDrag(null);
    },
    [dragging, onDropModuleAt, onDropElementAt, cols, isDragFlexible],
  );

  // Panel drag-over: fires as the pointer moves across the grid while a
  // module is being dragged in from the Add-modules panel. The library
  // hands us a raw native DragEvent; we compute the target grid cell
  // ourselves by measuring pointer position against the grid container's
  // bounding rect, using the same cell/gutter math the library uses
  // internally. Result: the lavender ghost-cell highlight tracks the
  // cursor cell-by-cell, same visual language as internal drags.
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const handlePanelDragOver = useCallback(
    (e: DragEvent) => {
      const el = gridContainerRef.current;
      if (!el || !dragging || containerWidth <= 0) return;
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const colStride = (containerWidth - MARGIN[0] * (cols - 1)) / cols + MARGIN[0];
      const rowStride = ROW_HEIGHT + MARGIN[1];
      const def = dragging.def;
      const w = Math.min(def.defaultW, cols);
      // Same OLD→NEW transform as `droppingItem` above — keeps the
      // ghost-cell highlight footprint consistent with what will
      // actually drop.
      const h =
        dragging.kind === 'module'
          ? def.defaultH * CHART_H_FACTOR
          : def.defaultH;
      // Center the placeholder on the cursor (matches the library's own
      // centering behavior).
      const centerColOffset = w / 2;
      const centerRowOffset = h / 2;
      const rawGx = Math.floor(relX / colStride - centerColOffset + 0.5);
      const rawGy = Math.floor(relY / rowStride - centerRowOffset + 0.5);
      const clampedX = Math.max(0, Math.min(rawGx, cols - w));
      const flexible = isDragFlexible(dragging);
      const y = flexible ? Math.max(0, rawGy) : snapToCell(Math.max(0, rawGy), 0);
      setActiveDrag({ id: '__dropping__', x: clampedX, y, w, h });
      // Return nothing → library keeps the default dropping-item dimensions.
    },
    [dragging, containerWidth, cols, isDragFlexible],
  );

  // ── Live drag / resize handlers ───────────────────────────────────────────
  // Snap the in-flight item to cell boundaries (strict modules only) so the
  // lavender ghost-cell highlight tracks cell-by-cell as the user drags,
  // rather than shifting every 10 px row.
  const snapActiveDrag = useCallback(
    (item: LayoutItem): { id: string; x: number; y: number; w: number; h: number } => {
      const mod = modules.find((m) => m.id === item.i);
      const flexible = mod ? isFlexibleHeight(mod.chartType) : false;
      return {
        id: item.i,
        x: item.x,
        y: flexible ? item.y : snapToCell(item.y, 0),
        w: item.w,
        h: flexible ? item.h : snapToCell(item.h, GHOST_CELL_ROWS),
      };
    },
    [modules],
  );

  const handleDragStart = useCallback(
    (_layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      if (!newItem) return;
      setActiveDrag(snapActiveDrag(newItem));
    },
    [snapActiveDrag],
  );

  const handleDrag = useCallback(
    (layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      if (!newItem) return;
      setActiveDrag(snapActiveDrag(newItem));
      applyGridLayout(layout);
    },
    [applyGridLayout, snapActiveDrag],
  );

  const handleDragStop = useCallback(
    (layout: Layout, _oldItem: LayoutItem | null, _newItem: LayoutItem | null) => {
      applyGridLayout(layout);
      setActiveDrag(null);
    },
    [applyGridLayout],
  );

  const handleResizeStart = useCallback(
    (_layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      if (newItem) {
        setResizingId(newItem.i);
        setActiveDrag(snapActiveDrag(newItem));
      }
    },
    [snapActiveDrag],
  );

  const handleResize = useCallback(
    (layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      if (newItem) setActiveDrag(snapActiveDrag(newItem));
      applyGridLayout(layout, 'resize');
    },
    [applyGridLayout, snapActiveDrag],
  );

  const handleResizeStop = useCallback(
    (layout: Layout, _oldItem: LayoutItem | null, _newItem: LayoutItem | null) => {
      applyGridLayout(layout, 'resize');
      setResizingId(null);
      setActiveDrag(null);
    },
    [applyGridLayout],
  );

  // ── Grid layout prop ──────────────────────────────────────────────────────
  // Display-time reflow so the persisted (desktop-authored) layout can be
  // rendered cleanly at narrower breakpoints. We don't mutate `modules` —
  // widening the canvas back out restores the original grid.
  //
  // Naive clamp (`x = min(persistedX, cols - w)`) breaks down when two
  // modules collide at the same clamped x — the vertical compactor only
  // pulls up, it doesn't redistribute horizontally, so you end up with
  // tall empty columns and modules stacked into the remaining ones. For
  // DEFAULT_MODULES at 3 cols this produced col 2 mostly empty with
  // audience-growth pushed hundreds of pixels below its authored y.
  //
  // Instead we shelf-pack: walk modules in stable reading order (y, x)
  // and place each into the (x, y) slot with the lowest max column top
  // that still fits its clamped width. When cols ≥ the authored width
  // this is a no-op (modules land back on their original coordinates);
  // when cols drops it spreads siblings across the available columns
  // and lets the rest of the layout flow down naturally.
  //
  // Memoized so identical module state produces the same `layout` reference
  // — that prop identity is what the grid uses to decide whether to
  // re-sync its internal state during live drag, so stability here is
  // critical for avoiding a feedback loop.
  const gridLayout: Layout = useMemo(() => {
    const sorted = [...modules].sort(
      (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
    );
    const colTops = new Array(cols).fill(0);
    return sorted.map((m) => {
      const w = Math.min(m.layout.w, cols);
      // Pick the origin x where the tallest column under [x, x+w) is lowest.
      // Ties resolve to the leftmost x — preserves authored ordering.
      let bestX = 0;
      let bestY = Infinity;
      for (let x = 0; x <= cols - w; x++) {
        let top = 0;
        for (let i = x; i < x + w; i++) {
          if (colTops[i] > top) top = colTops[i];
        }
        if (top < bestY) {
          bestY = top;
          bestX = x;
        }
      }
      if (bestY === Infinity) bestY = 0;
      for (let i = bestX; i < bestX + w; i++) {
        colTops[i] = bestY + m.layout.h;
      }
      return {
        i: m.id,
        x: bestX,
        y: bestY,
        w,
        h: m.layout.h,
        minW: Math.min(m.layout.minW ?? 1, cols),
        // Default lower bound = 1 Figma cell (78 rows × 2 px − 16 px
        // bottom-gap = 140 px visible). Matches the smallest ghost-cell
        // footprint so dynamically-added modules always land inside a
        // valid cell.
        minH: m.layout.minH ?? GHOST_CELL_ROWS,
        maxW: cols,
        ...(isEditMode ? {} : { static: true }),
      };
    });
  }, [modules, isEditMode, cols]);

  // ── Ghost-cell overlay ────────────────────────────────────────────────────
  // Visible only while the user is interacting. Three triggers:
  //   1. `activeDrag` set → internal drag or resize in progress.
  //   2. `isResizing` (belt-and-braces; covered by activeDrag already).
  //   3. `draggingDefinition` set → panel drag-over.
  const showGrid =
    isEditMode && (activeDrag !== null || isResizing || !!dragging);

  const cellWidth =
    containerWidth > 0
      ? (containerWidth - MARGIN[0] * (cols - 1)) / cols
      : 0;

  // Build the ghost cells. We extend the grid N rows past the last-occupied
  // row so there's always a visible landing zone below the content.
  // When an active drag is in progress we additionally extend to cover the
  // dragged item's own row range so cells under it show the active state.
  const maxOccupiedY = modules.reduce(
    (max, m) => Math.max(max, m.layout.y + m.layout.h),
    0,
  );
  const dragBottom = activeDrag ? activeDrag.y + activeDrag.h : 0;
  const totalGhostRows = Math.max(
    maxOccupiedY + GHOST_TRAILING_ROWS,
    dragBottom + GHOST_TRAILING_ROWS,
  );

  // Test whether a ghost-cell rectangle (x..x+1, y..y+GHOST_CELL_ROWS)
  // overlaps the active drag rectangle.
  const intersectsActiveDrag = (gx: number, gy: number) => {
    if (!activeDrag) return false;
    const ax1 = activeDrag.x;
    const ax2 = activeDrag.x + activeDrag.w;
    const ay1 = activeDrag.y;
    const ay2 = activeDrag.y + activeDrag.h;
    const gx2 = gx + 1;
    const gy2 = gy + GHOST_CELL_ROWS;
    return gx < ax2 && gx2 > ax1 && gy < ay2 && gy2 > ay1;
  };

  const ghostCells: {
    key: string;
    left: number;
    top: number;
    width: number;
    height: number;
    active: boolean;
  }[] = [];

  // Build a COMPLETE 4 × N grid of equal-sized cells. We do NOT skip cells
  // that are covered by existing modules — the modules paint ON TOP of this
  // overlay (see zIndex on the ghost layer below), which preserves the
  // consistent grid structure while still visually covering the cells.
  //
  // This is the Notion/Metabase/Retool feel: every cell is the same size,
  // columns line up, rows line up, gutters are identical everywhere. The
  // user sees the structure, not a punched-out irregular pattern.
  //
  // Active highlight is driven by a single source of truth — `activeDrag` —
  // which is updated for BOTH internal drags/resizes (via onDrag /
  // onResize) and external panel drags (via dropConfig.onDragOver). Each
  // cell in the drag footprint renders as its own 285 × 140 lavender+dashed
  // box with 16 px gutters between them, so the target area reads as part
  // of the repeated 4-column box grid rather than one stretched drop-zone
  // rectangle.
  if (showGrid) {
    for (let y = 0; y < totalGhostRows; y += GHOST_CELL_ROWS) {
      for (let x = 0; x < cols; x++) {
        const active = intersectsActiveDrag(x, y);
        ghostCells.push({
          key: `${x}-${y}`,
          left: x * (cellWidth + MARGIN[0]),
          top: y * (ROW_HEIGHT + MARGIN[1]),
          width: cellWidth,
          // Visible cell height — subtract the transparent BOTTOM_GAP_PX
          // (which lives as padding-bottom on each grid item) so the
          // ghost outlines align exactly with the painted footprint of
          // a 1-cell module rather than spilling into the gap.
          height: GHOST_CELL_ROWS * ROW_HEIGHT + (GHOST_CELL_ROWS - 1) * MARGIN[1] - BOTTOM_GAP_PX,
          active,
        });
      }
    }
  }

  // Canvas minimum height so ghost cells below the last module remain visible
  // during a drag. In view mode the grid dictates its own height.
  const canvasMinHeight = isEditMode
    ? totalGhostRows * ROW_HEIGHT + Math.max(0, totalGhostRows - 1) * MARGIN[1]
    : undefined;

  return (
    <div
      ref={gridContainerRef}
      className={`relative ${isEditMode ? 'edit-mode-canvas' : ''}`}
      style={canvasMinHeight ? { minHeight: canvasMinHeight } : undefined}
    >
      <style>{`
        /* Transparent 16 px gap between every two stacked items.
           We run RGL with marginY=0 so vertical spacing isn't tied to
           row-quantization — instead, every grid item carries its own
           padding-bottom and the painted card hugs the top portion.
           This is what allows a TEXT element (which hugs intrinsic
           content height in 2 px increments) to sit cleanly above a
           cell-quantized chart with an exact 16 px gap. Applies in
           both edit and view modes so the visual rhythm stays
           consistent across mode switches. */
        .react-grid-item {
          box-sizing: border-box;
          padding-bottom: 16px;
        }
        /* The library's placement indicator is intentionally invisible —
           we draw the target state ourselves on the ghost-cell overlay so
           each cell in the drag footprint renders as its own 285 × 140
           lavender + dashed box (preserving the repeated 4-column box
           structure). The placeholder still participates in position math,
           it just doesn't paint. */
        .edit-mode-canvas .react-grid-item.react-grid-placeholder {
          background: transparent !important;
          opacity: 0 !important;
          border: none !important;
          transition: none !important;
          pointer-events: none !important;
        }
        /* Custom resize handle — matches Figma's SE-corner grip pattern
           (Group 9 in frame 1168:213840). Two diagonal parallel lines
           in DARK/dark--tint_30 (#626165), rendered via a pair of
           linear-gradients on the ::after pseudo-element so we don't
           need to ship an SVG asset. The default react-resizable arrow
           pseudo-element is suppressed entirely.
           Hover-only: hidden in the default state, revealed while the
           module card is hovered or actively resizing. */
        .edit-mode-canvas .react-grid-item > .react-resizable-handle {
          opacity: 0;
          transition: opacity 120ms ease;
        }
        .edit-mode-canvas .react-grid-item:hover > .react-resizable-handle,
        .edit-mode-canvas .react-grid-item.resizing > .react-resizable-handle {
          opacity: 1;
        }
        .edit-mode-canvas .react-resizable-handle {
          width: 20px !important;
          height: 20px !important;
          padding: 0 !important;
          right: 2px !important;
          /* Each grid item carries 16 px of TRANSPARENT padding-bottom
             (the inter-module gap; see the .react-grid-item rule at
             the top of this stylesheet). RGL anchors the handle to the
             border-box bottom-right via "bottom: 2px", which would
             land it in the middle of that transparent gap — visibly
             outside the painted card. Push it up by BOTTOM_GAP_PX so
             the handle sits 2 px inside the card's bottom-right
             corner instead. Text elements override this further down
             via the :has(text-element-wrapper) rule, since their
             wrapper hugs intrinsic content height and the handle has
             to track the chrome bottom, not the painted card bottom. */
          bottom: 18px !important; /* 16 px gap + 2 px inset */
          background-image: none !important;
          border-radius: 0 0 8px 0 !important;
          cursor: nwse-resize;
        }
        /* Two diagonal grip lines — Figma 1397:411191 (Group 9). Per the
           design tokens each stroke is exactly 1 px thick, 14 px long,
           with a 2 px gap between them, painted in BRAND/dark (#201E24)
           and rotated −45°. We reproduce that via two stacked
           linear-gradients on the ::after pseudo:
             • gradient line of a 135° gradient on a 12 × 12 box has
               length 12√2 ≈ 16.97 px → 1 px ≈ 5.9 %, 2 px ≈ 11.8 %.
             • inner stroke at 67–73 % (≈1 px), gap 73–85 % (≈2 px),
               outer stroke at 85–91 % (≈1 px). Bottom-right biased so
               the pattern reads as a corner grip rather than a centered
               glyph.
           Color was previously #626165 (DARK/dark--tint_30) at 2 px
           strokes / 1 px gap — too heavy and the wrong shade. */
        .edit-mode-canvas .react-resizable-handle::after {
          content: '';
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 12px;
          height: 12px;
          background:
            linear-gradient(135deg, transparent 0 67%, #201E24 67% 73%, transparent 73% 100%),
            linear-gradient(135deg, transparent 0 85%, #201E24 85% 91%, transparent 91% 100%);
          border: none !important;
        }
        /* Ghost preview while dragging — module floats with a soft shadow. */
        .edit-mode-canvas .react-grid-item.react-draggable-dragging {
          transition: none !important;
          z-index: 10 !important;
          cursor: grabbing !important;
          box-shadow: 0 12px 32px rgba(32, 30, 36, 0.12), 0 2px 8px rgba(32, 30, 36, 0.08) !important;
        }
        /* While resizing, suppress transitions so the item tracks the cursor 1:1. */
        .edit-mode-canvas .react-grid-item.resizing {
          transition: none !important;
          z-index: 10 !important;
          opacity: 1 !important;
        }
        /* Smooth settle when items are being repositioned around a drag. */
        .react-grid-item.cssTransforms {
          transition: transform 150ms ease !important;
        }
        /* Kill the snap transition on the item actually being dragged. */
        .react-grid-item.react-draggable-dragging.cssTransforms {
          transition: none !important;
        }
        /* Module cards sit ABOVE the ghost-cell overlay (which is zIndex 0).
           Drag/resize states bump higher via rules above. */
        .edit-mode-canvas .react-grid-item {
          z-index: 1;
        }
        /* Text-element drag preview — Figma 1391:377936. RGL adds
           react-draggable-dragging to the grid item under the cursor.
           Outside that class the text wrapper relies on hover/focus
           state to paint chrome, but during a drag the cursor is
           latched on the drag handle so neither React event fires —
           we would otherwise see a chrome-less ghost dropping into
           the grid. Force the white fill + purple border + visible
           action buttons so the floating preview matches the design. */
        .edit-mode-canvas
          .react-grid-item.react-draggable-dragging
          .text-element-wrapper {
          background-color: #FFFFFF !important;
          border-color: #4D36FF !important;
        }
        .edit-mode-canvas
          .react-grid-item.react-draggable-dragging
          .text-element-wrapper
          .text-element-action {
          opacity: 1 !important;
        }
        /* Resize-grip alignment for text elements.
           The chrome wrapper hugs typed content, so its bottom edge
           sits ABOVE the grid cell bottom edge whenever the cell is
           taller than the wrapper (e.g. an empty single-line element
           is ~44 px chrome inside a 62 px min-row cell). RGL anchors
           the grip to the cell SE corner via right:2 / bottom:2, so
           it would float in the dead space below the chrome.
           TextElement writes the wrapper measured pixel height to the
           grid-item as --text-chrome-h. We use it here to flip the
           grip bottom anchor inside the chrome bottom edge with the
           same 2 px inset other modules use (see the base
           react-resizable-handle rule above), so the grip reads as
           "sitting inside" the chrome corner instead of overhanging
           it. The :has() ancestor selector restricts the override to
           grid items that actually contain a text element. */
        .edit-mode-canvas
          .react-grid-item:has(> .text-element-wrapper)
          > .react-resizable-handle {
          bottom: calc(100% - var(--text-chrome-h, 100%) + 2px) !important;
        }
      `}</style>
      {/* Background ghost-cell layer. Hidden by default; only mounts while the
          user is interacting (drag / resize / panel-drop). Active cells under
          the dragged item render in the lavender drop-zone state per
          Figma 1026:44875.
          `zIndex: 0` keeps the overlay BEHIND the module cards — modules
          paint on top, preserving the consistent grid structure while still
          visually covering the cells beneath them. */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ zIndex: 0 }}
        >
          {ghostCells.map((g) => (
            <div
              key={g.key}
              className="absolute rounded-[8px] transition-colors duration-75"
              style={{
                left: g.left,
                top: g.top,
                width: g.width,
                height: g.height,
                background: g.active ? '#EDEAFF' : '#F3F3F4',
                border: g.active ? '1.5px dashed #B4A3FF' : 'none',
              }}
            />
          ))}
        </div>
      )}
      <GridLayout
        layout={gridLayout}
        width={containerWidth}
        // Force a minimum height on the GridLayout's own container so it
        // remains a valid drop target on an empty canvas.  Without this,
        // `react-grid-layout` computes `containerHeight = bottom(layout)
        // * rowHeight + …`; with an empty layout `bottom([]) === 0`, so
        // the inline `height: 0px` collapses the drop-target div and
        // native drag/drop events never fire — the exact reason the
        // "Start from scratch" canvas refused to accept modules
        // dropped from the panel. Mirrors `canvasMinHeight` on the
        // outer wrapper so the drag-target area lines up with the
        // ghost-cell overlay we paint above the layout. View mode
        // skips this (canvasMinHeight === undefined) so the grid still
        // hugs its content height as before.
        style={canvasMinHeight ? { minHeight: canvasMinHeight } : undefined}
        // `verticalCompactor` — gravity behavior. Every time the layout
        // changes the library pulls items upward as far as they can go
        // without colliding. Matches the spec: "No vertical gaps allowed,
        // No empty space between modules, Layout should always be tight and
        // compact."
        compactor={verticalCompactor}
        gridConfig={{
          cols,
          rowHeight: ROW_HEIGHT,
          margin: MARGIN,
          containerPadding: CONTAINER_PADDING,
          maxRows: Infinity,
        }}
        dragConfig={{
          enabled: isEditMode,
          handle: '.drag-handle',
          bounded: false,
          threshold: 3,
        }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        resizeConfig={{
          enabled: isEditMode,
          handles: ['se'],
        }}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        // External drop: enabled whenever the user is dragging a module from
        // the Add-modules panel.
        dropConfig={{
          enabled: isEditMode && !!dragging,
          // Fallback size if the dragged definition is missing —
          // w=1 col × h=78 rows = 1 Figma cell (285 × 140 visible),
          // the smallest valid ghost-cell footprint.
          defaultItem: { w: 1, h: GHOST_CELL_ROWS },
          onDragOver: handlePanelDragOver,
        }}
        droppingItem={droppingItem}
        onDrop={handleDrop}
      >
        {modules.map((module) => {
          // Branch FIRST on elementKind — non-data canvas elements
          // (currently only text) carry a synthetic `definitionId`
          // (e.g. `element:text`) that won't resolve in MODULE_DEFINITIONS.
          // Looking it up before this check would drop the entry on the
          // floor.
          if (module.elementKind === 'text') {
            return (
              <div key={module.id}>
                <TextElement
                  module={module}
                  isEditMode={isEditMode}
                  onChange={(patch) => handleTextElementChange(module.id, patch)}
                  onDuplicate={() => handleDuplicate(module.id)}
                  onDelete={() => handleDelete(module.id)}
                />
              </div>
            );
          }
          if (module.elementKind === 'emoji') {
            return (
              <div key={module.id}>
                <EmojiElement
                  module={module}
                  isEditMode={isEditMode}
                  onChange={(patch) => handleEmojiElementChange(module.id, patch)}
                  onDuplicate={() => handleDuplicate(module.id)}
                  onDelete={() => handleDelete(module.id)}
                />
              </div>
            );
          }
          if (module.elementKind === 'divider') {
            return (
              <div key={module.id}>
                <DividerElement
                  module={module}
                  isEditMode={isEditMode}
                  onDuplicate={() => handleDuplicate(module.id)}
                  onDelete={() => handleDelete(module.id)}
                />
              </div>
            );
          }

          const definition = MODULE_DEFINITIONS.find((d) => d.id === module.definitionId);
          if (!definition) return null;

          // Visible card height. The grid item's outer height is
          // `h × ROW_HEIGHT`, but each item carries `BOTTOM_GAP_PX` of
          // transparent padding-bottom (see CSS), so the painted card
          // sits in the upper portion. Recharts/ResponsiveContainer
          // reads this `height` prop, so it must reflect the visible
          // area only — passing the full grid-item height would cause
          // charts to overshoot into the gap below.
          const pixelHeight = module.layout.h * ROW_HEIGHT - BOTTOM_GAP_PX;

          return (
            <div key={module.id}>
              <ModuleCard
                module={module}
                definition={definition}
                isEditMode={isEditMode}
                // Latched during a resize of THIS module so the card keeps
                // its hover chrome (border / shadow / handle / actions /
                // grip) even if the cursor slips outside the card bounds
                // as it grows or shrinks.
                isResizing={resizingId === module.id}
                onChartTypeChange={handleChartTypeChange}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                height={pixelHeight}
                selectedProfiles={selectedProfiles}
              />
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}
