'use client';

import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { ChartType, MockDataPoint } from '@/types';
import { CHART_COLORS } from '@/lib/mock-data';
import { ModuleTooltip } from './ModuleTooltip';

interface ChartRendererProps {
  chartType: ChartType;
  data: MockDataPoint[];
  height?: number;
  color?: string;
  secondaryColor?: string;
  showSecondary?: boolean;
}

// Legacy fallback renderer — now routes through the shared
// `ModuleTooltip` so its visual chrome (circle dots, design-system
// colors) matches every other chart in the report.
const CustomTooltip = ModuleTooltip;

function formatYAxis(value: number): string {
  if (value < 0) return '';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function ChartRenderer({
  chartType,
  data,
  height = 200,
  color = CHART_COLORS.primary,
  secondaryColor = CHART_COLORS.secondary,
  showSecondary = false,
}: ChartRendererProps) {
  const commonProps = {
    data,
    margin: { top: 4, right: 4, left: -20, bottom: 0 },
  };

  const axisProps = {
    xAxis: (
      <XAxis
        dataKey="date"
        tick={{ fontSize: 10, fill: CHART_COLORS.text }}
        tickLine={false}
        axisLine={false}
        interval="preserveStartEnd"
      />
    ),
    yAxis: (
      <YAxis
        tick={{ fontSize: 10, fill: CHART_COLORS.text }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatYAxis}
        width={44}
        domain={['auto', 'auto']}
        tickCount={4}
      />
    ),
    grid: <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />,
    tooltip: <Tooltip content={<CustomTooltip />} />,
  };

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            {showSecondary && (
              <linearGradient id={`grad2-${secondaryColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          <Area
            type="monotone"
            dataKey="value"
            name="Value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${color.replace('#', '')})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          {showSecondary && (
            <Area
              type="monotone"
              dataKey="value2"
              name="Value 2"
              stroke={secondaryColor}
              strokeWidth={2}
              fill={`url(#grad2-${secondaryColor.replace('#', '')})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart {...commonProps}>
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          <Line
            type="monotone"
            dataKey="value"
            name="Value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: color }}
          />
          {showSecondary && (
            <Line
              type="monotone"
              dataKey="value2"
              name="Value 2"
              stroke={secondaryColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: secondaryColor }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart {...commonProps} barCategoryGap="30%">
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          <Bar dataKey="value" name="Value" fill={color} radius={[3, 3, 0, 0]} />
          {showSecondary && (
            <Bar dataKey="value2" name="Value 2" fill={secondaryColor} radius={[3, 3, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

interface PieChartRendererProps {
  data: { name: string; value: number; color: string }[];
  height?: number;
  donut?: boolean;
}

// Same shared chrome as the other charts. Pie payloads put the slice
// color on `payload[0].payload.color` and the slice name on
// `payload[0].name`; ModuleTooltip's defaults handle both.
const PieTooltip = (props: Parameters<typeof ModuleTooltip>[0]) => (
  <ModuleTooltip {...props} title={false} formatValue={(v) => `${v}%`} />
);

export function PieChartRenderer({ data, height = 200, donut = false }: PieChartRendererProps) {
  const innerRadius = donut ? '55%' : 0;

  return (
    <div className="flex flex-col gap-3 h-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius="75%"
            dataKey="value"
            strokeWidth={2}
            stroke="white"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 px-1">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600">{entry.name}</span>
            </div>
            <span className="font-medium text-gray-800">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
