/** One row from `/api/reports/sla/trend/`. `series` is always
 * `'response'` or `'resolution'` — not a `ReportDimension`, a fixed pair. */
export type SlaTrendPoint = {
  bucket: string
  series: 'response' | 'resolution'
  value: number
}

/** One row from `/api/reports/sla/breach-rate/`. `rate` is `null` when
 * `met + breached === 0` (nothing past its deadline yet). */
export type SlaBreachRateRow = {
  key: 'response' | 'resolution'
  met: number
  breached: number
  pending: number
  /** SLA-6 (Story 112): tickets currently `pending_customer` — excluded
   * from `rate`'s denominator, the same as `pending`. */
  paused: number
  rate: number | null
}
