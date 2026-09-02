import { useQuery } from '@tanstack/react-query'

import { getErpSyncRuns } from './getErpSyncRuns'
import type { ErpSyncRunListParams } from './getErpSyncRuns'
import { erpKeys } from './erpKeys'

export function useErpSyncRuns(params: ErpSyncRunListParams) {
  return useQuery({
    queryKey: erpKeys.resource('sync-runs', params),
    queryFn: () => getErpSyncRuns(params),
  })
}
