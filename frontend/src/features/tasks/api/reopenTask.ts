import { api } from '@/shared/lib/api/client'

import type { Task } from '../types/task'

export function reopenTask(id: number): Promise<Task> {
  return api.post<Task>(`/tasks/${id}/reopen/`)
}
