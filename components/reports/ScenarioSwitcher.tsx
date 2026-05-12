'use client';

/**
 * Scenario Switcher — internal demo / review tool.
 *
 * Floating panel pinned to the right edge of the viewport, portaled to
 * `document.body` so it sits above any page chrome regardless of the
 * route's layout (landing page, builder, future surfaces). Two state
 * axes; one collapsible chrome; localStorage persistence is handled
 * upstream by `useScenario` — this component is purely presentational.
 *
 * Visual language is deliberately distinct from the product UI:
 *   • Monospaced label "DEMO TOOL" up top.
 *   • Yellow-tinted edge so it reads as scaffolding, not chrome the
 *     reviewer might mistake for a real Sendible feature.
 *   • Dashed left border on the collapsed tab — same hint.
 *
 * The component is a NO-OP at the data layer. All it does is fire the
 * provided `onChange` callback with the new scenario; the parent
 * `app/page.tsx` is responsible for translating that into actual
 * derived data via `lib/scenario-data.ts`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ReportListState,
  Scenario,
  ScenarioFeatures,
  SidebarMode,
  CanvasMode,
  TemplateScope,
} from '@/lib/scenario';
import { cn } from '@/lib/utils';

/** Which page the switcher is currently overlaying.  Drives the
 *  per-group default open/closed state inside the panel so reviewers
 *  see the scenarios relevant to the surface they're looking at,
 *  with the other page's controls collapsed behind a chevron.
 *  Reviewers can still expand a collapsed group manually. */
export type ScenarioCurrentPage = 'landing' | 'builder';

interface ScenarioSwitcherProps {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
  /** Page-context hint — see `ScenarioCurrentPage`.  Defaults to
   *  `'landing'` for first-paint / out-of-route callers. */
  currentPage?: ScenarioCurrentPage;
}

// Each option carries a short inline `description` rendered below
// the label, plus the full `hint` retained as a `title=` tooltip so
// auditors still have access to the implementation detail.  The
// inline description is what a reviewer sees at a glance — keep it
// human, ≤ ~40 chars, focused on what they'll observe (not on the
// state-machine internals).
type Option<T extends string> = {
  id: T;
  label: string;
  description: string;
  hint: string;
};

const TEMPLATE_SCOPES: Option<TemplateScope>[] = [
  { id: 'full', label: 'Full network', description: 'All 8 template cards', hint: 'all 8 cards (current production target)' },
  { id: 'beta', label: 'Beta launch',  description: 'TikTok + Instagram only', hint: 'Scratch + TikTok + Instagram only' },
];

const REPORT_LIST_STATES: Option<ReportListState>[] = [
  { id: 'empty', label: 'Empty', description: 'No reports — first-run state',     hint: 'no reports — first-run state' },
  { id: 'few',   label: 'Few',   description: '3 reports, no filters or pagination', hint: '3 reports — no Filter trigger' },
  { id: 'many',  label: 'Many',  description: '50 reports with pagination',       hint: '50 reports — Filter trigger visible' },
];

// Independent capability flags. Unlike the radio sections above, both
// flags are toggled with checkboxes — they're orthogonal and any
// combination is valid (Rename on / Sorting off, both on, etc.).
const FEATURE_TOGGLES: Option<keyof ScenarioFeatures>[] = [
  { id: 'rename',  label: 'Rename',  description: 'Pencil + Rename in row menu',         hint: 'pencil glyph + Rename row in the more-options menu' },
  { id: 'sorting', label: 'Sorting', description: 'Sort indicators + clickable headers', hint: 'sort indicator icons + clickable column headers' },
];

// Sidebar architecture — two iterations of the report-builder left rail
// live side by side; flipping this radio swaps the layout in place
// without remounting the canvas / modules / filters.
const SIDEBAR_MODES: Option<SidebarMode>[] = [
  { id: 'combined', label: 'Combined', description: 'Single rail with tabs',          hint: 'single rail; modules + elements share one panel with tabs' },
  { id: 'split',    label: 'Split',    description: 'Separate Data + Elements panels', hint: 'two rail entries; Data modules + Elements open separate panels' },
];

// Canvas treatment — design-comparison toggle.  Flipping this only
// adjusts the report-builder's outer wrapper chrome; modules,
// grid behavior, and selection state are preserved across switches.
const CANVAS_MODES: Option<CanvasMode>[] = [
  { id: 'white', label: 'White canvas',    description: 'Modules inside a white card',  hint: 'production: modules inside a white card with 24 px inset' },
  { id: 'grey',  label: 'Grey background', description: 'Modules on the page background', hint: 'card removed; modules sit on the page grey directly' },
];

