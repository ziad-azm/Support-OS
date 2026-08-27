import { useQuery } from '@tanstack/react-query'

import { getAssignableAgents } from './getAssignableAgents'
import { ticketKeys } from './ticketKeys'

export function useAssignableAgents() {
  return useQuery({
    queryKey: ticketKeys.resource('assignableAgents'),
    queryFn: getAssignableAgents,
  })
}
