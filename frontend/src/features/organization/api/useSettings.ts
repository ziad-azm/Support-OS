import { useQuery } from '@tanstack/react-query'

import { getSettings } from './getSettings'
import { settingsKeys } from './settingsKeys'

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.resource('detail'),
    queryFn: getSettings,
  })
}