// Error-state master toggle.  Off by default so reviewers see the
// calm-state production view; flipping on reveals every profile-
// driven warning surface (global banner + per-module icons +
// per-profile status pills) end-to-end.
const ERROR_STATE_TOGGLE: Option<'showErrorStates'> = {
  id: 'showErrorStates',
  label: 'Show error states',
  description: 'Profile warnings, banners, and partial-data states',
  hint: 'reveal the full warning system: global banner, per-module icons, and per-profile status pills',
};

export function ScenarioSwitcher({
  scenario,
  onChange,
  currentPage = 'landing',
}: ScenarioSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // `createPortal` requires `document.body` — only available client-side.
  // Defer the first paint until after mount so we don't crash SSR /
  // prerender, and so the panel position settles before fade-in.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleTemplateScope = (next: TemplateScope) => {
    if (next === scenario.templateScope) return;
    onChange({ ...scenario, templateScope: next });
  };

  const handleReportListState = (next: ReportListState) => {
    if (next === scenario.reportListState) return;
    onChange({ ...scenario, reportListState: next });
  };

  const handleFeatureToggle = (key: keyof ScenarioFeatures) => {
    onChange({
      ...scenario,
      features: { ...scenario.features, [key]: !scenario.features[key] },
    });
  };

  const handleSidebarMode = (next: SidebarMode) => {
    if (next === scenario.sidebarMode) return;
    onChange({ ...scenario, sidebarMode: next });
  };

  const handleCanvasMode = (next: CanvasMode) => {
    if (next === scenario.canvasMode) return;
    onChange({ ...scenario, canvasMode: next });
  };

  const handleErrorStatesToggle = () => {
    onChange({ ...scenario, showErrorStates: !scenario.showErrorStates });
  };

  return createPortal(
    <div
      // Full-viewport overlay — neither participates in page layout
      // (fixed inset-0) nor blocks clicks (`pointer-events-none`).
      // The tab + panel inside re-enable pointer events on themselves
      // so they remain clickable while everything else falls through.
      // This wrapper exists ONLY to hold the panel/tab in a stable
      // coordinate system so the drag handler's `clientX/Y` math is
      // straightforward (page coords == overlay coords).
      className="fixed inset-0 z-[1000] pointer-events-none"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
    >
      {open ? (
        <ExpandedPanel
          scenario={scenario}
          onTemplateScope={handleTemplateScope}
          onReportListState={handleReportListState}
          onFeatureToggle={handleFeatureToggle}
          onSidebarMode={handleSidebarMode}
          onCanvasMode={handleCanvasMode}
          onErrorStatesToggle={handleErrorStatesToggle}
          currentPage={currentPage}
          onCollapse={() => setOpen(false)}
        />
      ) : (
        <CollapsedTab onClick={() => setOpen(true)} />
      )}
    </div>,
    document.body,
  );
}

// ── Collapsed: the small tab pinned to the right edge ───────────────────

function CollapsedTab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Open scenario switcher (demo tool)"
      className={cn(
        // `absolute top-1/2 right-0 -translate-y-1/2` positions the
        // tab against the viewport's right edge, vertically centered.
        // Self-positioning here (rather than letting the wrapper do
        // it) keeps the tab's resting place independent of the
        // expanded panel — the panel can be dragged anywhere without
        // affecting where the tab snaps back to on close.
        'absolute top-1/2 right-0 -translate-y-1/2',
        'pointer-events-auto',
        // Dashed border + yellow accent so the tab reads as scaffolding,
        // not a real product feature.  Vertical writing mode lets the
        // label fit in a slim 28-px-wide tab without truncating.
        'flex items-center justify-center gap-2',
        'min-h-[140px] w-7 px-1 py-3',
        'rounded-l-md border border-r-0 border-dashed border-[#E5C200] bg-[#FFFCEA]',
        'text-[10px] font-medium tracking-[0.2em] uppercase text-[#7A6500]',
        'hover:bg-[#FFF8C7] transition-colors',
        'shadow-[-1px_2px_4px_rgba(0,0,0,0.08)]',
      )}
      style={{ writingMode: 'vertical-rl' }}
      aria-label="Open scenario switcher"
    >
      Demo · Scenarios
    </button>
  );
}

// ── Expanded: the full control panel ─────────────────────────────────────

