import { useQuery } from '@tanstack/react-query'

import { getTicketVolume } from './getTicketVolume'
import type { TicketVolumeParams } from './getTicketVolume'
import { reportKeys } from './reportKeys'

export function useTicketVolume(params: TicketVolumeParams) {
  return useQuery({
    queryKey: reportKeys.resource('ticket-volume', params),
    queryFn: () => getTicketVolume(params),
  })
}
