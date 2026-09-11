import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { SavedView } from '../types/savedView'

// page_size: 100 — the server's max, the same simplification getCategories.ts
// already accepted; a caller's own views plus every shared one is not
// expected to approach that in practice.
export function getSavedViews(): Promise<Page<SavedView>> {
  return api.getPage<SavedView>('/saved-views/', { params: { page_size: 100, ordering: 'name' } })
}
