import { api } from '@/shared/lib/api/client'

import type { SavedView, SavedViewRenameInput } from '../types/savedView'

// PATCH, not PUT — matches updateCategory.ts.
export function updateSavedView(id: number, input: SavedViewRenameInput): Promise<SavedView> {
  return api.patch<SavedView>(`/saved-views/${id}/`, input)
}
