import { useQuery } from '@tanstack/react-query'

import { getQuickReplies } from './getQuickReplies'
import { ticketKeys } from './ticketKeys'

export function useQuickReplies() {
  return useQuery({
    queryKey: ticketKeys.resource('quickReplies'),
    queryFn: getQuickReplies,
  })
}
