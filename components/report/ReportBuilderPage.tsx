'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ReportModule, ModuleDefinition, TextStyle } from '@/types';
import { DEFAULT_MODULES } from '@/lib/default-layout';
import { ElementDefinition, ElementKind } from '@/lib/element-definitions';
import { INITIAL_SELECTED_IDS, profilesByIds } from '@/lib/profile-data';
import { ReportHeader } from './ReportHeader';
import { ProfileSelectionBar } from './ProfileSelectionBar';
import { ReportCanvas } from './ReportCanvas';
import { EmptyBoardCard } from './EmptyBoardCard';
import { AddModulePanel } from './AddModulePanel';

// Charts in lib/mock-data.ts declare `defaultH` in OLD-units (multiples
// of 6 = Figma cells), kept that way so the catalog stays human-readable.
// ReportCanvas runs the grid with rowHeight=2 / marginY=0 + a transparent
// 16 px padding-bottom on each grid item, where 1 cell = 78 grid rows.
// We multiply chart heights by 13 (= 78 / 6) at every place a chart
// module is materialized so the catalog values translate correctly.
// Mirrors `CHART_H_FACTOR` in ReportCanvas — keep these in sync.
const CHART_H_FACTOR = 13;
/** Minimum chart height = 1 Figma cell, in NEW grid-row units. */
const CHART_MIN_H = 78;
import { cn, uid } from '@/lib/utils';
import { IconPlus, IconModules, IconSettings } from '@/components/icons/FigmaIcons';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

function LeftSidebar({
  isEditMode,
  isPanelOpen,
  onTogglePanel,
}: {
  isEditMode: boolean;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
}) {
  if (!isEditMode) return null;

  // Figma "Panel position" frame (1139:172886): sidebar is positioned at
  // x=24, y=124 relative to the viewport — i.e. flush with the page's 24px
  // horizontal gutter and 8px below the profile bar. The flex parent in
  // ReportBuilderPage now carries `gap-2 px-6 py-2`, so the sidebar only
  // needs `self-start` (don't stretch vertically) and no per-element
  // margin.
  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-4 p-[6px] bg-white border border-[#E8E8E9] rounded-[8px] self-start">
      {/* Sidebar buttons — Figma icon-library convention: 40×40 button with a
          20×20 icon tile. Active state uses BRAND purple on BRAND/purple--tint_90
          (#EDE9FF); inactive uses DARK/dark--tint_20 (#4C4B4F).

          Tooltips: each icon has no inline label, so we surface the
          purpose via the `Tooltip` primitive (TooltipProvider lives in
          app/layout.tsx). Anchored to the `right` side of each trigger
          since the sidebar hugs the left gutter — a top-aligned tooltip
          would clip against the profile bar above. */}
      {/* Add / open panel button. Figma 1139:172888 — active bg is
          PRIMARY/primary--tint_90 (#EDEAFF), icon BRAND/primary (#4D36FF);
          inactive has no background (transparent) with DARK/dark--tint_20
          icon. Hover on inactive uses DARK/dark--tint_90 (#F3F3F4). */}
      <Tooltip>
        <TooltipTrigger
          onClick={onTogglePanel}
          aria-label="Add modules"
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-[4px] transition-colors',
            isPanelOpen ? 'bg-[#EDEAFF]' : 'bg-transparent hover:bg-[#F3F3F4]'
          )}
        >
          <IconPlus size={20} color={isPanelOpen ? '#4D36FF' : '#4C4B4F'} />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>Add modules</TooltipContent>
      </Tooltip>

      {/* Modules / layout icon */}
      <Tooltip>
        <TooltipTrigger
          aria-label="Modules"
          className="w-10 h-10 flex items-center justify-center rounded-[4px] bg-transparent text-[#4C4B4F] hover:bg-[#F3F3F4] transition-colors"
        >
          <IconModules size={20} color="#4C4B4F" />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>Modules</TooltipContent>
      </Tooltip>

      {/* Settings */}
      <Tooltip>
        <TooltipTrigger
          aria-label="Report settings"
          className="w-10 h-10 flex items-center justify-center rounded-[4px] bg-transparent text-[#4C4B4F] hover:bg-[#F3F3F4] transition-colors"
        >
          <IconSettings size={20} color="#4C4B4F" />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>Report settings</TooltipContent>
      </Tooltip>
    </div>
  );
}

