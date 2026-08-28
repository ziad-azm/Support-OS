import { useQuery } from '@tanstack/react-query'

import { getInternalNotes } from './getInternalNotes'
import { ticketKeys } from './ticketKeys'

export function useInternalNotes(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('internalNotes', ticketId),
    queryFn: () => getInternalNotes(ticketId),
  })
}
