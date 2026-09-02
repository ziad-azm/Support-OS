import { api } from '@/shared/lib/api/client'

import type { PortalChatbotState } from '../types/portalChatbot'

/** Returns the FULL refreshed conversation state, including the bot's
 * reply — the caller replaces its state wholesale, no merging. */
export function sendPortalChatbotMessage(body: string): Promise<PortalChatbotState> {
  return api.post<PortalChatbotState>('/portal/chatbot/', { body })
}
