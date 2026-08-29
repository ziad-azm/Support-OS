import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateSettings } from './updateSettings'
import { settingsKeys } from './settingsKeys'
import type { SettingsInput } from '../types/settings'

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SettingsInput) => updateSettings(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  })
}
