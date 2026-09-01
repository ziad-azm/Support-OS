import { api } from '@/shared/lib/api/client'

export type ChangePasswordInput = { current_password: string; new_password: string }

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return api.post<void>('/auth/change-password/', input)
}
