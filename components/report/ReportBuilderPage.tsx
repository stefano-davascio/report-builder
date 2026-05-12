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
import { GlobalDataWarningBanner } from './GlobalDataWarningBanner';
import { deriveGlobalCase2Profiles } from '@/lib/profile-status';
import { MODULE_DEFINITIONS } from '@/lib/mock-data';

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
import {
  IconPlus,
  IconModules,
  IconSettings,
  IconStackPlus,
  IconElements,
} from '@/components/icons/FigmaIcons';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { SidebarMode, CanvasMode } from '@/lib/scenario';

/**
 * Which panel surface is currently visible in the report builder.
 *   • 'modules'  — the Network / Visual-type / (combined-only) Elements
 *                  flow.  Always reachable; in split mode this is what
 *                  the StackPlus icon opens.
 *   • 'elements' — the Elements list only (no tabs / filters).  Only
 *                  surfaces in split mode; the Elements rail icon
 *                  opens it as its own panel.  In combined mode this
 *                  value collapses to 'modules' (with the Elements
 *                  tab pre-selected inside) because there's no
 *                  standalone elements panel.
 */
type PanelKind = 'modules' | 'elements';

function LeftSidebar({
  isEditMode,
  activePanel,
  onTogglePanel,
  sidebarMode,
}: {
  isEditMode: boolean;
  activePanel: PanelKind | null;
  /** Toggle a specific panel.  Clicking the rail icon for the
   *  currently-active panel closes it; clicking a different icon
   *  switches to that panel. */
  onTogglePanel: (kind: PanelKind) => void;
  sidebarMode: SidebarMode;
}) {
  if (!isEditMode) return null;

  // Figma "Panel position" frame (1139:172886): sidebar is positioned at
  // x=24, y=124 relative to the viewport — i.e. flush with the page's 24px
  // horizontal gutter and 8px below the profile bar. The flex parent in
  // ReportBuilderPage now carries `gap-2 px-6 py-2`, so the sidebar only
  // needs `self-start` (don't stretch vertically) and no per-element
  // margin.

  // Split mode (Figma 1844:78434) — two stacked nav cells above a
  // hairline divider, with the Settings cog as a secondary action
  // below.  The two nav cells are 40×40 squares (rounded-[4px]) with
  // an active fill of `#EDEAFF` and brand-purple icon stroke; the
  // bottom Settings is a 40×40 round button (rounded-full).
  if (sidebarMode === 'split') {
    const isModulesActive = activePanel === 'modules';
    const isElementsActive = activePanel === 'elements';
    return (
      <div className="flex-shrink-0 flex flex-col items-center p-[4px] bg-white border border-[#E8E8E9] rounded-[8px] self-start">
        <div className="flex flex-col gap-[8px] items-start w-[40px]">
          {/* Data modules — StackPlus glyph, brand-purple stroke. */}
          <Tooltip>
            <TooltipTrigger
              onClick={() => onTogglePanel('modules')}
              aria-label="Data modules"
              aria-pressed={isModulesActive}
              className={cn(
                'w-10 h-10 flex items-center justify-center rounded-[4px] transition-colors',
                isModulesActive ? 'bg-[#EDEAFF]' : 'bg-transparent hover:bg-[#F3F3F4]',
              )}
            >
              <IconStackPlus
                size={20}
                color={isModulesActive ? '#4D36FF' : '#4C4B4F'}
              />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Data modules</TooltipContent>
          </Tooltip>

          {/* Elements — filled-path glyph (NOT stroked). */}
          <Tooltip>
            <TooltipTrigger
              onClick={() => onTogglePanel('elements')}
              aria-label="Elements"
              aria-pressed={isElementsActive}
              className={cn(
                'w-10 h-10 flex items-center justify-center rounded-[4px] transition-colors',
                isElementsActive ? 'bg-[#EDEAFF]' : 'bg-transparent hover:bg-[#F3F3F4]',
              )}
            >
              <IconElements
                size={20}
                color={isElementsActive ? '#4D36FF' : '#201E24'}
              />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Elements</TooltipContent>
          </Tooltip>

          {/* Hairline divider — Figma `Line 13`, full rail width. */}
          <div className="h-px w-full bg-[#E8E8E9]" aria-hidden="true" />

          {/* Modules — round 40×40 (rounded-[90px]) bars glyph.  Sits
              between the divider and Settings as a secondary action,
              same chrome as Settings so the two read as a paired
              cluster of tertiary tools.  Stub for now (the panel
              hosts the modules list above; this is decorative chrome
              for parity with combined mode). */}
          <Tooltip>
            <TooltipTrigger
              aria-label="Modules"
              className="w-10 h-10 flex items-center justify-center rounded-[90px] bg-transparent text-[#4C4B4F] hover:bg-[#F3F3F4] transition-colors"
            >
              <IconModules size={20} color="#4C4B4F" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Modules</TooltipContent>
          </Tooltip>

          {/* Settings — round 40×40 (rounded-[90px] per Figma) so it
              reads as a secondary tertiary action distinct from the
              squared nav cells above. */}
          <Tooltip>
            <TooltipTrigger
              aria-label="Report settings"
              className="w-10 h-10 flex items-center justify-center rounded-[90px] bg-transparent text-[#4C4B4F] hover:bg-[#F3F3F4] transition-colors"
            >
              <IconSettings size={20} color="#4C4B4F" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Report settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  // Combined mode — existing 3-icon rail (Plus + Modules + Settings).
  // Plus is the panel toggle; Modules is decorative for now (the panel
  // hosts the modules list); Settings is a stub.
  const isPanelOpen = activePanel !== null;
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
          onClick={() => onTogglePanel('modules')}
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
  /** Sidebar architecture — flips between the existing combined rail
   *  (single panel with Network/Visual/Elements as tabs) and the new
   *  split rail (Data modules + Elements as separate panels).  Driven
   *  by the Scenario Switcher; defaults to 'combined' so first-visit
   *  / non-scenario users see the production layout. */
  sidebarMode?: SidebarMode;
  /** Canvas treatment — design-comparison toggle from the Scenario
   *  Switcher.  `'white'` keeps the existing white-card chrome;
   *  `'grey'` strips the card + its 24 px inset so modules sit
   *  directly on the page's `#F3F3F4` background.  Defaults to
   *  `'white'` for production parity. */
  canvasMode?: CanvasMode;
}

export function ReportBuilderPage({
  initialTitle,
  initialModules,
  initialProfileIds,
  onBack,
  onSave: onSaveProp,
  sidebarMode = 'combined',
  canvasMode = 'white',
}: ReportBuilderPageProps = {}) {
  // Normalize divider modules at construction time.  Earlier dividers
  // shipped with `h: 30` (the old default) which left ~35 px of dead
  // space below the rule before the next module.  We now lock divider
  // h / minH / maxH to 21 (chrome height + BOTTOM_GAP_PX), so any
  // legacy divider with an oversized stored h gets clamped down on
  // first render — both new + saved reports converge on the tight
  // layout without requiring the user to re-drop or resize.
  const startingModules = (initialModules ?? DEFAULT_MODULES).map((m) => {
    if (m.elementKind !== 'divider') return m;
    const targetH = 21;
    if (
      m.layout.h === targetH &&
      m.layout.minH === targetH &&
      m.layout.maxH === targetH
    ) {
      return m;
    }
    return {
      ...m,
      layout: {
        ...m.layout,
        h: targetH,
        minH: targetH,
        maxH: targetH,
      },
    };
  });
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
  // Which panel surface is open right now (or `null` for closed).  In
  // combined mode this only ever takes 'modules' because Elements
  // lives inside that panel as a tab; in split mode it can be
  // 'modules' OR 'elements' depending on which rail icon was clicked.
  const [activePanel, setActivePanel] = useState<PanelKind | null>(null);
  // Backwards-compat boolean — most existing call sites only care
  // whether ANY panel is open (e.g. canvas resize gating, empty-state
  // visibility), not which one.  Derive once and reuse.
  const isPanelOpen = activePanel !== null;
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
  // Network binding for the in-flight drag — captured at dragStart from the
  // panel's active filter tab. Stored separately from `draggingDefinition`
  // because ReportCanvas's onDropModuleAt callback signature is
  // `(def, x, y)` (no network arg); we read it back from state in the drop
  // handler. Defaults to `'cross-network'` while idle.
  const [draggingNetwork, setDraggingNetwork] = useState<
    import('@/types').Platform | 'cross-network'
  >('cross-network');
  // Mirrors `draggingDefinition` for the Elements tab — Text / Heading 1 /
  // Heading 2 etc. carry no chart/data binding so they need a separate
  // drag-state slot. The two are mutually exclusive in practice (the panel
  // only ever drags one row at a time).
  const [draggingElement, setDraggingElement] = useState<ElementDefinition | null>(null);

  // ─── Global data-warning banner state ─────────────────────────────
  //
  // `bannerDismissed` is session-only — `useState` (not localStorage)
  // so a page reload re-evaluates whether the banner should appear.
  // `selectProfilesOpenTrigger` is a numeric counter; bumping it on
  // the banner's "Fix in Select profiles →" click forces
  // `ProfileSelectionBar` to imperatively open its picker dropdown
  // (see the `openTrigger` prop on that component).  Numeric so two
  // consecutive clicks both fire even if the dropdown is already
  // open.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectProfilesOpenTrigger, setSelectProfilesOpenTrigger] = useState(0);

  // Pre-compute a definitions-by-id map once so the warning derivation
  // doesn't linear-scan MODULE_DEFINITIONS for every module on every
  // render.  Module catalog is static, hence the empty dep array.
  const definitionsById = useMemo(
    () => new Map(MODULE_DEFINITIONS.map((d) => [d.id, d])),
    [],
  );

  // Distinct union of Case-2 profiles affecting any visible module.
  // Memoized on the same deps the helper actually reads — module
  // structure, definition map, and the user's current selection.  An
  // empty array means there's nothing to warn about, and the global
  // banner skips its render.
  const affectedCase2Profiles = useMemo(
    () => deriveGlobalCase2Profiles(modules, definitionsById, selectedProfiles),
    [modules, definitionsById, selectedProfiles],
  );

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
    setActivePanel(null);
    onSaveProp?.({
      title,
      modules,
      selectedProfileIds: Array.from(selectedProfileIds),
    });
  }, [modules, onSaveProp, title, selectedProfileIds]);

  const handleCancel = useCallback(() => {
    setModules(savedModules);
    setIsEditMode(false);
    setActivePanel(null);
  }, [savedModules]);

  const handleAddModule = useCallback((
    definition: ModuleDefinition,
    network: import('@/types').Platform | 'cross-network' = 'cross-network',
  ) => {
    const maxY = modules.reduce((max, m) => Math.max(max, m.layout.y + m.layout.h), 0);
    // uid() — see lib/utils.ts for why Date.now() alone isn't enough.
    const newId = `mod-${definition.id}-${uid()}`;
    const newModule: ReportModule = {
      id: newId,
      definitionId: definition.id,
      chartType: definition.defaultChartType,
      // `network` mirrors the panel's active filter tab at click time
      // (see AddModulePanel.ModuleNetworkBinding). Carried on the module
      // so ModuleCard can filter the user's profiles down to the right
      // platform and surface the "Select a matching profile" empty state
      // when none of them match.
      network,
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
        // Stamp the in-flight drag's network binding onto the new module.
        // `draggingNetwork` was set in handleDragStartModule from the
        // panel's active filter tab — by the time the drop lands it
        // still holds the right value (handleDragEndModule fires AFTER
        // this callback when the drop succeeds).
        network: draggingNetwork,
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
    [draggingNetwork],
  );

  const handleDragStartModule = useCallback((
    def: ModuleDefinition,
    network: import('@/types').Platform | 'cross-network' = 'cross-network',
  ) => {
    setDraggingDefinition(def);
    setDraggingNetwork(network);
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

  // Build a fresh ReportModule for the standalone Divider element.
  // No `html` / `emoji` / `textStyle` — the renderer is purely visual,
  // so the only meaningful module fields are id + layout.
  //
  // h / minH / maxH are all locked to `def.defaultH` so the cell can't
  // be vertically resized.  The divider's chrome is fixed at 25 px,
  // and any extra cell height would just leave dead space below the
  // rule (visibly enlarging the gap to the next module — not the
  // user's intent when they grab the resize grip).  Width still
  // resizes freely (1..4 columns) since the rule's span IS meaningful.
  const buildDividerElementModule = useCallback(
    (def: ElementDefinition, x: number, y: number): ReportModule => {
      const newId = `el-${def.id}-${uid()}`;
      return {
        id: newId,
        definitionId: `element:${def.id}`,
        chartType: 'text',
        elementKind: 'divider',
        layout: {
          i: newId,
          x,
          y,
          w: Math.min(def.defaultW, 4),
          h: def.defaultH,
          minW: def.minW,
          minH: def.defaultH,
          maxH: def.defaultH,
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
      // Divider is also its own renderer — non-text, non-data.
      if (def.id === 'divider') {
        setModules((prev) => {
          const maxY = prev.reduce((max, m) => Math.max(max, m.layout.y + m.layout.h), 0);
          return [...prev, buildDividerElementModule(def, 0, maxY)];
        });
        return;
      }
      const textStyle = elementKindToInitialTextStyle(def.id);
      if (!textStyle) {
        // Non-renderer element kinds (image / file / link) don't yet
        // have a canvas renderer — clicks fall through to a no-op
        // until their dedicated components ship.
        return;
      }
      setModules((prev) => {
        const maxY = prev.reduce((max, m) => Math.max(max, m.layout.y + m.layout.h), 0);
        return [...prev, buildTextElementModule(def, textStyle, 0, maxY)];
      });
    },
    [buildTextElementModule, buildEmojiElementModule, buildDividerElementModule],
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
      if (def.id === 'divider') {
        setModules((prev) => [
          ...prev,
          buildDividerElementModule(def, clampedX, clampedY),
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
    [buildTextElementModule, buildEmojiElementModule, buildDividerElementModule],
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
  // Wraps EVERY caller that flips the panel state (sidebar toggle,
  // the panel's own close X, edit-mode exit) so the canvas stays
  // frozen during every slide direction, not just sidebar-driven
  // opens.  Accepts a `PanelKind | null` rather than a boolean so
  // split-mode callers can target a specific surface; combined-mode
  // callers pass `'modules'` for open and `null` for close.
  const setActivePanelAnimated = useCallback((next: PanelKind | null) => {
    setActivePanel((prev) => {
      if (prev === next) return prev;
      suspendCanvasResizeRef.current = true;
      return next;
    });
  }, []);

  // Toggle the requested panel.  Clicking the rail icon for the
  // currently-active surface closes it; clicking a different icon
  // (split mode only) switches to that surface without an
  // intermediate close.  Combined mode only ever passes 'modules', so
  // it degenerates to the previous boolean toggle behaviour.
  const handleTogglePanel = useCallback((kind: PanelKind = 'modules') => {
    setActivePanel((prev) => {
      suspendCanvasResizeRef.current = true;
      if (prev === kind) return null;
      return kind;
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
        openTrigger={selectProfilesOpenTrigger}
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
          activePanel={activePanel}
          onTogglePanel={handleTogglePanel}
          sidebarMode={sidebarMode}
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
                // panelMode drives the panel's chrome:
                //   • 'all'      — combined sidebar; full tabs + filters.
                //   • 'modules'  — split / Data modules; Network +
                //                  Visual-type tabs only (no Elements
                //                  tab — Elements has its own panel
                //                  in this mode).
                //   • 'elements' — split / Elements; no tabs / filter
                //                  rows, header relabeled to "Elements".
                panelMode={
                  sidebarMode === 'combined'
                    ? 'all'
                    : activePanel === 'elements'
                      ? 'elements'
                      : 'modules'
                }
                onAdd={handleAddModule}
                onAddElement={handleAddElement}
                onClose={() => setActivePanelAnimated(null)}
                onDragStartModule={handleDragStartModule}
                onDragEndModule={handleDragEndModule}
                onDragStartElement={handleDragStartElement}
                onDragEndElement={handleDragEndElement}
                compact={panelCompact}
              />
            </div>
          )}
        </div>

        {/* Canvas — fills remaining horizontal + stretches vertically.
            The scroll container IS the card (overflow-y-auto directly
            on the wrapper) so the scrollbar lives inside the card
            outline when one is present.

            Card chrome (`bg-white border border-[#E8E8E9] rounded-[8px]`)
            paints only when `canvasMode === 'white'`.  In grey mode
            the entire card chrome comes off so modules sit directly
            on the page's `bg-[#F3F3F4]` parent.  The grid + drag /
            drop / resize machinery is identical between modes;
            removing the chrome only changes what's painted behind. */}
        <div
          className={cn(
            'flex-1 min-w-0 overflow-y-auto',
            canvasMode === 'white' && 'bg-white border border-[#E8E8E9] rounded-[8px]',
          )}
        >
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
          {/* Global data-warning banner — Case 2 only.  Renders OUTSIDE
              the modules-grid `p-6` wrapper because Figma 1857:73897
              sits it with a 4 px inset from the canvas-card edge
              (banner-x = card-x + 4, banner-y = card-y + 4), not the
              24 px the modules grid uses.  Hidden when there's
              nothing to warn about, the user dismissed this session,
              or the canvas is in the empty state. */}
          {modules.length > 0 &&
            !bannerDismissed &&
            affectedCase2Profiles.length > 0 && (
              <div
                className={cn(
                  // White-card mode: the 4 px inset matches Figma
                  // 1857:73897 — banner sits with a tight gap from
                  // the canvas-card edge.  Grey mode: no card edge
                  // to inset from, so the banner pins flush to the
                  // canvas region.  The banner's own bg keeps it
                  // visible against either parent.
                  canvasMode === 'white' && 'px-[4px] pt-[4px]',
                )}
              >
                <GlobalDataWarningBanner
                  affectedCount={affectedCase2Profiles.length}
                  onOpenSelectProfiles={() => {
                    // The picker dropdown is edit-mode only — see the
                    // ProfileSelectionBar effect that force-closes it
                    // when !isEditMode.  Flip edit mode on first so
                    // the trigger lands on a mounted dropdown.
                    if (!isEditMode) setIsEditMode(true);
                    setSelectProfilesOpenTrigger((n) => n + 1);
                  }}
                  onDismiss={() => setBannerDismissed(true)}
                />
              </div>
            )}
          <div
            className={cn(
              'h-full relative',
              modules.length === 0 ? '' : 'min-h-[900px]',
              // White-card mode keeps the 24-px inset (the card's
              // own "report surface" padding).  Grey mode strips it
              // entirely so modules align with the page-level
              // gap-2 / px-6 spacing on the flex parent rather than
              // sitting in an awkward inner box of dead space.
              canvasMode === 'white' && 'p-6',
            )}
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
