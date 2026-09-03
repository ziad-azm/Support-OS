import { useMutation, useQueryClient } from '@tanstack/react-query'

import { brandingKeys } from '@/shared/branding/brandingKeys'

import { updateSettings } from './updateSettings'
import { settingsKeys } from './settingsKeys'
import type { SettingsInput } from '../types/settings'

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SettingsInput) => updateSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      // Branding (name/logo_url/primary_color) is a subset of this same
      // row, served publicly through a separate endpoint/cache key — ORG-3.
      // Without this, an admin saves a new brand colour and the running
      // app keeps the old one until a reload.
      queryClient.invalidateQueries({ queryKey: brandingKeys.all })
    },
  })
}
