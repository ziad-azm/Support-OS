import { useQuery } from '@tanstack/react-query'

import { getSlaTrend } from './getSlaTrend'
import type { SlaTrendParams } from './getSlaTrend'
import { reportKeys } from './reportKeys'

export function useSlaTrend(params: SlaTrendParams) {
  return useQuery({
    queryKey: reportKeys.resource('sla-trend', params),
    queryFn: () => getSlaTrend(params),
  })
}
