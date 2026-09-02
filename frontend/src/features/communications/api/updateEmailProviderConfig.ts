import { api } from '@/shared/lib/api/client'

import type { EmailProviderConfig, EmailProviderConfigInput } from '../types/providers'

export function updateEmailProviderConfig(
  input: EmailProviderConfigInput,
): Promise<EmailProviderConfig> {
  return api.patch<EmailProviderConfig>('/providers/email/', input)
}
