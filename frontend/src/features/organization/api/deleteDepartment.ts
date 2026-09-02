import { api } from '@/shared/lib/api/client'

export function deleteDepartment(id: number): Promise<void> {
  return api.delete(`/departments/${id}/`)
}
