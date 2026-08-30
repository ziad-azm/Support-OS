import { useDirection } from '@/shared/i18n/useDirection'

import type { ChartSeries } from './types'

const WIDTH = 600
const HEIGHT = 280
const PADDING = 32

// Distinct dash pattern per series, applied alongside `--chart-N` — never
// hue alone (CONVENTIONS.md § 25 line 1629). `undefined` means a solid
// line, so the first series (the common case: one line) stays plain.
const SERIES_DASH: (string | undefined)[] = [undefined, '6 3', '2 3', '8 3 2 3', '1 3']

function colorFor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
}

function bucketDomain(series: readonly ChartSeries[]): readonly string[] {
  const buckets = new Set<string>()
  for (const s of series) {
    for (const point of s.points) buckets.add(point.bucket)
  }
  return [...buckets].sort()
}

function valueRange(series: readonly ChartSeries[]): { min: number; max: number } {
  let min = 0
  let max = 0
  let seen = false
  for (const s of series) {
    for (const point of s.points) {
      if (!seen) {
        min = point.value
        max = point.value
        seen = true
      } else {
        min = Math.min(min, point.value)
        max = Math.max(max, point.value)
      }
    }
  }
  if (!seen) return { min: 0, max: 1 }
  return { min: Math.min(0, min), max }
}

type LineChartProps = {
  series: readonly ChartSeries[]
  formatValue?: (n: number) => string
  formatBucket?: (b: string) => string
}

/**
 * Plain SVG line chart — CONVENTIONS.md § 25 rows 1/3/6 (RPT-1/RPT-2/RPT-4
 * trends). No chart library; see Story 55 `## Product rules` for why.
 */
export function LineChart({
  series,
  formatValue = String,
  formatBucket = (b) => b,
}: LineChartProps) {
  const direction = useDirection()
  const buckets = bucketDomain(series)
  const { min, max } = valueRange(series)
  const range = max - min || 1
  const plotWidth = WIDTH - PADDING * 2
  const plotHeight = HEIGHT - PADDING * 2

  function xForIndex(index: number): number {
    const t = buckets.length > 1 ? index / (buckets.length - 1) : 0.5
    const offset = t * plotWidth
    return direction === 'rtl' ? WIDTH - PADDING - offset : PADDING + offset
  }

  function yForValue(value: number): number {
    return HEIGHT - PADDING - ((value - min) / range) * plotHeight
  }

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-64 w-full"
        role="img"
      >
        {series.map((s, seriesIndex) => {
          const sortedPoints = [...s.points].sort((a, b) => a.bucket.localeCompare(b.bucket))
          const color = colorFor(seriesIndex)
          const dash = SERIES_DASH[seriesIndex % SERIES_DASH.length]

          const path = sortedPoints
            .map((point, pointIndex) => {
              const bucketIndex = buckets.indexOf(point.bucket)
              const x = xForIndex(bucketIndex)
              const y = yForValue(point.value)
              return `${pointIndex === 0 ? 'M' : 'L'}${x},${y}`
            })
            .join(' ')

          return (
            <g key={s.key}>
              {sortedPoints.length > 1 ? (
                <path d={path} fill="none" stroke={color} strokeWidth={2} strokeDasharray={dash} />
              ) : null}
              {sortedPoints.map((point) => {
                const bucketIndex = buckets.indexOf(point.bucket)
                const x = xForIndex(bucketIndex)
                const y = yForValue(point.value)
                const label = `${s.label}, ${formatBucket(point.bucket)}: ${formatValue(point.value)}`
                return (
                  <circle
                    key={point.bucket}
                    cx={x}
                    cy={y}
                    r={4}
                    fill={color}
                    tabIndex={0}
                    role="img"
                    aria-label={label}
                  >
                    <title>{label}</title>
                  </circle>
                )
              })}
            </g>
          )
        })}
      </svg>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-4">
          {series.map((s, seriesIndex) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <svg width={20} height={8} aria-hidden="true">
                <line
                  x1={0}
                  y1={4}
                  x2={20}
                  y2={4}
                  stroke={colorFor(seriesIndex)}
                  strokeWidth={2}
                  strokeDasharray={SERIES_DASH[seriesIndex % SERIES_DASH.length]}
                />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
