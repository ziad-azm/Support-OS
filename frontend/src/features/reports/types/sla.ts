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
  rate: number | null
}
