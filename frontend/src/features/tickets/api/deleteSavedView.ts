import { api } from '@/shared/lib/api/client'

export function deleteSavedView(id: number): Promise<void> {
  return api.delete(`/saved-views/${id}/`)
}
