import { useQuery } from '@tanstack/react-query'

import { getErpOrders } from './getErpOrders'
import type { ErpOrderListParams } from './getErpOrders'
import { erpKeys } from './erpKeys'

export function useErpOrders(params: ErpOrderListParams) {
  return useQuery({
    queryKey: erpKeys.resource('orders', params),
    queryFn: () => getErpOrders(params),
  })
}
