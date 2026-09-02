import { useQuery } from '@tanstack/react-query'

import { getSmsProviderConfig } from './getSmsProviderConfig'
import { providersKeys } from './providersKeys'

export function useSmsProviderConfig() {
  return useQuery({
    queryKey: providersKeys.resource('sms'),
    queryFn: getSmsProviderConfig,
  })
}
