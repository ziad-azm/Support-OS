import { api } from '@/shared/lib/api/client'

export type DisableTwoFactorInput = { current_password: string }

export function disableTwoFactor(input: DisableTwoFactorInput): Promise<void> {
  return api.post<void>('/auth/2fa/disable/', input)
}
