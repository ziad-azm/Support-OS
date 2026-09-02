/** Mirrors `apps.portal.views._chatbot_state`'s shape verbatim. */
export const CHATBOT_AUTHORS = ['customer', 'bot', 'agent'] as const
export type ChatbotAuthor = (typeof CHATBOT_AUTHORS)[number]

export type PortalChatbotMessage = {
  id: number
  author: ChatbotAuthor
  body: string
  created_at: string
}

export type PortalChatbotState = {
  ticket: number
  handed_off: boolean
  messages: PortalChatbotMessage[]
}
