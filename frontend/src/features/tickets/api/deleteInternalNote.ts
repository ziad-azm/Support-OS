import { api } from '@/shared/lib/api/client'

export function deleteInternalNote(id: number): Promise<void> {
  return api.delete(`/internal-notes/${id}/`)
}
