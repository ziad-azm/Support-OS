import { api } from '@/shared/lib/api/client'

import type { Branch, BranchInput } from '../types/branch'

// PATCH, not PUT — matches `updateDepartment.ts`.
export function updateBranch(id: number, input: BranchInput): Promise<Branch> {
  return api.patch<Branch>(`/branches/${id}/`, input)
}
