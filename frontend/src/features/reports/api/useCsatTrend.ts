import { useQuery } from '@tanstack/react-query'

import { getCsatTrend } from './getCsatTrend'
import type { CsatTrendParams } from './getCsatTrend'
import { reportKeys } from './reportKeys'

export function useCsatTrend(params: CsatTrendParams) {
  return useQuery({
    queryKey: reportKeys.resource('csat-trend', params),
    queryFn: () => getCsatTrend(params),
  })
}
