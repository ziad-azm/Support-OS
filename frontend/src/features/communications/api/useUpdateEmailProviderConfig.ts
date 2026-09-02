import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateEmailProviderConfig } from './updateEmailProviderConfig'
import { providersKeys } from './providersKeys'
import type { EmailProviderConfigInput } from '../types/providers'

export function useUpdateEmailProviderConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailProviderConfigInput) => updateEmailProviderConfig(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providersKeys.all }),
  })
}
