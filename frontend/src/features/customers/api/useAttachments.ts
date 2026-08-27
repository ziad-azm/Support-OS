import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getAttachments } from './getAttachments'

export function useAttachments(customerId: number) {
  return useQuery({
    queryKey: customerKeys.resource('attachments', customerId),
    queryFn: () => getAttachments(customerId),
  })
}