interface ReportBuilderPageProps {
  /** Initial title — defaults to a sensible placeholder. */
  initialTitle?: string;
  /** Initial module set — defaults to the canonical DEFAULT_MODULES. */
  initialModules?: ReportModule[];
  /** Initial selected profile ids — defaults to INITIAL_SELECTED_IDS.
   *  Threaded in so opening a saved report restores its profile picker
   *  selection without resetting to the global default. */
  initialProfileIds?: ReadonlyArray<string>;
  /** Close (back) handler — invoked when the user clicks the header's
   *  close icon. Surfaces the route change to the parent. Optional so
   *  the component remains usable in isolation. */
  onBack?: () => void;
  /** Save handler — invoked when the user clicks the header's Save
   *  button while editing. Receives the latest snapshot so the parent
   *  can persist it back into the reports list. Optional. */
  onSave?: (snapshot: { title: string; modules: ReportModule[]; selectedProfileIds: string[] }) => void;
}

export function ReportBuilderPage({
  initialTitle,
  initialModules,
  initialProfileIds,
  onBack,
  onSave: onSaveProp,
}: ReportBuilderPageProps = {}) {
  const startingModules = initialModules ?? DEFAULT_MODULES;
  const [modules, setModules] = useState<ReportModule[]>(startingModules);
  const [savedModules, setSavedModules] = useState<ReportModule[]>(startingModules);
  // Empty initial modules ⇒ "Start from scratch" — drop the user
  // straight into edit mode so the empty-board card and the Add-modules
  // panel are reachable without an extra click.  Reports that arrive
  // with content (template-seeded or saved) keep the existing
  // read-only-on-open behavior.
  const [isEditMode, setIsEditMode] = useState(
    (initialModules?.length ?? -1) === 0,
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle ?? 'TikTok Monthly Report');
  const [containerWidth, setContainerWidth] = useState(900);
  // Viewport width — drives the panel width breakpoint. Tracked via a
  // window resize listener (not a ResizeObserver on the app root) so we
  // get the actual window dimension regardless of any stretched
  // flex-child re-measurement cascade.
  //
  // Breakpoints (panel width):
  //   • viewport ≥ 1280 px → 375 px (canonical desktop)
  //   • viewport ≥  900 px → 320 px (small laptop — tighter list rows)
  //   • viewport <  900 px → 280 px (min — panel stays usable, canvas
  //                                   gets max room to reflow into 2/1 cols)
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const panelWidth = viewportWidth >= 1280 ? 375 : viewportWidth >= 900 ? 320 : 280;
  // `compact` toggles the panel's tighter layout below 1280 px —
  // shorter list rows, tighter network-tile padding.
  const panelCompact = viewportWidth < 1280;
  // Global profile selection — owned here so that both the profile bar
  // (picker UI) and the canvas (Module Networks indicators inside each
  // chart's legend row) read from the same source of truth. See
  // `lib/profile-data.ts` for the catalogue.
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    () => new Set(initialProfileIds ?? INITIAL_SELECTED_IDS),
  );
  const selectedProfiles = useMemo(
    () => profilesByIds(selectedProfileIds),
    [selectedProfileIds],
  );
  // Tracks the ModuleDefinition the user is currently dragging from the
  // Add-modules panel. While set, ReportCanvas enables its drop target and
  // renders a placeholder sized to this definition's default w/h.
  const [draggingDefinition, setDraggingDefinition] = useState<ModuleDefinition | null>(null);
  // Mirrors `draggingDefinition` for the Elements tab — Text / Heading 1 /
  // Heading 2 etc. carry no chart/data binding so they need a separate
  // drag-state slot. The two are mutually exclusive in practice (the panel
  // only ever drags one row at a time).
  const [draggingElement, setDraggingElement] = useState<ElementDefinition | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  // While the Add-modules panel is mid-slide, the canvas (flex-1) is
  // resizing every frame, the ResizeObserver fires every frame, and
  // ReportCanvas re-renders all modules + recomputes the grid every
  // frame. With 13 modules that's enough work per frame to drop the
  // animation. Solution: gate ResizeObserver updates with a ref the
  // panel toggle flips on, and re-measure once on transitionend.
  const suspendCanvasResizeRef = useRef(false);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (suspendCanvasResizeRef.current) return;
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  const handleEdit = useCallback(() => {
    setSavedModules(modules);
    setIsEditMode(true);
  }, [modules]);

  const handleSave = useCallback(() => {
    setSavedModules(modules);
    setIsEditMode(false);
    setIsPanelOpen(false);
    onSaveProp?.({
      title,
      modules,
      selectedProfileIds: Array.from(selectedProfileIds),
    });
  }, [modules, onSaveProp, title, selectedProfileIds]);

  const handleCancel = useCallback(() => {
    setModules(savedModules);
    setIsEditMode(false);
    setIsPanelOpen(false);
  }, [savedModules]);

  const handleAddModule = useCallback((definition: ModuleDefinition) => {
    const maxY = modules.reduce((max, m) => Math.max(max, m.layout.y + m.layout.h), 0);
    // uid() — see lib/utils.ts for why Date.now() alone isn't enough.
    const newId = `mod-${definition.id}-${uid()}`;
    const newModule: ReportModule = {
      id: newId,
      definitionId: definition.id,
      chartType: definition.defaultChartType,
      layout: {
        i: newId,
        x: 0,
        y: maxY,
        w: Math.min(definition.defaultW, 4),
        // OLD→NEW units: see CHART_H_FACTOR comment at top of file.
        h: definition.defaultH * CHART_H_FACTOR,
        minW: 1,
        minH: CHART_MIN_H,
      },
    };
    setModules((prev) => [...prev, newModule]);
  }, [modules]);

  // Drop from Add-modules panel → canvas. The grid tells us which grid cell
  // the user released over; we insert the new module at that x/y using the
  // definition's default dimensions. The grid's vertical compactor will
  // shift siblings out of the way.
  const handleDropModuleAt = useCallback(
    (definition: ModuleDefinition, x: number, y: number) => {
      const newId = `mod-${definition.id}-${uid()}`;
      const w = Math.min(definition.defaultW, 4);
      // Clamp so a drop near the right edge doesn't produce an out-of-bounds
      // x + w combination.
      const clampedX = Math.max(0, Math.min(x, 4 - w));
      const newModule: ReportModule = {
        id: newId,
        definitionId: definition.id,
        chartType: definition.defaultChartType,
        layout: {
          i: newId,
          x: clampedX,
          y: Math.max(0, y),
          w,
          // OLD→NEW units: see CHART_H_FACTOR comment at top of file.
          h: definition.defaultH * CHART_H_FACTOR,
          minW: 1,
          // 1 Figma cell (140 px visible) = 78 grid rows under
          // ReportCanvas's rowHeight=2 / 16 px transparent bottom-gap.
          minH: CHART_MIN_H,
        },
      };
      setModules((prev) => [...prev, newModule]);
      setDraggingDefinition(null);
    },
    [],
  );

  const handleDragStartModule = useCallback((def: ModuleDefinition) => {
    setDraggingDefinition(def);
  }, []);

  const handleDragEndModule = useCallback(() => {
    setDraggingDefinition(null);
  }, []);

  // Map an ElementKind onto the TextStyle the rendered element should
  // start with. The Elements tab exposes Text / Heading 1 / Heading 2 as
  // three separate rows, but they all render via the same `TextElement`
  // component — only the initial `textStyle` differs. Returns null for
  // element kinds that aren't text-shaped (divider/emoji/image/file/link),
  // which currently no-op pending their own renderers.
  const elementKindToInitialTextStyle = (kind: ElementKind): TextStyle | null => {
    if (kind === 'text') return 'text';
    if (kind === 'heading-1') return 'heading-1';
    if (kind === 'heading-2') return 'heading-2';
    return null;
  };

  // Build a fresh ReportModule for a text-shaped element. `definitionId`
  // gets a synthetic `element:<kind>` value so the canvas's modules map can
  // stay keyed by `id` without needing a placeholder entry in
  // MODULE_DEFINITIONS — the canvas branches on `elementKind` before
  // looking the definition up.
  const buildTextElementModule = useCallback(
    (def: ElementDefinition, textStyle: TextStyle, x: number, y: number): ReportModule => {
      const newId = `el-${def.id}-${uid()}`;
      return {
        id: newId,
        definitionId: `element:${def.id}`,
        chartType: 'text',
        elementKind: 'text',
        html: '',
        textStyle,
        layout: {
          i: newId,
          x,
          y,
          w: Math.min(def.defaultW, 4),
          h: def.defaultH,
          minW: def.minW,
          minH: def.minH,
        },
      };
    },
    [],
  );

  // Build a fresh ReportModule for the standalone Emoji element.  Same
  // synthetic `element:emoji` definitionId convention as text-shaped
  // elements, plus an empty `emoji` field — the canvas renderer
  // auto-opens the picker on mount whenever this is empty so the user
  // chooses immediately after the drop.
  const buildEmojiElementModule = useCallback(
    (def: ElementDefinition, x: number, y: number): ReportModule => {
      const newId = `el-${def.id}-${uid()}`;
      return {
        id: newId,
        definitionId: `element:${def.id}`,
        chartType: 'text',
        elementKind: 'emoji',
        emoji: '',
        layout: {
          i: newId,
          x,
          y,
          w: Math.min(def.defaultW, 4),
          h: def.defaultH,
          minW: def.minW,
          minH: def.minH,
        },
      };
    },
    [],
  );

  const handleAddElement = useCallback(
    (def: ElementDefinition) => {
      // Emoji is its own renderer.  Branch first so it doesn't fall
      // into the text-style mapper (which returns null for it and would
      // otherwise no-op the click).
      if (def.id === 'emoji') {
        setModules((prev) => {
          const maxY = prev.reduce((max, m) => Math.max(max, m.layout.y + m.layout.h), 0);
          return [...prev, buildEmojiElementModule(def, 0, maxY)];
        });
        return;
      }
      const textStyle = elementKindToInitialTextStyle(def.id);
      if (!textStyle) {
        // Non-renderer element kinds (divider / image / file / link)
        // don't yet have a canvas renderer — clicks fall through to a
        // no-op until their dedicated components ship.
        return;
      }
      setModules((prev) => {
        const maxY = prev.reduce((max, m) => Math.max(max, m.layout.y + m.layout.h), 0);
        return [...prev, buildTextElementModule(def, textStyle, 0, maxY)];
      });
    },
    [buildTextElementModule, buildEmojiElementModule],
  );

  const handleDropElementAt = useCallback(
    (def: ElementDefinition, x: number, y: number) => {
      const w = Math.min(def.defaultW, 4);
      const clampedX = Math.max(0, Math.min(x, 4 - w));
      const clampedY = Math.max(0, y);
      if (def.id === 'emoji') {
        setModules((prev) => [
          ...prev,
          buildEmojiElementModule(def, clampedX, clampedY),
        ]);
        setDraggingElement(null);
        return;
      }
      const textStyle = elementKindToInitialTextStyle(def.id);
      if (!textStyle) {
        setDraggingElement(null);
        return;
      }
      setModules((prev) => [
        ...prev,
        buildTextElementModule(def, textStyle, clampedX, clampedY),
      ]);
      setDraggingElement(null);
    },
    [buildTextElementModule, buildEmojiElementModule],
  );

  const handleDragStartElement = useCallback((def: ElementDefinition) => {
    setDraggingElement(def);
  }, []);

  const handleDragEndElement = useCallback(() => {
    setDraggingElement(null);
  }, []);

  // Suspend canvas resize observer for the duration of the slide — see
  // comment on `suspendCanvasResizeRef`. Cleared in the wrapper's
  // onTransitionEnd handler below, where we also commit one final
  // width measurement so the canvas grid catches up to the new size.
  // Wraps EVERY caller that flips `isPanelOpen` (sidebar toggle, the
  // panel's own close X, edit-mode exit) so the canvas stays frozen
  // during every slide direction, not just sidebar-driven opens.
  const setPanelOpenAnimated = useCallback((next: boolean) => {
    setIsPanelOpen((prev) => {
      if (prev === next) return prev;
      suspendCanvasResizeRef.current = true;
      return next;
    });
  }, []);

  const handleTogglePanel = useCallback(() => {
    setIsPanelOpen((prev) => {
      suspendCanvasResizeRef.current = true;
      return !prev;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#F3F3F4] overflow-hidden">
      {/* Header */}
      <ReportHeader
        title={title}
        isEditMode={isEditMode}
        onEdit={handleEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        onTitleChange={setTitle}
        onClose={onBack}
      />

      {/* Profile bar — controlled by the selection state owned in this
          component so modules (e.g. audience-growth's legend-row
          ModuleNetworks indicator) can read from the same source of
          truth as the picker. */}
      <ProfileSelectionBar
        isEditMode={isEditMode}
        selectedIds={selectedProfileIds}
        onSelectedIdsChange={setSelectedProfileIds}
      />

      {/* Main area — Figma "Panel position" frame (1139:172886).
          Horizontal layout at 1728-wide viewport:
            24 px ← gutter  | 52 px sidebar | 8 px gap |
            375 px panel    | 8 px gap      | 1237 px canvas | 24 px gutter →
          Vertical: 8 px top margin (below 52 px profile bar), 8 px bottom.
          We carry all the gutters/gaps on the flex parent via `gap-2 px-6
          py-2`, so every child only needs to declare its own width and
          whether it vertically stretches.
          Order matters: sidebar FIRST, then panel, then canvas — the panel
          is not flush against the viewport edge, it floats between the
          sidebar and the canvas. */}
      <div className="flex flex-1 min-h-0 gap-2 px-6 py-2 bg-[#F3F3F4]">
        {/* Left sidebar (self-start so it doesn't stretch to panel/canvas
            height). */}
        <LeftSidebar
          isEditMode={isEditMode}
          isPanelOpen={isPanelOpen}
          onTogglePanel={handleTogglePanel}
        />

        {/* Add modules panel — floating card, rounded on all four corners
            per Figma 1139:172912. Width is responsive (see `panelWidth`
            computed above): 375 on full desktop, 320 on small laptop,
            280 below — giving the canvas more room to reflow into fewer
            grid columns on narrower viewports. `compact` toggles the
            panel's tighter list-row padding below 1280 px.

            Animation:
              • We transition ONLY `width` (not `transition-all`) so the
                border/bg/rounded chrome doesn't snap on/off mid-slide.
              • The card chrome is rendered the whole time edit mode is
                active — we just render it with width: 0 when closed,
                which makes it invisible without a layout-shifting
                mount/unmount.
              • AddModulePanel stays mounted across open/close toggles
                while in edit mode. Otherwise the content would blink out
                the instant the user clicked close, leaving an empty
                wrapper to animate down to zero (the old "snap-then-
                shrink" feel).
              • `cubic-bezier(0.32, 0.72, 0, 1)` is a soft-out curve —
                accelerates in, decelerates more gently than ease-in-out,
                which reads as "physical" rather than mechanical for
                drawer-style slides. */}
        <div
          className={cn(
            'flex-shrink-0 overflow-hidden transition-[width] duration-300',
            'ease-[cubic-bezier(0.32,0.72,0,1)]',
            isEditMode && isPanelOpen && 'bg-white border border-[#E8E8E9] rounded-[8px]',
          )}
          style={{ width: isEditMode && isPanelOpen ? panelWidth : 0 }}
          onTransitionEnd={(e) => {
            // Only react to OUR width transition (not nested transitions
            // bubbling up from AddModulePanel chrome).
            if (e.target !== e.currentTarget || e.propertyName !== 'width') return;
            suspendCanvasResizeRef.current = false;
            if (canvasRef.current) {
              setContainerWidth(canvasRef.current.getBoundingClientRect().width);
            }
          }}
        >
          {isEditMode && (
            <div className="h-full" style={{ width: panelWidth }}>
              <AddModulePanel
                onAdd={handleAddModule}
                onAddElement={handleAddElement}
                onClose={() => setPanelOpenAnimated(false)}
                onDragStartModule={handleDragStartModule}
                onDragEndModule={handleDragEndModule}
                onDragStartElement={handleDragStartElement}
                onDragEndElement={handleDragEndElement}
                compact={panelCompact}
              />
            </div>
          )}
        </div>

        {/* Canvas — floating card, fills remaining horizontal + stretches
            vertically. The scroll container IS the card (overflow-y-auto
            directly on the rounded/bordered wrapper) so the scrollbar
            lives inside the card outline. */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-white border border-[#E8E8E9] rounded-[8px]">
          {/* `relative` here so the empty-board overlay can pin to
              this scroll viewport via `absolute inset-0`.
              Height rules:
                • Empty state — `h-full` only, so the wrapper matches
                  the canvas-card's height EXACTLY.  Skipping the 900 px
                  floor here is what keeps the canvas-card from
                  overflowing on viewports where the visible area is
                  shorter than 900 px; that overflow triggers a vertical
                  scrollbar which on some systems reserves space on the
                  right and visually shifts the empty-board card off
                  horizontal center.
                • Populated state — `min-h-[900px] h-full`.  Keeps the
                  drag-ghost cell band reachable below the last module
                  in edit mode (the existing behavior); `h-full` lets
                  the wrapper grow on tall viewports so the grid sits
                  in a fully-painted canvas. */}
          <div
            className={
              modules.length === 0
                ? 'p-6 h-full relative'
                : 'p-6 min-h-[900px] h-full relative'
            }
          >
            <div ref={canvasRef} className="w-full">
              <ReportCanvas
                modules={modules}
                isEditMode={isEditMode}
                onModulesChange={setModules}
                onAddModule={handleTogglePanel}
                containerWidth={containerWidth}
                draggingDefinition={draggingDefinition}
                draggingElement={draggingElement}
                onDropModuleAt={handleDropModuleAt}
                onDropElementAt={handleDropElementAt}
                selectedProfiles={selectedProfiles}
              />
            </div>
            {/* Empty-state card — Figma 1392:383980.  Surfaces only
                in the "fresh canvas, panel still closed" state — i.e.
                the user just landed from "Start from scratch" and
                hasn't yet engaged the Add-modules panel.  Once the
                panel opens (the card's CTA does that, or the sidebar
                toggle), the panel itself becomes the action surface
                and the empty card retires; otherwise the user sees
                two competing prompts asking them to add a module.
                Conditions:
                  • `isEditMode`         — never on a saved view-mode report
                  • `modules.length === 0` — only while the canvas is empty
                  • `!isPanelOpen`       — panel-open hides the card so the
                                           Add-modules panel takes the focus
                Other notes:
                  • `pointer-events-none` on the overlay so the empty
                    grid underneath stays a valid drop target during
                    drag-drop from the panel; the card itself
                    re-enables pointer events so the button is
                    clickable.
                  • `z-10` keeps the overlay above any future stacking
                    context introduced inside ReportCanvas (RGL ghost
                    cells, drop placeholders, etc.) so the card never
                    gets visually buried. */}
            {isEditMode && modules.length === 0 && !isPanelOpen && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto">
                  <EmptyBoardCard onAddFirstModule={handleTogglePanel} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
