import { api } from '@/shared/lib/api/client'

import type { Faq, FaqInput } from '../types/faq'

export function createFaq(input: FaqInput): Promise<Faq> {
  return api.post<Faq>('/faqs/', input)
}
