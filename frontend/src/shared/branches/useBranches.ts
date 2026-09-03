import { useQuery } from '@tanstack/react-query'

import { branchKeys } from './branchKeys'
import { getBranches } from './getBranches'

/** The picker/filter options query. Every consumer shares one cache
 * entry, and every write in `features/organization` invalidates it. */
export function useBranches() {
  return useQuery({
    queryKey: branchKeys.resource('options'),
    queryFn: getBranches,
  })
}
