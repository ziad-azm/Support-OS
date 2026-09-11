import { api } from '@/shared/lib/api/client'

export type ConfirmTwoFactorInput = { code: string }
export type ConfirmTwoFactorResponse = { recovery_codes: string[] }

export function confirmTwoFactor(input: ConfirmTwoFactorInput): Promise<ConfirmTwoFactorResponse> {
  return api.post<ConfirmTwoFactorResponse>('/auth/2fa/confirm/', input)
}
