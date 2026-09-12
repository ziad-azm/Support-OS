import { useQuery } from '@tanstack/react-query'

import { getDuplicateCandidates } from './getDuplicateCandidates'
import { ticketKeys } from './ticketKeys'

export function useDuplicateCandidates(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('duplicate-candidates', ticketId),
    queryFn: () => getDuplicateCandidates(ticketId),
  })
}
