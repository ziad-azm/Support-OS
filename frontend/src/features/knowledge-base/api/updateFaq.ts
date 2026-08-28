import { api } from '@/shared/lib/api/client'

import type { Faq, FaqInput } from '../types/faq'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateFaq(id: number, input: FaqInput): Promise<Faq> {
  return api.patch<Faq>(`/faqs/${id}/`, input)
}
