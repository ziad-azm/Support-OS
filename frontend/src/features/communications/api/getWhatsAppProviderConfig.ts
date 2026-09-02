import { api } from '@/shared/lib/api/client'

import type { WhatsAppProviderConfig } from '../types/providers'

export function getWhatsAppProviderConfig(): Promise<WhatsAppProviderConfig> {
  return api.get<WhatsAppProviderConfig>('/providers/whatsapp/')
}
