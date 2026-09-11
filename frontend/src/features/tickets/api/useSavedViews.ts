import { useQuery } from '@tanstack/react-query'

import { getSavedViews } from './getSavedViews'
import { ticketKeys } from './ticketKeys'

export function useSavedViews() {
  return useQuery({
    queryKey: ticketKeys.resource('saved-views'),
    queryFn: getSavedViews,
  })
}
