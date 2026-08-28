import { api } from '@/shared/lib/api/client'

import type { SearchResult } from '../types/searchResult'

// Not `api.getPage` — the endpoint returns a plain, capped, unpaginated
// array (`Response(search_knowledge_base(...))`), not a DRF-paginated
// queryset. See Story 41 `## Prerequisites`.
export function getSearchResults(query: string): Promise<SearchResult[]> {
  return api.get<SearchResult[]>('/search/', { params: { q: query } })
}
