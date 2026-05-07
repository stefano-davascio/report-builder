'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { ModuleDefinition, Platform, ChartType } from '@/types';
import { MODULE_DEFINITIONS } from '@/lib/mock-data';
import {
  ELEMENT_DEFINITIONS,
  ElementDefinition,
  ElementCategory,
  ElementKind,
  groupElementsByCategory,
} from '@/lib/element-definitions';
import {
  IconClose,
  IconSearch,
  IconDragHandle,
  IconText,
  IconHeading1,
  IconHeading2,
  IconDivider,
  IconEmoji,
  IconImage,
  IconFile,
  IconLink,
  IconMetric,
  IconLineChart,
  IconAreaChart,
  IconPieChart,
  IconBarChart,
  IconTable,
  IconList,
} from '@/components/icons/SendiIcons';
import {
  IconNetworkAll,
  IconNetworkFacebook,
  IconNetworkInstagram,
  IconNetworkTikTok,
  IconNetworkYouTube,
  IconNetworkLinkedIn,
  IconNetworkGA,
  IconNetworkX,
  IconNetworkThreads,
  IconNetworkBluesky,
  type NetworkIconProps,
} from '@/components/icons/NetworkIcons';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddModulePanelProps {
  onAdd: (definition: ModuleDefinition) => void;
  onClose: () => void;
  /**
   * Click-to-add for non-data canvas elements (Text, Heading 1, Heading 2,
   * Divider, etc.). Currently only the text-style elements (text/heading-1/
   * heading-2) are renderable — the rest of the catalog is render-complete
   * in the panel but the canvas no-ops on them until their renderers ship.
   */
  onAddElement?: (definition: ElementDefinition) => void;
  /**
   * Called when the user starts dragging a module row. The parent should
   * surface this to the canvas so the grid can render a drop placeholder
   * sized to this definition.
   */
  onDragStartModule?: (definition: ModuleDefinition) => void;
  /** Called when the drag ends (dropped or cancelled). */
  onDragEndModule?: () => void;
  /** Mirrors onDragStartModule for the Elements tab. */
  onDragStartElement?: (definition: ElementDefinition) => void;
  /** Mirrors onDragEndModule for the Elements tab. */
  onDragEndElement?: () => void;
  /**
   * Compact layout — enabled on narrower viewports (<1280 px) so the
   * panel can still live alongside a usable canvas. Shorter list rows
   * (44 px vs 53 px), tighter left inset (24 px vs 31 px) on the row
   * label, and a smaller right-rail reservation so the platform cluster
   * and label don't crowd each other at 320/280 panel widths. Every
   * filter / search / tab control keeps its desktop size so tap targets
   * stay unchanged.
   */
  compact?: boolean;
  /**
   * Which slice of the panel surface to render — drives chrome and
   * default view, NOT the underlying behaviour (search, drag-and-drop,
   * filtering all keep working in every mode).
   *
   *   • 'all'      — combined sidebar (existing production layout).
   *                  Network / Visual type / Elements tabs all visible;
   *                  user picks which view.  Default.
   *   • 'modules'  — split sidebar / Data modules panel.  No Elements
   *                  tab.  View toggles between Network and Visual
   *                  type only.
   *   • 'elements' — split sidebar / Elements panel.  No tabs, no
   *                  Network/Visual filter row; the panel renders the
   *                  Elements list directly under the search input,
   *                  and the header reads "Elements" instead of
   *                  "Add modules".
   */
  panelMode?: 'all' | 'modules' | 'elements';
}

type PanelView = 'network' | 'visual' | 'elements';

