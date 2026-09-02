import { api } from '@/shared/lib/api/client'

import type { PortalChatbotState } from '../types/portalChatbot'

export function handOffPortalChatbot(): Promise<PortalChatbotState> {
  return api.post<PortalChatbotState>('/portal/chatbot/handoff/')
}
