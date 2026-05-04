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

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ReportListState,
  Scenario,
  TemplateScope,
} from '@/lib/scenario';
import { cn } from '@/lib/utils';

interface ScenarioSwitcherProps {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
}

const TEMPLATE_SCOPES: { id: TemplateScope; label: string; hint: string }[] = [
  { id: 'full', label: 'Full network', hint: 'all 8 cards (current production target)' },
  { id: 'beta', label: 'Beta launch', hint: 'Scratch + TikTok + Instagram only' },
];

const REPORT_LIST_STATES: { id: ReportListState; label: string; hint: string }[] = [
  { id: 'empty',    label: 'Empty',     hint: 'no reports — first-run state' },
  { id: 'few',      label: 'Few',       hint: '3 reports — no search / pagination' },
  { id: 'many',     label: 'Many',      hint: '25 reports — search + pagination' },
  { id: 'filtered', label: 'Filtered',  hint: 'pre-applied filter chip' },
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

  return createPortal(
    <div
      // `fixed` so it never participates in the page's flex/grid math —
      // a designer toggling scenarios never sees content reflow because
      // of the panel itself.  `pointer-events-none` on the wrapper
      // means clicks elsewhere on the page fall through; the inner
      // chrome re-enables events for the clickable surfaces.
      className="fixed top-1/2 right-0 z-[1000] -translate-y-1/2 pointer-events-none"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
    >
      {open ? (
        <ExpandedPanel
          scenario={scenario}
          onTemplateScope={handleTemplateScope}
          onReportListState={handleReportListState}
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
  onCollapse: () => void;
}

function ExpandedPanel({
  scenario,
  onTemplateScope,
  onReportListState,
  onCollapse,
}: ExpandedPanelProps) {
  return (
    <div
      // Pointer events re-enabled here so radios + close button are
      // clickable; the wrapper one level up is `pointer-events-none`
      // so empty space outside the panel still passes clicks through
      // to the underlying page.
      className={cn(
        'pointer-events-auto',
        'w-[280px] rounded-l-md border border-r-0 border-dashed border-[#E5C200] bg-[#FFFCEA]',
        'shadow-[-2px_4px_12px_rgba(0,0,0,0.1)]',
        'text-[12px] text-[#3A3000]',
      )}
    >
      {/* Header — DEMO TOOL chip + collapse button. */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dashed border-[#E5C200]">
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#7A6500]">
          Demo Tool · Scenarios
        </span>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse scenario switcher"
          className="w-5 h-5 flex items-center justify-center rounded text-[#7A6500] hover:bg-[#FFF8C7] transition-colors"
        >
          {/* Lucide-style ✕ rendered inline so we don't pull a new icon. */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <Section title="Landing page">
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

      <Section title="Reports list">
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

      <p className="px-3 py-2 text-[10px] leading-[14px] text-[#7A6500] border-t border-dashed border-[#E5C200]">
        Internal demo state — not visible to customers. Persisted to
        localStorage.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-b border-dashed border-[#E5C200] last:border-b-0">
      <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#7A6500] mb-1.5">
        {title}
      </p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

interface RadioRowProps {
  checked: boolean;
  label: string;
  hint: string;
  onChange: () => void;
  /** Shared `name` so native radio semantics keep one selection per
   *  group — accessibility + arrow-key navigation come for free. */
  name: string;
}

function RadioRow({ checked, label, hint, onChange, name }: RadioRowProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-2 px-2 py-1 rounded cursor-pointer transition-colors',
        checked ? 'bg-[#FFF1A8]' : 'hover:bg-[#FFF8C7]',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-[#7A6500]"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-medium text-[#3A3000]">
          {label}
        </span>
        <span className="block text-[10px] leading-[14px] text-[#7A6500]">
          {hint}
        </span>
      </span>
    </label>
  );
}
