import { api } from '@/shared/lib/api/client'

import type { SavedView, SavedViewInput } from '../types/savedView'

export function createSavedView(input: SavedViewInput): Promise<SavedView> {
  return api.post<SavedView>('/saved-views/', input)
}
