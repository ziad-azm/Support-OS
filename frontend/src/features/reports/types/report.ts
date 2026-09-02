/** One row from `/api/reports/tickets/volume/`. Mirrors
 * `apps/reports/aggregation.py::bucketed_counts` output. `bucket` is a
 * `YYYY-MM-DD` CALENDAR DATE, not an instant — always format it with
 * `{ timeZone: 'UTC' }`, or it renders as the previous day west of
 * Greenwich. See Story 56 `## Prerequisites`. */
export type VolumePoint = {
  bucket: string
  value: number
  /** Present only when `?series=` was sent. */
  series?: string
}

/** One row from `/api/reports/tickets/breakdown/`. Mirrors
 * `grouped_counts` output — already sorted descending server-side. */
export type BreakdownRow = {
  key: string
  value: number
}

/** The dimensions both endpoints accept, mirroring
 * `apps/reports/tickets.py::DIMENSION_FIELDS`. Re-declared here rather
 * than imported from `features/tickets`: `no-restricted-imports`
 * (`.oxlintrc.json`) forbids the cross-feature import, the same boundary
 * `features/tickets/types/ticket.ts:10` and CONVENTIONS.md line 1668
 * already document for duplicated enums. */
export const REPORT_DIMENSIONS = [
  'status',
  'priority',
  'category',
  'channel',
  'department',
] as const
export type ReportDimension = (typeof REPORT_DIMENSIONS)[number]
