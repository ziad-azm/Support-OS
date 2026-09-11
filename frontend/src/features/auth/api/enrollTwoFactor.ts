import { api } from '@/shared/lib/api/client'

export type EnrollTwoFactorResponse = { secret: string; provisioning_uri: string }

export function enrollTwoFactor(): Promise<EnrollTwoFactorResponse> {
  return api.post<EnrollTwoFactorResponse>('/auth/2fa/enroll/', {})
}
