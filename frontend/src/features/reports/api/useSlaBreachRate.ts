import { useQuery } from '@tanstack/react-query'

import { getSlaBreachRate } from './getSlaBreachRate'
import type { SlaBreachRateParams } from './getSlaBreachRate'
import { reportKeys } from './reportKeys'

export function useSlaBreachRate(params: SlaBreachRateParams) {
  return useQuery({
    queryKey: reportKeys.resource('sla-breach-rate', params),
    queryFn: () => getSlaBreachRate(params),
  })
}
