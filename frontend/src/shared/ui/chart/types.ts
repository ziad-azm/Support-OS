/** One point on a time axis. `bucket` is a `YYYY-MM-DD` date string, exactly
 * as `apps/reports/aggregation.py::bucketed_counts` emits it — a bucket is a
 * day/week/month, never an instant. */
export type ChartPoint = {
  bucket: string
  value: number
}

/** One named line. `label` is already translated by the caller — chart
 * components never call `t()` on data. */
export type ChartSeries = {
  key: string
  label: string
  points: readonly ChartPoint[]
}

/** One bar. Mirrors `grouped_counts`'s `{key, value}` plus the caller's
 * translated label; already sorted descending server-side (CONVENTIONS.md
 * § 25 line 1630) — a chart component must not re-sort. */
export type ChartCategory = {
  key: string
  label: string
  value: number
}
