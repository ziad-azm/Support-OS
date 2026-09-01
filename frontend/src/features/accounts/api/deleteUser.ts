import { api } from '@/shared/lib/api/client'

export function deleteUser(id: number): Promise<void> {
  return api.delete(`/users/${id}/`)
}
