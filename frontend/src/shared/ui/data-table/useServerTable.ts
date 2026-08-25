import { useCallback, useMemo, useState } from 'react'

import type { SortState } from './types'

/** Query params for a paginated list endpoint. Wire keys are snake_case. */
export type ServerTableParams = {
  page: number
  page_size?: number
  ordering?: string
}

/**
 * Pagination and sort state for a list screen, plus the params object to feed
 * a query key and `api.getPage`.
 *
 * Sorting is server-side: `ordering` follows DRF's OrderingFilter convention
 * (`field` ascending, `-field` descending). See CONVENTIONS.md §19.
 */
export function useServerTable(options?: { pageSize?: number; initialSort?: SortState }) {
  const [page, setPage] = useState(1)
  const [sort, setSortState] = useState<SortState>(options?.initialSort ?? null)
  const pageSize = options?.pageSize

  // Changing the sort re-orders the whole result set, so page 2 of the old
  // order is meaningless. Reset, or the user lands on an unrelated page.
  const setSort = useCallback((next: SortState) => {
    setSortState(next)
    setPage(1)
  }, [])

  const params = useMemo<ServerTableParams>(
    () => ({
      page,
      ...(pageSize ? { page_size: pageSize } : {}),
      ...(sort ? { ordering: `${sort.direction === 'desc' ? '-' : ''}${sort.field}` } : {}),
    }),
    [page, sort, pageSize],
  )

  return { page, sort, params, setPage, setSort }
}
