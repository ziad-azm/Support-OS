import { api } from '@/shared/lib/api/client'

import type { PortalFeedbackCreated, PortalFeedbackInput } from '../types/portalFeedback'

export function createPortalFeedback(input: PortalFeedbackInput): Promise<PortalFeedbackCreated> {
  return api.post<PortalFeedbackCreated>('/portal/feedback/', input)
}
