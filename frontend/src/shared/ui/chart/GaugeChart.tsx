import { useDirection } from '@/shared/i18n/useDirection'

const WIDTH = 600
const BAR_HEIGHT = 28
const GAP = 16

// CONVENTIONS.md § 25 row 4's literal qualitative-zone triple (bad/ok/good)
// and performance-bar color — RPT-2 is the first real consumer naming
// these, RPT-5 reuses this component unchanged (§ 25 line 1636). Originally
// hardcoded light-only hex values (never revisited when `LineChart`/
// `BarChart` were rebuilt on `recharts` and given the same dark-mode
// treatment, SUPPORTOS-105) — now the same theme-aware tokens `badge.tsx`
// uses for the identical semantic meanings (success/warning/destructive),
// at reduced opacity so the always-bold `PERFORMANCE_COLOR` bar drawn on
// top still reads as the distinct data indicator, not just another zone.
// Target = GOOD_THRESHOLD: no "acceptable breach rate" setting exists
// anywhere in this codebase, so this is a first-cut default a later story
// can promote to a real setting if needed.
const ZONE_GOOD = 'var(--success)'
const ZONE_OK = 'var(--warning)'
const ZONE_BAD = 'var(--destructive)'
const ZONE_OPACITY = 0.3
const PERFORMANCE_COLOR = 'var(--chart-1)'
const GOOD_THRESHOLD = 0.1
const WARN_THRESHOLD = 0.25

export type GaugeValue = {
  key: string
  label: string
  /** 0-1 fraction, e.g. a breach rate. */
  value: number
}

type GaugeChartProps = {
  gauges: readonly GaugeValue[]
  formatValue?: (n: number) => string
}

/**
 * A small grid of "performance vs target" gauges — CONVENTIONS.md § 25
 * row 4 (RPT-2's breach rate) and row 7 (RPT-5 reuses this UNCHANGED, not
 * a new chart type). Each gauge is a 0-100% horizontal bar over three
 * fixed qualitative zones with a target marker, so lower is always
 * "better" — the correct framing for a breach RATE. Never color alone:
 * every gauge's percentage is also rendered as text.
 */
export function GaugeChart({
  gauges,
  formatValue = (n) => `${Math.round(n * 100)}%`,
}: GaugeChartProps) {
  const direction = useDirection()
  const height = gauges.length * (BAR_HEIGHT + GAP)

  // Maps a 0-1 fraction to an x coordinate, flipping under RTL so "0%"
  // sits at the visual start-edge in either direction. Every rect below
  // is built from Math.min/Math.max of two xFor() calls rather than a
  // direction-branched x/width pair, so the three zones tile the full
  // bar with no gap or overlap in both directions — verified algebraically
  // (Story 57 `## Verification Steps`).
  function xFor(fraction: number): number {
    const clamped = Math.min(1, Math.max(0, fraction))
    return direction === 'rtl' ? WIDTH - clamped * WIDTH : clamped * WIDTH
  }

  function zoneRect(from: number, to: number) {
    const x = Math.min(xFor(from), xFor(to))
    const width = Math.abs(xFor(to) - xFor(from))
    return { x, width }
  }

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" style={{ height }} role="img">
      {gauges.map((gauge, index) => {
        const y = index * (BAR_HEIGHT + GAP)
        const good = zoneRect(0, GOOD_THRESHOLD)
        const ok = zoneRect(GOOD_THRESHOLD, WARN_THRESHOLD)
        const bad = zoneRect(WARN_THRESHOLD, 1)
        const performance = zoneRect(0, gauge.value)
        const targetX = xFor(GOOD_THRESHOLD)
        const label = `${gauge.label}: ${formatValue(gauge.value)}`

        return (
          <g key={gauge.key}>
            <text
              x={xFor(0)}
              y={y - 4}
              textAnchor={direction === 'rtl' ? 'end' : 'start'}
              className="fill-foreground text-xs"
            >
              {gauge.label}
            </text>
            <rect
              x={good.x}
              y={y}
              width={good.width}
              height={BAR_HEIGHT}
              fill={ZONE_GOOD}
              fillOpacity={ZONE_OPACITY}
            />
            <rect
              x={ok.x}
              y={y}
              width={ok.width}
              height={BAR_HEIGHT}
              fill={ZONE_OK}
              fillOpacity={ZONE_OPACITY}
            />
            <rect
              x={bad.x}
              y={y}
              width={bad.width}
              height={BAR_HEIGHT}
              fill={ZONE_BAD}
              fillOpacity={ZONE_OPACITY}
            />
            <rect
              x={performance.x}
              y={y + BAR_HEIGHT / 4}
              width={performance.width}
              height={BAR_HEIGHT / 2}
              fill={PERFORMANCE_COLOR}
              tabIndex={0}
              role="img"
              aria-label={label}
            >
              <title>{label}</title>
            </rect>
            <line
              x1={targetX}
              y1={y - 2}
              x2={targetX}
              y2={y + BAR_HEIGHT + 2}
              stroke="var(--foreground)"
              strokeWidth={3}
            />
            <text
              x={direction === 'rtl' ? xFor(gauge.value) - 4 : xFor(gauge.value) + 4}
              y={y + BAR_HEIGHT / 2}
              dominantBaseline="middle"
              textAnchor={direction === 'rtl' ? 'end' : 'start'}
              className="fill-foreground text-xs font-medium"
            >
              {formatValue(gauge.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
