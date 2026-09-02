import { api } from '@/shared/lib/api/client'

import type { PortalChatbotState } from '../types/portalChatbot'

/** `GET` starts the conversation if the customer has none open yet —
 * the backend's `get_or_start_session` is find-or-create. */
export function getPortalChatbot(): Promise<PortalChatbotState> {
  return api.get<PortalChatbotState>('/portal/chatbot/')
}
