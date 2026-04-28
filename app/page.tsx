'use client';

/**
 * App entry — owns the routing decision between the **Reports landing
 * page** (the list of saved reports + the "Build a new report" cards)
 * and the **Report Builder** (the canvas the user edits).
 *
 * State-machine instead of a real router because the project is a
 * single-route SPA today; we keep the contract narrow so it's trivial
 * to swap in `next/navigation` later without disturbing either child.
 *
 *   view: 'landing' | 'builder'
 *   activeReport: MockReport | null   ← what the builder is editing
 *
 * Navigation flow:
 *   • Landing row click          → setView('builder', report)
 *   • Landing template card      → seed a new report, navigate
 *   • Builder header close icon  → setView('landing')
 *   • Builder Save               → write back into `reports`
 */

import { useCallback, useState } from 'react';
import { ReportBuilderPage } from '@/components/report/ReportBuilderPage';
import { ReportsLandingPage } from '@/components/reports/ReportsLandingPage';
import {
  INITIAL_REPORTS,
  MockReport,
  ReportTemplate,
  templateSelectedProfileIds,
} from '@/lib/reports-data';
import { uid } from '@/lib/utils';
import { ReportModule } from '@/types';

type View =
  | { kind: 'landing' }
  // Existing report — looked up by id from `reports` so live updates
  // (rename, duplicate, save-from-builder) flow through the same row.
  | { kind: 'builder'; reportId: string }
  // Brand-new report being authored, NOT yet committed to the
  // landing-page list.  The draft lives inline on the view so it
  // disappears the moment the user navigates back without saving — no
  // ghost row left behind for "Untitled report" carcasses.  On first
  // Save, we prepend the draft to `reports` and switch the view to
  // `{ kind: 'builder', reportId }` so subsequent edits go through the
  // regular update path.
  | { kind: 'builder-draft'; draft: MockReport };

// Today's date in `YYYY-MM-DD` for the "modifiedAt" stamp on rename /
// duplicate / save. Lives outside the component so each render doesn't
// re-mint a Date instance unnecessarily.
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Re-issue ids on every module clone so the builder doesn't end up with
// two ReportModule rows that share `id` after a duplicate.
function reissueModuleIds(modules: ReportModule[]): ReportModule[] {
  return modules.map((m) => {
    const newId = `mod-${m.definitionId}-${uid()}`;
    return { ...m, id: newId, layout: { ...m.layout, i: newId } };
  });
}

