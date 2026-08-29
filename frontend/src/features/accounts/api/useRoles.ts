import { useQuery } from '@tanstack/react-query'

import { getRoles } from './getRoles'
import type { RoleListParams } from './getRoles'
import { roleKeys } from './roleKeys'

export function useRoles(params: RoleListParams) {
  return useQuery({
    queryKey: roleKeys.resource('list', params),
    queryFn: () => getRoles(params),
  })
}
