import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getNotes } from './getNotes'

export function useNotes(customerId: number) {
  return useQuery({
    queryKey: customerKeys.resource('notes', customerId),
    queryFn: () => getNotes(customerId),
  })
}
