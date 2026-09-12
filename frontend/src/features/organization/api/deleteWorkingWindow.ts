import { api } from '@/shared/lib/api/client'

export function deleteWorkingWindow(id: number): Promise<void> {
  return api.delete(`/working-windows/${id}/`)
}
