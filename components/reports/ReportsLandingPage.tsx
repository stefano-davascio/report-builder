'use client';

/**
 * Reports landing page — Figma 1290:101688.
 *
 * Composition:
 *   • TopAppBar (Sendible chrome — utility row + main nav row).
 *   • A 1114-px-wide content column centered horizontally with the
 *     page padding pulled from Figma (`left-[calc(16.67%+19px)]`,
 *     translated to a max-width container so it stays centered at all
 *     viewport widths).
 *   • Vertical rhythm inside the column: 48 px between the page H1,
 *     the "Build a new report" carousel, and the reports table.
 *
 * Page background is WHITE (not the report-builder's #f3f3f4) — the
 * Figma surface color for the landing page is plain white with the
 * carousel section providing its own #f3f3f4 fill.
 *
 * Owns nothing — just delegates open / create / rename / duplicate /
 * delete callbacks upward to the parent route component.
 */

import { MockReport, REPORT_TEMPLATES, ReportTemplate } from '@/lib/reports-data';
import type { ScenarioFeatures } from '@/lib/scenario';
import { TopAppBar } from './TopAppBar';
import { BuildNewReportSection } from './BuildNewReportSection';
import { ReportsTable } from './ReportsTable';

interface ReportsLandingPageProps {
  reports: MockReport[];
  onOpen: (report: MockReport) => void;
  onCreate: (template: ReportTemplate) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Templates to surface in the Build-a-new-report carousel.  Defaults
   *  to the production list (`REPORT_TEMPLATES`) so existing callers
   *  don't need to change.  The Scenario Switcher passes a filtered
   *  subset for the "beta" template scope. */
  templates?: ReportTemplate[];
  /** Forwarded straight through to ReportsTable — see that component
   *  for the semantics of each. Optional so the production caller can
   *  omit them and get the existing default behavior. */
  filterEnabled?: boolean;
  initialFilters?: ReadonlySet<string>;
  /** Capability flags for in-development surfaces (rename, sorting).
   *  Threaded through to ReportsTable + ReportRow + ColumnHeader. */
  features?: ScenarioFeatures;
  /** When the underlying scenario changes the parent passes a new key
   *  here; we forward it onto ReportsTable so the table fully remounts
   *  (clearing search query, page index, and any user-applied filters)
   *  rather than clinging to state from the previous scenario. */
  scenarioKey?: string;
}

export function ReportsLandingPage({
  reports,
  onOpen,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  templates = REPORT_TEMPLATES,
  filterEnabled,
  initialFilters,
  features,
  scenarioKey,
}: ReportsLandingPageProps) {
  return (
    <div
      // Landing page is its own SCROLL CONTAINER. The app's
      // `<body>` is `flex flex-col overflow-hidden` (set in
      // app/layout.tsx so the report builder can run a fixed-viewport
      // shell with its own internal canvas scroll), which means the
      // body itself never scrolls — pages that want vertical scroll
      // must opt in by becoming their own scroller. `h-full
      // overflow-y-auto` does exactly that: fills the body's
      // viewport-sized flex slot and scrolls internally when the
      // landing content (carousel + 25-row "many" scenario + footer)
      // exceeds the viewport. `position: sticky` on descendants
      // (TopAppBar wrapper, the Reports header chrome) takes effect
      // relative to THIS scroll container.
      className="h-full overflow-y-auto bg-white"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {/* TopAppBar pinned to the scroll container's top — Figma
          1585:461063 (Many reports — after scroll) shows it stuck
          above the Reports section as the user scrolls. Wrapping at
          this level (rather than baking sticky into TopAppBar itself)
          keeps the component reusable in other contexts where
          stickiness might not be wanted (settings pages, modals).
          z-30 keeps the bar above the table's sticky chrome (z-20). */}
      <div className="sticky top-0 z-30 bg-[#F1F0F8]">
        <TopAppBar />
      </div>

      {/* Content column — Figma anchors it at left:calc(16.67%+19px)
          which centers a 1114-px column inside the page. The 1114-px
          column IS the section width (px-24 lives INSIDE each section,
          not on the page wrapper) so cards / table columns add up to
          exactly the Figma sum without double-padding. The Figma comp
          for this page (1295:124074) has no page-level "Reports" H1 —
          the only "Reports" label sits inside the table's header
          cluster — so we don't render one here either. */}
      <main className="max-w-[1114px] mx-auto pt-[40px] pb-[80px] flex flex-col gap-[48px]">
        <BuildNewReportSection templates={templates} onSelect={onCreate} />

        <ReportsTable
          key={scenarioKey}
          reports={reports}
          onOpen={onOpen}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          filterEnabled={filterEnabled}
          initialFilters={initialFilters}
          features={features}
        />
      </main>
    </div>
  );
}
