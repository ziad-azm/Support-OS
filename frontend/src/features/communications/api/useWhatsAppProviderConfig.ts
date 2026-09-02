import { useQuery } from '@tanstack/react-query'

import { getWhatsAppProviderConfig } from './getWhatsAppProviderConfig'
import { providersKeys } from './providersKeys'

export function useWhatsAppProviderConfig() {
  return useQuery({
    queryKey: providersKeys.resource('whatsapp'),
    queryFn: getWhatsAppProviderConfig,
  })
}
