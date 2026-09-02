import { api } from '@/shared/lib/api/client'

import type { ErpConnection } from '../types/erp'

export function getErpConnection(): Promise<ErpConnection> {
  return api.get<ErpConnection>('/erp/connection/')
}
