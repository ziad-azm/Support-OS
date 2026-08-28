import { api } from '@/shared/lib/api/client'

export function deleteTask(id: number): Promise<void> {
  return api.delete(`/tasks/${id}/`)
}
