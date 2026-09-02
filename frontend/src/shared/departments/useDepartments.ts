import { useQuery } from '@tanstack/react-query'

import { departmentKeys } from './departmentKeys'
import { getDepartments } from './getDepartments'

/** The picker/filter options query. Every consumer shares one cache
 * entry, and every write in `features/organization` invalidates it. */
export function useDepartments() {
  return useQuery({
    queryKey: departmentKeys.resource('options'),
    queryFn: getDepartments,
  })
}
