import { api } from '@/shared/lib/api/client'

import type { Task } from '../types/task'

// No body — mirrors `markNotificationRead.ts` (Story 31), not
// `escalateTicket.ts` (which sends an explicit `{ escalated }`): there
// is only one direction to move `completed_at` from this endpoint.
export function completeTask(id: number): Promise<Task> {
  return api.post<Task>(`/tasks/${id}/complete/`)
}
