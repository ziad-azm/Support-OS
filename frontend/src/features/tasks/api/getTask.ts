import { api } from '@/shared/lib/api/client'

import type { Task } from '../types/task'

export function getTask(id: number): Promise<Task> {
  return api.get<Task>(`/tasks/${id}/`)
}
