import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateWhatsAppProviderConfig } from './updateWhatsAppProviderConfig'
import { providersKeys } from './providersKeys'
import type { WhatsAppProviderConfigInput } from '../types/providers'

export function useUpdateWhatsAppProviderConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WhatsAppProviderConfigInput) => updateWhatsAppProviderConfig(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providersKeys.all }),
  })
}
