import { api } from '@/shared/lib/api/client'

import type { SmsProviderConfig } from '../types/providers'

export function getSmsProviderConfig(): Promise<SmsProviderConfig> {
  return api.get<SmsProviderConfig>('/providers/sms/')
}
