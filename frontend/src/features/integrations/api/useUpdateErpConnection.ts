import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateErpConnection } from './updateErpConnection'
import { erpKeys } from './erpKeys'
import type { ErpConnectionInput } from '../types/erp'

export function useUpdateErpConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ErpConnectionInput) => updateErpConnection(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: erpKeys.all }),
  })
}
