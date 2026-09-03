import { api } from '@/shared/lib/api/client'

import type { Branch } from '../types/branch'

export function getBranch(id: number): Promise<Branch> {
  return api.get<Branch>(`/branches/${id}/`)
}
