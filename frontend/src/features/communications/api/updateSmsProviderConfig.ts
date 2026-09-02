import { api } from '@/shared/lib/api/client'

import type { SmsProviderConfig, SmsProviderConfigInput } from '../types/providers'

export function updateSmsProviderConfig(input: SmsProviderConfigInput): Promise<SmsProviderConfig> {
  return api.patch<SmsProviderConfig>('/providers/sms/', input)
}