// Network icon dispatch — maps a NetworkFilterId (or Platform for PlatformBadge)
// to the Figma-exported icon component in NetworkIcons.tsx. Each icon is
// rendered at the requested tile size, preserving Figma's inset positioning.
function NetworkIcon({
  network,
  size = 24,
  selected = false,
}: {
  network: string;
  size?: number;
  selected?: boolean;
}) {
  const props: NetworkIconProps = { size };
  switch (network) {
    case 'all':
      // The "All" icon is a stroke-only library icon. Per Figma
      // (1139:172948), its stroke stays BRAND/dark (#201E24) in both
      // selected and unselected states — only the tile background changes.
      return <IconNetworkAll {...props} color="#201E24" />;
    case 'facebook':
      return <IconNetworkFacebook {...props} />;
    case 'instagram':
      return <IconNetworkInstagram {...props} />;
    case 'tiktok':
      return <IconNetworkTikTok {...props} />;
    case 'youtube':
      return <IconNetworkYouTube {...props} />;
    case 'linkedin':
      return <IconNetworkLinkedIn {...props} />;
    case 'ga':
      return <IconNetworkGA {...props} />;
    case 'x':
      return <IconNetworkX {...props} />;
    case 'threads':
      return <IconNetworkThreads {...props} />;
    case 'bluesky':
      return <IconNetworkBluesky {...props} />;
    default:
      return (
        <span
          className="inline-flex items-center justify-center rounded-full bg-[#E8E8E9] text-[9px] font-bold text-[#79787B]"
          style={{ width: size, height: size }}
        >
          {network[0]?.toUpperCase()}
        </span>
      );
  }
}

// Network filter row — mirrors Figma Frame 1139:172946 (10 platform tiles
// + the "All" tile at the head).
//
// All tiles share the same `rounded-[4px]` corner radius and the same
// `px-[8px] py-[6px]` padding (`spacings/8` + `spacings/6`) wrapping a
// 24×24 icon, producing the 40×36 outer footprint from Figma.
//
// The `ga` id is kept as a filter alias for the canonical
// `google-analytics` platform key — shorter to type in UI code, and
// matches the Figma tile label.
type NetworkFilterId = Platform | 'all' | 'ga';
type NetworkOption = {
  id: NetworkFilterId;
  label: string;
  /** Figma node id for the tile, for traceability. */
  figmaNodeId: string;
};

const NETWORK_OPTIONS: NetworkOption[] = [
  { id: 'all',       label: 'All',              figmaNodeId: '1139:172947' },
  { id: 'facebook',  label: 'Facebook',         figmaNodeId: '1139:172949' },
  { id: 'instagram', label: 'Instagram',        figmaNodeId: '1139:172951' },
  { id: 'tiktok',    label: 'TikTok',           figmaNodeId: '1139:172953' },
  { id: 'youtube',   label: 'YouTube',          figmaNodeId: '1139:172955' },
  { id: 'linkedin',  label: 'LinkedIn',         figmaNodeId: '1139:172957' },
  { id: 'ga',        label: 'Google Analytics', figmaNodeId: '1139:172959' },
  { id: 'x',         label: 'X',                figmaNodeId: '1139:172961' },
  { id: 'threads',   label: 'Threads',          figmaNodeId: '1139:172963' },
  { id: 'bluesky',   label: 'Bluesky',          figmaNodeId: '1139:172965' },
];

// Visual-type filter chips — 7 types per Figma 1026:40316 (donut was
// folded into pie at the ChartType level). Each chip is icon-only in
// Figma: `metric` uses `Hashtag` (373:25230), `area` uses `TrendUp`
// (1026:40395), the rest reuse the general chart-type icons from the
// shared library.
//
// `label` is preserved solely for accessibility (the chip's `title` /
// aria-label) — it's never rendered as visible text.
const VISUAL_TYPES: {
  type: ChartType;
  label: string;
  Icon: (props: { size?: number; color?: string }) => React.JSX.Element;
  /** Figma node id for the chip, for traceability. */
  figmaNodeId: string;
}[] = [
  { type: 'metric', label: 'Metric Card', Icon: (p) => <IconMetric    {...p} />, figmaNodeId: '1026:40390' },
  { type: 'line',   label: 'Line Chart',  Icon: (p) => <IconLineChart {...p} />, figmaNodeId: '1026:40392' },
  { type: 'area',   label: 'Area Chart',  Icon: (p) => <IconAreaChart {...p} />, figmaNodeId: '1026:40394' },
  { type: 'pie',    label: 'Pie Chart',   Icon: (p) => <IconPieChart  {...p} />, figmaNodeId: '1026:40399' },
  { type: 'bar',    label: 'Bar Chart',   Icon: (p) => <IconBarChart  {...p} />, figmaNodeId: '1026:40401' },
  { type: 'table',  label: 'Table',       Icon: (p) => <IconTable     {...p} />, figmaNodeId: '1026:40403' },
  { type: 'list',   label: 'List',        Icon: (p) => <IconList      {...p} />, figmaNodeId: '1026:40405' },
];

