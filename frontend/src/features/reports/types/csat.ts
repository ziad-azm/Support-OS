export const CSAT_RATINGS = ['satisfied', 'neutral', 'dissatisfied'] as const
export type CsatRating = (typeof CSAT_RATINGS)[number]

/** One row from `/api/reports/csat/trend/`. */
export type CsatTrendPoint = {
  bucket: string
  series: CsatRating
  value: number
}

/** One row from `/api/reports/csat/breakdown/`. Deliberately typed as
 * `{key, value}`, NOT `ChartCategory` — unlike RPT-3's agent rows, a
 * rating's `label` is a frontend-translatable enum (`ratings.satisfied`
 * etc.), so the backend sends no label and the frontend builds
 * `ChartCategory[]` itself, the same `labelForDimensionValue`-style
 * mapping RPT-1's breakdown page already does. */
export type CsatBreakdownRow = {
  key: CsatRating
  value: number
}
