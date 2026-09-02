import { useMutation, useQueryClient } from '@tanstack/react-query'

import { triggerErpSync } from './triggerErpSync'
import { erpKeys } from './erpKeys'
import type { SyncDirection } from '../types/erp'

export function useTriggerErpSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (direction: SyncDirection) => triggerErpSync(direction),
    // The run itself happens on a worker, so there is nothing new to read
    // yet — but the history table's "no run row exists" state changes to
    // "the last run is now queued/running" once the worker picks it up.
    // Invalidating here means the next poll/refetch of `erpKeys.all`
    // (the sync-runs list included) reflects that as soon as it happens.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: erpKeys.all }),
  })
}
