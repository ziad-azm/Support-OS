import { api } from '@/shared/lib/api/client'

export function resetTwoFactor(id: number): Promise<void> {
  return api.post<void>(`/users/${id}/reset-2fa/`, {})
}
