import { useDirection } from '@/shared/i18n/useDirection'

import type { ChartCategory } from './types'

const WIDTH = 600
const HEIGHT = 280
const PADDING = 32
const BAR_GAP_RATIO = 0.3

function colorFor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
}

type BarChartProps = {
  categories: readonly ChartCategory[]
  orientation?: 'vertical' | 'horizontal'
  formatValue?: (n: number) => string
}

/**
 * Plain SVG bar chart — CONVENTIONS.md § 25 rows 2/5 (RPT-1 by
 * status/category/channel; RPT-3 ranked agents, `orientation="horizontal"`,
 * § 25 line 1633). Never re-sorts: `grouped_counts` already orders
 * descending server-side, and the CSV export of the same query relies on
 * that same order. No chart library; see Story 55 `## Product rules`.
 */
export function BarChart({
  categories,
  orientation = 'vertical',
  formatValue = String,
}: BarChartProps) {
  const direction = useDirection()
  const maxValue = Math.max(1, ...categories.map((c) => c.value))
  const plotWidth = WIDTH - PADDING * 2
  const plotHeight = HEIGHT - PADDING * 2
  const count = Math.max(1, categories.length)

  if (orientation === 'horizontal') {
    const bandHeight = plotHeight / count
    const barHeight = bandHeight * (1 - BAR_GAP_RATIO)
    return (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-64 w-full"
        role="img"
      >
        {categories.map((category, index) => {
          const barLength = (category.value / maxValue) * plotWidth
          const y = PADDING + index * bandHeight + (bandHeight - barHeight) / 2
          const x = direction === 'rtl' ? WIDTH - PADDING - barLength : PADDING
          const labelX = direction === 'rtl' ? x - 4 : x + barLength + 4
          const label = `${category.label}: ${formatValue(category.value)}`
          return (
            <g key={category.key}>
              <rect
                x={x}
                y={y}
                width={barLength}
                height={barHeight}
                fill={colorFor(index)}
                tabIndex={0}
                role="img"
                aria-label={label}
              >
                <title>{label}</title>
              </rect>
              <text
                x={labelX}
                y={y + barHeight / 2}
                dominantBaseline="middle"
                textAnchor={direction === 'rtl' ? 'end' : 'start'}
                className="fill-foreground text-xs"
              >
                {formatValue(category.value)}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const bandWidth = plotWidth / count
  const barWidth = bandWidth * (1 - BAR_GAP_RATIO)
  const orderedCategories = direction === 'rtl' ? [...categories].reverse() : categories

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-64 w-full"
      role="img"
    >
      {orderedCategories.map((category, index) => {
        const barHeight = (category.value / maxValue) * plotHeight
        const x = PADDING + index * bandWidth + (bandWidth - barWidth) / 2
        const y = HEIGHT - PADDING - barHeight
        const label = `${category.label}: ${formatValue(category.value)}`
        return (
          <g key={category.key}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={colorFor(index)}
              tabIndex={0}
              role="img"
              aria-label={label}
            >
              <title>{label}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={y - 4}
              textAnchor="middle"
              className="fill-foreground text-xs"
            >
              {formatValue(category.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
