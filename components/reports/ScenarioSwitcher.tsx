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
  TemplateScope,
} from '@/lib/scenario';
import { cn } from '@/lib/utils';

interface ScenarioSwitcherProps {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
}

// `hint` lives only as a hover tooltip now — the panel itself shows
// label-only rows so the switcher reads as a quick control surface,
// not a documentation page. Keep the descriptions here so anyone
// auditing the file still sees what each scenario means.
const TEMPLATE_SCOPES: { id: TemplateScope; label: string; hint: string }[] = [
  { id: 'full', label: 'Full network', hint: 'all 8 cards (current production target)' },
  { id: 'beta', label: 'Beta launch', hint: 'Scratch + TikTok + Instagram only' },
];

const REPORT_LIST_STATES: { id: ReportListState; label: string; hint: string }[] = [
  { id: 'empty',    label: 'Empty',     hint: 'no reports — first-run state' },
  { id: 'few',      label: 'Few',       hint: '3 reports — no Filter trigger' },
  { id: 'many',     label: 'Many',      hint: '99 reports — Filter trigger visible' },
  { id: 'filtered', label: 'Filtered',  hint: 'many + a pre-applied filter chip' },
];

// Independent capability flags. Unlike the radio sections above, both
// flags are toggled with checkboxes — they're orthogonal and any
// combination is valid (Rename on / Sorting off, both on, etc.).
const FEATURE_TOGGLES: { id: keyof ScenarioFeatures; label: string; hint: string }[] = [
  { id: 'rename',  label: 'Rename',  hint: 'pencil glyph + Rename row in the more-options menu' },
  { id: 'sorting', label: 'Sorting', hint: 'sort indicator icons + clickable column headers' },
];

export function ScenarioSwitcher({ scenario, onChange }: ScenarioSwitcherProps) {
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
  onCollapse: () => void;
}

function ExpandedPanel({
  scenario,
  onTemplateScope,
  onReportListState,
  onFeatureToggle,
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
        'w-[220px] rounded-l-md border border-r-0 border-dashed border-[#E5C200] bg-[#FFFCEA]',
        'shadow-[-2px_4px_12px_rgba(0,0,0,0.1)]',
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
          'flex items-center justify-between px-3 py-1.5 border-b border-dashed border-[#E5C200]',
          'select-none touch-none',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#7A6500]">
          Scenarios
        </span>
        <button
          type="button"
          data-no-drag
          onClick={onCollapse}
          aria-label="Collapse scenario switcher"
          className="w-5 h-5 flex items-center justify-center rounded text-[#7A6500] hover:bg-[#FFF8C7] transition-colors cursor-pointer"
        >
          {/* Lucide-style ✕ rendered inline so we don't pull a new icon. */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <Section title="Landing">
        {TEMPLATE_SCOPES.map((opt) => (
          <RadioRow
            key={opt.id}
            checked={scenario.templateScope === opt.id}
            label={opt.label}
            hint={opt.hint}
            onChange={() => onTemplateScope(opt.id)}
            name="template-scope"
          />
        ))}
      </Section>

      <Section title="Reports">
        {REPORT_LIST_STATES.map((opt) => (
          <RadioRow
            key={opt.id}
            checked={scenario.reportListState === opt.id}
            label={opt.label}
            hint={opt.hint}
            onChange={() => onReportListState(opt.id)}
            name="report-list-state"
          />
        ))}
      </Section>

      {/* Features — checkboxes (NOT radios) since the flags are
          orthogonal: any combination of {rename, sorting} ∈ {on, off}
          is valid. Both default OFF on first visit. */}
      <Section title="Features">
        {FEATURE_TOGGLES.map((opt) => (
          <CheckboxRow
            key={opt.id}
            checked={scenario.features[opt.id]}
            label={opt.label}
            hint={opt.hint}
            onChange={() => onFeatureToggle(opt.id)}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 border-b border-dashed border-[#E5C200] last:border-b-0">
      <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#7A6500] mb-1">
        {title}
      </p>
      {/* gap-0 — rows are tight enough that the radio + label visually
          group themselves; padding inside each row gives breathing
          room without needing extra vertical space between rows. */}
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

interface RadioRowProps {
  checked: boolean;
  label: string;
  /** Hover-only context. Stays out of the visible UI; surfaces via
   *  `title=` so a reviewer who's never seen the tool can still find
   *  out what each scenario means without bloating the layout. */
  hint: string;
  onChange: () => void;
  /** Shared `name` so native radio semantics keep one selection per
   *  group — accessibility + arrow-key navigation come for free. */
  name: string;
}

function RadioRow({ checked, label, hint, onChange, name }: RadioRowProps) {
  return (
    <label
      title={hint}
      className={cn(
        'flex items-center gap-2 px-2 py-[3px] rounded cursor-pointer transition-colors',
        // No bold "selected" fill — the radio's purple-yellow dot +
        // semibold label are enough to indicate state. Hover surfaces
        // a very light tint so the row still feels tappable.
        'hover:bg-[#FFF8C7]',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="accent-[#7A6500]"
      />
      <span
        className={cn(
          'flex-1 min-w-0 text-[12px] leading-[16px] text-[#3A3000]',
          checked ? 'font-semibold' : 'font-normal',
        )}
      >
        {label}
      </span>
    </label>
  );
}

// CheckboxRow — visually identical to RadioRow but uses an
// independent `<input type="checkbox">`.  Used by the Features
// section where each toggle is orthogonal (no shared `name` group).
interface CheckboxRowProps {
  checked: boolean;
  label: string;
  hint: string;
  onChange: () => void;
}

function CheckboxRow({ checked, label, hint, onChange }: CheckboxRowProps) {
  return (
    <label
      title={hint}
      className={cn(
        'flex items-center gap-2 px-2 py-[3px] rounded cursor-pointer transition-colors',
        'hover:bg-[#FFF8C7]',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-[#7A6500]"
      />
      <span
        className={cn(
          'flex-1 min-w-0 text-[12px] leading-[16px] text-[#3A3000]',
          checked ? 'font-semibold' : 'font-normal',
        )}
      >
        {label}
      </span>
    </label>
  );
}
