import { api } from '@/shared/lib/api/client'

export function deleteNote(id: number): Promise<void> {
  return api.delete(`/notes/${id}/`)
}
