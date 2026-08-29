import { useQuery } from '@tanstack/react-query'

import { getUser } from './getUser'
import { userKeys } from './userKeys'

/**
 * `enabled` lets a caller with a not-yet-numeric route param skip the
 * request entirely rather than firing one against a malformed URL. Defaults
 * to enabled, like `useQuery` itself.
 */
export function useUser(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.resource('detail', id),
    queryFn: () => getUser(id),
    enabled: options?.enabled,
  })
}
