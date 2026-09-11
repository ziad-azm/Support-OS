import { api } from '@/shared/lib/api/client'

import type { SavedView } from '../types/savedView'

export function setDefaultSavedView(id: number, isDefault: boolean): Promise<SavedView> {
  return api.post<SavedView>(`/saved-views/${id}/set-default/`, { is_default: isDefault })
}
