import { api } from '@/shared/lib/api/client'

import type { ErpConnection, ErpConnectionInput } from '../types/erp'

export function updateErpConnection(input: ErpConnectionInput): Promise<ErpConnection> {
  return api.patch<ErpConnection>('/erp/connection/', input)
}
