import { useQuery } from '@tanstack/react-query'

import { getTasks } from './getTasks'
import type { TaskListParams } from './getTasks'
import { taskKeys } from './taskKeys'

export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.resource('list', params),
    queryFn: () => getTasks(params),
  })
}
