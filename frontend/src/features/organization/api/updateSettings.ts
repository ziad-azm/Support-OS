import { api } from '@/shared/lib/api/client'

import type { OrganizationSettings, SettingsInput } from '../types/settings'

export function updateSettings(input: SettingsInput): Promise<OrganizationSettings> {
  return api.patch<OrganizationSettings>('/settings/', input)
}