// Map a NetworkFilterId onto the Platform key that modules actually
// declare. `ga` is only a UI shorthand — module definitions use the
// canonical `google-analytics` key.
function filterIdToPlatform(id: NetworkFilterId): Platform | null {
  if (id === 'all') return null;
  if (id === 'ga') return 'google-analytics';
  return id;
}

// Platform badge icons for module list rows
function PlatformBadge({ platform }: { platform: string }) {
  return <NetworkIcon network={platform.toLowerCase()} size={16} />;
}

function ModuleListItem({
  def,
  onAdd,
  onDragStartModule,
  onDragEndModule,
  displayPlatform,
  compact = false,
}: {
  def: ModuleDefinition;
  onAdd: (def: ModuleDefinition) => void;
  onDragStartModule?: (def: ModuleDefinition) => void;
  onDragEndModule?: () => void;
  /**
   * When set, the right-rail platform cluster collapses to the single
   * given platform's icon — used inside a specific-network tab (e.g.
   * "Facebook") where every row is shown as a Facebook-relevant module
   * even if the underlying definition supports multiple platforms.
   * When undefined (Cross-network / Visual-type / Elements views), the
   * full multi-platform cluster renders.
   */
  displayPlatform?: Platform;
  /** Compact row — see `AddModulePanelProps.compact`. */
  compact?: boolean;
}) {
  // `wasDragged` suppresses the click that some browsers fire after a
  // drag-and-drop gesture when the cursor didn't move far enough between
  // mousedown and mouseup — without this, a user who clicked-and-dropped a
  // row onto the canvas would get both a panel-drop (handleDropModuleAt)
  // AND a panel-click (handleAdd), producing two modules with the same
  // `mod-${def.id}-${Date.now()}` id. Root-cause id collision is already
  // fixed with `uid()` in lib/utils.ts, but suppressing the phantom click
  // also prevents two visibly-duplicate modules from appearing at all.
  const wasDragged = useRef(false);

  const handleAdd = () => {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    onAdd(def);
  };

  // `platformsToShow` is the list that actually renders in the right-rail
  // cluster. Inside a specific-network tab we collapse it to a single
  // icon (Facebook tab → only the Facebook badge, even for cross-network
  // modules). In Cross-network / Visual-type / Elements views we keep
  // the multi-icon cluster (up to 3 + overflow counter).
  const platformsToShow: Platform[] = displayPlatform ? [displayPlatform] : def.platforms;

  // HTML5 drag source. react-grid-layout listens to native dragover/drop
  // events on its container, so the row only needs `draggable` + dataTransfer
  // set in `dragstart`. We also notify the parent via callbacks so the canvas
  // knows which definition is being dragged (the grid's onDrop callback
  // doesn't receive our payload directly).
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    // Required for Firefox — if dataTransfer is empty, the drag is cancelled
    // immediately. Also lets the drop target read back the id if needed.
    e.dataTransfer.setData('application/x-module-definition-id', def.id);
    e.dataTransfer.effectAllowed = 'copy';
    wasDragged.current = true;
    onDragStartModule?.(def);
  };

  const handleDragEnd = () => {
    onDragEndModule?.();
    // Reset after the browser's trailing-click window. If a phantom click
    // fires synchronously after dragend, `handleAdd` still sees
    // wasDragged=true and swallows it. If no trailing click fires,
    // subsequent genuine clicks on the row aren't blocked.
    window.setTimeout(() => {
      wasDragged.current = false;
    }, 300);
  };

  // Figma 1139:172972 — the desktop row is 53 px tall with absolutely-
  // positioned children (label left=31, cluster right=15). In compact
  // mode we tighten to 44 px tall with label left=24, so the row still
  // reads as the same component at 320/280 px panel widths but isn't
  // wasting vertical runway or crowding the cluster against the label.
  // Compact mode also collapses the platform cluster's max icons from
  // 3 → 2, which keeps the label column breathable even when the panel
  // is only 280 px wide.
  const rowH = compact ? 44 : 53;
  const labelLeft = compact ? 24 : 31;
  const clusterRight = compact ? 12 : 15;
  const labelTop = compact ? 12 : 15;
  const maxCluster = compact ? 2 : 3;
  const reservedRight = compact ? 64 : 80;
  const visibleCluster = platformsToShow.slice(0, maxCluster);
  const clusterExtra = Math.max(0, platformsToShow.length - maxCluster);
  // Drag-handle gutter — a labelLeft-wide flex column spanning the full
  // row height, pinned flush to the row's left/top edge. The 24×24
  // DotsSixVertical icon centers inside it via flex, so the visible dot
  // cluster sits precisely on the gutter's horizontal AND vertical
  // midline regardless of the outer border width or row height.
  return (
    <button
      onClick={handleAdd}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      // Hover state: border tightens to DARK/dark--tint_70 (#BCBBBD), bg
      // stays white, and a surface--elevation-14 drop-shadow lifts the
      // row (`0 3px 4px rgba(27,27,32,0.14)`). `transition-all` so the
      // shadow fades in alongside the border. Drag-handle icon also
      // darkens via group-hover below.
      className="group relative w-full overflow-hidden bg-white border border-[#E8E8E9] rounded-[4px] text-left transition-all hover:border-[#BCBBBD] hover:shadow-[0_3px_4px_0_rgba(27,27,32,0.14)] cursor-grab active:cursor-grabbing"
      style={{ height: rowH }}
    >
      {/* Drag handle — Figma DotsSixVertical (349:19030). Wrapped in a
          labelLeft-wide flex gutter so the dot cluster is explicitly
          centered on the gutter's horizontal AND vertical midlines. */}
      <span
        className="absolute top-0 left-0 bottom-0 flex items-center justify-center text-[#BCBBBD] group-hover:text-[#79787B]"
        style={{ width: labelLeft }}
      >
        <IconDragHandle size={24} color="currentColor" />
      </span>

      {/* Module name — Regular 14/21 DARK (#201E24). Desktop positions at
          x=31, y=15; compact at x=24, y=12 (44 px row ÷ 2 − 21/2 ≈ 12). */}
      <span
        className="absolute text-[14px] leading-[21px] text-[#201E24] truncate"
        style={{ left: labelLeft, top: labelTop, right: reservedRight }}
      >
        {def.name}
      </span>

      {/* Platform cluster — absolutely positioned at right (15 desktop / 12
          compact), centered. Each badge is a 20×20 white disc
          (rounded-[10px]) with p-px and a 16×16 brand logo inside;
          siblings overlap by 3px (mr-[-3px]). */}
      <span
        className="absolute top-1/2 -translate-y-1/2 flex items-center pr-[3px]"
        style={{ right: clusterRight }}
      >
        {visibleCluster.map((p, i) => (
          <span
            key={p}
            className="relative inline-flex items-center justify-center size-[20px] rounded-[10px] bg-white p-px -mr-[3px]"
            style={{ zIndex: maxCluster - i }}
          >
            <PlatformBadge platform={p} />
          </span>
        ))}
        {clusterExtra > 0 && (
          <span className="ml-[7px] text-[12px] leading-[18px] text-[#79787B]">
            +{clusterExtra}
          </span>
        )}
      </span>
    </button>
  );
}

