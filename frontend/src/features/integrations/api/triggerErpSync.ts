import { api } from '@/shared/lib/api/client'

import type { SyncDirection } from '../types/erp'

export function triggerErpSync(direction: SyncDirection): Promise<void> {
  return api.post<void>('/erp/sync/', { direction })
}
