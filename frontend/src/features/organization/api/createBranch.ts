import { api } from '@/shared/lib/api/client'

import type { Branch, BranchInput } from '../types/branch'

export function createBranch(input: BranchInput): Promise<Branch> {
  return api.post<Branch>('/branches/', input)
}
