import { api } from '@/shared/lib/api/client'

export function deleteBranch(id: number): Promise<void> {
  return api.delete(`/branches/${id}/`)
}
