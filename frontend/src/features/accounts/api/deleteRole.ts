import { api } from '@/shared/lib/api/client'

export function deleteRole(id: number): Promise<void> {
  return api.delete(`/roles/${id}/`)
}
