import { useQuery } from '@tanstack/react-query'

import { getMessages } from './getMessages'
import { ticketKeys } from './ticketKeys'

export function useMessages(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('messages', ticketId),
    queryFn: () => getMessages(ticketId),
  })
}
