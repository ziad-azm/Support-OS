import { api } from '@/shared/lib/api/client'

import type { EmailProviderConfig } from '../types/providers'

export function getEmailProviderConfig(): Promise<EmailProviderConfig> {
  return api.get<EmailProviderConfig>('/providers/email/')
}
