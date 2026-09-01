import { api } from '@/shared/lib/api/client'

export type ConfirmPasswordResetInput = { token: string; password: string }

export function confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
  return api.post<void>('/auth/password-reset/confirm/', input)
}
