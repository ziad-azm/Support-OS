import { useQuery } from '@tanstack/react-query'

import { getSearchResults } from './getSearchResults'
import { searchKeys } from './searchKeys'

// Mirrors the backend's own `len(query) < 2` guard (apps/knowledge_base/views.py)
// so the UI never fires a request the server would just reject — a UX
// nicety, not the enforcement point (CONVENTIONS.md §12).
const MIN_QUERY_LENGTH = 2

export function useSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: searchKeys.resource('results', trimmed),
    queryFn: () => getSearchResults(trimmed),
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
  })
}