// Icon dispatch for the Elements tab. Each entry maps an ElementKind to the
// matching Figma-exported icon component in SendiIcons.tsx. Kept as a Record
// (not a switch) so TypeScript flags any missing ElementKind if the catalog
// grows. All icons render at size=20 to match Figma 1026:40473 (rows draw the
// icon inside a 20×20 footprint on the right edge).
const ELEMENT_ICONS: Record<ElementKind, (props: { size?: number; color?: string }) => React.JSX.Element> = {
  'text':      (p) => <IconText      {...p} />,
  'heading-1': (p) => <IconHeading1  {...p} />,
  'heading-2': (p) => <IconHeading2  {...p} />,
  'divider':   (p) => <IconDivider   {...p} />,
  'emoji':     (p) => <IconEmoji     {...p} />,
  'image':     (p) => <IconImage     {...p} />,
  'file':      (p) => <IconFile      {...p} />,
  'link':      (p) => <IconLink      {...p} />,
};

function ElementListItem({
  def,
  onAdd,
  onDragStartElement,
  onDragEndElement,
  compact = false,
}: {
  def: ElementDefinition;
  onAdd: (def: ElementDefinition) => void;
  onDragStartElement?: (def: ElementDefinition) => void;
  onDragEndElement?: () => void;
  /** Compact row — see `AddModulePanelProps.compact`. */
  compact?: boolean;
}) {
  // Same trailing-click guard as ModuleListItem — suppresses the phantom
  // click a browser fires after a short drag-drop when the cursor barely
  // moved, which would otherwise double-add the element.
  const wasDragged = useRef(false);
  const Icon = ELEMENT_ICONS[def.id];

  const handleAdd = () => {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    onAdd(def);
  };

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    // Distinct MIME type from module drags so the canvas can branch on what
    // was dropped (module vs element) without extra state.
    e.dataTransfer.setData('application/x-element-definition-id', def.id);
    e.dataTransfer.effectAllowed = 'copy';
    wasDragged.current = true;
    onDragStartElement?.(def);
  };

  const handleDragEnd = () => {
    onDragEndElement?.();
    window.setTimeout(() => {
      wasDragged.current = false;
    }, 300);
  };

  // Figma 1026:40473 — element row is 53 px tall in desktop. Compact
  // mirrors ModuleListItem: 44 px tall, label left=24, icon right=12.
  const rowH = compact ? 44 : 53;
  const labelLeft = compact ? 24 : 31;
  const iconRight = compact ? 12 : 15;
  const labelTop = compact ? 12 : 15;
  return (
    <button
      onClick={handleAdd}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="group relative w-full overflow-hidden bg-white border border-[#E8E8E9] rounded-[4px] text-left transition-all hover:border-[#BCBBBD] hover:shadow-[0_3px_4px_0_rgba(27,27,32,0.14)] cursor-grab active:cursor-grabbing"
      style={{ height: rowH }}
    >
      {/* Drag handle — mirrors ModuleListItem so the two row types read as
          siblings in the panel. */}
      <span
        className="absolute top-0 left-0 bottom-0 flex items-center justify-center text-[#BCBBBD] group-hover:text-[#79787B]"
        style={{ width: labelLeft }}
      >
        <IconDragHandle size={24} color="currentColor" />
      </span>

      {/* Label — Regular 14/21 DARK (#201E24). Desktop x=31/y=15;
          compact x=24/y=12 inside the 44 px row. */}
      <span
        className="absolute text-[14px] leading-[21px] text-[#201E24] truncate"
        style={{ left: labelLeft, top: labelTop, right: iconRight + 32 }}
      >
        {def.name}
      </span>

      {/* Right-rail element icon — Figma places a 20×20 icon at right-[15px],
          vertically centered. Compact tucks it to right=12. Stroke color is
          DARK/dark--tint_10 (#363439) in the default state. */}
      <span
        className="absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center"
        style={{ right: iconRight }}
      >
        <Icon size={20} color="#363439" />
      </span>
    </button>
  );
}

