import { api } from '@/shared/lib/api/client'

import type { DuplicateCandidate } from '../types/duplicateCandidate'

export function getDuplicateCandidates(ticketId: number): Promise<DuplicateCandidate[]> {
  return api.get<DuplicateCandidate[]>(`/tickets/${ticketId}/duplicate-candidates/`)
}
