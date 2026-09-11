/** Mirrors the `{"results": [...]}` shape every `apps.tickets.bulk`-backed
 * action returns — one row per requested ticket id, `error` present only
 * when `ok` is false. See Story 106 `## Prerequisites`. */
export type BulkActionResultRow = {
  id: number
  ok: boolean
  error?: string
}

export type BulkActionResult = {
  results: BulkActionResultRow[]
}
