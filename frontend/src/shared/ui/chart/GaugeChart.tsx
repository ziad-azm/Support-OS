import { useTranslation } from 'react-i18next'

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

// Past this, the value label would overhang the track's end edge, so it is
// drawn INSIDE the performance bar instead. The SVG version placed it at
// `x + 4` unconditionally, which pushed "100%" outside the 600-unit viewBox
// and into the card's padding (F-7c).
const VALUE_INSIDE_FROM = 0.9

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

function percent(fraction: number): string {
  return `${Math.min(1, Math.max(0, fraction)) * 100}%`
}

/**
 * A small grid of "performance vs target" gauges — CONVENTIONS.md § 25
 * row 4 (RPT-2's breach rate) and row 7 (RPT-5 reuses this UNCHANGED, not
 * a new chart type). Each gauge is a 0-100% horizontal bar over three
 * fixed qualitative zones with a target marker, so lower is always
 * "better" — the correct framing for a breach RATE. Never color alone:
 * every gauge's percentage is also rendered as text, and the legend below
 * names each zone.
 *
 * CSS, not SVG (Story 102). The SVG version had a fixed `WIDTH = 600`
 * viewBox with a pixel height, so under the default
 * `preserveAspectRatio="xMidYMid meet"` it drew at 1:1 centred in its
 * container — roughly 280px of dead space on each side at desktop width
 * (F-7b) — while the first gauge's label, drawn at `y = -4`, fell outside
 * the viewBox entirely and was clipped (F-7a). Neither is fixable while
 * staying in SVG: the requirement is "bars stretch, text does not", and
 * uniform scaling cannot express it. These are horizontal bars with
 * labels, which HTML renders natively.
 *
 * RTL needs no coordinate branch any more — every offset is a logical
 * property, so direction is the browser's job. `npm run check:rtl` is the
 * gate that replaces Story 57's hand-verified `xFor()` algebra.
 */
export function GaugeChart({
  gauges,
  formatValue = (n) => `${Math.round(n * 100)}%`,
}: GaugeChartProps) {
  const { t } = useTranslation()

  const zones = [
    { key: 'good', color: ZONE_GOOD, basis: GOOD_THRESHOLD },
    { key: 'ok', color: ZONE_OK, basis: WARN_THRESHOLD - GOOD_THRESHOLD },
    { key: 'bad', color: ZONE_BAD, basis: 1 - WARN_THRESHOLD },
  ]

  return (
    <div className="flex flex-col gap-4">
      {gauges.map((gauge) => {
        // Clamped: a rate above 1 is possible from a bad aggregate and must
        // not paint past the track or break the row.
        const clamped = Math.min(1, Math.max(0, gauge.value))
        const inside = clamped >= VALUE_INSIDE_FROM
        const label = `${gauge.label}: ${formatValue(gauge.value)}`

        return (
          <div
            key={gauge.key}
            // A real focusable element with a real focus ring — the SVG
            // version put `tabIndex={0}` on a <rect>, which is an invisible
            // tab stop (F-19).
            tabIndex={0}
            role="img"
            aria-label={label}
            className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {/* Above the track, so nothing can clip it (F-7a). */}
            <p className="mb-1 text-xs text-foreground">{gauge.label}</p>

            <div className="relative h-7 w-full overflow-hidden rounded-sm">
              {/* Zones tile the full track, in order, from the inline-start
                  edge. `flex` handles direction; no coordinate maths. */}
              <div className="absolute inset-0 flex" aria-hidden="true">
                {zones.map((zone) => (
                  <div
                    key={zone.key}
                    style={{
                      flexBasis: percent(zone.basis),
                      backgroundColor: zone.color,
                      opacity: ZONE_OPACITY,
                    }}
                  />
                ))}
              </div>

              {/* The measured value. */}
              <div
                aria-hidden="true"
                className="absolute inset-y-0 start-0 my-auto h-3.5 rounded-e-sm"
                style={{ inlineSize: percent(clamped), backgroundColor: PERFORMANCE_COLOR }}
              />

              {/* Target marker at GOOD_THRESHOLD. */}
              <div
                aria-hidden="true"
                className="absolute inset-y-0 w-0.5 bg-foreground"
                style={{ insetInlineStart: percent(GOOD_THRESHOLD) }}
              />

              {/* Inside the bar once it is long enough, so it can never
                  overhang the track (F-7c). */}
              <span
                aria-hidden="true"
                className={
                  inside
                    ? 'absolute inset-y-0 flex items-center pe-2 text-xs font-medium text-background'
                    : 'absolute inset-y-0 flex items-center ps-2 text-xs font-medium text-foreground'
                }
                style={
                  inside
                    ? {
                        insetInlineStart: 0,
                        inlineSize: percent(clamped),
                        justifyContent: 'flex-end',
                      }
                    : { insetInlineStart: percent(clamped) }
                }
              >
                {formatValue(gauge.value)}
              </span>
            </div>
          </div>
        )
      })}

      {/* F-7d: the zones and the marker were never explained on screen — a
          reader could not tell whether red was the track or the value. */}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {[
          { key: 'good', color: ZONE_GOOD, label: t('chart.gauge.zoneGood') },
          { key: 'ok', color: ZONE_OK, label: t('chart.gauge.zoneOk') },
          { key: 'bad', color: ZONE_BAD, label: t('chart.gauge.zoneBad') },
        ].map((zone) => (
          <li key={zone.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-xs"
              style={{ backgroundColor: zone.color, opacity: ZONE_OPACITY }}
            />
            {zone.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-0.5 bg-foreground" />
          {t('chart.gauge.target')}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-3 rounded-xs"
            style={{ backgroundColor: PERFORMANCE_COLOR }}
          />
          {t('chart.gauge.measured')}
        </li>
      </ul>
    </div>
  )
}
