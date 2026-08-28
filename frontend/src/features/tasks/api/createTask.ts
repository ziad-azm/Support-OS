import { api } from '@/shared/lib/api/client'

import type { Task, TaskInput } from '../types/task'

export function createTask(input: TaskInput): Promise<Task> {
  return api.post<Task>('/tasks/', input)
}
