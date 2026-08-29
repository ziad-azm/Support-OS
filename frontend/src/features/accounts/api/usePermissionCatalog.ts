import { useQuery } from '@tanstack/react-query'

import { getPermissionCatalog } from './getPermissionCatalog'
import { roleKeys } from './roleKeys'

// Cached under `roleKeys`, not a new key prefix: the catalog exists only to
// serve `RoleFormPage`'s checklist, the same reasoning
// `useAssignableAgents` caches under `ticketKeys` for a lookup that is
// really about users.
export function usePermissionCatalog() {
  return useQuery({
    queryKey: roleKeys.resource('catalog'),
    queryFn: getPermissionCatalog,
  })
}
