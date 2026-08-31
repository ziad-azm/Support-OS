import type { ChartCategory } from './types'

const GRID_SIZE = 10
// Only a true percentage because GRID_SIZE is 10 (10*10 = 100 cells) — if
// GRID_SIZE ever changes, cellCounts stops being a 0-100 percentage and
// every formatValue call site below must change with it.
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE

function colorFor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
}

/**
 * Largest-remainder (Hamilton) apportionment: floor every category's
 * exact share of TOTAL_CELLS, then hand out the leftover cells to the
 * categories with the largest fractional remainder, largest first. A
 * naive Math.round per category can under- or over-shoot 100 (three
 * categories at 33.3% each round to 99, not 100) — this method always
 * sums to exactly TOTAL_CELLS. Verified against 8 cases including exact
 * thirds, a 2-way split, and a 5-way equal split — see Story 59
 * `## Prerequisites`.
 */
function allocateCells(values: readonly number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total === 0) return values.map(() => 0)
  const exact = values.map((v) => (v / total) * TOTAL_CELLS)
  const floors = exact.map(Math.floor)
  const remainders = exact.map((e, i) => e - floors[i])
  const remaining = TOTAL_CELLS - floors.reduce((sum, f) => sum + f, 0)
  const order = remainders.map((_, i) => i).sort((a, b) => remainders[b] - remainders[a])
  const result = [...floors]
  for (let i = 0; i < remaining; i++) result[order[i]] += 1
  return result
}

type WaffleChartProps = {
  categories: readonly ChartCategory[]
  /** Called with a 0-1 FRACTION (each category's share of TOTAL_CELLS),
   * matching every other percentage-shaped `formatValue` in this codebase
   * (`GaugeChart`, `SlaReportsPage`/`AgentReportsPage`'s own `number(v,
   * { style: 'percent' })` calls) — never a raw 0-100 cell count. */
  formatValue?: (n: number) => string
}

/**
 * A 10×10 grid, one square per percentage point — CONVENTIONS.md § 25
 * row 6 (RPT-4's satisfied/neutral/dissatisfied breakdown), explicitly
 * NOT Pie/Donut (`charts.csv` rates those risk:high for accessibility;
 * Waffle is risk:low for the identical Part-to-Whole use case).
 *
 * Individual cells are `aria-hidden` — 100 near-identical decorative
 * fragments of ONE aggregate percentage each are not 100 independent
 * data points the way a bar chart's bars are. The grid carries one
 * summary `role="img"`/`aria-label`; the LEGEND below it is real, visible
 * text (not ARIA-only) — that is what "always labeled with percentage
 * text" (§ 25) means here, backed by `ChartFrame`'s own mandatory
 * `ChartDataTable` fallback.
 */
export function WaffleChart({ categories, formatValue = String }: WaffleChartProps) {
  const counts = categories.map((c) => c.value)
  const cellCounts = allocateCells(counts)

  const cells: number[] = []
  cellCounts.forEach((count, categoryIndex) => {
    for (let i = 0; i < count; i++) cells.push(categoryIndex)
  })

  const summaryLabel = categories
    .map((c, i) => `${c.label}: ${formatValue(cellCounts[i] / TOTAL_CELLS)}`)
    .join(', ')

  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={summaryLabel}
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, maxWidth: 240 }}
      >
        {cells.map((categoryIndex, cellIndex) => (
          <div
            key={cellIndex}
            aria-hidden="true"
            className="aspect-square rounded-xs"
            style={{ backgroundColor: colorFor(categoryIndex) }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-4">
        {categories.map((category, index) => (
          <li key={category.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="size-3 rounded-xs"
              style={{ backgroundColor: colorFor(index) }}
            />
            {category.label}
            {' — '}
            {formatValue(cellCounts[index] / TOTAL_CELLS)}
          </li>
        ))}
      </ul>
    </div>
  )
}
