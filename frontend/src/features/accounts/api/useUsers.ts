import { useQuery } from '@tanstack/react-query'

import { getUsers } from './getUsers'
import type { UserListParams } from './getUsers'
import { userKeys } from './userKeys'

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.resource('list', params),
    queryFn: () => getUsers(params),
  })
}
