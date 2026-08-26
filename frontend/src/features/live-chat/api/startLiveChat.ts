import { api } from '@/shared/lib/api/client'

export type StartLiveChatInput = { name: string; email?: string }
type StartLiveChatResponse = { ticket_id: number; session_token: string }

export function startLiveChat(input: StartLiveChatInput): Promise<StartLiveChatResponse> {
  return api.post<StartLiveChatResponse>('/live-chat/start/', input)
}
