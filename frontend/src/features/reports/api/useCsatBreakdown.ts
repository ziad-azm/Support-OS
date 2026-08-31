import { useQuery } from '@tanstack/react-query'

import { getCsatBreakdown } from './getCsatBreakdown'
import type { CsatBreakdownParams } from './getCsatBreakdown'
import { reportKeys } from './reportKeys'

export function useCsatBreakdown(params: CsatBreakdownParams) {
  return useQuery({
    queryKey: reportKeys.resource('csat-breakdown', params),
    queryFn: () => getCsatBreakdown(params),
  })
}
