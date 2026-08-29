import { api } from '@/shared/lib/api/client'

import type { PortalArticle } from '../types/portalArticle'

export function getPortalArticle(id: number): Promise<PortalArticle> {
  return api.get<PortalArticle>(`/articles/${id}/`)
}
