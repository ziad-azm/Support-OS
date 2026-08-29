import { api } from '@/shared/lib/api/client'

import type { OrganizationSettings } from '../types/settings'

export function getSettings(): Promise<OrganizationSettings> {
  return api.get<OrganizationSettings>('/settings/')
}
