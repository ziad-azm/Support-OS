import { api } from '@/shared/lib/api/client'

import type { Task, TaskInput } from '../types/task'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateTask(id: number, input: TaskInput): Promise<Task> {
  return api.patch<Task>(`/tasks/${id}/`, input)
}
