import { ReportModule } from '@/types';

// Heights and Y positions below are expressed in OLD-units (1 Figma cell
// = 6 rows). The canvas now runs RGL with rowHeight=2 + a 16 px
// transparent padding-bottom on each grid item, where 1 Figma cell = 78
// rows; we scale h/y/minH by 13 (= 78 / 6) at the bottom of this
// file via `scaleChartLayout()`. The literal values stay readable so the
// "visual guide" mental model (1 cell = 6 rows) matches what the code
// reads top-to-bottom.
//
// Starter layout — atomic modules from the Cross-network track so the
// board isn't empty on first load:
//   Row band 0 (y=0,  h=6,  1 cell):  four single-metric cards across
//                                      (followers | reach | impressions | engagement-rate)
//   Row band 1 (y=6,  h=18, 3 cells): audience-growth | audience-by-gender
//   Row band 2 (y=24, h=24, 4 cells): audience-by-country (full width, 10-row list)
//   Row band 3 (y=48, h=24, 4 cells): top-posts (full width, list)
const RAW_DEFAULT_MODULES: ReportModule[] = [
  {
    id: 'mod-followers',
    definitionId: 'followers',
    chartType: 'metric',
    layout: { i: 'mod-followers', x: 0, y: 0, w: 1, h: 6, minW: 1, minH: 6 },
  },
  {
    id: 'mod-reach',
    definitionId: 'reach',
    chartType: 'metric',
    layout: { i: 'mod-reach', x: 1, y: 0, w: 1, h: 6, minW: 1, minH: 6 },
  },
  {
    id: 'mod-impressions',
    definitionId: 'impressions',
    chartType: 'metric',
    layout: { i: 'mod-impressions', x: 2, y: 0, w: 1, h: 6, minW: 1, minH: 6 },
  },
  {
    id: 'mod-engagement-rate',
    definitionId: 'engagement-rate',
    chartType: 'metric',
    layout: { i: 'mod-engagement-rate', x: 3, y: 0, w: 1, h: 6, minW: 1, minH: 6 },
  },
  {
    id: 'mod-audience-growth',
    definitionId: 'audience-growth',
    chartType: 'area',
    layout: { i: 'mod-audience-growth', x: 0, y: 6, w: 2, h: 18, minW: 1, minH: 12 },
  },
  {
    id: 'mod-audience-by-gender',
    definitionId: 'audience-by-gender',
    chartType: 'pie',
    layout: { i: 'mod-audience-by-gender', x: 2, y: 6, w: 2, h: 18, minW: 1, minH: 12 },
  },
  {
    id: 'mod-audience-by-country',
    definitionId: 'audience-by-country',
    chartType: 'list',
    layout: { i: 'mod-audience-by-country', x: 0, y: 24, w: 4, h: 24, minW: 1, minH: 18 },
  },
  {
    id: 'mod-top-posts',
    definitionId: 'top-posts',
    chartType: 'list',
    layout: { i: 'mod-top-posts', x: 0, y: 48, w: 4, h: 24, minW: 2, minH: 12 },
  },
];

// ── OLD→NEW-units transform ──────────────────────────────────────────────
//
// Scale chart-shaped modules' vertical layout fields (y, h, minH) by
// `CHART_H_FACTOR`. Mirrors the constant of the same name in
// ReportCanvas.tsx — keep the two in sync. Mid-row text/heading elements
// inside a saved layout (those carry `elementKind`) are passed through
// unchanged because their h is already in NEW-units.
const CHART_H_FACTOR = 13;
export function scaleChartLayout(modules: ReportModule[]): ReportModule[] {
  return modules.map((m) => {
    if (m.elementKind) return m;
    const { y, h, minH, ...rest } = m.layout;
    return {
      ...m,
      layout: {
        ...rest,
        y: y * CHART_H_FACTOR,
        h: h * CHART_H_FACTOR,
        ...(minH !== undefined ? { minH: minH * CHART_H_FACTOR } : {}),
      },
    };
  });
}

export const DEFAULT_MODULES: ReportModule[] = scaleChartLayout(RAW_DEFAULT_MODULES);
