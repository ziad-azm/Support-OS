import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateSmsProviderConfig } from './updateSmsProviderConfig'
import { providersKeys } from './providersKeys'
import type { SmsProviderConfigInput } from '../types/providers'

export function useUpdateSmsProviderConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SmsProviderConfigInput) => updateSmsProviderConfig(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providersKeys.all }),
  })
}
