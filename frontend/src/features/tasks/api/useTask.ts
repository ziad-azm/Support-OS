import { useQuery } from '@tanstack/react-query'

import { getTask } from './getTask'
import { taskKeys } from './taskKeys'

export function useTask(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.resource('detail', id),
    queryFn: () => getTask(id),
    enabled: options?.enabled,
  })
}