interface ExpandedPanelProps {
  scenario: Scenario;
  onTemplateScope: (next: TemplateScope) => void;
  onReportListState: (next: ReportListState) => void;
  onFeatureToggle: (key: keyof ScenarioFeatures) => void;
  onSidebarMode: (next: SidebarMode) => void;
  onCanvasMode: (next: CanvasMode) => void;
  onErrorStatesToggle: () => void;
  currentPage: ScenarioCurrentPage;
  onCollapse: () => void;
}

function ExpandedPanel({
  scenario,
  onTemplateScope,
  onReportListState,
  onFeatureToggle,
  onSidebarMode,
  onCanvasMode,
  onErrorStatesToggle,
  currentPage,
  onCollapse,
}: ExpandedPanelProps) {
  // Drag state lives entirely inside this component — when the panel
  // closes, the parent unmounts ExpandedPanel and re-creating it on
  // next open gives us a fresh `position = null`. That's the "snap
  // back to default on close" behavior, no explicit reset needed.
  //
  //   • position === null   → render at the default right-edge anchor
  //                            (absolute top-1/2 right-0)
  //   • position is { x, y } → render at literal coords (absolute
  //                            top-y left-x). `right` and the
  //                            translate are dropped so the coords
  //                            map 1:1 to viewport space.
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Refs for the drag math.
  //   panelRef   — measures the panel's actual rect (width is 220 fixed
  //                but height is dynamic, so we read it lazily).
  //   offsetRef  — captures where inside the header the pointer grabbed
  //                so the panel doesn't jump under the cursor.
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only start drag on primary button (left mouse / first touch).
      if (e.button !== 0) return;
      // The collapse button lives inside the header; if the user
      // clicked on it, let the click flow normally without starting
      // a drag.
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-drag]')) return;

      const panel = panelRef.current;
      if (!panel) return;

      const rect = panel.getBoundingClientRect();

      // Capture the cursor offset within the panel so subsequent
      // moves keep the panel anchored under the same point of the
      // header that the user grabbed.
      offsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // setPointerCapture routes all subsequent pointer events to
      // this element until pointerup, even if the cursor leaves the
      // header. That's what gives the drag its "smooth — never loses
      // the cursor" feel and keeps every event scoped to this
      // element instead of the document.
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);

      // If this is the first drag, lock in the panel's CURRENT
      // computed top/left as the starting position so the move
      // handler has a coord system to work in.
      setPosition({ x: rect.left, y: rect.top });
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;

      const panel = panelRef.current;
      if (!panel) return;

      const rect = panel.getBoundingClientRect();

      // Clamp to viewport so the panel can't be dragged off-screen.
      // 8 px padding at the edges keeps the resize-corner / scrollbar
      // areas accessible.
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      const nextX = Math.max(0, Math.min(maxX, e.clientX - offsetRef.current.x));
      const nextY = Math.max(0, Math.min(maxY, e.clientY - offsetRef.current.y));

      setPosition({ x: nextX, y: nextY });
    },
    [dragging],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDragging(false);
    },
    [dragging],
  );

  // Build the inline style that switches between the default right-
  // edge anchor and a custom dragged position.  Default uses CSS-only
  // (`right: 0; top: 50%; transform: translateY(-50%)`) so we don't
  // need to measure the viewport up-front.
  const positionStyle: React.CSSProperties =
    position === null
      ? { top: '50%', right: 0, transform: 'translateY(-50%)' }
      : { top: position.y, left: position.x };

  return (
    <div
      ref={panelRef}
      // Pointer events re-enabled here so radios + close button are
      // clickable; the wrapper one level up is `pointer-events-none`
      // so empty space outside the panel still passes clicks through
      // to the underlying page.
      className={cn(
        'absolute pointer-events-auto',
        // Wider than before so two-line rows (label + description)
        // fit without truncation.  The cream `#FFFCEA` surface is
        // the demo-tool signature — kept so testers immediately
        // recognise the panel as scaffolding, not a real product
        // feature.  Hierarchy inside comes from typography + spacing,
        // not chrome.
        'w-[280px] rounded-l-md border border-r-0 border-dashed border-[#E5C200] bg-[#FFFCEA]',
        'shadow-[-2px_4px_16px_rgba(0,0,0,0.08)]',
        'text-[12px] text-[#3A3000]',
        // While dragging we kill text-selection on the whole panel so
        // a stray cursor sweep doesn't highlight option labels mid-drag.
        dragging && 'select-none',
      )}
      style={{
        ...positionStyle,
        // When dragged the panel becomes pinned by left/top; when at
        // rest it's pinned by right + translate. The CSS in
        // `positionStyle` handles the swap, but we always ensure the
        // border-radius reads as a free-floating panel once dragged
        // (rounded on all sides) instead of just the left side.
        ...(position !== null && { borderRadius: 6 }),
      }}
    >
      {/* Header — drag handle.  `cursor-grab` invites the user to
          grab; flips to `grabbing` while a drag is active.  The
          collapse button has `data-no-drag` so its clicks never
          start a drag. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          // Single dashed underline below the header is the ONLY
          // dashed separator left inside the panel — it doubles as a
          // visual cue for "this is a draggable handle" and the
          // demo-tool callout.
          'flex items-center justify-between px-3 py-2 border-b border-dashed border-[#E5C200] bg-[#FFFCEA]',
          'select-none touch-none rounded-tl-md',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#7A6500]">
          Scenarios
        </span>
        <button
          type="button"
          data-no-drag
          onClick={onCollapse}
          aria-label="Collapse scenario switcher"
          className="w-5 h-5 flex items-center justify-center rounded text-[#7A6500] hover:bg-[#FFF1A8] transition-colors cursor-pointer"
        >
          {/* Lucide-style ✕ rendered inline so we don't pull a new icon. */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Body — two reviewer-oriented top-level groups, each
          labelled by the page being controlled.  Both groups use
          sub-clusters so the structure stays consistent:
            • Landing page  → Templates / Reports list / Experimental
            • Report builder → Module panel / Canvas style */}
      <div className="py-1">
        <Group title="Landing page" defaultOpen={currentPage === 'landing'}>
          <SubGroup title="Templates">
            {TEMPLATE_SCOPES.map((opt) => (
              <OptionRow
                key={opt.id}
                kind="radio"
                checked={scenario.templateScope === opt.id}
                label={opt.label}
                description={opt.description}
                hint={opt.hint}
                onChange={() => onTemplateScope(opt.id)}
                name="template-scope"
              />
            ))}
          </SubGroup>

          <SubGroup title="Reports list">
            {REPORT_LIST_STATES.map((opt) => (
              <OptionRow
                key={opt.id}
                kind="radio"
                checked={scenario.reportListState === opt.id}
                label={opt.label}
                description={opt.description}
                hint={opt.hint}
                onChange={() => onReportListState(opt.id)}
                name="report-list-state"
              />
            ))}
          </SubGroup>

          {/* Experimental features — checkboxes (NOT radios) since
              the flags are orthogonal: any combination of {rename,
              sorting} ∈ {on, off} is valid.  Nested under Landing
              page because both toggles surface there (reports
              table rename + sortable column headers). */}
          <SubGroup title="Experimental features">
            {FEATURE_TOGGLES.map((opt) => (
              <OptionRow
                key={opt.id}
                kind="checkbox"
                checked={scenario.features[opt.id]}
                label={opt.label}
                description={opt.description}
                hint={opt.hint}
                onChange={() => onFeatureToggle(opt.id)}
              />
            ))}
          </SubGroup>
        </Group>

        <Group title="Report builder" defaultOpen={currentPage === 'builder'} isLast>
          <SubGroup title="Module panel">
            {SIDEBAR_MODES.map((opt) => (
              <OptionRow
                key={opt.id}
                kind="radio"
                checked={scenario.sidebarMode === opt.id}
                label={opt.label}
                description={opt.description}
                hint={opt.hint}
                onChange={() => onSidebarMode(opt.id)}
                name="sidebar-mode"
              />
            ))}
          </SubGroup>

          <SubGroup title="Canvas style">
            {CANVAS_MODES.map((opt) => (
              <OptionRow
                key={opt.id}
                kind="radio"
                checked={scenario.canvasMode === opt.id}
                label={opt.label}
                description={opt.description}
                hint={opt.hint}
                onChange={() => onCanvasMode(opt.id)}
                name="canvas-mode"
              />
            ))}
          </SubGroup>

          {/* Error states — single master toggle that gates every
              profile-driven warning surface (global banner,
              per-module icons, per-profile status pills).  Off by
              default so the calm production state is the first
              thing reviewers see. */}
          <SubGroup title="Error states">
            <OptionRow
              kind="checkbox"
              checked={scenario.showErrorStates}
              label={ERROR_STATE_TOGGLE.label}
              description={ERROR_STATE_TOGGLE.description}
              hint={ERROR_STATE_TOGGLE.hint}
              onChange={onErrorStatesToggle}
            />
          </SubGroup>
        </Group>
      </div>
    </div>
  );
}