export default function Home() {
  const [reports, setReports] = useState<MockReport[]>(INITIAL_REPORTS);
  const [view, setView] = useState<View>({ kind: 'landing' });

  // ── Landing → Builder transitions ─────────────────────────────────────────

  const handleOpen = useCallback((report: MockReport) => {
    setView({ kind: 'builder', reportId: report.id });
  }, []);

  // Template card click → mint a new MockReport as a DRAFT and open
  // it.  The draft is held inline on the view (`builder-draft`) and
  // intentionally NOT prepended to `reports` — the report only appears
  // on the landing page after the user clicks Save in the builder.
  // Hitting Back without saving discards the draft entirely so the
  // landing list never accumulates empty "Untitled report" rows from
  // abandoned sessions.
  const handleCreate = useCallback((template: ReportTemplate) => {
    const id = `report-${uid()}`;
    const draft: MockReport =
      template.kind === 'scratch'
        ? {
            id,
            name: 'Untitled report',
            modifiedAt: todayIso(),
            modules: [],
            networks: [],
            selectedProfileIds: [],
          }
        : {
            id,
            name: template.title,
            modifiedAt: todayIso(),
            modules: reissueModuleIds(template.modules()),
            networks: template.networks,
            // Quick-report defaults: single-network templates auto-pick
            // every profile attached to that network; the cross-platform
            // template picks every connected profile. The user can still
            // edit the selection from the builder's profile picker.
            selectedProfileIds: templateSelectedProfileIds(template),
          };
    setView({ kind: 'builder-draft', draft });
  }, []);

  // ── Builder → Landing transitions ─────────────────────────────────────────

  const handleBack = useCallback(() => {
    setView({ kind: 'landing' });
  }, []);

  // ── Row-level mutations (rename / duplicate / delete) ────────────────────

  const handleRename = useCallback((id: string, name: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name, modifiedAt: todayIso() } : r)),
    );
  }, []);

  const handleDuplicate = useCallback((id: string) => {
    setReports((prev) => {
      const src = prev.find((r) => r.id === id);
      if (!src) return prev;
      const dup: MockReport = {
        ...src,
        id: `report-${uid()}`,
        name: `${src.name} (copy)`,
        modifiedAt: todayIso(),
        // Each module needs a fresh id — the grid keys off `id` and a
        // collision would render the duplicated module twice in one row.
        modules: reissueModuleIds(src.modules),
        selectedProfileIds: [...src.selectedProfileIds],
      };
      // Insert directly after the source so the user can find the copy
      // without scrolling.
      const idx = prev.findIndex((r) => r.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Builder Save → write back into the list ──────────────────────────────

  const handleBuilderSave = useCallback(
    (id: string, snapshot: { title: string; modules: ReportModule[]; selectedProfileIds: string[] }) => {
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                name: snapshot.title,
                modules: snapshot.modules,
                selectedProfileIds: snapshot.selectedProfileIds,
                modifiedAt: todayIso(),
              }
            : r,
        ),
      );
    },
    [],
  );

  // First save of a draft — promote it from inline view state to a
  // real entry in `reports`, then flip the view to the regular
  // `{ kind: 'builder', reportId }` shape so subsequent saves go
  // through `handleBuilderSave`.  The builder's `key` is the report
  // id (same id throughout the draft → saved transition), so the
  // ReportBuilderPage instance is preserved — internal state (title
  // edits, module list, selection) doesn't reset across the save.
  const handleSaveDraft = useCallback(
    (
      draft: MockReport,
      snapshot: { title: string; modules: ReportModule[]; selectedProfileIds: string[] },
    ) => {
      const saved: MockReport = {
        ...draft,
        name: snapshot.title,
        modules: snapshot.modules,
        selectedProfileIds: snapshot.selectedProfileIds,
        modifiedAt: todayIso(),
      };
      setReports((prev) => [saved, ...prev]);
      setView({ kind: 'builder', reportId: saved.id });
    },
    [],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (view.kind === 'builder') {
    const active = reports.find((r) => r.id === view.reportId);
    // Defensive — if the active report was deleted out from under us
    // (shouldn't happen via the current UI, but keeps the navigation
    // contract honest) fall back to the landing page.
    if (!active) {
      setView({ kind: 'landing' });
      return null;
    }
    return (
      <ReportBuilderPage
        // `key` ensures the builder fully remounts when switching
        // between two saved reports — otherwise its useState seeds
        // would carry over from the previous report.
        key={active.id}
        initialTitle={active.name}
        initialModules={active.modules}
        initialProfileIds={active.selectedProfileIds}
        onBack={handleBack}
        onSave={(snapshot) => handleBuilderSave(active.id, snapshot)}
      />
    );
  }

  if (view.kind === 'builder-draft') {
    const { draft } = view;
    // Same `key` strategy as the saved-report branch — `draft.id` is
    // also the id the report will get once saved, so the ReportBuilder
    // instance survives the draft → saved transition without
    // remounting (which would clobber the user's mid-edit state).
    return (
      <ReportBuilderPage
        key={draft.id}
        initialTitle={draft.name}
        initialModules={draft.modules}
        initialProfileIds={draft.selectedProfileIds}
        onBack={handleBack}
        onSave={(snapshot) => handleSaveDraft(draft, snapshot)}
      />
    );
  }

  return (
    <ReportsLandingPage
      reports={reports}
      onOpen={handleOpen}
      onCreate={handleCreate}
      onRename={handleRename}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
    />
  );
}
