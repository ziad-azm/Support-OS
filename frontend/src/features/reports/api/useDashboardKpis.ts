import { useQuery } from '@tanstack/react-query'

import { getDashboardKpis } from './getDashboardKpis'
import type { DashboardKpiParams } from './getDashboardKpis'
import { reportKeys } from './reportKeys'

export function useDashboardKpis(params: DashboardKpiParams) {
  return useQuery({
    queryKey: reportKeys.resource('dashboard-kpis', params),
    queryFn: () => getDashboardKpis(params),
  })
}
