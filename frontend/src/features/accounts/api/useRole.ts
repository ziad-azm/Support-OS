import { useQuery } from '@tanstack/react-query'

import { getRole } from './getRole'
import { roleKeys } from './roleKeys'

export function useRole(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: roleKeys.resource('detail', id),
    queryFn: () => getRole(id),
    enabled: options?.enabled,
  })
}
