import { api } from '@/shared/lib/api/client'

import type { WhatsAppProviderConfig, WhatsAppProviderConfigInput } from '../types/providers'

export function updateWhatsAppProviderConfig(
  input: WhatsAppProviderConfigInput,
): Promise<WhatsAppProviderConfig> {
  return api.patch<WhatsAppProviderConfig>('/providers/whatsapp/', input)
}
