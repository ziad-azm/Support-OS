import { api } from '@/shared/lib/api/client'

import type { Faq } from '../types/faq'

export function getFaq(id: number): Promise<Faq> {
  return api.get<Faq>(`/faqs/${id}/`)
}
