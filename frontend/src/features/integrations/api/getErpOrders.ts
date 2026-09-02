import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { ErpOrder } from '../types/erp'

export type ErpOrderListParams = ServerTableParams & {
  customer?: number
}

export function getErpOrders(params: ErpOrderListParams): Promise<Page<ErpOrder>> {
  return api.getPage<ErpOrder>('/erp/orders/', { params })
}
