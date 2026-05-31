'use client';

// ─── ChartStyleContext ──────────────────────────────────────────────────
//
// Single-axis context that lets every Recharts `<Area>` / `<Line>` in
// the report-builder pick its curve interpolation from one
// scenario-driven setting instead of hard-coding `type="monotone"` at
// each call site.  The scenario layer owns the source of truth
// (`Scenario.chartCurveStyle`); `<ChartStyleProvider>` wraps the
// builder once at the top, and `useChartCurveStyle()` reads the
// current value anywhere inside the tree.
//
// Default is `'linear'` so a chart rendered outside the provider
// (storybook, isolated tests) renders in the new design's straight-
// segment style without any extra wiring.

import { createContext, useContext, type ReactNode } from 'react';
import type { ChartCurveStyle } from './scenario';

const ChartCurveStyleContext = createContext<ChartCurveStyle>('linear');

interface ChartStyleProviderProps {
  curveStyle: ChartCurveStyle;
  children: ReactNode;
}

export function ChartStyleProvider({ curveStyle, children }: ChartStyleProviderProps) {
  return (
    <ChartCurveStyleContext.Provider value={curveStyle}>
      {children}
    </ChartCurveStyleContext.Provider>
  );
}

/**
 * Read the active chart curve style.  Safe to call outside the
 * provider — returns `'linear'` (the design-system default) so
 * isolated chart renders don't blow up.
 */
export function useChartCurveStyle(): ChartCurveStyle {
  return useContext(ChartCurveStyleContext);
}