export function AddModulePanel({
  onAdd,
  onClose,
  onAddElement,
  onDragStartModule,
  onDragEndModule,
  onDragStartElement,
  onDragEndElement,
  compact = false,
  panelMode = 'all',
}: AddModulePanelProps) {
  // Internal `view` state is the user-driven tab selection (only
  // honoured in panelMode='all' / 'modules'; ignored in 'elements'
  // since that mode pins the view to elements unconditionally).
  const [view, setView] = useState<PanelView>(
    panelMode === 'elements' ? 'elements' : 'network',
  );

  // Derived effective view — collapses panelMode + internal view into
  // a single value the renderers below switch on.  In 'elements' mode
  // the user can't change the view, so we always return 'elements'.
  // In 'modules' mode we never render the Elements list, so an
  // 'elements' internal state coerces back to 'network'.
  const effectiveView: PanelView =
    panelMode === 'elements'
      ? 'elements'
      : panelMode === 'modules' && view === 'elements'
        ? 'network'
        : view;

  // When panelMode flips at runtime (Scenario Switcher swap), keep
  // the internal view in sync so re-opening the panel later doesn't
  // resurrect a stale tab selection.
  useEffect(() => {
    if (panelMode === 'elements' && view !== 'elements') setView('elements');
    else if (panelMode === 'modules' && view === 'elements') setView('network');
  }, [panelMode, view]);
  const [search, setSearch] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkFilterId>('all');
  // Visual-type row is always in a single-selected state (Figma 1024:33991
  // shows the first chip — Metric — pre-selected by default, and clicking
  // any chip swaps to that chip rather than toggling off). No `null` state.
  const [selectedVisualType, setSelectedVisualType] = useState<ChartType>('metric');

  // Element list derived for the Elements tab. Honours the shared search
  // input (filter by name) but is otherwise independent of the Network /
  // Visual-type filter rows (which don't render in the Elements view).
  const filteredElements = useMemo(() => {
    if (!search) return ELEMENT_DEFINITIONS;
    const q = search.toLowerCase();
    return ELEMENT_DEFINITIONS.filter((el) => el.name.toLowerCase().includes(q));
  }, [search]);

  const groupedElements = useMemo(() => {
    const groups = groupElementsByCategory();
    if (!search) return groups;
    // When searching, preserve the Basic blocks → Media order but only
    // include categories with matches so empty headers don't render.
    const filtered: Record<ElementCategory, ElementDefinition[]> = {
      'Basic blocks': groups['Basic blocks'].filter((el) => filteredElements.includes(el)),
      'Media':        groups['Media'].filter((el) => filteredElements.includes(el)),
    };
    return filtered;
  }, [search, filteredElements]);

  const filteredModules = useMemo(() => {
    let mods = MODULE_DEFINITIONS;

    if (search) {
      const q = search.toLowerCase();
      mods = mods.filter(m => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    }

    if (effectiveView === 'network') {
      if (selectedNetwork === 'all') {
        // "All" tile scopes to Cross-network modules (multi-platform data
        // concepts). Platform-specific modules only surface when the user
        // picks that platform. Matches Figma 1026:38009 (left panel).
        mods = mods.filter(m => m.category === 'Cross-network');
      } else {
        // Specific platform: show every module whose supportedPlatforms
        // list includes it, regardless of whether the module's "track" is
        // cross-network or platform-specific. Matches Figma 1026:38009
        // (right panel — Facebook selected shows both FB-specific AND
        // Cross-network modules that support FB).
        const platform = filterIdToPlatform(selectedNetwork);
        if (platform) {
          mods = mods.filter(m => (m.platforms as string[]).includes(platform));
        } else {
          mods = [];
        }
      }
    }

    if (effectiveView === 'visual' && selectedVisualType) {
      mods = mods.filter(m => m.supportedChartTypes.includes(selectedVisualType));
    }

    return mods;
  }, [search, effectiveView, selectedNetwork, selectedVisualType]);

  // Section header label for the list below the filters.
  //   • Network / All            → "Cross-network" (all shown modules share
  //                                 this category, so it's a single group).
  //   • Network / <platform>     → platform display label (e.g. "Facebook"),
  //                                 as a single group — Figma 1026:38009.
  //   • Visual type / <viz>      → the viz label (e.g. "Metric card").
  //   • Search active            → group by each module's own `.category`
  //                                 so results fan out across tracks.
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, ModuleDefinition[]> = {};

    if (search) {
      for (const mod of filteredModules) {
        const cat = mod.category;
        (groups[cat] ??= []).push(mod);
      }
      return groups;
    }

    let headerLabel = 'Cross-network';
    if (effectiveView === 'network') {
      if (selectedNetwork === 'all') headerLabel = 'Cross-network';
      else {
        const opt = NETWORK_OPTIONS.find(o => o.id === selectedNetwork);
        headerLabel = opt?.label ?? 'Cross-network';
      }
    } else if (effectiveView === 'visual') {
      // selectedVisualType is never null (first chip is pre-selected and
      // clicks single-select), so the lookup always resolves to a label.
      headerLabel = VISUAL_TYPES.find(v => v.type === selectedVisualType)?.label ?? 'Modules';
    }

    groups[headerLabel] = filteredModules;
    return groups;
  }, [filteredModules, effectiveView, search, selectedNetwork, selectedVisualType]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header — Figma 1139:172915. 52px tall, border-b #E8E8E9, 12px/10px
          inset. Title is IBM Plex Sans Medium 14/21, DARK/dark--tint_10
          (#363439). Close button is a 32×32 wrapper with 16×16 close_sm at
          BRAND/dark. */}
      <div className="flex items-center justify-between h-[52px] px-[12px] py-[10px] border-b border-[#E8E8E9] flex-shrink-0">
        {/* Header label — drives off `panelMode`:
              • 'all' / 'modules' — "Add modules" (the existing combined
                title; the split-Data-modules panel reuses it since the
                content is identical aside from the missing Elements tab).
              • 'elements'        — "Elements" (split sidebar; the panel
                only carries layout primitives, so the heading reflects
                that exactly). */}
        <h2 className="text-[14px] font-medium leading-[21px] text-[#363439]">
          {panelMode === 'elements' ? 'Elements' : 'Add modules'}
        </h2>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-[4px] hover:bg-[#F3F3F4] transition-colors"
          aria-label="Close"
        >
          <IconClose size={16} color="#201E24" />
        </button>
      </div>

      {/* Search — Figma 1139:172923.
          Outer frame: 32px tall, `bg-[#F3F3F4] rounded-[6px] p-[8px]
          overflow-clip`. The inner "Search bar container" (1139:172924) is
          16 px tall (flex gap-[8px] items-center), so the 8 px padding on
          top/bottom + 16 px content = 32 px exactly. Icon is 16×16,
          placeholder is IBM Plex Sans Regular 14 / DARK/dark--tint_30
          (#626165).
          `<input>` pitfalls worked around:
          1. UA default `font-family` — set `font-sans` to pull in IBM Plex.
          2. UA default vertical padding — zero with `p-0`.
          3. UA default line-height (~1.15) — force `leading-[16px]` so the
             input contributes exactly 16 px to the flex row (matching the
             icon and Figma's row frame). Figma's typography spec shows
             `leading-[24px]`, but that's wrapped in a `leading-[0]` parent
             that collapses the line-box for layout; we can't reproduce
             that on a native input, so we render the text at 16 px leading
             which is the visible row height Figma produces. */}
      <div className="px-[12px] pt-[8px] pb-[8px] flex-shrink-0">
        <div className="flex items-center gap-[8px] p-[8px] bg-[#F3F3F4] rounded-[6px] overflow-hidden focus-within:ring-2 focus-within:ring-[#4D36FF]/20 transition-all">
          <IconSearch size={16} color="#201E24" className="flex-shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 p-0 border-0 bg-transparent font-sans text-[14px] leading-[16px] text-[#201E24] placeholder:text-[#626165] focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs — Figma Frame 1026-38534: pill buttons, selected bg
          rgba(32,30,36,0.05).  Hidden entirely in 'elements' panelMode
          (split sidebar's Elements panel); reduced to Network +
          Visual type only in 'modules' mode. */}
      {panelMode !== 'elements' && (
        <div className="px-[12px] pt-[4px] pb-[8px] flex-shrink-0">
          <div className="flex items-center gap-[8px]">
            {(panelMode === 'modules'
              ? ([
                  { id: 'network', label: 'Network' },
                  { id: 'visual', label: 'Visual type' },
                ] as { id: PanelView; label: string }[])
              : ([
                  { id: 'network', label: 'Network' },
                  { id: 'visual', label: 'Visual type' },
                  { id: 'elements', label: 'Elements' },
                ] as { id: PanelView; label: string }[])
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={cn(
                  'flex-1 min-w-[32px] h-[32px] px-[19px] rounded-full text-[12px] leading-[18px] font-medium transition-colors whitespace-nowrap',
                  effectiveView === tab.id
                    ? 'bg-[rgba(32,30,36,0.05)] text-[#201E24]'
                    : 'bg-transparent text-[#79787B] hover:text-[#363439]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Network filter icons — Figma 1139:172946. Flex wrap, gap-[8px] both
          axes, w-[351px]. Each tile wraps a 24×24 icon with px-[8px] py-[6px]
          (→ 40×36). The "All" tile uses rounded-[4px]; brand icons use
          rounded-[10px] so the tile matches the circular logo. Unselected bg
          is white; selected bg is PRIMARY/primary--tint_90 (#EDEAFF). */}
      {effectiveView === 'network' && !search && (
        <div className="px-[12px] pb-[12px] flex-shrink-0">
          <div className="flex flex-wrap content-center items-center gap-[8px]">
            {NETWORK_OPTIONS.map((net) => {
              const isSelected = selectedNetwork === net.id;
              return (
                <button
                  key={net.id}
                  onClick={() => setSelectedNetwork(net.id)}
                  // All tiles share the same radius, padding, and icon size:
                  // `rounded-[4px]` + `px-[8px] py-[6px]` around a 24×24
                  // icon yields the 40×36 outer footprint from Figma.
                  className={cn(
                    'flex items-center justify-center px-[8px] py-[6px] rounded-[4px] transition-colors',
                    isSelected ? 'bg-[#EDEAFF]' : 'bg-white hover:bg-[#F3F3F4]',
                  )}
                  title={net.label}
                  aria-pressed={isSelected}
                  data-figma-node-id={net.figmaNodeId}
                >
                  <NetworkIcon network={net.id} size={24} selected={isSelected} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual type filter — icon-only tiles per Figma 1026:40316. Shares
          the exact geometry of the Network filter row: `rounded-[4px]` +
          `px-[8px] py-[6px]` around a 24×24 icon → 40×36 outer footprint,
          flex-wrap with gap-[8px]. Selected tile uses PRIMARY/primary--tint_90
          (#EDEAFF) as background; icon stroke stays BRAND/dark (#201E24) in
          both states (only the tile bg changes), matching the Network tile
          treatment. `title` carries the accessible label since the chip is
          icon-only. */}
      {effectiveView === 'visual' && !search && (
        <div className="px-[12px] pb-[12px] flex-shrink-0">
          <div className="flex flex-wrap content-center items-center gap-[8px]">
            {VISUAL_TYPES.map((vt) => {
              const isSelected = selectedVisualType === vt.type;
              return (
                <button
                  key={vt.type}
                  // Single-select, no toggle-off — always leave one chip
                  // active to match Figma 1024:33991.
                  onClick={() => setSelectedVisualType(vt.type)}
                  className={cn(
                    'flex items-center justify-center px-[8px] py-[6px] rounded-[4px] transition-colors',
                    isSelected ? 'bg-[#EDEAFF]' : 'bg-white hover:bg-[#F3F3F4]',
                  )}
                  title={vt.label}
                  aria-label={vt.label}
                  aria-pressed={isSelected}
                  data-figma-node-id={vt.figmaNodeId}
                >
                  {/* Icon color:
                        • selected → BRAND/dark (#201E24) for maximum contrast
                          inside the PRIMARY/primary--tint_90 chip bg.
                        • default  → DARK/dark--tint_30 (#626165), the gray
                          Figma uses for every unselected chart-type icon. */}
                  <vt.Icon size={24} color={isSelected ? '#201E24' : '#626165'} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider — Figma "Line 8" under the filter row. */}
      <div className="h-px bg-[#E8E8E9] flex-shrink-0" />

      {/* List region — scroll. Two renderers:
            • Module list (Network / Visual-type views) — Figma 1139:172969
            • Element list (Elements view)              — Figma 1026:40473
          Both use the same section-header typography (Regular 14/21,
          DARK/dark--tint_40 #79787B, left-[11px] from panel edge). */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-[12px] pt-[12px] pb-[12px] flex flex-col">
          {effectiveView === 'elements' ? (
            <>
              {(Object.entries(groupedElements) as [ElementCategory, ElementDefinition[]][])
                .filter(([, els]) => els.length > 0)
                .map(([category, els]) => (
                  <div key={category} className="mb-[12px] last:mb-0">
                    <p className="-ml-[1px] text-[14px] leading-[21px] font-normal text-[#79787B] pb-[8px]">
                      {category}
                    </p>
                    <div className="flex flex-col gap-[8px]">
                      {els.map((def) => (
                        <ElementListItem
                          key={def.id}
                          def={def}
                          compact={compact}
                          onAdd={(d) => onAddElement?.(d)}
                          onDragStartElement={onDragStartElement}
                          onDragEndElement={onDragEndElement}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              {filteredElements.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[13px] text-[#79787B]">No elements found</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Collapse every row's right-rail icon cluster to the single
                  scoped platform when the user is inside a specific-network
                  tab (e.g. Facebook). In Cross-network / Visual-type views,
                  rows keep their full multi-platform cluster. Search results
                  also keep the full cluster since they fan out across tracks. */}
              {(() => {
                const scopedPlatform: Platform | null =
                  effectiveView === 'network' && !search
                    ? filterIdToPlatform(selectedNetwork)
                    : null;
                return Object.entries(groupedByCategory).map(([category, mods]) => (
                  <div key={category} className="mb-[12px] last:mb-0">
                    <p className="-ml-[1px] text-[14px] leading-[21px] font-normal text-[#79787B] pb-[8px]">
                      {category}
                    </p>
                    <div className="flex flex-col gap-[8px]">
                      {mods.map((def) => (
                        <ModuleListItem
                          key={def.id}
                          def={def}
                          onAdd={onAdd}
                          onDragStartModule={onDragStartModule}
                          onDragEndModule={onDragEndModule}
                          displayPlatform={scopedPlatform ?? undefined}
                          compact={compact}
                        />
                      ))}
                    </div>
                  </div>
                ));
              })()}
              {filteredModules.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[13px] text-[#79787B]">No modules found</p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
