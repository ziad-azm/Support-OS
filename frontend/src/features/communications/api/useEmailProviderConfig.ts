import { useQuery } from '@tanstack/react-query'

import { getEmailProviderConfig } from './getEmailProviderConfig'
import { providersKeys } from './providersKeys'

export function useEmailProviderConfig() {
  return useQuery({
    queryKey: providersKeys.resource('email'),
    queryFn: getEmailProviderConfig,
  })
}