/**
 * `Group` — top-level cluster for a related set of scenarios (one
 * page or category).  Collapsible: the header acts as a button that
 * toggles a chevron + the rows below.  `defaultOpen` seeds the
 * initial state from the parent's page-context hint (e.g. open
 * "Report builder" by default when the user is inside the builder,
 * open "Landing page" by default when on the landing route).
 *
 * `defaultOpen` is intentionally only consulted on first mount —
 * subsequent re-renders preserve the user's manual toggle so a
 * navigation event doesn't snap a section the user just expanded
 * closed again.  The Group remounts when the panel itself
 * collapses + reopens (since `ExpandedPanel` unmounts in the
 * collapsed state), which is when the page-context default
 * re-applies.
 *
 * The last group skips the bottom hairline (`isLast`) so the
 * panel's own bottom edge owns the close-out.
 */
function Group({
  title,
  defaultOpen = true,
  isLast = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn('px-2 pt-2 pb-2', !isLast && 'border-b border-[#F0E7BF]')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'group/header w-full flex items-center justify-between gap-2',
          'px-2 py-1 rounded-[4px] text-left',
          'hover:bg-[#FFF8C7] transition-colors cursor-pointer',
        )}
      >
        <h3 className="text-[12px] font-semibold text-[#3A3000]">
          {title}
        </h3>
        {/* Chevron rotates 90° when collapsed (points right) vs open
            (points down).  Lucide-style 2-px stroke so it reads at
            the same weight as the rest of the panel chrome. */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={cn(
            'flex-shrink-0 text-[#7A6500] transition-transform',
            open ? 'rotate-0' : '-rotate-90',
          )}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="flex flex-col pt-1">{children}</div>}
    </section>
  );
}

