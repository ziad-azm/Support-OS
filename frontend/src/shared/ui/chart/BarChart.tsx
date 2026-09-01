import type { CSSProperties } from 'react'
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

// recharts's default value-axis domain is `[0, dataMax]`, which leaves zero
// headroom above/beside the tallest bar — the always-visible `<LabelList>`
// value label then gets clipped against the plot's own edge (visible as a
// sliver of cut-off text). Adding 15% headroom keeps every label fully
// inside the chart regardless of data shape.
function valueDomainWithHeadroom(max: number): number {
  return Math.ceil(max * 1.15) || 1
}

// recharts's <Tooltip> defaults to inline light-only styles (white
// background, dark-gray text) that don't follow this app's theme — a
// dark-mode viewer sees pale-gray-on-white, unreadable against the rest of
// the UI. Pinned to the same `--popover`/`--border` tokens `popover.tsx`'s
// shared primitive already uses, so it flips with `.dark` automatically.
const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  fontSize: 12,
}
const TOOLTIP_LABEL_STYLE: CSSProperties = { color: 'var(--popover-foreground)' }
const TOOLTIP_ITEM_STYLE: CSSProperties = { color: 'var(--popover-foreground)' }

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
              domain={[0, valueDomainWithHeadroom]}
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
              domain={[0, valueDomainWithHeadroom]}
              tickFormatter={(value) => formatValue(Number(value))}
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
            />
          </>
        )}
        <Tooltip
          formatter={(value) => formatValue(Number(value))}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ fill: 'var(--accent)' }}
        />
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
