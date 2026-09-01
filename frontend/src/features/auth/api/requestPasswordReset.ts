import { api } from '@/shared/lib/api/client'

export type RequestPasswordResetInput = { email: string }

export function requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
  return api.post<void>('/auth/password-reset/request/', input)
}