/**
 * `SubGroup` — used inside a Group when the cluster has more than
 * one related axis to switch (currently only "Report builder" uses
 * this, with Module panel + Canvas style).  Smaller, muted label so
 * it reads as a sub-heading rather than a peer of the Group's
 * title.  No top margin on the first sub-group; subsequent ones
 * get vertical breathing room so the two sub-clusters feel
 * distinct.
 */
function SubGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 first:mt-0">
      <p className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-[#7A6500]">
        {title}
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

/**
 * `OptionRow` — unified row for both radio (mutually-exclusive) and
 * checkbox (orthogonal toggle) scenarios.  One component handles
 * both because the visual treatment is identical — only the underlying
 * `<input type>` differs.  Each row renders:
 *
 *   • a 12-px label (semibold when active),
 *   • a 11-px muted description that names the observable effect
 *     ("3 reports without filters or pagination") rather than the
 *     implementation detail (kept in `hint` → `title=` tooltip),
 *   • a hidden native input on the left so accessibility / keyboard
 *     nav / form semantics still work cleanly,
 *   • a subtle active-state background + brand-yellow accent stripe
 *     on the left edge so the selected row is unmistakable at a glance.
 */
interface OptionRowProps {
  kind: 'radio' | 'checkbox';
  checked: boolean;
  label: string;
  description: string;
  hint: string;
  onChange: () => void;
  /** Required for radios — shared `name` keeps one-of-N selection
   *  semantics + arrow-key navigation native.  Unused for checkboxes. */
  name?: string;
}

function OptionRow({
  kind,
  checked,
  label,
  description,
  hint,
  onChange,
  name,
}: OptionRowProps) {
  return (
    <label
      title={hint}
      className={cn(
        'group relative flex items-start gap-2.5 px-2 py-1.5 rounded-[6px] cursor-pointer transition-colors',
        // Active state: soft cream tint + a 2-px brand-yellow left
        // accent so the selected row reads as such without bolding
        // every visible string.  Hover gets a lighter tint that
        // doesn't fight with the active state.
        checked
          ? 'bg-[#FFFAD9] hover:bg-[#FFF8C7]'
          : 'hover:bg-[#FAF6E8]',
      )}
    >
      {checked && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-[2px] bg-[#E5C200]"
        />
      )}
      <input
        type={kind}
        // Radios share a name; checkboxes don't (each is independent).
        {...(kind === 'radio' && name ? { name } : {})}
        checked={checked}
        onChange={onChange}
        // Keep the native input but visually muted — it sits in the
        // row as a small accessibility anchor while the row chrome
        // (active stripe + label weight) carries the visible state.
        className="mt-0.5 accent-[#B89200] flex-shrink-0"
      />
      <span className="flex-1 min-w-0 flex flex-col">
        <span
          className={cn(
            'text-[12px] leading-[16px] text-[#3A3000]',
            checked ? 'font-semibold' : 'font-normal',
          )}
        >
          {label}
        </span>
        <span className="text-[11px] leading-[14px] text-[#857047] mt-0.5">
          {description}
        </span>
      </span>
    </label>
  );
}
