import type { CSSProperties } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useDirection } from '@/shared/i18n/useDirection'

import type { ChartSeries } from './types'

// Distinct dash pattern per series, applied alongside `--chart-N` — never
// hue alone (CONVENTIONS.md § 25 line 1629). `undefined` means a solid
// line, so the first series (the common case: one line) stays plain.
const SERIES_DASH: (string | undefined)[] = [undefined, '6 3', '2 3', '8 3 2 3', '1 3']

function colorFor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
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

function bucketDomain(series: readonly ChartSeries[]): readonly string[] {
  const buckets = new Set<string>()
  for (const s of series) {
    for (const point of s.points) buckets.add(point.bucket)
  }
  return [...buckets].sort()
}

type RechartsRow = { bucket: string } & Record<string, number | string>

function toRows(series: readonly ChartSeries[]): RechartsRow[] {
  return bucketDomain(series).map((bucket) => {
    const row: RechartsRow = { bucket }
    for (const s of series) {
      const point = s.points.find((p) => p.bucket === bucket)
      if (point) row[s.key] = point.value
    }
    return row
  })
}

type LineChartProps = {
  series: readonly ChartSeries[]
  formatValue?: (n: number) => string
  formatBucket?: (b: string) => string
}

/**
 * `recharts`-based line chart — CONVENTIONS.md § 25 rows 1/3/6 (RPT-1/RPT-2/
 * RPT-4 trends). Replaces the hand-built SVG version (SUPPORTOS-105 task 3,
 * a product decision to adopt a real charting library). `GaugeChart`/
 * `WaffleChart` stay hand-built — recharts has no native gauge-zone-bar or
 * waffle-grid primitive.
 *
 * RTL: `XAxis`'s own `reversed` prop mirrors the bucket axis — the same
 * effect `GaugeChart.tsx`'s manual `xFor()` achieves by hand, but native to
 * the library, so no per-point coordinate math is needed here.
 */
export function LineChart({
  series,
  formatValue = String,
  formatBucket = (b) => b,
}: LineChartProps) {
  const direction = useDirection()
  const rows = toRows(series)

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={256}>
        <RechartsLineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="bucket"
            reversed={direction === 'rtl'}
            tickFormatter={formatBucket}
            tick={{ fontSize: 12 }}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickFormatter={(value) => formatValue(Number(value))}
            tick={{ fontSize: 12 }}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            formatter={(value) => formatValue(Number(value))}
            labelFormatter={(label) => formatBucket(String(label))}
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ stroke: 'var(--border)' }}
          />
          {series.map((s, seriesIndex) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={colorFor(seriesIndex)}
              strokeWidth={2}
              strokeDasharray={SERIES_DASH[seriesIndex % SERIES_DASH.length]}
              dot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
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
