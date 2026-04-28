'use client';

/**
 * Audience by Country — bar variant. Horizontal bars with the country
 * name labelled inside the left edge of the bar and the percentage
 * pinned to the right end of the bar (shadcn "Bar Chart - Custom Label"
 * pattern). Per-bar fill comes from a 10-step blue ramp authored in
 * Figma 1310:191707, darkest = highest rank.
 *
 * The module is rendered inside `ModuleCard` which already supplies the
 * card chrome (header / actions / padding), so we drop the shadcn
 * `Card` / `CardHeader` / `CardFooter` shell from the original snippet
 * and emit just the chart + ModuleNetworks footer.
 *
 * Label color decision: white labels read on the darker top half of the
 * ramp but become invisible on the palest bottom-half tones. The
 * country-name label therefore picks white vs. dark text per row based
 * on the bar's color luminance — same data, no manual list to keep in
 * sync with the palette.
 */

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MockProfile } from '@/lib/profile-data';
import { MOCK_PIE_DATA } from '@/lib/mock-data';
import { ModuleNetworks } from './ModuleNetworks';
import { ModuleTooltip } from './ModuleTooltip';

interface AudienceByCountryBarModuleProps {
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

// Pick a readable text color for a label that sits inside a colored
// bar. We compare the bar's luminance against the WCAG mid-grey
// threshold (~0.5 in linearized space) and flip white ↔ dark
// accordingly. Inputs are 6-digit hex strings (`#RRGGBB`).
function readableLabelColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // sRGB → relative luminance (Rec. 709 coefficients).
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#201E24' : '#FFFFFF';
}

const LEGEND_RESERVE = 36;

export function AudienceByCountryBarModule({
  contentHeight,
  contentWidth = 0,
  profiles = [],
}: AudienceByCountryBarModuleProps) {
  const data = MOCK_PIE_DATA['audience-by-country'];
  const chartH = Math.max(contentHeight - LEGEND_RESERVE, 200);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="w-full" style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 48, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="#E8E8E9" />
          {/* Y axis carries the ordinal country list but is hidden — the
              country name is rendered inside each bar via LabelList so
              the chart reads as a single horizontal strip without an
              axis gutter. */}
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            hide
          />
          <XAxis dataKey="value" type="number" hide domain={[0, 'dataMax']} />
          <Tooltip
            cursor={false}
            content={
              <ModuleTooltip
                title={false}
                // Single-series bar — `entry.name` is the dataKey
                // ("value"), so reach through to the row's country name.
                getName={(e) => e.payload?.name ?? null}
                formatValue={(v) => `${v < 1 ? v.toFixed(1) : v}%`}
              />
            }
          />
          <Bar
            dataKey="value"
            radius={4}
            // `activeBar={false}` disables Recharts' default behavior of
            // swapping the hovered bar into a separate "active-bar" SVG
            // group. Without this, the inside-left and right LabelLists
            // are only painted on the inactive variant, so they flicker
            // out and back in as the cursor crosses each row. Plain
            // bars + custom labels stay perfectly stable on hover.
            activeBar={false}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
            <LabelList
              dataKey="name"
              position="insideLeft"
              offset={10}
              fontSize={12}
              fontFamily="IBM Plex Sans, sans-serif"
              // Per-row label color: light text on dark bars, dark text
              // on light bars. Recharts forwards the data row to the
              // formatter via the third argument's index lookup; we read
              // straight from the same data array we passed to <Bar>.
              content={(props) => {
                const { x, y, width, height, value, index } = props as {
                  x: number; y: number; width: number; height: number;
                  value: string; index: number;
                };
                const fill = readableLabelColor(data[index].color);
                // Skip the label if the bar is too narrow to fit any of
                // the country name — keeps the lowest-rank rows clean.
                if (width < 32) return null;
                return (
                  <text
                    x={x + 10}
                    y={y + height / 2}
                    dy={4}
                    fill={fill}
                    fontSize={12}
                    fontFamily="IBM Plex Sans, sans-serif"
                  >
                    {value}
                  </text>
                );
              }}
            />
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              fontSize={12}
              fontFamily="IBM Plex Sans, sans-serif"
              className="fill-foreground"
              formatter={(value) => {
                const v = Number(value);
                return v < 1 ? `${v.toFixed(1)}%` : `${v}%`;
              }}
            />
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer — same pattern as the list and pie variants: ranking
          footnote on the left, ModuleNetworks cluster on the right. */}
      <div className="flex items-center justify-between gap-4 mt-[8px]">
        <p
          className="text-[#79787B]"
          style={{
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 12,
            lineHeight: '16px',
            letterSpacing: '0.3px',
          }}
        >
          * Lifetime view across all published videos within the selected period.
        </p>
        <ModuleNetworks profiles={profiles} />
      </div>
    </div>
  );
}
