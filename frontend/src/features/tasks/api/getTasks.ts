import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Task } from '../types/task'

export type TaskListParams = ServerTableParams & {
  completed?: 'true' | 'false'
}

export function getTasks(params: TaskListParams): Promise<Page<Task>> {
  return api.getPage<Task>('/tasks/', { params })
}
