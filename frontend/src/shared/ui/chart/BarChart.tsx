import {
  Bar,
  BarChart as RechartsBarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useDirection } from '@/shared/i18n/useDirection'

import type { ChartCategory } from './types'

function colorFor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
}

type BarChartProps = {
  categories: readonly ChartCategory[]
  orientation?: 'vertical' | 'horizontal'
  formatValue?: (n: number) => string
}

/**
 * `recharts`-based bar chart — CONVENTIONS.md § 25 rows 2/5 (RPT-1 by
 * status/category/channel; RPT-3 ranked agents, `orientation="horizontal"`).
 * Never re-sorts: `grouped_counts` already orders descending server-side,
 * relied on by the CSV export of the same query — `categories` is passed to
 * recharts in the exact order given. Replaces the hand-built SVG version
 * (SUPPORTOS-105 task 3).
 *
 * This component's own `orientation` prop ('vertical' = bars grow upward,
 * the common case; 'horizontal' = bars grow sideways, ranked-agent charts)
 * is unchanged from before this task. Internally it maps to recharts's own,
 * oppositely-named `layout` prop ('horizontal' layout = upward bars,
 * 'vertical' layout = sideways bars).
 *
 * RTL: the relevant axis's `reversed` prop mirrors it — the category axis
 * for vertical bars, the value axis for horizontal bars.
 */
export function BarChart({
  categories,
  orientation = 'vertical',
  formatValue = String,
}: BarChartProps) {
  const direction = useDirection()
  const isHorizontal = orientation === 'horizontal'
  const data = [...categories]

  return (
    <ResponsiveContainer width="100%" height={256}>
      <RechartsBarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, left: isHorizontal ? 8 : 0, bottom: 8 }}
      >
        {isHorizontal ? (
          <>
            <XAxis
              type="number"
              tickFormatter={(value) => formatValue(Number(value))}
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
              reversed={direction === 'rtl'}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12 }}
              width={120}
              stroke="var(--muted-foreground)"
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
              reversed={direction === 'rtl'}
            />
            <YAxis
              tickFormatter={(value) => formatValue(Number(value))}
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
            />
          </>
        )}
        <Tooltip formatter={(value) => formatValue(Number(value))} />
        <Bar dataKey="value" isAnimationActive={false}>
          <LabelList
            dataKey="value"
            position={isHorizontal ? 'right' : 'top'}
            formatter={(value) => formatValue(Number(value))}
            className="fill-foreground text-xs"
          />
          {data.map((category, index) => (
            <Cell key={category.key} fill={colorFor(index)} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
