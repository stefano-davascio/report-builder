'use client';

/**
 * Scenario switcher — internal demo / review tool.
 *
 * Two independent state axes drive every "what does the landing page
 * look like in scenario X" answer:
 *
 *   • `templateScope`    — which Build-a-new-report carousel cards show.
 *   • `reportListState`  — which mocked dataset the reports table renders,
 *                          and which list-level chrome (search, pagination,
 *                          pre-applied filters) shows alongside it.
 *
 * The values are persisted to `localStorage` so a designer can set up a
 * scenario, take a screenshot, refresh the tab, and find the same view —
 * which is the whole point of the tool. Defaults reflect the production
 * shipping target ("full" template scope, "few" reports — i.e. the
 * landing page Sendible would actually expose to a real customer with a
 * handful of saved reports).
 *
 * NOT a product concept. Lives outside the app's data model. The page
 * tree only knows about derived `templates` / `reports` lists — nothing
 * inside the report builder, modules, or canvas references this hook.
 */

import { useEffect, useState } from 'react';

/** Carousel scope — drives which Build-a-new-report cards show. */
export type TemplateScope = 'full' | 'beta';

/** Reports table state — drives data + list-level chrome (search,
 *  pagination, filter chips). */
export type ReportListState = 'empty' | 'few' | 'many' | 'filtered';

export interface Scenario {
  templateScope: TemplateScope;
  reportListState: ReportListState;
}

const DEFAULT_SCENARIO: Scenario = {
  templateScope: 'full',
  reportListState: 'few',
};

const STORAGE_KEY = 'report-builder.scenario.v1';

// Read once on mount.  Guarded for SSR (`window` undefined) so the
// hook can be called from a Server Component or during prerender.
function readPersisted(): Scenario {
  if (typeof window === 'undefined') return DEFAULT_SCENARIO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCENARIO;
    const parsed = JSON.parse(raw) as Partial<Scenario>;
    // Validate every field — if localStorage is corrupted (older
    // version, hand-edited, …) we silently fall back to defaults
    // instead of letting the invalid value flow into the UI.
    const templateScope: TemplateScope =
      parsed.templateScope === 'full' || parsed.templateScope === 'beta'
        ? parsed.templateScope
        : DEFAULT_SCENARIO.templateScope;
    const reportListState: ReportListState =
      parsed.reportListState === 'empty' ||
      parsed.reportListState === 'few' ||
      parsed.reportListState === 'many' ||
      parsed.reportListState === 'filtered'
        ? parsed.reportListState
        : DEFAULT_SCENARIO.reportListState;
    return { templateScope, reportListState };
  } catch {
    return DEFAULT_SCENARIO;
  }
}

/**
 * `useScenario` — exposes the current scenario plus a setter that
 * also writes through to localStorage.  The first paint uses the
 * default values (so server + client agree on initial HTML); a
 * post-mount `useEffect` then upgrades to whatever was persisted on
 * the previous visit.  This avoids the classic Next.js hydration
 * mismatch where `localStorage` reads on the server vs client
 * produce diverging trees.
 */
export function useScenario(): [Scenario, (next: Scenario) => void] {
  const [scenario, setScenarioState] = useState<Scenario>(DEFAULT_SCENARIO);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const persisted = readPersisted();
    if (
      persisted.templateScope !== DEFAULT_SCENARIO.templateScope ||
      persisted.reportListState !== DEFAULT_SCENARIO.reportListState
    ) {
      setScenarioState(persisted);
    }
  }, []);

  const setScenario = (next: Scenario) => {
    setScenarioState(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage can throw in private browsing / quota scenarios;
        // a failed write is non-fatal — the in-memory state still
        // updates and the rest of the session works.
      }
    }
  };

  return [scenario, setScenario];
}
