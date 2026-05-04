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
  searchEnabled?: boolean;
  paginationEnabled?: boolean;
  initialFilters?: ReadonlySet<string>;
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
  searchEnabled,
  paginationEnabled,
  initialFilters,
  scenarioKey,
}: ReportsLandingPageProps) {
  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      <TopAppBar />

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
          searchEnabled={searchEnabled}
          paginationEnabled={paginationEnabled}
          initialFilters={initialFilters}
        />
      </main>
    </div>
  );
}
