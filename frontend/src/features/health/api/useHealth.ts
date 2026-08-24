import { useQuery } from '@tanstack/react-query'

import { getHealth } from './getHealth'
import { healthKeys } from './healthKeys'

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.resource('status'),
    queryFn: getHealth,
  })
}
