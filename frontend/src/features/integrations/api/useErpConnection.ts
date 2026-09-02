import { useQuery } from '@tanstack/react-query'

import { getErpConnection } from './getErpConnection'
import { erpKeys } from './erpKeys'

export function useErpConnection() {
  return useQuery({
    queryKey: erpKeys.resource('connection'),
    queryFn: getErpConnection,
  })
}
